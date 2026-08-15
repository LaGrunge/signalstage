import { Router } from "express";
import axios from "axios";
import { pool } from "./db.js";
import { optionalAuth } from "./auth.js";
import { getRoomAccess } from "./roomAccess.js";

// judge0/Dockerfile builds this deployment's own Judge0 image (Ubuntu 26.04,
// not upstream's Debian-buster judge0/compilers) and bakes these language
// definitions into db/seeds.rb itself, not upstream Judge0 CE's defaults -
// verify against this instance's own GET /languages if you change either.
// Judge0's own defaults are 1.5GB / 5s CPU / 10s wall (judge0.conf's
// MEMORY_LIMIT, CPU_TIME_LIMIT, WALL_TIME_LIMIT); anything below overrides
// them per language, within judge0.conf's MAX_* ceilings (4GB / 30s / 30s).
// Note this deployment runs isolate on rlimits, not cgroups (see README's
// sandbox section), so memory_limit is RLIMIT_AS - address space, not RSS -
// and a process's own binary/libstdc++/stack eat ~60MB of it before main().
export const LANGUAGES = [
  // Sized around the shared "query" template (a deliberately naive
  // SQL-engine exercise). It needs ~1.7GB just to build its 3M-row dataset -
  // 3M heap-allocated 511-char keys - so under Judge0's 1.5GB default it
  // died with bad_alloc inside fillData(), before the candidate's own code
  // mattered at all.
  //
  // The template as shipped still cannot finish, and that is deliberate:
  // measured unoptimised (Judge0 compiles without -O), its brute-force
  // nested loop is ~4:50 wall and peaks at ~8.5GB, because it materialises
  // up to 3M joined rows that each copy a 511-char key. No setting under
  // judge0.conf's ceilings (4GB / 30s) would let that through, and raising
  // those to fit would hand one submission half the box for five minutes.
  //
  // 3GB is chosen to sit above what a *correct* solution needs (~1.7-2GB:
  // hash-join and aggregate on the fly, never materialising the join) and
  // below what the naive one does. So the wall a candidate hits now tells
  // them something - don't materialise the intermediate result - instead of
  // being a sandbox limit they can't reason about.
  { key: "cpp", label: "C++ (GCC 15, C++26)", judge0Id: 54, memoryLimit: 3145728, cpuTimeLimit: 15, wallTimeLimit: 20 },
  { key: "python", label: "Python (3.14)", judge0Id: 71 },
  { key: "go", label: "Go (1.26)", judge0Id: 60 },
  { key: "java", label: "Java (OpenJDK 25)", judge0Id: 62 },
  { key: "bash", label: "Bash (5.3)", judge0Id: 46 },
  // mariadb-install-db + mariadbd startup inside the sandbox needs several
  // seconds on top of actual query time - give it more wall-clock room than
  // the other languages (default 10s, judge0.conf's MAX_WALL_TIME_LIMIT=30).
  // maxFileSize: InnoDB's initial datadir (ibdata1 + redo logs) lands around
  // 140MB even for a fresh, empty instance - the default 20MB quota (sized
  // for the other languages' build artifacts) makes mariadb-install-db die
  // with "File size limit exceeded" before it ever gets to run a query.
  { key: "mariadb", label: "MariaDB (11.8)", judge0Id: 90, wallTimeLimit: 25, maxFileSize: 256000 },
];

const LANGUAGE_BY_KEY = Object.fromEntries(LANGUAGES.map((l) => [l.key, l]));

// Separate Judge0 language ids used only by the problem-tests pipeline
// (server/src/testHarness/*.js, server/src/testRunner.js) - never exposed
// via GET /languages. Compiling/running a GoogleTest or JUnit binary is a
// fundamentally different command line than running a candidate's program
// directly, so these are distinct ids (91/92/93) from the plain-execution
// ones above, seeded in judge0/Dockerfile. Python (71) and Bash (46) need
// no separate entry - see that Dockerfile's comment for why.
export const TEST_LANGUAGES = {
  python: { judge0Id: 71 },
  go: {
    judge0Id: 92,
    // `go test` with a cold GOCACHE compiles a surprising amount of the
    // standard library from scratch (testing/fmt's own transitive deps) -
    // found by actually submitting through Judge0, not by reasoning about
    // it: the default wall time limit wasn't enough even after fixing the
    // "too many open files" issue (judge0/Dockerfile's `-p 1` comment) by
    // serializing the build, which makes it slower still.
    wallTimeLimit: 15,
  },
  // Same headroom as plain C++ execution above - a test harness runs the
  // candidate's code, so it hits the same walls.
  cpp: { judge0Id: 91, memoryLimit: 3145728, cpuTimeLimit: 15, wallTimeLimit: 20 },
  java: { judge0Id: 93 },
  bash: { judge0Id: 46 },
};

// Must exceed the longest wallTimeLimit above (MariaDB's 25s) with real
// headroom - Judge0 itself waits up to that long server-side under
// wait=true, and an axios timeout shorter than that aborts genuinely slow
// (but successful) runs before Judge0 ever gets to respond.
const judge0 = axios.create({
  baseURL: process.env.JUDGE0_URL || "http://judge0-server:2358",
  timeout: 35_000,
  headers: process.env.JUDGE0_AUTH_TOKEN
    ? { [process.env.JUDGE0_AUTH_HEADER || "X-Judge0-Token"]: process.env.JUDGE0_AUTH_TOKEN }
    : {},
});

const b64 = (s) => Buffer.from(s ?? "", "utf8").toString("base64");
const unb64 = (s) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

// Shared by plain /execute and the test-runner (server/src/testRunner.js) -
// same Judge0 submission shape either way, the only difference is what
// source string gets submitted (the candidate's file as-is, vs. that file
// wrapped in a generated test-driver) and which judge0Id/limits apply.
export async function submitToJudge0Raw(lang, sourceCode, stdin) {
  const { data } = await judge0.post(
    "/submissions",
    {
      source_code: b64(sourceCode),
      language_id: lang.judge0Id,
      stdin: b64(stdin || ""),
      ...(lang.wallTimeLimit ? { wall_time_limit: lang.wallTimeLimit } : {}),
      ...(lang.cpuTimeLimit ? { cpu_time_limit: lang.cpuTimeLimit } : {}),
      ...(lang.memoryLimit ? { memory_limit: lang.memoryLimit } : {}),
      ...(lang.maxFileSize ? { max_file_size: lang.maxFileSize } : {}),
    },
    { params: { base64_encoded: "true", wait: "true" } }
  );

  return {
    status: data.status,
    stdout: unb64(data.stdout),
    stderr: unb64(data.stderr),
    compileOutput: unb64(data.compile_output),
    message: unb64(data.message),
    time: data.time,
    memory: data.memory,
  };
}

export async function submitToJudge0(languageKey, sourceCode, stdin) {
  const lang = LANGUAGE_BY_KEY[languageKey];
  if (!lang) throw new Error(`unsupported language: ${languageKey}`);
  return submitToJudge0Raw(lang, sourceCode, stdin);
}

export const router = Router();

router.get("/languages", (_req, res) => {
  res.json(LANGUAGES.map(({ key, label }) => ({ key, label })));
});

router.post("/execute", optionalAuth, async (req, res) => {
  const { roomId, language, code, stdin, submittedBy } = req.body || {};

  const access = await getRoomAccess(roomId, req.user?.sub);
  if (!access) {
    return res.status(404).json({ error: "room not found" });
  }
  // The "Disable candidate run" toggle only needs to bind non-owners - the
  // interviewer who owns this room can always run, same as before the
  // toggle existed.
  if (!access.isOwner && !access.room.run_enabled) {
    return res.status(403).json({ error: "run disabled by interviewer" });
  }
  if (!LANGUAGE_BY_KEY[language]) {
    return res.status(400).json({ error: `unsupported language: ${language}` });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const result = await submitToJudge0(language, code, stdin);

    // Every attempt, not just successful ones - the version history panel is
    // most useful for showing an interviewer exactly what a candidate tried
    // right before it failed.
    await pool.query(
      `INSERT INTO submissions (room_id, language, code, stdin, status, stdout, stderr, compile_output, submitted_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        roomId,
        language,
        code,
        stdin || "",
        result.status?.description || null,
        result.stdout,
        result.stderr,
        result.compileOutput,
        submittedBy || "Anonymous",
      ]
    );

    res.json(result);
  } catch (err) {
    console.error("judge0 execute failed:", err.response?.data || err.message);
    res.status(502).json({ error: "code execution backend unavailable" });
  }
});

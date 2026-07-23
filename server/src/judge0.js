import { Router } from "express";
import axios from "axios";
import { roomExists } from "./db.js";

// judge0/Dockerfile builds this deployment's own Judge0 image (Ubuntu 26.04,
// not upstream's Debian-buster judge0/compilers), so these ids/versions are
// specific to judge0/fixups.sql, not upstream Judge0 CE's defaults - verify
// against this instance's own GET /languages if you change either.
export const LANGUAGES = [
  { key: "cpp", label: "C++ (GCC 15, C++23)", judge0Id: 54 },
  { key: "python", label: "Python (3.14)", judge0Id: 71 },
  { key: "go", label: "Go (1.26)", judge0Id: 60 },
  { key: "java", label: "Java (OpenJDK 25)", judge0Id: 62 },
  { key: "bash", label: "Bash (5.3)", judge0Id: 46 },
  // mariadbd needs ~1-2s to initialize + start inside the sandbox on top of
  // actual query time - give it more wall-clock room than the other
  // languages (default 10s) rather than raising it globally in judge0.conf.
  { key: "mariadb", label: "MariaDB (11.8)", judge0Id: 90, wallTimeLimit: 15 },
];

const LANGUAGE_BY_KEY = Object.fromEntries(LANGUAGES.map((l) => [l.key, l]));

const judge0 = axios.create({
  baseURL: process.env.JUDGE0_URL || "http://judge0-server:2358",
  timeout: 20_000,
  headers: process.env.JUDGE0_AUTH_TOKEN
    ? { [process.env.JUDGE0_AUTH_HEADER || "X-Judge0-Token"]: process.env.JUDGE0_AUTH_TOKEN }
    : {},
});

const b64 = (s) => Buffer.from(s ?? "", "utf8").toString("base64");
const unb64 = (s) => (s ? Buffer.from(s, "base64").toString("utf8") : "");

export const router = Router();

router.get("/languages", (_req, res) => {
  res.json(LANGUAGES.map(({ key, label }) => ({ key, label })));
});

router.post("/execute", async (req, res) => {
  const { roomId, language, code, stdin } = req.body || {};
  const lang = LANGUAGE_BY_KEY[language];

  if (!roomId || !(await roomExists(roomId))) {
    return res.status(404).json({ error: "room not found" });
  }
  if (!lang) {
    return res.status(400).json({ error: `unsupported language: ${language}` });
  }
  if (typeof code !== "string" || !code.trim()) {
    return res.status(400).json({ error: "code is required" });
  }

  try {
    const { data } = await judge0.post("/submissions", {
      source_code: b64(code),
      language_id: lang.judge0Id,
      stdin: b64(stdin || ""),
      ...(lang.wallTimeLimit ? { wall_time_limit: lang.wallTimeLimit } : {}),
    }, { params: { base64_encoded: "true", wait: "true" } });

    res.json({
      status: data.status,
      stdout: unb64(data.stdout),
      stderr: unb64(data.stderr),
      compileOutput: unb64(data.compile_output),
      message: unb64(data.message),
      time: data.time,
      memory: data.memory,
    });
  } catch (err) {
    console.error("judge0 execute failed:", err.response?.data || err.message);
    res.status(502).json({ error: "code execution backend unavailable" });
  }
});

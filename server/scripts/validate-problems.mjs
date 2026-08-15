// Run every problem's reference solutions against its own test code (public
// AND hidden), through the real Judge0/isolate pipeline the candidates use.
//
// This is the same thing POST /problems/:id/validate does, minus the HTTP and
// the auth - so it can be run against a deployment from inside the api
// container, which is what you want when the problems came from a migration
// seed rather than from someone typing them into the authoring form:
//
//   docker compose exec api node scripts/validate-problems.mjs
//   docker compose exec api node scripts/validate-problems.mjs 'Two Sum' 'Max Points'
//
// Arguments, if any, filter problems by title substring (case-insensitive).
// Exits non-zero if anything failed, so it can gate a deploy.
//
// With --starters it runs the *starter* code instead, and inverts the
// expectation: a starter is supposed to compile and then fail its tests. A
// starter that fails to build is a broken skeleton the candidate would have
// to repair before writing a line of their own, which the pass/fail runs
// above can never catch.
import { pool } from "../src/db.js";
import { runProblemTests } from "../src/testRunner.js";
import { harnessFor } from "../src/testHarness/index.js";

const args = process.argv.slice(2);
const startersMode = args.includes("--starters");
const filters = args.filter((a) => a !== "--starters").map((a) => a.toLowerCase());

const { rows: problems } = await pool.query(
  startersMode
    ? `SELECT p.id, p.title, s.language, s.starter_code AS code,
              t.public_code AS "publicCode", '' AS "hiddenCode"
         FROM problems p
         JOIN problem_starters s ON s.problem_id = p.id
         LEFT JOIN problem_test_code t ON t.problem_id = p.id AND t.language = s.language
        ORDER BY p.title, s.language`
    : `SELECT p.id, p.title, s.id AS "solutionId", s.language, s.title AS "solutionTitle", s.code,
              t.public_code AS "publicCode", t.hidden_code AS "hiddenCode"
         FROM problems p
         JOIN problem_solutions s ON s.problem_id = p.id
         LEFT JOIN problem_test_code t ON t.problem_id = p.id AND t.language = s.language
        ORDER BY p.title, s.language`
);

const selected = problems.filter(
  (r) => filters.length === 0 || filters.some((f) => r.title.toLowerCase().includes(f))
);
if (selected.length === 0) {
  console.error("no reference solutions matched");
  process.exit(2);
}

let failed = 0;
for (const row of selected) {
  const label = `${row.title} [${row.language}]`;
  if (!harnessFor(row.language)) {
    console.log(`SKIP ${label} - no test harness for this language`);
    continue;
  }
  if (!row.publicCode?.trim() && !row.hiddenCode?.trim()) {
    console.log(`SKIP ${label} - no test code`);
    continue;
  }

  try {
    const { results, compileOutput, stderr } = await runProblemTests({
      language: row.language,
      candidateCode: row.code,
      publicTestCode: row.publicCode,
      hiddenTestCode: row.hiddenCode,
      mode: "submit",
    });
    const bad = results.filter((r) => !r.passed);

    if (startersMode) {
      // "(all tests)" is testRunner's synthetic result for output it could not
      // parse at all - for a starter that means it never built or never ran.
      const broken = results.some((r) => r.name === "(all tests)");
      if (!broken) {
        console.log(`OK   ${label} - builds, ${bad.length}/${results.length} public tests fail as expected`);
        continue;
      }
      failed++;
      console.log(`BAD  ${label} - starter does not build or run`);
      console.log(`       ${results[0].message?.trim().slice(0, 800)}`);
      continue;
    }

    if (bad.length === 0) {
      console.log(`PASS ${label} - ${results.length} tests`);
      continue;
    }
    failed++;
    console.log(`FAIL ${label} - ${bad.length}/${results.length} failing`);
    for (const r of bad) console.log(`       ${r.name}: ${r.message}`);
    if (compileOutput) console.log(`       compile: ${compileOutput.trim().slice(0, 800)}`);
    if (stderr) console.log(`       stderr: ${stderr.trim().slice(0, 400)}`);
  } catch (err) {
    failed++;
    console.log(`ERROR ${label} - ${err.message}`);
  }
}

const noun = startersMode ? "starter" : "solution";
console.log(
  failed
    ? `\n${failed} ${noun}(s) failed`
    : startersMode
      ? "\nevery starter builds and runs"
      : "\nall reference solutions pass"
);
await pool.end();
process.exit(failed ? 1 : 0);

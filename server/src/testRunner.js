import { harnessFor } from "./testHarness/index.js";
import { parseResultLines } from "./testHarness/markers.js";
import { submitToJudge0 } from "./judge0.js";

// Runs `testCases` against `candidateCode` for one interview problem. Used
// both by the room-facing "Run tests"/"Submit" flow (server/src/rooms.js)
// and by problem authoring's "Validate against reference solution" flow
// (server/src/problems.js) - same function either way, only the code
// string and which test cases get passed in differ.
export async function runTests({ language, candidateCode, functionName, returnType, params, testCases }) {
  const harness = harnessFor(language);
  if (!harness) {
    throw new Error(`automated tests are not supported for language: ${language}`);
  }
  if (testCases.length === 0) {
    return { results: [], compileOutput: "", stderr: "", status: null };
  }

  const source = harness.buildSource(candidateCode, { functionName, returnType, params, testCases });
  const judgeResult = await submitToJudge0(language, source, "");
  const parsed = parseResultLines(judgeResult.stdout);

  // Anything other than exactly one parsed line per test case (compile
  // error, a crash before the driver printed anything, a hard crash
  // mid-run that took the process down) - report every case as errored
  // rather than guessing which ones actually ran. The caller always gets
  // exactly one result per input test case, never a silent gap.
  if (!parsed || parsed.length !== testCases.length) {
    const infraError =
      judgeResult.compileOutput || judgeResult.stderr || judgeResult.message || "no test output produced";
    return {
      results: testCases.map((tc) => ({
        id: tc.id,
        name: tc.name,
        isHidden: tc.isHidden,
        passed: false,
        actual: null,
        error: infraError,
      })),
      compileOutput: judgeResult.compileOutput,
      stderr: judgeResult.stderr,
      status: judgeResult.status,
    };
  }

  const results = testCases.map((tc, i) => ({
    id: tc.id,
    name: tc.name,
    isHidden: tc.isHidden,
    passed: Boolean(parsed[i].passed),
    actual: parsed[i].actual,
    error: parsed[i].error,
  }));

  return { results, compileOutput: judgeResult.compileOutput, stderr: judgeResult.stderr, status: judgeResult.status };
}

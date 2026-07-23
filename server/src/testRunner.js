import { harnessFor } from "./testHarness/index.js";
import { submitToJudge0Raw, TEST_LANGUAGES } from "./judge0.js";

// One Judge0 submission = candidate code + one blob of real test-framework
// code (public or hidden). Returns a synthetic "batch error" single result
// if the framework's own output couldn't be parsed at all (compile error,
// crash before any test ran) - callers still get an array back either way.
async function runBatch(language, candidateCode, testCode, isHidden) {
  const harness = harnessFor(language);
  const lang = TEST_LANGUAGES[language];
  if (!harness || !lang) {
    throw new Error(`automated tests are not supported for language: ${language}`);
  }

  const source = harness.buildSource(candidateCode, testCode);
  const judgeResult = await submitToJudge0Raw(lang, source, "");
  const parsed = harness.parseResults(judgeResult.stdout);

  if (!parsed.length) {
    const infraError =
      judgeResult.compileOutput || judgeResult.stderr || judgeResult.message || "no test output produced";
    return {
      results: [{ name: "(all tests)", passed: false, isHidden, message: infraError }],
      compileOutput: judgeResult.compileOutput,
      stderr: judgeResult.stderr,
      status: judgeResult.status,
    };
  }

  return {
    results: parsed.map((r) => ({ ...r, isHidden })),
    compileOutput: judgeResult.compileOutput,
    stderr: judgeResult.stderr,
    status: judgeResult.status,
  };
}

// mode "run": public test code only (fast feedback, not persisted).
// mode "submit": public AND hidden test code, each as its own Judge0
// submission (simpler and more robust than trying to tell which results
// came from which blob after concatenating them into one run - a crash in
// a real test framework doesn't always leave that reconstructible).
export async function runProblemTests({ language, candidateCode, publicTestCode, hiddenTestCode, mode }) {
  const batches = [];
  if ((publicTestCode || "").trim()) {
    batches.push(runBatch(language, candidateCode, publicTestCode, false));
  }
  if (mode === "submit" && (hiddenTestCode || "").trim()) {
    batches.push(runBatch(language, candidateCode, hiddenTestCode, true));
  }
  if (batches.length === 0) {
    return { results: [], compileOutput: "", stderr: "", status: null };
  }

  const batchResults = await Promise.all(batches);
  return {
    results: batchResults.flatMap((b) => b.results),
    compileOutput: batchResults.map((b) => b.compileOutput).filter(Boolean).join("\n"),
    stderr: batchResults.map((b) => b.stderr).filter(Boolean).join("\n"),
    status: batchResults[batchResults.length - 1].status,
  };
}

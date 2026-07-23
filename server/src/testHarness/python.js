// Tests are real Python: the problem author writes an actual
// unittest.TestCase subclass calling the candidate's function(s) directly.
// candidateCode and testCode are both plain top-level module code -
// concatenated as-is, then run through unittest's own TextTestRunner
// forced onto stdout (its default stream is stderr).
export function buildSource(candidateCode, testCode) {
  return [
    "import unittest, sys",
    "",
    candidateCode,
    "",
    testCode,
    "",
    "if __name__ == '__main__':",
    "    __sig_loader = unittest.TestLoader()",
    "    __sig_suite = __sig_loader.loadTestsFromModule(sys.modules['__main__'])",
    "    unittest.TextTestRunner(stream=sys.stdout, verbosity=2).run(__sig_suite)",
  ].join("\n");
}

// verbosity=2 prints one line per test: "test_name (module.Class) ... ok",
// "... FAIL", or "... ERROR", then (for any non-ok result) a traceback
// block afterwards headed by "FAIL: test_name (...)" / "ERROR: test_name (...)".
const RESULT_LINE_RE = /^(\S+) \([^)]*\)\s*\.\.\.\s*(ok|FAIL|ERROR)\s*$/gm;
// No `|$` alternative here deliberately: with the /m flag, a bare `$` in
// the lookahead matches at the end of every line (not just end-of-input),
// so the lazy capture stopped after the block's very first line. Real
// unittest output always ends with a "Ran N tests..." line, so the
// remaining alternatives are enough to always find the true block end.
const DETAIL_BLOCK_RE = /^(?:FAIL|ERROR): (\S+) \([^)]*\)\n-+\n([\s\S]*?)(?=\n(?:={5,}|-{5,})\n|\nRan \d)/gm;

export function parseResults(stdout) {
  const text = stdout || "";
  const details = new Map();
  let d;
  while ((d = DETAIL_BLOCK_RE.exec(text))) {
    const lines = d[2].trim().split("\n").filter(Boolean);
    details.set(d[1], lines[lines.length - 1] || "failed");
  }

  const results = [];
  let m;
  while ((m = RESULT_LINE_RE.exec(text))) {
    const [, name, status] = m;
    if (status === "ok") {
      results.push({ name, passed: true, message: null });
    } else {
      results.push({ name, passed: false, message: details.get(name) || `test ${status.toLowerCase()}` });
    }
  }
  return results;
}

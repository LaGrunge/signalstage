// Tests are real Go: the problem author writes actual `func TestX(t
// *testing.T)` functions calling the candidate's function(s) directly -
// `go test` auto-discovers any such function, no naming registry needed.
// candidateCode and testCode both omit `package`/`import` (the harness
// owns those, same convention as the plain-execution Go entry) - a
// generous, always-blank-referenced import set means neither the
// candidate nor the test author risks an "imported and not used" compile
// error regardless of what they actually call.
export function buildSource(candidateCode, testCode) {
  return [
    "package main",
    "",
    "import (",
    '\t"testing"',
    '\t"fmt"',
    '\t"sort"',
    '\t"strings"',
    '\t"strconv"',
    '\t"math"',
    ")",
    "",
    "var (",
    "\t_ = fmt.Sprintf",
    "\t_ = sort.Ints",
    "\t_ = strings.Contains",
    "\t_ = strconv.Itoa",
    "\t_ = math.Abs",
    ")",
    "",
    candidateCode,
    "",
    testCode,
  ].join("\n");
}

// `go test -json` (see judge0/Dockerfile's id 92) emits one JSON object per
// line - filter for the ones naming a specific Test and carrying the final
// pass/fail action. A prior panic aborts the whole process before later
// tests ever get a "run" event at all - callers (testRunner.js) fill in
// "never ran" for any test name they expected but never saw here, rather
// than this module guessing.
export function parseResults(stdout) {
  const results = [];
  const lastOutputByTest = new Map();
  for (const line of (stdout || "").split("\n")) {
    if (!line.trim()) continue;
    let evt;
    try {
      evt = JSON.parse(line);
    } catch {
      continue;
    }
    if (!evt.Test) continue;
    if (evt.Action === "output") {
      const text = (evt.Output || "").trim();
      if (text && !text.startsWith("=== RUN") && !text.startsWith("--- PASS") && !text.startsWith("--- FAIL")) {
        lastOutputByTest.set(evt.Test, text);
      }
    } else if (evt.Action === "pass") {
      results.push({ name: evt.Test, passed: true, message: null });
    } else if (evt.Action === "fail") {
      results.push({ name: evt.Test, passed: false, message: lastOutputByTest.get(evt.Test) || "test failed" });
    }
  }
  return results;
}

import { parseMarkerLines } from "./markers.js";

// No real "test framework" ecosystem exists for bash the way gtest/JUnit
// do - the harness instead provides a tiny, genuinely-executed assertion
// library (not a stub), and the problem author's testCode is plain bash
// calling it directly against whatever the candidate's script defines
// (functions, or just stdout/exit code from running it). Both
// candidateCode and testCode run in the same process/shell, so functions
// the candidate defines are directly callable from testCode with no
// sourcing step needed.
const PREAMBLE = [
  "__sig_ok() { echo \"##SIG_TEST_OK## $1\"; }",
  "__sig_fail() { echo \"##SIG_TEST_FAIL## $1 :: $2\"; }",
  "assert_eq() {",
  '  local expected="$1" actual="$2" name="$3"',
  '  if [ "$expected" = "$actual" ]; then __sig_ok "$name"; else __sig_fail "$name" "expected [$expected] got [$actual]"; fi',
  "}",
  "assert_true() {",
  '  local status="$1" name="$2"',
  '  if [ "$status" -eq 0 ]; then __sig_ok "$name"; else __sig_fail "$name" "expected exit 0, got $status"; fi',
  "}",
  "assert_false() {",
  '  local status="$1" name="$2"',
  '  if [ "$status" -ne 0 ]; then __sig_ok "$name"; else __sig_fail "$name" "expected a non-zero exit, got 0"; fi',
  "}",
].join("\n");

export function buildSource(candidateCode, testCode) {
  return [PREAMBLE, "", candidateCode, "", testCode].join("\n");
}

export function parseResults(stdout) {
  return parseMarkerLines(stdout);
}

// Shared line-prefix protocol used by the languages where we generate our
// own emit code (cpp/java/bash) - Python/Go instead parse each language's
// own native structured test output directly (unittest's verbose text,
// `go test -json`), so they don't need this at all. Distinctive enough
// that a candidate's own stray print output won't collide with it by
// accident; unmatched lines are just ignored, not an error.
export const OK_PREFIX = "##SIG_TEST_OK##";
export const FAIL_PREFIX = "##SIG_TEST_FAIL##";

export function parseMarkerLines(stdout) {
  const results = [];
  for (const line of (stdout || "").split("\n")) {
    if (line.startsWith(OK_PREFIX)) {
      results.push({ name: line.slice(OK_PREFIX.length).trim(), passed: true, message: null });
    } else if (line.startsWith(FAIL_PREFIX)) {
      const rest = line.slice(FAIL_PREFIX.length).trim();
      const sepIdx = rest.indexOf(" :: ");
      const name = sepIdx === -1 ? rest : rest.slice(0, sepIdx);
      const message = sepIdx === -1 ? null : rest.slice(sepIdx + 4);
      results.push({ name, passed: false, message });
    }
  }
  return results;
}

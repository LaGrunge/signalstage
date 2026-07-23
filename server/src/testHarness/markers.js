// Unique markers wrapping the harness's structured result block in stdout,
// so a candidate's own stray prints (debugging output before/after the
// driver runs) survive alongside it instead of being mistaken for it.
// One JSON object per line between the markers, not a single JSON array -
// a hard crash partway through (e.g. a C++ segfault) still leaves earlier
// lines parseable instead of losing the whole run to one malformed array.
export const TESTS_BEGIN = "##SIGNALSTAGE_TESTS_BEGIN##";
export const TESTS_END = "##SIGNALSTAGE_TESTS_END##";

export function parseResultLines(stdout) {
  const beginIdx = stdout.indexOf(TESTS_BEGIN);
  const endIdx = stdout.indexOf(TESTS_END);
  if (beginIdx === -1 || endIdx === -1 || endIdx < beginIdx) return null;

  const block = stdout.slice(beginIdx + TESTS_BEGIN.length, endIdx);
  const results = [];
  for (const line of block.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      results.push(JSON.parse(trimmed));
    } catch {
      // Ignore a stray non-JSON line rather than failing the whole parse -
      // shouldn't happen from our own generated code, but don't let one
      // corrupt line take down every other test case's result with it.
    }
  }
  return results;
}

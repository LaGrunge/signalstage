// Compressed playback-time axis for session playback: between consecutive
// recorded moments, playback time advances min(realGap, GAP_CAP_MS), so long
// silences replay as a short fixed pause (the codeinterview-style trick).
// Kept free of React/JSX so the mapping math is unit-testable in plain node.

export const GAP_CAP_MS = 3000;

export function buildTimeAxis(timestamps) {
  const times = [...new Set(timestamps)].sort((a, b) => a - b);
  const compressed = [0];
  for (let i = 1; i < times.length; i++) {
    compressed.push(compressed[i - 1] + Math.min(times[i] - times[i - 1], GAP_CAP_MS));
  }
  const duration = compressed[compressed.length - 1] ?? 0;

  // Rightmost recorded moment at or before the argument, by binary search.
  function segmentIndex(arr, v) {
    let lo = 0,
      hi = arr.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (arr[mid] <= v) lo = mid;
      else hi = mid - 1;
    }
    return lo;
  }

  function toCompressed(t) {
    if (times.length === 0 || t <= times[0]) return 0;
    const lo = segmentIndex(times, t);
    if (lo === times.length - 1) return compressed[lo];
    const span = times[lo + 1] - times[lo];
    const cSpan = compressed[lo + 1] - compressed[lo];
    const frac = span === 0 ? 0 : (t - times[lo]) / span;
    return compressed[lo] + frac * cSpan;
  }

  function toReal(c) {
    if (times.length === 0) return 0;
    if (c <= 0) return times[0];
    const lo = segmentIndex(compressed, Math.min(c, duration));
    if (lo === compressed.length - 1) return times[lo];
    const cSpan = compressed[lo + 1] - compressed[lo];
    const frac = cSpan === 0 ? 0 : (Math.min(c, duration) - compressed[lo]) / cSpan;
    return times[lo] + frac * (times[lo + 1] - times[lo]);
  }

  return { duration, toCompressed, toReal };
}

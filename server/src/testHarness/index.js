import * as python from "./python.js";
import * as go from "./go.js";
import * as cpp from "./cpp.js";
import * as java from "./java.js";

// bash/mariadb are deliberately unsupported - a shell script or a single
// SQL statement doesn't fit the "candidate implements one function" model
// these harnesses assume. See CLAUDE.md.
export const HARNESS_BY_LANGUAGE = { python, go, cpp, java };

export function harnessFor(language) {
  return HARNESS_BY_LANGUAGE[language] || null;
}

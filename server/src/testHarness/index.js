import * as python from "./python.js";
import * as go from "./go.js";
import * as cpp from "./cpp.js";
import * as java from "./java.js";
import * as bash from "./bash.js";

// mariadb has no test harness - a single SQL statement doesn't fit the
// "author writes real test code calling the candidate's code" model these
// harnesses assume. See CLAUDE.md.
export const HARNESS_BY_LANGUAGE = { python, go, cpp, java, bash };

export function harnessFor(language) {
  return HARNESS_BY_LANGUAGE[language] || null;
}

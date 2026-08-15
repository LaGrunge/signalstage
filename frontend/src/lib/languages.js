// The order and display names for language keys wherever the UI shows them
// itself. The room's and dashboard's language <select>s get their labels from
// the server instead (GET /languages, which carries the exact toolchain
// version - "C++ (GCC 15, C++26)"); this is for the compact tab strips in the
// Problem bank, where the version is noise.
//
// C++ comes first everywhere, and is what a new session and a new problem
// default to - it is what interviews here are actually conducted in.
export const DEFAULT_LANGUAGE = "cpp";

// Languages that have an automated-test harness (server/src/testHarness/*).
// mariadb is deliberately absent: a single SQL statement doesn't fit the
// "author writes real test code" model, so problems can't be written for it.
export const TESTABLE_LANGUAGES = ["cpp", "python", "go", "java", "bash"];

const LABELS = {
  cpp: "C++",
  python: "Python",
  go: "Go",
  java: "Java",
  bash: "Bash",
  mariadb: "MariaDB",
};

export function languageLabel(key) {
  return LABELS[key] || key;
}

// Sort an arbitrary set of language keys into the canonical order above,
// keeping anything unrecognised at the end rather than dropping it.
export function orderLanguages(keys) {
  return [...keys].sort((a, b) => {
    const ia = TESTABLE_LANGUAGES.indexOf(a);
    const ib = TESTABLE_LANGUAGES.indexOf(b);
    return (ia === -1 ? Infinity : ia) - (ib === -1 ? Infinity : ib) || a.localeCompare(b);
  });
}

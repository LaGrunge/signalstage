import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import go from "highlight.js/lib/languages/go";
import java from "highlight.js/lib/languages/java";
import bash from "highlight.js/lib/languages/bash";
import sql from "highlight.js/lib/languages/sql";

hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("python", python);
hljs.registerLanguage("go", go);
hljs.registerLanguage("java", java);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("sql", sql);

// Same language keys as server/src/judge0.js's LANGUAGES - mariadb is SQL
// under the hood, everything else matches highlight.js's own names directly.
const HLJS_LANGUAGE = {
  cpp: "cpp",
  python: "python",
  go: "go",
  java: "java",
  bash: "bash",
  mariadb: "sql",
};

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Returns a {__html} object ready for dangerouslySetInnerHTML. Safe against
// XSS despite that: hljs.highlight() always HTML-escapes the source text
// itself before wrapping tokens in <span> - the only markup it ever emits is
// its own <span class="hljs-..."> wrappers, never anything from the input,
// so code containing e.g. "<script>" renders as highlighted plain text, not
// live HTML. Falls back to plain escaped text for unknown languages or if
// plain escaped text for unknown languages or if hljs itself throws (it
// shouldn't for a registered language, but a card preview breaking the whole
// dashboard over a highlighting quirk would be worse than losing the colors).
export function highlightCode(code, language) {
  const text = code || "";
  const hljsLang = HLJS_LANGUAGE[language];
  if (!hljsLang) return { __html: escapeHtml(text) };
  try {
    return { __html: hljs.highlight(text, { language: hljsLang }).value };
  } catch {
    return { __html: escapeHtml(text) };
  }
}

import { isArrayType, elementType } from "./types.js";
import { TESTS_BEGIN, TESTS_END } from "./markers.js";

const CPP_SCALAR_TYPE = { int: "int", double: "double", bool: "bool", string: "string" };

function cppType(type) {
  if (isArrayType(type)) return `vector<${CPP_SCALAR_TYPE[elementType(type)]}>`;
  return CPP_SCALAR_TYPE[type];
}

// JSON.stringify's escaping is a subset of C++ double-quoted string literal
// syntax - safe to use directly as a source literal for values known at
// codegen time (test names), no separate escaper needed for those.
function srcStrLit(value) {
  return JSON.stringify(String(value));
}

function literal(type, value) {
  if (isArrayType(type)) {
    const el = elementType(type);
    return `${cppType(type)}{` + (value ?? []).map((v) => literal(el, v)).join(", ") + "}";
  }
  switch (type) {
    case "int":
      return String(Math.trunc(Number(value)));
    case "double":
      return String(Number(value));
    case "bool":
      return value ? "true" : "false";
    case "string":
      return srcStrLit(value);
    default:
      throw new Error(`unsupported type: ${type}`);
  }
}

// candidateCode is expected to define just the function itself (plus any
// #include lines it personally needs - a generous fixed set is included
// below regardless, and unlike Go, C++ doesn't error on unused includes).
export function buildSource(candidateCode, { functionName, returnType, params, testCases }) {
  const fmtCall = isArrayType(returnType) ? "__sigFmtVec" : "__sigFmtScalar";

  const lines = [
    "#include <iostream>",
    "#include <vector>",
    "#include <string>",
    "#include <sstream>",
    "#include <algorithm>",
    "using namespace std;",
    "",
    candidateCode,
    "",
    "static string __sigJsonString(const string& s) {",
    '\tostringstream o; o << \'"\';',
    "\tfor (unsigned char c : s) {",
    "\t\tswitch (c) {",
    '\t\t\tcase \'"\': o << "\\\\\\""; break;',
    '\t\t\tcase \'\\\\\': o << "\\\\\\\\"; break;',
    '\t\t\tcase \'\\n\': o << "\\\\n"; break;',
    '\t\t\tcase \'\\t\': o << "\\\\t"; break;',
    '\t\t\tcase \'\\r\': o << "\\\\r"; break;',
    "\t\t\tdefault:",
    "\t\t\t\tif (c < 0x20) { char buf[8]; snprintf(buf, sizeof(buf), \"\\\\u%04x\", c); o << buf; }",
    "\t\t\t\telse o << (char)c;",
    "\t\t}",
    "\t}",
    "\to << '\"';",
    "\treturn o.str();",
    "}",
    "",
    "template <typename T>",
    "static string __sigFmtScalar(const T& v) { ostringstream ss; ss << v; return ss.str(); }",
    "static string __sigFmtScalar(const string& v) { return v; }",
    "static string __sigFmtScalar(bool v) { return v ? \"true\" : \"false\"; }",
    "",
    "template <typename T>",
    "static string __sigFmtVec(const vector<T>& v) {",
    '\tostringstream ss; ss << "[";',
    "\tfor (size_t i = 0; i < v.size(); i++) { if (i) ss << \", \"; ss << __sigFmtScalar(v[i]); }",
    '\tss << "]"; return ss.str();',
    "}",
    "",
    "static void __sigEmit(const string& name, bool passed, const string* actual, const string* err) {",
    '\tcout << "{\\"name\\":" << __sigJsonString(name)',
    '\t     << ",\\"passed\\":" << (passed ? "true" : "false")',
    '\t     << ",\\"actual\\":" << (actual ? __sigJsonString(*actual) : "null")',
    '\t     << ",\\"error\\":" << (err ? __sigJsonString(*err) : "null") << "}\\n";',
    "}",
    "",
    "int main() {",
    `\tcout << ${srcStrLit(TESTS_BEGIN)} << "\\n";`,
  ];

  for (const tc of testCases) {
    const expectedExpr = literal(returnType, tc.expected);
    const nameLit = srcStrLit(tc.name);
    // Materialize each argument into a named local first: a literal like
    // `vector<int>{...}` is an rvalue and won't bind to a candidate
    // signature taking `vector<int>&` (common style, e.g. LeetCode's own
    // C++ signatures) - only a named variable is an lvalue that can.
    const argDecls = params.map(
      (p, j) => `\t\t${cppType(p.type)} __arg${j} = ${literal(p.type, tc.args[j])};`
    );
    const argNames = params.map((_p, j) => `__arg${j}`).join(", ");
    lines.push(
      "\ttry {",
      ...argDecls,
      `\t\tauto __actual = ${functionName}(${argNames});`,
      `\t\tbool __passed = (__actual == ${expectedExpr});`,
      `\t\tstring __actualStr = ${fmtCall}(__actual);`,
      `\t\t__sigEmit(${nameLit}, __passed, &__actualStr, nullptr);`,
      "\t} catch (const std::exception& __e) {",
      "\t\tstring __err = __e.what();",
      `\t\t__sigEmit(${nameLit}, false, nullptr, &__err);`,
      "\t} catch (...) {",
      '\t\tstring __err = "unknown exception";',
      `\t\t__sigEmit(${nameLit}, false, nullptr, &__err);`,
      "\t}"
    );
  }

  lines.push(`\tcout << ${srcStrLit(TESTS_END)} << "\\n";`, "\treturn 0;", "}");
  return lines.join("\n");
}

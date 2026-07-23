import { isArrayType, elementType } from "./types.js";
import { TESTS_BEGIN, TESTS_END } from "./markers.js";

const GO_SCALAR_TYPE = { int: "int", double: "float64", bool: "bool", string: "string" };

function goType(type) {
  if (isArrayType(type)) return `[]${GO_SCALAR_TYPE[elementType(type)]}`;
  return GO_SCALAR_TYPE[type];
}

// JSON.stringify's escaping is a subset of Go's double-quoted string literal
// syntax - safe to use directly as a source literal for values known at
// codegen time (test names), no separate escaper needed for those.
function srcStrLit(value) {
  return JSON.stringify(String(value));
}

function literal(type, value) {
  if (isArrayType(type)) {
    const el = elementType(type);
    return `${goType(type)}{` + (value ?? []).map((v) => literal(el, v)).join(", ") + "}";
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

// candidateCode is expected to define just the function itself, `package
// main` and imports are supplied here - no import block of its own (Go
// only allows one, before any other top-level declaration). sort/strconv/
// math are blank-referenced below so the candidate can use them freely
// without risking an "imported and not used" compile error if they don't.
export function buildSource(candidateCode, { functionName, returnType, params, testCases }) {
  const lines = [
    "package main",
    "",
    'import (',
    '\t"fmt"',
    '\t"reflect"',
    '\t"sort"',
    '\t"strings"',
    '\t"strconv"',
    '\t"math"',
    ")",
    "",
    "var (",
    "\t_ = sort.Ints",
    "\t_ = strconv.Itoa",
    "\t_ = math.Abs",
    ")",
    "",
    candidateCode,
    "",
    "func __sigJSONString(s string) string {",
    "\tvar b strings.Builder",
    "\tb.WriteByte('\"')",
    "\tfor _, r := range s {",
    "\t\tswitch r {",
    "\t\tcase '\"':",
    '\t\t\tb.WriteString(`\\"`)',
    "\t\tcase '\\\\':",
    '\t\t\tb.WriteString(`\\\\`)',
    "\t\tcase '\\n':",
    '\t\t\tb.WriteString(`\\n`)',
    "\t\tcase '\\t':",
    '\t\t\tb.WriteString(`\\t`)',
    "\t\tcase '\\r':",
    '\t\t\tb.WriteString(`\\r`)',
    "\t\tdefault:",
    "\t\t\tif r < 0x20 {",
    '\t\t\t\tb.WriteString(fmt.Sprintf(`\\u%04x`, r))',
    "\t\t\t} else {",
    "\t\t\t\tb.WriteRune(r)",
    "\t\t\t}",
    "\t\t}",
    "\t}",
    "\tb.WriteByte('\"')",
    "\treturn b.String()",
    "}",
    "",
    "func __sigEmit(name string, passed bool, actual *string, errMsg *string) {",
    '\tactualJSON := "null"',
    "\tif actual != nil {",
    "\t\tactualJSON = __sigJSONString(*actual)",
    "\t}",
    '\terrJSON := "null"',
    "\tif errMsg != nil {",
    "\t\terrJSON = __sigJSONString(*errMsg)",
    "\t}",
    '\tfmt.Printf("{\\"name\\":%s,\\"passed\\":%v,\\"actual\\":%s,\\"error\\":%s}\\n", __sigJSONString(name), passed, actualJSON, errJSON)',
    "}",
    "",
    "func main() {",
    `\tfmt.Println(${srcStrLit(TESTS_BEGIN)})`,
  ];

  for (const tc of testCases) {
    const argExprs = params.map((p, j) => literal(p.type, tc.args[j]));
    const expectedExpr = literal(returnType, tc.expected);
    const nameLit = srcStrLit(tc.name);
    lines.push(
      "\tfunc() {",
      "\t\tdefer func() {",
      "\t\t\tif r := recover(); r != nil {",
      '\t\t\t\terrMsg := fmt.Sprintf("%v", r)',
      `\t\t\t\t__sigEmit(${nameLit}, false, nil, &errMsg)`,
      "\t\t\t}",
      "\t\t}()",
      `\t\tactual := ${functionName}(${argExprs.join(", ")})`,
      `\t\texpected := ${expectedExpr}`,
      "\t\tpassed := reflect.DeepEqual(actual, expected)",
      '\t\tactualStr := fmt.Sprintf("%v", actual)',
      `\t\t__sigEmit(${nameLit}, passed, &actualStr, nil)`,
      "\t}()"
    );
  }

  lines.push(`\tfmt.Println(${srcStrLit(TESTS_END)})`, "}");
  return lines.join("\n");
}

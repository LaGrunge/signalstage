import { isArrayType, elementType } from "./types.js";
import { TESTS_BEGIN, TESTS_END } from "./markers.js";

// JSON.stringify's escaping is a subset of what Python double-quoted string
// literals accept (\n, \t, \", \\, \uXXXX, ...) - safe to use directly as a
// Python source string literal for any value known at codegen time (test
// names, static JSON fragments), without writing a separate escaper.
function srcStrLit(value) {
  return JSON.stringify(String(value));
}

function literal(type, value) {
  if (isArrayType(type)) {
    const el = elementType(type);
    return "[" + (value ?? []).map((v) => literal(el, v)).join(", ") + "]";
  }
  switch (type) {
    case "int":
      return String(Math.trunc(Number(value)));
    case "double":
      return String(Number(value));
    case "bool":
      return value ? "True" : "False";
    case "string":
      return srcStrLit(value);
    default:
      throw new Error(`unsupported type: ${type}`);
  }
}

// candidateCode is expected to define just the function itself - no
// package/import/main boilerplate. testCases: [{name, args:[...values, one
// per param, in order], expected}].
export function buildSource(candidateCode, { functionName, returnType, params, testCases }) {
  const lines = [
    "import json",
    "",
    candidateCode,
    "",
    "def __sig_emit(name, passed, actual, error):",
    '    print(json.dumps({"name": name, "passed": bool(passed), "actual": actual, "error": error}))',
    "",
    `print(${srcStrLit(TESTS_BEGIN)})`,
  ];

  for (const tc of testCases) {
    const argExprs = params.map((p, j) => literal(p.type, tc.args[j]));
    const expectedExpr = literal(returnType, tc.expected);
    const nameLit = srcStrLit(tc.name);
    lines.push(
      "try:",
      `    __actual = ${functionName}(${argExprs.join(", ")})`,
      `    __sig_emit(${nameLit}, __actual == ${expectedExpr}, repr(__actual), None)`,
      "except Exception as __e:",
      `    __sig_emit(${nameLit}, False, None, str(__e))`
    );
  }

  lines.push(`print(${srcStrLit(TESTS_END)})`);
  return lines.join("\n");
}

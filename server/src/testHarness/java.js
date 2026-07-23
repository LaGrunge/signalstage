import { isArrayType, elementType } from "./types.js";
import { TESTS_BEGIN, TESTS_END } from "./markers.js";

const JAVA_SCALAR_TYPE = { int: "int", double: "double", bool: "boolean", string: "String" };

function javaType(type) {
  if (isArrayType(type)) return `${JAVA_SCALAR_TYPE[elementType(type)]}[]`;
  return JAVA_SCALAR_TYPE[type];
}

// JSON.stringify's escaping is a subset of Java's double-quoted string
// literal syntax - safe to use directly as a source literal for values
// known at codegen time (test names), no separate escaper needed for those.
function srcStrLit(value) {
  return JSON.stringify(String(value));
}

function literal(type, value) {
  if (isArrayType(type)) {
    const el = elementType(type);
    return `new ${javaType(type)}{` + (value ?? []).map((v) => literal(el, v)).join(", ") + "}";
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

function equalsExpr(type, actualExpr, expectedExpr) {
  if (isArrayType(type)) return `java.util.Arrays.equals(${actualExpr}, ${expectedExpr})`;
  if (type === "string") return `${actualExpr}.equals(${expectedExpr})`;
  return `(${actualExpr} == ${expectedExpr})`;
}

function formatExpr(type, expr) {
  return isArrayType(type) ? `java.util.Arrays.toString(${expr})` : `String.valueOf(${expr})`;
}

// candidateCode is expected to define the whole `class Solution { ... }`
// wrapper itself (Judge0's Java run_cmd expects a public class named Main
// matching the source filename - candidate's Solution class is a second,
// non-public top-level class in the same file, which Java allows).
export function buildSource(candidateCode, { functionName, returnType, params, testCases }) {
  const lines = [
    candidateCode,
    "",
    "public class Main {",
    "\tstatic String __sigJsonString(String s) {",
    "\t\tStringBuilder b = new StringBuilder();",
    '\t\tb.append(\'"\');',
    "\t\tfor (int i = 0; i < s.length(); i++) {",
    "\t\t\tchar c = s.charAt(i);",
    "\t\t\tswitch (c) {",
    '\t\t\t\tcase \'"\': b.append("\\\\\\""); break;',
    "\t\t\t\tcase '\\\\': b.append(\"\\\\\\\\\"); break;",
    '\t\t\t\tcase \'\\n\': b.append("\\\\n"); break;',
    '\t\t\t\tcase \'\\t\': b.append("\\\\t"); break;',
    '\t\t\t\tcase \'\\r\': b.append("\\\\r"); break;',
    "\t\t\t\tdefault:",
    "\t\t\t\t\tif (c < 0x20) b.append(String.format(\"\\\\u%04x\", (int) c));",
    "\t\t\t\t\telse b.append(c);",
    "\t\t\t}",
    "\t\t}",
    '\t\tb.append(\'"\');',
    "\t\treturn b.toString();",
    "\t}",
    "",
    "\tstatic void __sigEmit(String name, boolean passed, String actual, String err) {",
    "\t\tSystem.out.println(\"{\\\"name\\\":\" + __sigJsonString(name)",
    "\t\t\t+ \",\\\"passed\\\":\" + passed",
    "\t\t\t+ \",\\\"actual\\\":\" + (actual != null ? __sigJsonString(actual) : \"null\")",
    "\t\t\t+ \",\\\"error\\\":\" + (err != null ? __sigJsonString(err) : \"null\") + \"}\");",
    "\t}",
    "",
    "\tpublic static void main(String[] args) {",
    `\t\tSystem.out.println(${srcStrLit(TESTS_BEGIN)});`,
  ];

  for (const tc of testCases) {
    const argExprs = params.map((p, j) => literal(p.type, tc.args[j]));
    const expectedExpr = literal(returnType, tc.expected);
    const nameLit = srcStrLit(tc.name);
    lines.push(
      "\t\ttry {",
      `\t\t\t${javaType(returnType)} __actual = Solution.${functionName}(${argExprs.join(", ")});`,
      `\t\t\t${javaType(returnType)} __expected = ${expectedExpr};`,
      `\t\t\tboolean __passed = ${equalsExpr(returnType, "__actual", "__expected")};`,
      `\t\t\tString __actualStr = ${formatExpr(returnType, "__actual")};`,
      `\t\t\t__sigEmit(${nameLit}, __passed, __actualStr, null);`,
      "\t\t} catch (Throwable __t) {",
      "\t\t\tString __err = __t.getMessage() != null ? __t.getMessage() : __t.toString();",
      `\t\t\t__sigEmit(${nameLit}, false, null, __err);`,
      "\t\t}"
    );
  }

  lines.push(`\t\tSystem.out.println(${srcStrLit(TESTS_END)});`, "\t}", "}");
  return lines.join("\n");
}

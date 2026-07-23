import { parseMarkerLines } from "./markers.js";

// Tests are real JUnit: the problem author writes an actual `class
// SigTests { @Test public void x() {...} }` calling the candidate's
// `class Solution { ... }` directly. The exact class name "SigTests" is a
// fixed convention (Judge0's source_file for this language is
// "SigRunner.java" - see judge0/Dockerfile's id 93).
//
// The driver runs tests via plain reflection over @Test-annotated methods,
// NOT via org.junit.runner.JUnitCore/BlockJUnit4ClassRunner - still real
// JUnit annotations/Assert/AssertionError throughout, just not JUnit's own
// runner. Found the hard way, by actually compiling generated output:
// JUnit4's runner validation requires the test class itself to be public,
// but javac only allows ONE public top-level class per file and it must
// match the filename - so a public SigTests can't coexist with anything
// else in a file that has to be named SigRunner.java. Reflection sidesteps
// the runner's validation step entirely; SigTests stays package-private.
export function buildSource(candidateCode, testCode) {
  return [
    "import org.junit.Test;",
    "import java.lang.reflect.InvocationTargetException;",
    "import java.lang.reflect.Method;",
    "",
    candidateCode,
    "",
    testCode,
    "",
    "class SigRunner {",
    "    public static void main(String[] args) throws Exception {",
    '        Class<?> testClass = Class.forName("SigTests");',
    "        Object instance = testClass.getDeclaredConstructor().newInstance();",
    "        for (Method m : testClass.getMethods()) {",
    "            if (!m.isAnnotationPresent(Test.class)) continue;",
    "            m.setAccessible(true);",
    "            try {",
    "                m.invoke(instance);",
    '                System.out.println("##SIG_TEST_OK## " + m.getName());',
    "            } catch (InvocationTargetException e) {",
    "                Throwable cause = e.getCause();",
    "                String msg = cause.getMessage() != null ? cause.getMessage() : String.valueOf(cause);",
    '                msg = msg.replace("\\n", " ");',
    '                System.out.println("##SIG_TEST_FAIL## " + m.getName() + " :: " + msg);',
    "            }",
    "        }",
    "    }",
    "}",
  ].join("\n");
}

export function parseResults(stdout) {
  return parseMarkerLines(stdout);
}

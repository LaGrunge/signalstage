import { parseMarkerLines } from "./markers.js";

// Tests are real GoogleTest: the problem author writes actual TEST(Suite,
// Name) {...} blocks calling the candidate's function(s) directly - gtest's
// own registry auto-discovers them, RUN_ALL_TESTS() runs everything. The
// harness supplies the includes, a custom TestEventListener (gtest's
// default main()/output doesn't cleanly separate "this exact test passed"
// from "this exact test failed" as a single machine-parsed line per test,
// so we drive our own), and main() itself - candidateCode/testCode must
// not define one.
export function buildSource(candidateCode, testCode) {
  return [
    "#include <gtest/gtest.h>",
    "#include <iostream>",
    "#include <vector>",
    "#include <string>",
    "#include <sstream>",
    "#include <algorithm>",
    "using namespace std;",
    "",
    candidateCode,
    "",
    testCode,
    "",
    "class __SigListener : public ::testing::EmptyTestEventListener {",
    "  void OnTestEnd(const ::testing::TestInfo& info) override {",
    '    string fullName = string(info.test_suite_name()) + "." + info.name();',
    "    if (info.result()->Passed()) {",
    '      cout << "##SIG_TEST_OK## " << fullName << "\\n";',
    "    } else {",
    '      string msg = "assertion failed";',
    "      if (info.result()->total_part_count() > 0) {",
    "        msg = info.result()->GetTestPartResult(0).summary();",
    "        for (auto &c : msg) if (c == '\\n') c = ' ';",
    "      }",
    '      cout << "##SIG_TEST_FAIL## " << fullName << " :: " << msg << "\\n";',
    "    }",
    "  }",
    "};",
    "",
    "int main(int argc, char** argv) {",
    "  ::testing::InitGoogleTest(&argc, argv);",
    "  ::testing::UnitTest::GetInstance()->listeners().Append(new __SigListener());",
    "  return RUN_ALL_TESTS();",
    "}",
  ].join("\n");
}

export function parseResults(stdout) {
  return parseMarkerLines(stdout);
}

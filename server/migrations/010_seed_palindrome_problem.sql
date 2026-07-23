-- One "Is Palindrome" shared problem, exercising the full v2 pipeline
-- (real GoogleTest/JUnit/unittest/go test/bash tests, public+hidden split,
-- reference solutions in all 5 testable languages) so a fresh install has
-- a working example instead of an empty Problem bank. Fixed ids + ON
-- CONFLICT DO NOTHING keep this idempotent across the every-boot migration
-- replay (see server/src/db.js's runMigrations), same pattern as 007's
-- seeded shared templates. Dollar-quoted strings throughout - these blobs
-- are full of quotes/backslashes that would otherwise need escaping.
INSERT INTO problems (id, title, description, signature_hint, difficulty, created_by, is_shared) VALUES
(
  '00000000-0000-0000-0000-000000000101',
  'Is Palindrome',
  $desc$Write a function that determines whether a given string is a palindrome.

Rules:
- Ignore any character that is not a letter (spaces, punctuation, digits, etc.).
- Treat upper- and lower-case letters as equal.
- An empty string, or a string with no letters at all, counts as a palindrome.

Example: "A man, a plan, a canal: Panama" is a palindrome once you ignore case and non-letter characters (it reads "amanaplanacanalpanama" both ways).$desc$,
  'isPalindrome(s: string) -> bool',
  2,
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO problem_starters (problem_id, language, starter_code) VALUES
(
  '00000000-0000-0000-0000-000000000101',
  'python',
  $s$def is_palindrome(s):
    # TODO: ignore non-letter characters, case-insensitive.
    pass
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'cpp',
  $s$#include <cctype>

bool isPalindrome(const string& s) {
    // TODO: ignore non-letter characters, case-insensitive.
    return false;
}
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'java',
  $s$class Solution {
    public static boolean isPalindrome(String s) {
        // TODO: ignore non-letter characters, case-insensitive.
        return false;
    }
}
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'go',
  $s$func isPalindrome(s string) bool {
	// TODO: ignore non-letter characters, case-insensitive.
	return false
}
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'bash',
  $s$is_palindrome() {
    # TODO: ignore non-letter characters, case-insensitive.
    # Exit 0 if $1 is a palindrome, exit 1 otherwise.
    return 1
}
$s$
)
ON CONFLICT (problem_id, language) DO NOTHING;

INSERT INTO problem_solutions (id, problem_id, language, title, code) VALUES
(
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000101',
  'python',
  'regex strip + slice reverse',
  $s$import re

def is_palindrome(s):
    cleaned = re.sub(r'[^A-Za-z]', '', s).lower()
    return cleaned == cleaned[::-1]
$s$
),
(
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000101',
  'cpp',
  'two pointers',
  $s$#include <cctype>

bool isPalindrome(const string& s) {
    string cleaned;
    for (char c : s) {
        if (isalpha((unsigned char)c)) cleaned += (char)tolower((unsigned char)c);
    }
    int i = 0, j = (int)cleaned.size() - 1;
    while (i < j) {
        if (cleaned[i] != cleaned[j]) return false;
        i++; j--;
    }
    return true;
}
$s$
),
(
  '00000000-0000-0000-0000-000000000104',
  '00000000-0000-0000-0000-000000000101',
  'java',
  'StringBuilder reverse',
  $s$class Solution {
    public static boolean isPalindrome(String s) {
        StringBuilder cleaned = new StringBuilder();
        for (char c : s.toCharArray()) {
            if (Character.isLetter(c)) cleaned.append(Character.toLowerCase(c));
        }
        String cs = cleaned.toString();
        return cs.equals(new StringBuilder(cs).reverse().toString());
    }
}
$s$
),
(
  '00000000-0000-0000-0000-000000000105',
  '00000000-0000-0000-0000-000000000101',
  'go',
  'rune slice two pointers',
  $s$func isPalindrome(s string) bool {
	var cleaned []rune
	for _, r := range s {
		if (r >= 'a' && r <= 'z') || (r >= 'A' && r <= 'Z') {
			if r >= 'A' && r <= 'Z' {
				r = r - 'A' + 'a'
			}
			cleaned = append(cleaned, r)
		}
	}
	for i, j := 0, len(cleaned)-1; i < j; i, j = i+1, j-1 {
		if cleaned[i] != cleaned[j] {
			return false
		}
	}
	return true
}
$s$
),
(
  '00000000-0000-0000-0000-000000000106',
  '00000000-0000-0000-0000-000000000101',
  'bash',
  'tr + manual reverse loop',
  $s$is_palindrome() {
    local cleaned reversed=""
    cleaned=$(printf '%s' "$1" | tr -cd 'A-Za-z' | tr 'A-Z' 'a-z')
    local i
    for (( i=${#cleaned}-1; i>=0; i-- )); do
        reversed+="${cleaned:$i:1}"
    done
    [ "$cleaned" = "$reversed" ]
}
$s$
)
ON CONFLICT (id) DO NOTHING;

INSERT INTO problem_test_code (problem_id, language, public_code, hidden_code) VALUES
(
  '00000000-0000-0000-0000-000000000101',
  'python',
  $s$class PublicTests(unittest.TestCase):
    def test_simple_palindrome(self):
        self.assertTrue(is_palindrome('racecar'))
    def test_not_a_palindrome(self):
        self.assertFalse(is_palindrome('hello'))
$s$,
  $s$class HiddenTests(unittest.TestCase):
    def test_mixed_case_and_punctuation(self):
        self.assertTrue(is_palindrome('A man, a plan, a canal: Panama'))
    def test_empty_string(self):
        self.assertTrue(is_palindrome(''))
    def test_only_punctuation(self):
        self.assertTrue(is_palindrome('...,,,!!!'))
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'cpp',
  $s$TEST(IsPalindrome, SimplePalindrome) { EXPECT_TRUE(isPalindrome("racecar")); }
TEST(IsPalindrome, NotAPalindrome) { EXPECT_FALSE(isPalindrome("hello")); }
$s$,
  $s$TEST(IsPalindrome, MixedCaseAndPunctuation) { EXPECT_TRUE(isPalindrome("A man, a plan, a canal: Panama")); }
TEST(IsPalindrome, EmptyString) { EXPECT_TRUE(isPalindrome("")); }
TEST(IsPalindrome, OnlyPunctuation) { EXPECT_TRUE(isPalindrome("...,,,!!!")); }
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'java',
  $s$class SigTests {
    @org.junit.Test public void simplePalindrome() { org.junit.Assert.assertTrue(Solution.isPalindrome("racecar")); }
    @org.junit.Test public void notAPalindrome() { org.junit.Assert.assertFalse(Solution.isPalindrome("hello")); }
}
$s$,
  $s$class SigTests {
    @org.junit.Test public void mixedCaseAndPunctuation() { org.junit.Assert.assertTrue(Solution.isPalindrome("A man, a plan, a canal: Panama")); }
    @org.junit.Test public void emptyString() { org.junit.Assert.assertTrue(Solution.isPalindrome("")); }
    @org.junit.Test public void onlyPunctuation() { org.junit.Assert.assertTrue(Solution.isPalindrome("...,,,!!!")); }
}
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'go',
  $s$func TestSimplePalindrome(t *testing.T) {
	if !isPalindrome("racecar") { t.Errorf("expected racecar to be a palindrome") }
}
func TestNotAPalindrome(t *testing.T) {
	if isPalindrome("hello") { t.Errorf("expected hello to not be a palindrome") }
}
$s$,
  $s$func TestMixedCaseAndPunctuation(t *testing.T) {
	if !isPalindrome("A man, a plan, a canal: Panama") { t.Errorf("expected true") }
}
func TestEmptyString(t *testing.T) {
	if !isPalindrome("") { t.Errorf("expected true") }
}
func TestOnlyPunctuation(t *testing.T) {
	if !isPalindrome("...,,,!!!") { t.Errorf("expected true") }
}
$s$
),
(
  '00000000-0000-0000-0000-000000000101',
  'bash',
  $s$is_palindrome "racecar"; assert_true $? "simple_palindrome"
is_palindrome "hello"; assert_false $? "not_a_palindrome"
$s$,
  $s$is_palindrome "A man, a plan, a canal: Panama"; assert_true $? "mixed_case_and_punctuation"
is_palindrome ""; assert_true $? "empty_string"
is_palindrome "...,,,!!!"; assert_true $? "only_punctuation"
$s$
)
ON CONFLICT (problem_id, language) DO NOTHING;

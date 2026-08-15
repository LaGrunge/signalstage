-- A real starting Problem bank: a folder tree plus twelve shared problems,
-- eleven algorithmic (C++ and Python, both with reference solutions and real
-- GoogleTest/unittest test code) and one C++ debugging exercise.
--
-- Two of these are adaptations of shared *templates* that were being used as
-- problems in practice ("Vertical Symmetry" / "Symmetry Solution" and
-- "C++ Bugs Hunt"): a template is free-form starter code with no description,
-- no hidden tests and no Run/Submit pipeline, so anything that wants to be
-- graded belongs here instead.
--
-- Same idempotency contract as 007/010: fixed ids + ON CONFLICT DO NOTHING,
-- because every migration re-runs on every API boot (server/src/db.js). That
-- also means editing a blob below does NOT update an instance that already
-- ran this file - change it through the Problem bank UI, or bump to a new id.
--
-- created_by IS NULL, is_shared = true: owned by the instance rather than by
-- whoever happened to start it, visible to every interviewer. Admins can
-- still edit and delete them (problems.js treats an admin as the owner).

-- --------------------------------------------------------------------------
-- Folders. Every ancestor is its own row (the mkdir -p invariant from 013),
-- so "algorithms" exists even though nothing sits directly in it.
-- --------------------------------------------------------------------------
INSERT INTO problem_folders (id, path, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0001', 'algorithms', NULL),
  ('00000000-0000-0000-0000-0000000f0002', 'algorithms/arrays and hashing', NULL),
  ('00000000-0000-0000-0000-0000000f0003', 'algorithms/strings', NULL),
  ('00000000-0000-0000-0000-0000000f0004', 'algorithms/geometry', NULL),
  ('00000000-0000-0000-0000-0000000f0005', 'algorithms/graphs', NULL),
  ('00000000-0000-0000-0000-0000000f0006', 'C++ debug', NULL)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Problems
-- --------------------------------------------------------------------------
INSERT INTO problems (id, title, description, signature_hint, difficulty, folder_id, created_by, is_shared) VALUES
(
  '00000000-0000-0000-0000-0000000a0001',
  'Two Sum',
  $d$Given an array of integers and a target value, find the two elements that add up to the target and return their indices.

Rules:
- Exactly one such pair exists.
- Return the two indices in increasing order.
- You may not use the same element twice.

Example: nums = [2, 7, 11, 15], target = 9 -> [0, 1], because nums[0] + nums[1] == 9.

The obvious solution is two nested loops. Aim for a single pass instead.$d$,
  'vector<int> twoSum(const vector<int>& nums, int target)  |  two_sum(nums, target) -> [i, j]',
  1,
  '00000000-0000-0000-0000-0000000f0002',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0002',
  'Product of Array Except Self',
  $d$Given an array of integers, return an array where each position holds the product of every other element of the input.

Rules:
- You may not use division (assume it is forbidden, not just discouraged).
- Aim for O(n) time.
- The input may contain zeros and negative numbers.

Example: [1, 2, 3, 4] -> [24, 12, 8, 6].
Example: [-1, 1, 0, -3, 3] -> [0, 0, 9, 0, 0].$d$,
  'vector<int> productExceptSelf(const vector<int>& nums)  |  product_except_self(nums) -> list',
  3,
  '00000000-0000-0000-0000-0000000f0002',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0003',
  'Longest Consecutive Sequence',
  $d$Given an unsorted array of integers, return the length of the longest run of consecutive integers present in it.

Rules:
- The numbers do not have to be adjacent in the array, only consecutive in value.
- Duplicates count once.
- Aim for O(n) time - sorting is the easy answer, and it is not the one being asked for.

Example: [100, 4, 200, 1, 3, 2] -> 4, from the run 1, 2, 3, 4.$d$,
  'int longestConsecutive(const vector<int>& nums)  |  longest_consecutive(nums) -> int',
  4,
  '00000000-0000-0000-0000-0000000f0002',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0004',
  'Valid Parentheses',
  $d$Given a string containing only the characters ( ) [ ] { }, decide whether the brackets are balanced.

A string is valid when every opening bracket is closed by the matching kind, in the right order, and nothing is left open at the end. The empty string is valid.

Examples:
  "()[]{}" -> true
  "([)]"   -> false
  "{[]}"   -> true
  "("      -> false$d$,
  'bool isValid(const string& s)  |  is_valid(s) -> bool',
  2,
  '00000000-0000-0000-0000-0000000f0003',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0005',
  'Longest Substring Without Repeating Characters',
  $d$Given a string, return the length of the longest substring that contains no repeated character.

Substring means contiguous - "abc" is a substring of "abcd", "acd" is not.

Examples:
  "abcabcbb" -> 3 ("abc")
  "bbbbb"    -> 1 ("b")
  "pwwkew"   -> 3 ("wke")
  ""         -> 0

Aim for a single pass over the string.$d$,
  'int lengthOfLongestSubstring(const string& s)  |  length_of_longest_substring(s) -> int',
  3,
  '00000000-0000-0000-0000-0000000f0003',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0006',
  'Minimum Window Substring',
  $d$Given two strings s and t, return the shortest substring of s that contains every character of t, including repeats. If no such substring exists, return the empty string.

Rules:
- Characters of t may appear in any order inside the window.
- If t contains a character twice, the window must contain it twice.
- The answer is unique for the inputs used here.

Example: s = "ADOBECODEBANC", t = "ABC" -> "BANC".
Example: s = "a", t = "aa" -> "" (only one 'a' available).$d$,
  'string minWindow(const string& s, const string& t)  |  min_window(s, t) -> str',
  5,
  '00000000-0000-0000-0000-0000000f0003',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0007',
  'Vertical Symmetry',
  $d$Given a set of points with integer coordinates, decide whether there exists a vertical line (x = c) that the whole set is symmetric about.

Rules:
- The points are distinct.
- The line does not have to pass through any point, and c does not have to be an integer: {(1, 0), (2, 0)} is symmetric about x = 1.5.
- A set of fewer than two points is trivially symmetric.
- Aim for O(n) or O(n log n) - the answer does not require trying every candidate line.

Symmetric:

     *     *
    *       *
    *   *   *
     *     *
        *
        *
        *

Not symmetric:

    *       *
    *       *
    *   *   *
     *     *
        *
        *  *
        *$d$,
  'bool hasVerticalSymmetry(const vector<Point>& points)  |  has_vertical_symmetry(points) -> bool',
  4,
  '00000000-0000-0000-0000-0000000f0004',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0008',
  'Max Points on a Line',
  $d$Given a set of distinct points with integer coordinates, return the largest number of them that lie on one straight line.

Rules:
- Any single point counts as 1, and an empty set as 0.
- Vertical lines count like any other - beware of dividing by zero when computing a slope.
- Floating-point slopes lose precision on large coordinates; prefer an exact representation.

Example: [(1,1), (3,2), (5,3), (4,1), (2,3), (1,4)] -> 4, from the line x + y = 5 through (1,4), (2,3), (3,2) and (4,1).$d$,
  'int maxPoints(const vector<Point>& points)  |  max_points(points) -> int',
  5,
  '00000000-0000-0000-0000-0000000f0004',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0009',
  'Number of Islands',
  $d$Given a rectangular grid of '1' (land) and '0' (water), count the islands. An island is a group of land cells connected horizontally or vertically (not diagonally), surrounded by water or the edge of the grid.

Example:

  1 1 0 0 0
  1 1 0 0 0
  0 0 1 0 0
  0 0 0 1 1

-> 3 islands.

The grid is passed by value, so you are free to mark cells as you go.$d$,
  'int numIslands(vector<vector<char>> grid)  |  num_islands(grid) -> int',
  3,
  '00000000-0000-0000-0000-0000000f0005',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0010',
  'Course Schedule',
  $d$There are numCourses courses, numbered 0 to numCourses - 1. Each entry of prerequisites is a pair [course, prereq] meaning you must take prereq before course.

Return whether it is possible to finish all courses.

Examples:
  numCourses = 2, prerequisites = [[1, 0]]         -> true
  numCourses = 2, prerequisites = [[1, 0], [0, 1]] -> false (they need each other)

This is a cycle-detection question in disguise. Either a topological sort or a depth-first search with three colours works.$d$,
  'bool canFinish(int numCourses, const vector<vector<int>>& prerequisites)  |  can_finish(num_courses, prerequisites) -> bool',
  4,
  '00000000-0000-0000-0000-0000000f0005',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0011',
  'Rotting Oranges',
  $d$A grid holds 0 (empty), 1 (a fresh orange) or 2 (a rotten orange). Every minute, each rotten orange rots every fresh orange directly above, below, left or right of it.

Return the number of minutes until no fresh orange is left, or -1 if that never happens.

Example:

  2 1 1
  1 1 0
  0 1 1

-> 4.

If there is no fresh orange to begin with, the answer is 0. Note that this is a breadth-first search where the whole frontier advances together, not one cell at a time.$d$,
  'int orangesRotting(vector<vector<int>> grid)  |  oranges_rotting(grid) -> int',
  3,
  '00000000-0000-0000-0000-0000000f0005',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0012',
  'C++ Bugs Hunt',
  $d$The code below is supposed to run one season for a team: a captain with a rating of -1000, seven recruits with a rating of 0 each, and then a boost of +100 to every member. So it should report

  total = -200, captain = -900, team size = 8

It reports something else entirely. Find every reason why and fix them, keeping the structure of the program recognisable - the point is to explain what is wrong, not to rewrite it from scratch.

There is more than one bug, and they are of quite different kinds: object lifetime, inheritance, loop bounds, integer types, and how a range-for binds its loop variable. When you find one, keep looking.

Do not change the tests, and keep playSeason() returning a Report.$d$,
  'Report playSeason()  -  Report { long long total; int captainRating; int teamSize; }',
  4,
  '00000000-0000-0000-0000-0000000f0006',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Starter code
-- --------------------------------------------------------------------------
INSERT INTO problem_starters (problem_id, language, starter_code) VALUES
('00000000-0000-0000-0000-0000000a0001', 'cpp', $c$#include <unordered_map>

vector<int> twoSum(const vector<int>& nums, int target) {
    // TODO: return the two indices, smaller one first.
    return {};
}
$c$),
('00000000-0000-0000-0000-0000000a0001', 'python', $c$def two_sum(nums, target):
    # TODO: return the two indices, smaller one first.
    return []
$c$),

('00000000-0000-0000-0000-0000000a0002', 'cpp', $c$vector<int> productExceptSelf(const vector<int>& nums) {
    // TODO: out[i] = product of every element except nums[i]. No division.
    return {};
}
$c$),
('00000000-0000-0000-0000-0000000a0002', 'python', $c$def product_except_self(nums):
    # TODO: out[i] = product of every element except nums[i]. No division.
    return []
$c$),

('00000000-0000-0000-0000-0000000a0003', 'cpp', $c$#include <unordered_set>

int longestConsecutive(const vector<int>& nums) {
    // TODO: length of the longest run of consecutive values.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0003', 'python', $c$def longest_consecutive(nums):
    # TODO: length of the longest run of consecutive values.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0004', 'cpp', $c$bool isValid(const string& s) {
    // TODO: are the brackets balanced?
    return false;
}
$c$),
('00000000-0000-0000-0000-0000000a0004', 'python', $c$def is_valid(s):
    # TODO: are the brackets balanced?
    return False
$c$),

('00000000-0000-0000-0000-0000000a0005', 'cpp', $c$int lengthOfLongestSubstring(const string& s) {
    // TODO: longest substring with no repeated character.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0005', 'python', $c$def length_of_longest_substring(s):
    # TODO: longest substring with no repeated character.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0006', 'cpp', $c$string minWindow(const string& s, const string& t) {
    // TODO: shortest substring of s containing all of t, or "".
    return "";
}
$c$),
('00000000-0000-0000-0000-0000000a0006', 'python', $c$def min_window(s, t):
    # TODO: shortest substring of s containing all of t, or "".
    return ""
$c$),

('00000000-0000-0000-0000-0000000a0007', 'cpp', $c$#include <set>

// Keep this struct - the tests build Point values directly.
struct Point
{
    int x;
    int y;
};

// A vertical line is x = c. You only have to answer whether such a c exists.
bool hasVerticalSymmetry(const vector<Point>& points) {
    // TODO
    return false;
}
$c$),
('00000000-0000-0000-0000-0000000a0007', 'python', $c$# points is a list of (x, y) tuples.
# A vertical line is x = c. You only have to answer whether such a c exists.
def has_vertical_symmetry(points):
    # TODO
    return False
$c$),

('00000000-0000-0000-0000-0000000a0008', 'cpp', $c$#include <map>
#include <numeric>

// Keep this struct - the tests build Point values directly.
struct Point
{
    int x;
    int y;
};

int maxPoints(const vector<Point>& points) {
    // TODO: how many points share one straight line?
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0008', 'python', $c$# points is a list of (x, y) tuples.
def max_points(points):
    # TODO: how many points share one straight line?
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0009', 'cpp', $c$#include <utility>

int numIslands(vector<vector<char>> grid) {
    // TODO: count groups of '1' connected up/down/left/right.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0009', 'python', $c$# grid is a list of lists of the characters '1' and '0'.
def num_islands(grid):
    # TODO: count groups of '1' connected up/down/left/right.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0010', 'cpp', $c$bool canFinish(int numCourses, const vector<vector<int>>& prerequisites) {
    // Each prerequisites[i] is {course, prereq}: prereq must come first.
    // TODO
    return false;
}
$c$),
('00000000-0000-0000-0000-0000000a0010', 'python', $c$def can_finish(num_courses, prerequisites):
    # Each prerequisites[i] is [course, prereq]: prereq must come first.
    # TODO
    return False
$c$),

('00000000-0000-0000-0000-0000000a0011', 'cpp', $c$#include <utility>

int orangesRotting(vector<vector<int>> grid) {
    // TODO: minutes until nothing fresh is left, or -1.
    return -1;
}
$c$),
('00000000-0000-0000-0000-0000000a0011', 'python', $c$def oranges_rotting(grid):
    # TODO: minutes until nothing fresh is left, or -1.
    return -1
$c$),

('00000000-0000-0000-0000-0000000a0012', 'cpp', $c$#include <vector>
#include <numeric>

struct Gamer
{
    mutable int rating = 0;
};

struct Captain : Gamer
{
    mutable int rating = -1000;
};

static constexpr auto initialTeamRating = 0u;
static constexpr auto teamMaxSize = 100u;
static constexpr auto ratingBoost = 100u;

using Team = std::vector<Gamer>;

// What the season is expected to produce. Keep this struct as it is.
struct Report
{
    long long total = 0;
    int captainRating = 0;
    int teamSize = 0;
};

void recruit(Team* t, size_t count)
{
    for (size_t i = count; i >= 0; i--) {
        t->push_back( * new Gamer());

        if (t->size() > teamMaxSize )
        {
            break;
        }
    }
}

void boostRatings(Team* t)
{
    for (const auto g : *t) {
        g.rating += ratingBoost;
    }
}

Report playSeason()
{
    Team t;
    t.push_back(*new Captain());
    const Gamer& captain = t[0];

    recruit(&t, 7);
    boostRatings(&t);

    auto total = std::accumulate(
        t.begin(), t.end(), initialTeamRating,
        [](auto sum, auto g) { return sum + g.rating; }
    );

    return Report{ total, captain.rating, (int)t.size() };
}
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

-- --------------------------------------------------------------------------
-- Reference solutions
-- --------------------------------------------------------------------------
INSERT INTO problem_solutions (id, problem_id, language, title, code) VALUES
('00000000-0000-0000-0000-0000000b0001', '00000000-0000-0000-0000-0000000a0001', 'cpp', 'one pass with a hash map',
$c$#include <unordered_map>

vector<int> twoSum(const vector<int>& nums, int target) {
    unordered_map<int, int> seen;
    for (int i = 0; i < (int)nums.size(); i++) {
        auto it = seen.find(target - nums[i]);
        if (it != seen.end()) return {it->second, i};
        seen[nums[i]] = i;
    }
    return {};
}
$c$),
('00000000-0000-0000-0000-0000000b0002', '00000000-0000-0000-0000-0000000a0001', 'python', 'one pass with a dict',
$c$def two_sum(nums, target):
    seen = {}
    for i, value in enumerate(nums):
        if target - value in seen:
            return [seen[target - value], i]
        seen[value] = i
    return []
$c$),

('00000000-0000-0000-0000-0000000b0003', '00000000-0000-0000-0000-0000000a0002', 'cpp', 'prefix and suffix products',
$c$vector<int> productExceptSelf(const vector<int>& nums) {
    int n = (int)nums.size();
    vector<int> out(n, 1);
    int prefix = 1;
    for (int i = 0; i < n; i++) {
        out[i] = prefix;
        prefix *= nums[i];
    }
    int suffix = 1;
    for (int i = n - 1; i >= 0; i--) {
        out[i] *= suffix;
        suffix *= nums[i];
    }
    return out;
}
$c$),
('00000000-0000-0000-0000-0000000b0004', '00000000-0000-0000-0000-0000000a0002', 'python', 'prefix and suffix products',
$c$def product_except_self(nums):
    out = [1] * len(nums)
    prefix = 1
    for i, value in enumerate(nums):
        out[i] = prefix
        prefix *= value
    suffix = 1
    for i in range(len(nums) - 1, -1, -1):
        out[i] *= suffix
        suffix *= nums[i]
    return out
$c$),

('00000000-0000-0000-0000-0000000b0005', '00000000-0000-0000-0000-0000000a0003', 'cpp', 'hash set, walk up from run starts only',
$c$#include <unordered_set>

int longestConsecutive(const vector<int>& nums) {
    unordered_set<int> values(nums.begin(), nums.end());
    int best = 0;
    for (int value : values) {
        if (values.count(value - 1)) continue;  // not the start of a run
        int length = 1;
        while (values.count(value + length)) length++;
        best = max(best, length);
    }
    return best;
}
$c$),
('00000000-0000-0000-0000-0000000b0006', '00000000-0000-0000-0000-0000000a0003', 'python', 'set, walk up from run starts only',
$c$def longest_consecutive(nums):
    values = set(nums)
    best = 0
    for value in values:
        if value - 1 in values:
            continue  # not the start of a run
        length = 1
        while value + length in values:
            length += 1
        best = max(best, length)
    return best
$c$),

('00000000-0000-0000-0000-0000000b0007', '00000000-0000-0000-0000-0000000a0004', 'cpp', 'stack of open brackets',
$c$bool isValid(const string& s) {
    string open;
    for (char c : s) {
        if (c == '(' || c == '[' || c == '{') {
            open += c;
            continue;
        }
        if (open.empty()) return false;
        char last = open.back();
        open.pop_back();
        if ((c == ')' && last != '(') || (c == ']' && last != '[') || (c == '}' && last != '{')) {
            return false;
        }
    }
    return open.empty();
}
$c$),
('00000000-0000-0000-0000-0000000b0008', '00000000-0000-0000-0000-0000000a0004', 'python', 'stack of open brackets',
$c$def is_valid(s):
    closing = {')': '(', ']': '[', '}': '{'}
    open_brackets = []
    for c in s:
        if c in closing:
            if not open_brackets or open_brackets.pop() != closing[c]:
                return False
        else:
            open_brackets.append(c)
    return not open_brackets
$c$),

('00000000-0000-0000-0000-0000000b0009', '00000000-0000-0000-0000-0000000a0005', 'cpp', 'sliding window with last-seen index',
$c$int lengthOfLongestSubstring(const string& s) {
    vector<int> lastSeen(256, -1);
    int start = 0, best = 0;
    for (int i = 0; i < (int)s.size(); i++) {
        unsigned char c = (unsigned char)s[i];
        if (lastSeen[c] >= start) start = lastSeen[c] + 1;
        lastSeen[c] = i;
        best = max(best, i - start + 1);
    }
    return best;
}
$c$),
('00000000-0000-0000-0000-0000000b0010', '00000000-0000-0000-0000-0000000a0005', 'python', 'sliding window with last-seen index',
$c$def length_of_longest_substring(s):
    last_seen = {}
    start = 0
    best = 0
    for i, c in enumerate(s):
        if c in last_seen and last_seen[c] >= start:
            start = last_seen[c] + 1
        last_seen[c] = i
        best = max(best, i - start + 1)
    return best
$c$),

('00000000-0000-0000-0000-0000000b0011', '00000000-0000-0000-0000-0000000a0006', 'cpp', 'sliding window with a missing counter',
$c$string minWindow(const string& s, const string& t) {
    if (s.empty() || t.empty()) return "";
    vector<int> need(256, 0);
    for (unsigned char c : t) need[c]++;

    int missing = (int)t.size(), left = 0, bestLeft = 0, bestLength = 0;
    for (int right = 0; right < (int)s.size(); right++) {
        unsigned char c = (unsigned char)s[right];
        if (need[c] > 0) missing--;
        need[c]--;
        while (missing == 0) {
            if (bestLength == 0 || right - left + 1 < bestLength) {
                bestLeft = left;
                bestLength = right - left + 1;
            }
            unsigned char dropped = (unsigned char)s[left];
            need[dropped]++;
            if (need[dropped] > 0) missing++;
            left++;
        }
    }
    return s.substr(bestLeft, bestLength);
}
$c$),
('00000000-0000-0000-0000-0000000b0012', '00000000-0000-0000-0000-0000000a0006', 'python', 'sliding window with a missing counter',
$c$from collections import Counter


def min_window(s, t):
    if not s or not t:
        return ""
    need = Counter(t)
    missing = len(t)
    left = 0
    best_left, best_right = 0, 0
    for right, c in enumerate(s):
        if need[c] > 0:
            missing -= 1
        need[c] -= 1
        while missing == 0:
            if best_right == 0 or right - left + 1 < best_right - best_left:
                best_left, best_right = left, right + 1
            need[s[left]] += 1
            if need[s[left]] > 0:
                missing += 1
            left += 1
    return s[best_left:best_right]
$c$),

('00000000-0000-0000-0000-0000000b0013', '00000000-0000-0000-0000-0000000a0007', 'cpp', 'mirror every point about the extremes',
$c$#include <set>

// If any vertical axis works, it is the one halfway between the leftmost and
// the rightmost point - nothing else can map those two onto each other. Its
// position is (minX + maxX) / 2, which may be a half-integer, so mirror with
// (minX + maxX) - x and never divide.
struct Point
{
    int x;
    int y;
};

bool hasVerticalSymmetry(const vector<Point>& points) {
    if (points.size() < 2) return true;

    set<pair<int, int>> present;
    int minX = points[0].x, maxX = points[0].x;
    for (const Point& p : points) {
        present.insert({p.x, p.y});
        minX = min(minX, p.x);
        maxX = max(maxX, p.x);
    }

    const int doubledAxis = minX + maxX;
    for (const Point& p : points) {
        if (!present.count({doubledAxis - p.x, p.y})) return false;
    }
    return true;
}
$c$),
('00000000-0000-0000-0000-0000000b0014', '00000000-0000-0000-0000-0000000a0007', 'python', 'mirror every point about the extremes',
$c$# If any vertical axis works, it is the one halfway between the leftmost and
# the rightmost point. Its position may be a half-integer, so mirror with
# (min_x + max_x) - x and never divide.
def has_vertical_symmetry(points):
    if len(points) < 2:
        return True
    present = set(points)
    doubled_axis = min(x for x, _ in points) + max(x for x, _ in points)
    return all((doubled_axis - x, y) in present for x, y in points)
$c$),

('00000000-0000-0000-0000-0000000b0015', '00000000-0000-0000-0000-0000000a0008', 'cpp', 'anchor each point, count reduced slopes',
$c$#include <map>
#include <numeric>

struct Point
{
    int x;
    int y;
};

int maxPoints(const vector<Point>& points) {
    const int n = (int)points.size();
    if (n <= 2) return n;

    int best = 1;
    for (int i = 0; i < n; i++) {
        // Exact slopes as a reduced (dx, dy) pair - no floating point, and a
        // vertical line is just dx == 0.
        map<pair<int, int>, int> slopes;
        for (int j = i + 1; j < n; j++) {
            int dx = points[j].x - points[i].x;
            int dy = points[j].y - points[i].y;
            const int g = gcd(dx, dy);
            if (g != 0) { dx /= g; dy /= g; }
            if (dx < 0 || (dx == 0 && dy < 0)) { dx = -dx; dy = -dy; }
            best = max(best, ++slopes[{dx, dy}] + 1);
        }
    }
    return best;
}
$c$),
('00000000-0000-0000-0000-0000000b0016', '00000000-0000-0000-0000-0000000a0008', 'python', 'anchor each point, count reduced slopes',
$c$from math import gcd


def max_points(points):
    n = len(points)
    if n <= 2:
        return n

    best = 1
    for i in range(n):
        # Exact slopes as a reduced (dx, dy) pair - no floating point.
        slopes = {}
        for j in range(i + 1, n):
            dx = points[j][0] - points[i][0]
            dy = points[j][1] - points[i][1]
            g = gcd(dx, dy)
            if g:
                dx //= g
                dy //= g
            if dx < 0 or (dx == 0 and dy < 0):
                dx, dy = -dx, -dy
            slopes[(dx, dy)] = slopes.get((dx, dy), 0) + 1
            best = max(best, slopes[(dx, dy)] + 1)
    return best
$c$),

('00000000-0000-0000-0000-0000000b0017', '00000000-0000-0000-0000-0000000a0009', 'cpp', 'flood fill with an explicit stack',
$c$#include <utility>

int numIslands(vector<vector<char>> grid) {
    if (grid.empty()) return 0;
    const int rows = (int)grid.size(), cols = (int)grid[0].size();
    const int dy[] = {1, -1, 0, 0}, dx[] = {0, 0, 1, -1};

    int count = 0;
    vector<pair<int, int>> stack;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] != '1') continue;
            count++;
            grid[r][c] = '0';
            stack.push_back({r, c});
            while (!stack.empty()) {
                auto [y, x] = stack.back();
                stack.pop_back();
                for (int k = 0; k < 4; k++) {
                    const int ny = y + dy[k], nx = x + dx[k];
                    if (ny < 0 || ny >= rows || nx < 0 || nx >= cols) continue;
                    if (grid[ny][nx] != '1') continue;
                    grid[ny][nx] = '0';
                    stack.push_back({ny, nx});
                }
            }
        }
    }
    return count;
}
$c$),
('00000000-0000-0000-0000-0000000b0018', '00000000-0000-0000-0000-0000000a0009', 'python', 'flood fill with an explicit stack',
$c$def num_islands(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    count = 0
    for r in range(rows):
        for c in range(cols):
            if grid[r][c] != '1':
                continue
            count += 1
            grid[r][c] = '0'
            stack = [(r, c)]
            while stack:
                y, x = stack.pop()
                for ny, nx in ((y + 1, x), (y - 1, x), (y, x + 1), (y, x - 1)):
                    if 0 <= ny < rows and 0 <= nx < cols and grid[ny][nx] == '1':
                        grid[ny][nx] = '0'
                        stack.append((ny, nx))
    return count
$c$),

('00000000-0000-0000-0000-0000000b0019', '00000000-0000-0000-0000-0000000a0010', 'cpp', 'topological sort by in-degree',
$c$bool canFinish(int numCourses, const vector<vector<int>>& prerequisites) {
    vector<vector<int>> next(numCourses);
    vector<int> indegree(numCourses, 0);
    for (const auto& edge : prerequisites) {
        next[edge[1]].push_back(edge[0]);
        indegree[edge[0]]++;
    }

    vector<int> ready;
    for (int i = 0; i < numCourses; i++) {
        if (indegree[i] == 0) ready.push_back(i);
    }

    int taken = 0;
    while (!ready.empty()) {
        const int course = ready.back();
        ready.pop_back();
        taken++;
        for (int unlocked : next[course]) {
            if (--indegree[unlocked] == 0) ready.push_back(unlocked);
        }
    }
    return taken == numCourses;
}
$c$),
('00000000-0000-0000-0000-0000000b0020', '00000000-0000-0000-0000-0000000a0010', 'python', 'topological sort by in-degree',
$c$def can_finish(num_courses, prerequisites):
    nxt = [[] for _ in range(num_courses)]
    indegree = [0] * num_courses
    for course, prereq in prerequisites:
        nxt[prereq].append(course)
        indegree[course] += 1

    ready = [i for i in range(num_courses) if indegree[i] == 0]
    taken = 0
    while ready:
        course = ready.pop()
        taken += 1
        for unlocked in nxt[course]:
            indegree[unlocked] -= 1
            if indegree[unlocked] == 0:
                ready.append(unlocked)
    return taken == num_courses
$c$),

('00000000-0000-0000-0000-0000000b0021', '00000000-0000-0000-0000-0000000a0011', 'cpp', 'breadth-first search, one whole frontier per minute',
$c$#include <utility>

int orangesRotting(vector<vector<int>> grid) {
    if (grid.empty()) return 0;
    const int rows = (int)grid.size(), cols = (int)grid[0].size();
    const int dy[] = {1, -1, 0, 0}, dx[] = {0, 0, 1, -1};

    int fresh = 0;
    vector<pair<int, int>> frontier;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < cols; c++) {
            if (grid[r][c] == 2) frontier.push_back({r, c});
            else if (grid[r][c] == 1) fresh++;
        }
    }

    int minutes = 0;
    while (!frontier.empty() && fresh > 0) {
        vector<pair<int, int>> nextFrontier;
        for (auto [r, c] : frontier) {
            for (int k = 0; k < 4; k++) {
                const int nr = r + dy[k], nc = c + dx[k];
                if (nr < 0 || nr >= rows || nc < 0 || nc >= cols) continue;
                if (grid[nr][nc] != 1) continue;
                grid[nr][nc] = 2;
                fresh--;
                nextFrontier.push_back({nr, nc});
            }
        }
        frontier = nextFrontier;
        minutes++;
    }
    return fresh > 0 ? -1 : minutes;
}
$c$),
('00000000-0000-0000-0000-0000000b0022', '00000000-0000-0000-0000-0000000a0011', 'python', 'breadth-first search, one whole frontier per minute',
$c$def oranges_rotting(grid):
    if not grid:
        return 0
    rows, cols = len(grid), len(grid[0])
    frontier = [(r, c) for r in range(rows) for c in range(cols) if grid[r][c] == 2]
    fresh = sum(row.count(1) for row in grid)

    minutes = 0
    while frontier and fresh:
        next_frontier = []
        for r, c in frontier:
            for nr, nc in ((r + 1, c), (r - 1, c), (r, c + 1), (r, c - 1)):
                if 0 <= nr < rows and 0 <= nc < cols and grid[nr][nc] == 1:
                    grid[nr][nc] = 2
                    fresh -= 1
                    next_frontier.append((nr, nc))
        frontier = next_frontier
        minutes += 1
    return -1 if fresh else minutes
$c$),

('00000000-0000-0000-0000-0000000b0023', '00000000-0000-0000-0000-0000000a0012', 'cpp', 'all six bugs fixed',
$c$#include <vector>
#include <numeric>

// (1) `mutable` was only there to let boostRatings() modify a const copy -
//     which silently did nothing. Plain members now.
struct Gamer
{
    int rating = 0;
};

// (2) Captain used to re-declare `rating`, shadowing Gamer::rating instead of
//     setting it - and since a Team stores Gamer values, push_back sliced the
//     Captain away and the -1000 with it. Set the inherited member instead.
struct Captain : Gamer
{
    Captain() { rating = -1000; }
};

// (3) The accumulator seed was unsigned, so a negative total wrapped around.
static constexpr auto initialTeamRating = 0;
static constexpr auto teamMaxSize = 100u;
static constexpr auto ratingBoost = 100;

using Team = std::vector<Gamer>;

struct Report
{
    long long total = 0;
    int captainRating = 0;
    int teamSize = 0;
};

void recruit(Team* t, size_t count)
{
    // (4) `for (size_t i = count; i >= 0; i--)` never ends: an unsigned value
    //     is always >= 0, so the loop only stopped at teamMaxSize.
    //     (5) `* new Gamer()` leaked a Gamer per recruit, too.
    for (size_t i = 0; i < count; i++) {
        if (t->size() >= teamMaxSize) break;
        t->push_back(Gamer{});
    }
}

void boostRatings(Team* t)
{
    // (6) `const auto g` copied each element; the boost went to the copy.
    for (auto& g : *t) {
        g.rating += ratingBoost;
    }
}

Report playSeason()
{
    Team t;
    t.push_back(Captain{});

    recruit(&t, 7);
    boostRatings(&t);

    const auto total = std::accumulate(
        t.begin(), t.end(), initialTeamRating,
        [](auto sum, const Gamer& g) { return sum + g.rating; }
    );

    // (7) The old `const Gamer& captain = t[0]` was taken before recruit()
    //     grew the vector, so every read through it was a dangling reference.
    return Report{ total, t[0].rating, (int)t.size() };
}
$c$)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Test code. public_code is shown to the candidate and runs on "Run";
-- hidden_code never reaches the browser and only runs on "Submit".
-- --------------------------------------------------------------------------
INSERT INTO problem_test_code (problem_id, language, public_code, hidden_code) VALUES
('00000000-0000-0000-0000-0000000a0001', 'cpp',
$c$TEST(TwoSum, FirstTwoElements) {
    vector<int> nums{2, 7, 11, 15};
    vector<int> expected{0, 1};
    EXPECT_EQ(twoSum(nums, 9), expected);
}

TEST(TwoSum, PairInTheMiddle) {
    vector<int> nums{3, 2, 4};
    vector<int> expected{1, 2};
    EXPECT_EQ(twoSum(nums, 6), expected);
}
$c$,
$c$TEST(TwoSum, SameValueTwice) {
    vector<int> nums{3, 3};
    vector<int> expected{0, 1};
    EXPECT_EQ(twoSum(nums, 6), expected);
}

TEST(TwoSum, NegativeNumbers) {
    vector<int> nums{-3, 4, 3, 90};
    vector<int> expected{0, 2};
    EXPECT_EQ(twoSum(nums, 0), expected);
}

TEST(TwoSum, PairAtTheEnd) {
    vector<int> nums{1, 5, 9, 2, 20};
    vector<int> expected{3, 4};
    EXPECT_EQ(twoSum(nums, 22), expected);
}
$c$),
('00000000-0000-0000-0000-0000000a0001', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_first_two_elements(self):
        self.assertEqual(list(two_sum([2, 7, 11, 15], 9)), [0, 1])

    def test_pair_in_the_middle(self):
        self.assertEqual(list(two_sum([3, 2, 4], 6)), [1, 2])
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_same_value_twice(self):
        self.assertEqual(list(two_sum([3, 3], 6)), [0, 1])

    def test_negative_numbers(self):
        self.assertEqual(list(two_sum([-3, 4, 3, 90], 0)), [0, 2])

    def test_pair_at_the_end(self):
        self.assertEqual(list(two_sum([1, 5, 9, 2, 20], 22)), [3, 4])
$c$),

('00000000-0000-0000-0000-0000000a0002', 'cpp',
$c$TEST(ProductExceptSelf, FourElements) {
    vector<int> nums{1, 2, 3, 4};
    vector<int> expected{24, 12, 8, 6};
    EXPECT_EQ(productExceptSelf(nums), expected);
}

TEST(ProductExceptSelf, ContainsAZero) {
    vector<int> nums{-1, 1, 0, -3, 3};
    vector<int> expected{0, 0, 9, 0, 0};
    EXPECT_EQ(productExceptSelf(nums), expected);
}
$c$,
$c$TEST(ProductExceptSelf, TwoElements) {
    vector<int> nums{2, 3};
    vector<int> expected{3, 2};
    EXPECT_EQ(productExceptSelf(nums), expected);
}

TEST(ProductExceptSelf, TwoZerosMakeEverythingZero) {
    vector<int> nums{0, 0, 5};
    vector<int> expected{0, 0, 0};
    EXPECT_EQ(productExceptSelf(nums), expected);
}

TEST(ProductExceptSelf, NegativesKeepTheirSign) {
    vector<int> nums{-1, -2, -3};
    vector<int> expected{6, 3, 2};
    EXPECT_EQ(productExceptSelf(nums), expected);
}
$c$),
('00000000-0000-0000-0000-0000000a0002', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_four_elements(self):
        self.assertEqual(list(product_except_self([1, 2, 3, 4])), [24, 12, 8, 6])

    def test_contains_a_zero(self):
        self.assertEqual(list(product_except_self([-1, 1, 0, -3, 3])), [0, 0, 9, 0, 0])
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_two_elements(self):
        self.assertEqual(list(product_except_self([2, 3])), [3, 2])

    def test_two_zeros_make_everything_zero(self):
        self.assertEqual(list(product_except_self([0, 0, 5])), [0, 0, 0])

    def test_negatives_keep_their_sign(self):
        self.assertEqual(list(product_except_self([-1, -2, -3])), [6, 3, 2])
$c$),

('00000000-0000-0000-0000-0000000a0003', 'cpp',
$c$TEST(LongestConsecutive, ScatteredRun) {
    vector<int> nums{100, 4, 200, 1, 3, 2};
    EXPECT_EQ(longestConsecutive(nums), 4);
}

TEST(LongestConsecutive, EmptyInput) {
    vector<int> nums{};
    EXPECT_EQ(longestConsecutive(nums), 0);
}
$c$,
$c$TEST(LongestConsecutive, DuplicatesCountOnce) {
    vector<int> nums{1, 2, 0, 1};
    EXPECT_EQ(longestConsecutive(nums), 3);
}

TEST(LongestConsecutive, SingleValue) {
    vector<int> nums{5};
    EXPECT_EQ(longestConsecutive(nums), 1);
}

TEST(LongestConsecutive, LongRunWithNoise) {
    vector<int> nums{0, 3, 7, 2, 5, 8, 4, 6, 0, 1};
    EXPECT_EQ(longestConsecutive(nums), 9);
}

TEST(LongestConsecutive, NegativeValues) {
    vector<int> nums{-3, -2, -1, 5, 9};
    EXPECT_EQ(longestConsecutive(nums), 3);
}
$c$),
('00000000-0000-0000-0000-0000000a0003', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_scattered_run(self):
        self.assertEqual(longest_consecutive([100, 4, 200, 1, 3, 2]), 4)

    def test_empty_input(self):
        self.assertEqual(longest_consecutive([]), 0)
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_duplicates_count_once(self):
        self.assertEqual(longest_consecutive([1, 2, 0, 1]), 3)

    def test_single_value(self):
        self.assertEqual(longest_consecutive([5]), 1)

    def test_long_run_with_noise(self):
        self.assertEqual(longest_consecutive([0, 3, 7, 2, 5, 8, 4, 6, 0, 1]), 9)

    def test_negative_values(self):
        self.assertEqual(longest_consecutive([-3, -2, -1, 5, 9]), 3)
$c$),

('00000000-0000-0000-0000-0000000a0004', 'cpp',
$c$TEST(ValidParentheses, SimplePair) { EXPECT_TRUE(isValid("()")); }
TEST(ValidParentheses, AllThreeKinds) { EXPECT_TRUE(isValid("()[]{}")); }
TEST(ValidParentheses, MismatchedKind) { EXPECT_FALSE(isValid("(]")); }
$c$,
$c$TEST(ValidParentheses, Interleaved) { EXPECT_FALSE(isValid("([)]")); }
TEST(ValidParentheses, Nested) { EXPECT_TRUE(isValid("{[]}")); }
TEST(ValidParentheses, EmptyString) { EXPECT_TRUE(isValid("")); }
TEST(ValidParentheses, LeftOpen) { EXPECT_FALSE(isValid("(")); }
TEST(ValidParentheses, ClosedWithoutOpening) { EXPECT_FALSE(isValid(")")); }
TEST(ValidParentheses, DeepNesting) { EXPECT_TRUE(isValid("({[({[]})]})")); }
$c$),
('00000000-0000-0000-0000-0000000a0004', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_simple_pair(self):
        self.assertTrue(is_valid('()'))

    def test_all_three_kinds(self):
        self.assertTrue(is_valid('()[]{}'))

    def test_mismatched_kind(self):
        self.assertFalse(is_valid('(]'))
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_interleaved(self):
        self.assertFalse(is_valid('([)]'))

    def test_nested(self):
        self.assertTrue(is_valid('{[]}'))

    def test_empty_string(self):
        self.assertTrue(is_valid(''))

    def test_left_open(self):
        self.assertFalse(is_valid('('))

    def test_closed_without_opening(self):
        self.assertFalse(is_valid(')'))

    def test_deep_nesting(self):
        self.assertTrue(is_valid('({[({[]})]})'))
$c$),

('00000000-0000-0000-0000-0000000a0005', 'cpp',
$c$TEST(LongestSubstring, AbcabcbbIsThree) { EXPECT_EQ(lengthOfLongestSubstring("abcabcbb"), 3); }
TEST(LongestSubstring, AllSameIsOne) { EXPECT_EQ(lengthOfLongestSubstring("bbbbb"), 1); }
TEST(LongestSubstring, PwwkewIsThree) { EXPECT_EQ(lengthOfLongestSubstring("pwwkew"), 3); }
$c$,
$c$TEST(LongestSubstring, EmptyString) { EXPECT_EQ(lengthOfLongestSubstring(""), 0); }
TEST(LongestSubstring, SingleSpace) { EXPECT_EQ(lengthOfLongestSubstring(" "), 1); }
TEST(LongestSubstring, WindowMustNotShrinkBackwards) { EXPECT_EQ(lengthOfLongestSubstring("abba"), 2); }
TEST(LongestSubstring, DvdfIsThree) { EXPECT_EQ(lengthOfLongestSubstring("dvdf"), 3); }
TEST(LongestSubstring, AllDistinct) { EXPECT_EQ(lengthOfLongestSubstring("abcdefg"), 7); }
$c$),
('00000000-0000-0000-0000-0000000a0005', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_abcabcbb_is_three(self):
        self.assertEqual(length_of_longest_substring('abcabcbb'), 3)

    def test_all_same_is_one(self):
        self.assertEqual(length_of_longest_substring('bbbbb'), 1)

    def test_pwwkew_is_three(self):
        self.assertEqual(length_of_longest_substring('pwwkew'), 3)
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_empty_string(self):
        self.assertEqual(length_of_longest_substring(''), 0)

    def test_single_space(self):
        self.assertEqual(length_of_longest_substring(' '), 1)

    def test_window_must_not_shrink_backwards(self):
        self.assertEqual(length_of_longest_substring('abba'), 2)

    def test_dvdf_is_three(self):
        self.assertEqual(length_of_longest_substring('dvdf'), 3)

    def test_all_distinct(self):
        self.assertEqual(length_of_longest_substring('abcdefg'), 7)
$c$),

('00000000-0000-0000-0000-0000000a0006', 'cpp',
$c$TEST(MinWindow, ClassicExample) { EXPECT_EQ(minWindow("ADOBECODEBANC", "ABC"), "BANC"); }
TEST(MinWindow, SingleCharacter) { EXPECT_EQ(minWindow("a", "a"), "a"); }
TEST(MinWindow, NotEnoughCopies) { EXPECT_EQ(minWindow("a", "aa"), ""); }
$c$,
$c$TEST(MinWindow, TailOfTheString) { EXPECT_EQ(minWindow("ab", "b"), "b"); }
TEST(MinWindow, RepeatsInTheWindow) { EXPECT_EQ(minWindow("bba", "ab"), "ba"); }
TEST(MinWindow, NoMatchAtAll) { EXPECT_EQ(minWindow("abc", "z"), ""); }
TEST(MinWindow, EmptyNeedle) { EXPECT_EQ(minWindow("abc", ""), ""); }
TEST(MinWindow, ShortestOfSeveral) { EXPECT_EQ(minWindow("cabefgecdaecf", "cae"), "aec"); }
$c$),
('00000000-0000-0000-0000-0000000a0006', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_classic_example(self):
        self.assertEqual(min_window('ADOBECODEBANC', 'ABC'), 'BANC')

    def test_single_character(self):
        self.assertEqual(min_window('a', 'a'), 'a')

    def test_not_enough_copies(self):
        self.assertEqual(min_window('a', 'aa'), '')
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_tail_of_the_string(self):
        self.assertEqual(min_window('ab', 'b'), 'b')

    def test_repeats_in_the_window(self):
        self.assertEqual(min_window('bba', 'ab'), 'ba')

    def test_no_match_at_all(self):
        self.assertEqual(min_window('abc', 'z'), '')

    def test_empty_needle(self):
        self.assertEqual(min_window('abc', ''), '')

    def test_shortest_of_several(self):
        self.assertEqual(min_window('cabefgecdaecf', 'cae'), 'aec')
$c$),

('00000000-0000-0000-0000-0000000a0007', 'cpp',
$c$TEST(VerticalSymmetry, SinglePoint) {
    vector<Point> points{{0, 0}};
    EXPECT_TRUE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, TwoPointsAlwaysHaveAnAxis) {
    vector<Point> points{{-1, 0}, {1, 0}};
    EXPECT_TRUE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, ThreeSymmetricPoints) {
    vector<Point> points{{-2, 1}, {0, 1}, {2, 1}};
    EXPECT_TRUE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, ThreeAsymmetricPoints) {
    vector<Point> points{{-1, 1}, {1, 1}, {-1, 3}};
    EXPECT_FALSE(hasVerticalSymmetry(points));
}
$c$,
$c$TEST(VerticalSymmetry, EmptySet) {
    vector<Point> points{};
    EXPECT_TRUE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, AxisBetweenTwoColumns) {
    vector<Point> points{{1, 0}, {2, 0}};
    EXPECT_TRUE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, ComplexSymmetricCase) {
    vector<Point> points{{-3, 2}, {-1, 2}, {0, 2}, {1, 2}, {3, 2}};
    EXPECT_TRUE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, ComplexAsymmetricCase) {
    vector<Point> points{{-3, 2}, {-1, 2}, {0, 2}, {2, 2}, {3, 2}};
    EXPECT_FALSE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, RowsMustMatchIndividually) {
    vector<Point> points{{0, 0}, {2, 0}, {0, 5}};
    EXPECT_FALSE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, MeanOfXIsNotTheAxis) {
    vector<Point> points{{0, 0}, {1, 0}, {2, 0}, {10, 0}};
    EXPECT_FALSE(hasVerticalSymmetry(points));
}

TEST(VerticalSymmetry, ThreeCollinearPointsOffCentre) {
    vector<Point> points{{1, 0}, {2, 0}, {4, 0}};
    EXPECT_FALSE(hasVerticalSymmetry(points));
}
$c$),
('00000000-0000-0000-0000-0000000a0007', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_single_point(self):
        self.assertTrue(has_vertical_symmetry([(0, 0)]))

    def test_two_points_always_have_an_axis(self):
        self.assertTrue(has_vertical_symmetry([(-1, 0), (1, 0)]))

    def test_three_symmetric_points(self):
        self.assertTrue(has_vertical_symmetry([(-2, 1), (0, 1), (2, 1)]))

    def test_three_asymmetric_points(self):
        self.assertFalse(has_vertical_symmetry([(-1, 1), (1, 1), (-1, 3)]))
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_empty_set(self):
        self.assertTrue(has_vertical_symmetry([]))

    def test_axis_between_two_columns(self):
        self.assertTrue(has_vertical_symmetry([(1, 0), (2, 0)]))

    def test_complex_symmetric_case(self):
        self.assertTrue(has_vertical_symmetry([(-3, 2), (-1, 2), (0, 2), (1, 2), (3, 2)]))

    def test_complex_asymmetric_case(self):
        self.assertFalse(has_vertical_symmetry([(-3, 2), (-1, 2), (0, 2), (2, 2), (3, 2)]))

    def test_rows_must_match_individually(self):
        self.assertFalse(has_vertical_symmetry([(0, 0), (2, 0), (0, 5)]))

    def test_mean_of_x_is_not_the_axis(self):
        self.assertFalse(has_vertical_symmetry([(0, 0), (1, 0), (2, 0), (10, 0)]))

    def test_three_collinear_points_off_centre(self):
        self.assertFalse(has_vertical_symmetry([(1, 0), (2, 0), (4, 0)]))
$c$),

('00000000-0000-0000-0000-0000000a0008', 'cpp',
$c$TEST(MaxPoints, ThreeOnADiagonal) {
    vector<Point> points{{1, 1}, {2, 2}, {3, 3}};
    EXPECT_EQ(maxPoints(points), 3);
}

TEST(MaxPoints, FourOutOfSix) {
    vector<Point> points{{1, 1}, {3, 2}, {5, 3}, {4, 1}, {2, 3}, {1, 4}};
    EXPECT_EQ(maxPoints(points), 4);
}
$c$,
$c$TEST(MaxPoints, EmptyInput) {
    vector<Point> points{};
    EXPECT_EQ(maxPoints(points), 0);
}

TEST(MaxPoints, SinglePoint) {
    vector<Point> points{{7, 7}};
    EXPECT_EQ(maxPoints(points), 1);
}

TEST(MaxPoints, TwoPointsAreAlwaysALine) {
    vector<Point> points{{0, 0}, {5, 9}};
    EXPECT_EQ(maxPoints(points), 2);
}

TEST(MaxPoints, VerticalLine) {
    vector<Point> points{{0, 0}, {0, 1}, {0, 2}, {1, 5}};
    EXPECT_EQ(maxPoints(points), 3);
}

TEST(MaxPoints, HorizontalLine) {
    vector<Point> points{{-4, 3}, {0, 3}, {9, 3}, {2, -8}};
    EXPECT_EQ(maxPoints(points), 3);
}

TEST(MaxPoints, LargeCoordinatesNeedExactSlopes) {
    vector<Point> points{{0, 0}, {100000, 100000}, {100001, 100001}, {1, 3}};
    EXPECT_EQ(maxPoints(points), 3);
}
$c$),
('00000000-0000-0000-0000-0000000a0008', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_three_on_a_diagonal(self):
        self.assertEqual(max_points([(1, 1), (2, 2), (3, 3)]), 3)

    def test_four_out_of_six(self):
        self.assertEqual(max_points([(1, 1), (3, 2), (5, 3), (4, 1), (2, 3), (1, 4)]), 4)
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_empty_input(self):
        self.assertEqual(max_points([]), 0)

    def test_single_point(self):
        self.assertEqual(max_points([(7, 7)]), 1)

    def test_two_points_are_always_a_line(self):
        self.assertEqual(max_points([(0, 0), (5, 9)]), 2)

    def test_vertical_line(self):
        self.assertEqual(max_points([(0, 0), (0, 1), (0, 2), (1, 5)]), 3)

    def test_horizontal_line(self):
        self.assertEqual(max_points([(-4, 3), (0, 3), (9, 3), (2, -8)]), 3)

    def test_large_coordinates_need_exact_slopes(self):
        self.assertEqual(max_points([(0, 0), (100000, 100000), (100001, 100001), (1, 3)]), 3)
$c$),

('00000000-0000-0000-0000-0000000a0009', 'cpp',
$c$TEST(NumIslands, OneBigIsland) {
    vector<vector<char>> grid{
        {'1', '1', '1', '1', '0'},
        {'1', '1', '0', '1', '0'},
        {'1', '1', '0', '0', '0'},
        {'0', '0', '0', '0', '0'},
    };
    EXPECT_EQ(numIslands(grid), 1);
}

TEST(NumIslands, ThreeIslands) {
    vector<vector<char>> grid{
        {'1', '1', '0', '0', '0'},
        {'1', '1', '0', '0', '0'},
        {'0', '0', '1', '0', '0'},
        {'0', '0', '0', '1', '1'},
    };
    EXPECT_EQ(numIslands(grid), 3);
}
$c$,
$c$TEST(NumIslands, AllWater) {
    vector<vector<char>> grid{
        {'0', '0'},
        {'0', '0'},
    };
    EXPECT_EQ(numIslands(grid), 0);
}

TEST(NumIslands, DiagonalsAreNotConnected) {
    vector<vector<char>> grid{
        {'1', '0', '1'},
        {'0', '1', '0'},
        {'1', '0', '1'},
    };
    EXPECT_EQ(numIslands(grid), 5);
}

TEST(NumIslands, SingleRow) {
    vector<vector<char>> grid{
        {'1', '0', '1', '1', '0', '1'},
    };
    EXPECT_EQ(numIslands(grid), 3);
}

TEST(NumIslands, SingleColumn) {
    vector<vector<char>> grid{{'1'}, {'0'}, {'1'}, {'1'}};
    EXPECT_EQ(numIslands(grid), 2);
}

TEST(NumIslands, EmptyGrid) {
    vector<vector<char>> grid{};
    EXPECT_EQ(numIslands(grid), 0);
}
$c$),
('00000000-0000-0000-0000-0000000a0009', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_one_big_island(self):
        grid = [
            ['1', '1', '1', '1', '0'],
            ['1', '1', '0', '1', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '0', '0', '0'],
        ]
        self.assertEqual(num_islands(grid), 1)

    def test_three_islands(self):
        grid = [
            ['1', '1', '0', '0', '0'],
            ['1', '1', '0', '0', '0'],
            ['0', '0', '1', '0', '0'],
            ['0', '0', '0', '1', '1'],
        ]
        self.assertEqual(num_islands(grid), 3)
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_all_water(self):
        self.assertEqual(num_islands([['0', '0'], ['0', '0']]), 0)

    def test_diagonals_are_not_connected(self):
        grid = [
            ['1', '0', '1'],
            ['0', '1', '0'],
            ['1', '0', '1'],
        ]
        self.assertEqual(num_islands(grid), 5)

    def test_single_row(self):
        self.assertEqual(num_islands([['1', '0', '1', '1', '0', '1']]), 3)

    def test_single_column(self):
        self.assertEqual(num_islands([['1'], ['0'], ['1'], ['1']]), 2)

    def test_empty_grid(self):
        self.assertEqual(num_islands([]), 0)
$c$),

('00000000-0000-0000-0000-0000000a0010', 'cpp',
$c$TEST(CourseSchedule, OneDependency) {
    vector<vector<int>> prerequisites{{1, 0}};
    EXPECT_TRUE(canFinish(2, prerequisites));
}

TEST(CourseSchedule, TwoCoursesNeedEachOther) {
    vector<vector<int>> prerequisites{{1, 0}, {0, 1}};
    EXPECT_FALSE(canFinish(2, prerequisites));
}
$c$,
$c$TEST(CourseSchedule, LongChain) {
    vector<vector<int>> prerequisites{{1, 0}, {2, 1}, {3, 2}};
    EXPECT_TRUE(canFinish(4, prerequisites));
}

TEST(CourseSchedule, CycleOfThree) {
    vector<vector<int>> prerequisites{{0, 1}, {1, 2}, {2, 0}};
    EXPECT_FALSE(canFinish(3, prerequisites));
}

TEST(CourseSchedule, NoPrerequisitesAtAll) {
    vector<vector<int>> prerequisites{};
    EXPECT_TRUE(canFinish(5, prerequisites));
}

TEST(CourseSchedule, SelfDependency) {
    vector<vector<int>> prerequisites{{0, 0}};
    EXPECT_FALSE(canFinish(1, prerequisites));
}

TEST(CourseSchedule, CycleAmongOtherwiseFineCourses) {
    vector<vector<int>> prerequisites{{1, 0}, {3, 2}, {2, 3}, {4, 1}};
    EXPECT_FALSE(canFinish(5, prerequisites));
}

TEST(CourseSchedule, DiamondIsFine) {
    vector<vector<int>> prerequisites{{1, 0}, {2, 0}, {3, 1}, {3, 2}};
    EXPECT_TRUE(canFinish(4, prerequisites));
}
$c$),
('00000000-0000-0000-0000-0000000a0010', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_one_dependency(self):
        self.assertTrue(can_finish(2, [[1, 0]]))

    def test_two_courses_need_each_other(self):
        self.assertFalse(can_finish(2, [[1, 0], [0, 1]]))
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_long_chain(self):
        self.assertTrue(can_finish(4, [[1, 0], [2, 1], [3, 2]]))

    def test_cycle_of_three(self):
        self.assertFalse(can_finish(3, [[0, 1], [1, 2], [2, 0]]))

    def test_no_prerequisites_at_all(self):
        self.assertTrue(can_finish(5, []))

    def test_self_dependency(self):
        self.assertFalse(can_finish(1, [[0, 0]]))

    def test_cycle_among_otherwise_fine_courses(self):
        self.assertFalse(can_finish(5, [[1, 0], [3, 2], [2, 3], [4, 1]]))

    def test_diamond_is_fine(self):
        self.assertTrue(can_finish(4, [[1, 0], [2, 0], [3, 1], [3, 2]]))
$c$),

('00000000-0000-0000-0000-0000000a0011', 'cpp',
$c$TEST(RottingOranges, ClassicExample) {
    vector<vector<int>> grid{
        {2, 1, 1},
        {1, 1, 0},
        {0, 1, 1},
    };
    EXPECT_EQ(orangesRotting(grid), 4);
}

TEST(RottingOranges, UnreachableOrange) {
    vector<vector<int>> grid{
        {2, 1, 1},
        {0, 1, 1},
        {1, 0, 1},
    };
    EXPECT_EQ(orangesRotting(grid), -1);
}
$c$,
$c$TEST(RottingOranges, NothingFreshToBeginWith) {
    vector<vector<int>> grid{{0, 2}};
    EXPECT_EQ(orangesRotting(grid), 0);
}

TEST(RottingOranges, NoRottenOrangeAtAll) {
    vector<vector<int>> grid{{1, 1}, {1, 1}};
    EXPECT_EQ(orangesRotting(grid), -1);
}

TEST(RottingOranges, EmptyCellsOnly) {
    vector<vector<int>> grid{{0, 0, 0}};
    EXPECT_EQ(orangesRotting(grid), 0);
}

TEST(RottingOranges, TwoSourcesSpreadTogether) {
    vector<vector<int>> grid{
        {2, 1, 1, 1, 2},
    };
    EXPECT_EQ(orangesRotting(grid), 2);
}

TEST(RottingOranges, SingleFreshNeighbour) {
    vector<vector<int>> grid{{2, 1}};
    EXPECT_EQ(orangesRotting(grid), 1);
}
$c$),
('00000000-0000-0000-0000-0000000a0011', 'python',
$c$class PublicTests(unittest.TestCase):
    def test_classic_example(self):
        self.assertEqual(oranges_rotting([[2, 1, 1], [1, 1, 0], [0, 1, 1]]), 4)

    def test_unreachable_orange(self):
        self.assertEqual(oranges_rotting([[2, 1, 1], [0, 1, 1], [1, 0, 1]]), -1)
$c$,
$c$class HiddenTests(unittest.TestCase):
    def test_nothing_fresh_to_begin_with(self):
        self.assertEqual(oranges_rotting([[0, 2]]), 0)

    def test_no_rotten_orange_at_all(self):
        self.assertEqual(oranges_rotting([[1, 1], [1, 1]]), -1)

    def test_empty_cells_only(self):
        self.assertEqual(oranges_rotting([[0, 0, 0]]), 0)

    def test_two_sources_spread_together(self):
        self.assertEqual(oranges_rotting([[2, 1, 1, 1, 2]]), 2)

    def test_single_fresh_neighbour(self):
        self.assertEqual(oranges_rotting([[2, 1]]), 1)
$c$),

('00000000-0000-0000-0000-0000000a0012', 'cpp',
$c$TEST(BugsHunt, TotalIsMinusTwoHundred) {
    EXPECT_EQ(playSeason().total, -200);
}

TEST(BugsHunt, CaptainKeepsHisPenalty) {
    EXPECT_EQ(playSeason().captainRating, -900);
}
$c$,
$c$TEST(BugsHunt, CaptainPlusSevenRecruits) {
    EXPECT_EQ(playSeason().teamSize, 8);
}

TEST(BugsHunt, TheSeasonIsRepeatable) {
    const Report first = playSeason();
    const Report second = playSeason();
    EXPECT_EQ(first.total, second.total);
    EXPECT_EQ(first.captainRating, second.captainRating);
    EXPECT_EQ(first.teamSize, second.teamSize);
}
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

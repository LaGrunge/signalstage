-- Five more Problem-bank sections and twelve more shared problems, all with
-- C++ and Python starters, reference solutions and real test code:
--
--   algorithms/bits and bytes        Single Number, Reverse Bits, Decode Varints
--   algorithms/binary search         Search in Rotated Sorted Array, Minimum Eating Speed
--   algorithms/dynamic programming   Climbing Stairs, Coin Change, Longest Increasing Subsequence
--   algorithms/intervals and sorting Merge Intervals, Minimum Meeting Rooms
--   algorithms/stacks and queues     Min Stack, Daily Temperatures
--
-- Same conventions as 020: fixed ids, ON CONFLICT DO NOTHING, created_by NULL
-- and is_shared = true (owned by the instance, not by an interviewer).
--
-- Migrations run once per database now (schema_migrations, see 146bc94), so
-- editing a blob below does NOT reach an instance that already ran this file:
-- change the problem through the UI, or add a new migration.

-- --------------------------------------------------------------------------
-- Folders (the "algorithms" parent already exists, from 020)
-- --------------------------------------------------------------------------
INSERT INTO problem_folders (id, path, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0007', 'algorithms/bits and bytes', NULL),
  ('00000000-0000-0000-0000-0000000f0008', 'algorithms/binary search', NULL),
  ('00000000-0000-0000-0000-0000000f0009', 'algorithms/dynamic programming', NULL),
  ('00000000-0000-0000-0000-0000000f0010', 'algorithms/intervals and sorting', NULL),
  ('00000000-0000-0000-0000-0000000f0011', 'algorithms/stacks and queues', NULL)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Problems
-- --------------------------------------------------------------------------
INSERT INTO problems (id, title, description, signature_hint, difficulty, folder_id, created_by, is_shared) VALUES
(
  '00000000-0000-0000-0000-0000000a0013',
  'Single Number',
  $d$Every value in the array appears exactly twice, except one that appears once. Return that one.

Rules:
- Aim for O(n) time and O(1) extra space - a hash set is the easy answer, and it is not the one being asked for.
- The array can contain negative numbers and zero.

Example: [4, 1, 2, 1, 2] -> 4.$d$,
  'int singleNumber(const vector<int>& nums)  |  single_number(nums) -> int',
  2,
  '00000000-0000-0000-0000-0000000f0007',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0014',
  'Reverse Bits',
  $d$Return the 32-bit value obtained by reversing the order of the bits of the input.

Rules:
- Treat the input as exactly 32 bits, including leading zeros: reversing 1 gives 2147483648, not 1.
- No string conversions - work on the bits.

Example: 43261596 (00000010100101000001111010011100) -> 964176192 (00111001011110000010100101000000).$d$,
  'uint32_t reverseBits(uint32_t n)  |  reverse_bits(n) -> int',
  3,
  '00000000-0000-0000-0000-0000000f0007',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0015',
  'Decode Varints',
  $d$Decode a buffer of LEB128 varints - the variable-length integer encoding used by Protocol Buffers, DWARF and WebAssembly.

The encoding: each byte carries seven payload bits in its low bits. The top bit (0x80) is a continuation flag - when it is set, the number continues in the next byte. Groups are little-endian: the first byte holds the least significant seven bits.

Rules:
- The buffer holds several numbers back to back. Return all of them, in order.
- If the buffer ends in the middle of a number (the last byte still has its continuation bit set), that incomplete tail is discarded, not reported.
- An empty buffer decodes to an empty list. Values fit in a signed 64-bit integer.

Example: [0xE5, 0x8E, 0x26] -> [624485].
Example: [0x01, 0x80, 0x01] -> [1, 128].$d$,
  'vector<long long> decodeVarints(const vector<int>& bytes)  |  decode_varints(data) -> list',
  4,
  '00000000-0000-0000-0000-0000000f0007',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0016',
  'Search in Rotated Sorted Array',
  $d$An ascending array of distinct integers was rotated left by some unknown amount before you got it: [0, 1, 2, 4, 5, 6, 7] may arrive as [4, 5, 6, 7, 0, 1, 2]. Return the index of the target, or -1 if it is not there.

Rules:
- O(log n) - a linear scan is not an answer to this question.
- The rotation may be zero, and the array may hold a single element.

Example: nums = [4, 5, 6, 7, 0, 1, 2], target = 0 -> 4.$d$,
  'int searchRotated(const vector<int>& nums, int target)  |  search_rotated(nums, target) -> int',
  4,
  '00000000-0000-0000-0000-0000000f0008',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0017',
  'Minimum Eating Speed',
  $d$There are piles of bananas and h hours before the guards come back. At a speed of k bananas per hour you pick one pile and eat k from it; if the pile holds fewer than k you finish it and then wait - you never move on to another pile within the same hour.

Return the smallest integer k that lets you finish every pile within h hours.

Rules:
- h is at least as large as the number of piles, so an answer always exists.
- Piles can be up to a billion bananas and there can be many of them - the answer is not found by trying every k.

Example: piles = [3, 6, 7, 11], h = 8 -> 4.$d$,
  'int minEatingSpeed(const vector<int>& piles, int h)  |  min_eating_speed(piles, h) -> int',
  4,
  '00000000-0000-0000-0000-0000000f0008',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0018',
  'Climbing Stairs',
  $d$You are climbing a staircase of n steps. Each move takes you either one step or two. Return how many distinct ways there are to reach the top.

Rules:
- n can be up to 45, so plain recursion without memoisation will not finish.
- The answer fits in a 32-bit signed integer for every n in range.

Example: n = 3 -> 3 (1+1+1, 1+2, 2+1).$d$,
  'int climbStairs(int n)  |  climb_stairs(n) -> int',
  2,
  '00000000-0000-0000-0000-0000000f0009',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0019',
  'Coin Change',
  $d$Given coin denominations and an amount, return the fewest coins that add up to exactly that amount, or -1 if no combination does.

Rules:
- You have an unlimited number of coins of each denomination.
- Greedily taking the largest coin first is wrong: coins = [1, 3, 4], amount = 6 needs two coins (3+3), not three (4+1+1).
- amount = 0 needs zero coins.

Example: coins = [1, 2, 5], amount = 11 -> 3 (5+5+1).$d$,
  'int coinChange(const vector<int>& coins, int amount)  |  coin_change(coins, amount) -> int',
  3,
  '00000000-0000-0000-0000-0000000f0009',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0020',
  'Longest Increasing Subsequence',
  $d$Return the length of the longest strictly increasing subsequence of the array.

A subsequence keeps the original order but does not have to be contiguous: [2, 5, 7] is a subsequence of [2, 4, 5, 1, 7].

Rules:
- Strictly increasing - equal neighbours do not extend a run.
- The straightforward O(n^2) dynamic program is a fine first answer; the O(n log n) one is the follow-up.

Example: [10, 9, 2, 5, 3, 7, 101, 18] -> 4, from [2, 3, 7, 18] (or [2, 3, 7, 101]).$d$,
  'int lengthOfLIS(const vector<int>& nums)  |  length_of_lis(nums) -> int',
  4,
  '00000000-0000-0000-0000-0000000f0009',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0021',
  'Merge Intervals',
  $d$Given a list of closed intervals [start, end], merge every group that overlaps and return the result sorted by start.

Rules:
- Touching counts as overlapping: [1, 4] and [4, 5] merge into [1, 5].
- The input is not sorted.
- An empty input gives an empty result.

Example: [[1,3], [2,6], [8,10], [15,18]] -> [[1,6], [8,10], [15,18]].$d$,
  'vector<vector<int>> mergeIntervals(vector<vector<int>> intervals)  |  merge_intervals(intervals) -> list',
  3,
  '00000000-0000-0000-0000-0000000f0010',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0022',
  'Minimum Meeting Rooms',
  $d$Given the start and end time of every meeting of a day, return the smallest number of rooms that can host all of them.

Rules:
- A meeting that ends at 10 and one that starts at 10 can share a room - the interval is half-open.
- The meetings arrive in no particular order.

Example: [[0,30], [5,10], [15,20]] -> 2.
Example: [[7,10], [2,4]] -> 1.$d$,
  'int minMeetingRooms(vector<vector<int>> meetings)  |  min_meeting_rooms(meetings) -> int',
  4,
  '00000000-0000-0000-0000-0000000f0010',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0023',
  'Min Stack',
  $d$Design a stack that also reports its smallest element.

Four operations, all of them O(1):
- push(value)
- pop()          - removes the top, and is only ever called on a non-empty stack
- top()          - returns the top without removing it
- getMin()       - returns the smallest value currently in the stack

Rules:
- getMin() must be O(1), not a scan. Constant time on every call, including right after a pop that removed the current minimum.
- Duplicates are possible: pushing 5 twice and popping once still leaves a 5.

Keep the class and method names exactly as given - the tests call them directly.$d$,
  'class MinStack { push(int), pop(), int top(), int getMin() }  |  MinStack with push/pop/top/get_min',
  3,
  '00000000-0000-0000-0000-0000000f0011',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0024',
  'Daily Temperatures',
  $d$Given the daily temperatures, return for each day how many days you have to wait for a warmer one. If no warmer day ever comes, that position is 0.

Rules:
- Strictly warmer - an equal temperature does not count.
- Aim for O(n): every element gets pushed and popped once.

Example: [73, 74, 75, 71, 69, 72, 76, 73] -> [1, 1, 4, 2, 1, 1, 0, 0].$d$,
  'vector<int> dailyTemperatures(const vector<int>& temps)  |  daily_temperatures(temps) -> list',
  3,
  '00000000-0000-0000-0000-0000000f0011',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Starter code
-- --------------------------------------------------------------------------
INSERT INTO problem_starters (problem_id, language, starter_code) VALUES
('00000000-0000-0000-0000-0000000a0013', 'cpp', $c$int singleNumber(const vector<int>& nums) {
    // TODO: return the value that appears once. O(n) time, O(1) space.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0013', 'python', $c$def single_number(nums):
    # TODO: return the value that appears once. O(n) time, O(1) space.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0014', 'cpp', $c$#include <cstdint>

uint32_t reverseBits(uint32_t n) {
    // TODO: return n with all 32 of its bits in reverse order.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0014', 'python', $c$def reverse_bits(n):
    # TODO: return n with all 32 of its bits in reverse order.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0015', 'cpp', $c$vector<long long> decodeVarints(const vector<int>& bytes) {
    // TODO: decode the buffer into the numbers it holds.
    // Low 7 bits are payload, 0x80 means "continues", groups are little-endian.
    return {};
}
$c$),
('00000000-0000-0000-0000-0000000a0015', 'python', $c$def decode_varints(data):
    # TODO: decode the buffer into the numbers it holds.
    # Low 7 bits are payload, 0x80 means "continues", groups are little-endian.
    return []
$c$),

('00000000-0000-0000-0000-0000000a0016', 'cpp', $c$int searchRotated(const vector<int>& nums, int target) {
    // TODO: O(log n) search over the rotated array. -1 when absent.
    return -1;
}
$c$),
('00000000-0000-0000-0000-0000000a0016', 'python', $c$def search_rotated(nums, target):
    # TODO: O(log n) search over the rotated array. -1 when absent.
    return -1
$c$),

('00000000-0000-0000-0000-0000000a0017', 'cpp', $c$int minEatingSpeed(const vector<int>& piles, int h) {
    // TODO: smallest bananas-per-hour speed that clears every pile within h hours.
    return 1;
}
$c$),
('00000000-0000-0000-0000-0000000a0017', 'python', $c$def min_eating_speed(piles, h):
    # TODO: smallest bananas-per-hour speed that clears every pile within h hours.
    return 1
$c$),

('00000000-0000-0000-0000-0000000a0018', 'cpp', $c$int climbStairs(int n) {
    // TODO: number of distinct ways to climb n steps taking 1 or 2 at a time.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0018', 'python', $c$def climb_stairs(n):
    # TODO: number of distinct ways to climb n steps taking 1 or 2 at a time.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0019', 'cpp', $c$int coinChange(const vector<int>& coins, int amount) {
    // TODO: fewest coins adding up to amount, or -1 if impossible.
    return -1;
}
$c$),
('00000000-0000-0000-0000-0000000a0019', 'python', $c$def coin_change(coins, amount):
    # TODO: fewest coins adding up to amount, or -1 if impossible.
    return -1
$c$),

('00000000-0000-0000-0000-0000000a0020', 'cpp', $c$int lengthOfLIS(const vector<int>& nums) {
    // TODO: length of the longest strictly increasing subsequence.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0020', 'python', $c$def length_of_lis(nums):
    # TODO: length of the longest strictly increasing subsequence.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0021', 'cpp', $c$vector<vector<int>> mergeIntervals(vector<vector<int>> intervals) {
    // TODO: merge every overlapping group, sorted by start.
    return {};
}
$c$),
('00000000-0000-0000-0000-0000000a0021', 'python', $c$def merge_intervals(intervals):
    # TODO: merge every overlapping group, sorted by start.
    return []
$c$),

('00000000-0000-0000-0000-0000000a0022', 'cpp', $c$int minMeetingRooms(vector<vector<int>> meetings) {
    // TODO: how many rooms are needed to host every meeting.
    return 0;
}
$c$),
('00000000-0000-0000-0000-0000000a0022', 'python', $c$def min_meeting_rooms(meetings):
    # TODO: how many rooms are needed to host every meeting.
    return 0
$c$),

('00000000-0000-0000-0000-0000000a0023', 'cpp', $c$class MinStack
{
public:
    void push(int value)
    {
        // TODO
    }

    void pop()
    {
        // TODO
    }

    int top() const
    {
        // TODO
        return 0;
    }

    int getMin() const
    {
        // TODO: O(1), not a scan.
        return 0;
    }
};
$c$),
('00000000-0000-0000-0000-0000000a0023', 'python', $c$class MinStack:
    def __init__(self):
        pass

    def push(self, value):
        # TODO
        pass

    def pop(self):
        # TODO
        pass

    def top(self):
        # TODO
        return 0

    def get_min(self):
        # TODO: O(1), not a scan.
        return 0
$c$),

('00000000-0000-0000-0000-0000000a0024', 'cpp', $c$vector<int> dailyTemperatures(const vector<int>& temps) {
    // TODO: days to wait for a strictly warmer temperature, 0 when none comes.
    return {};
}
$c$),
('00000000-0000-0000-0000-0000000a0024', 'python', $c$def daily_temperatures(temps):
    # TODO: days to wait for a strictly warmer temperature, 0 when none comes.
    return []
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

-- --------------------------------------------------------------------------
-- Reference solutions
-- --------------------------------------------------------------------------
INSERT INTO problem_solutions (id, problem_id, language, title, code) VALUES
('00000000-0000-0000-0000-0000000b0024', '00000000-0000-0000-0000-0000000a0013', 'cpp', 'xor everything',
$c$// x ^ x == 0 and x ^ 0 == x, and xor is commutative - so every pair cancels
// out no matter how the array is ordered, leaving only the lone value.
int singleNumber(const vector<int>& nums) {
    int acc = 0;
    for (int n : nums) {
        acc ^= n;
    }
    return acc;
}
$c$),
('00000000-0000-0000-0000-0000000b0025', '00000000-0000-0000-0000-0000000a0013', 'python', 'xor everything',
$c$def single_number(nums):
    acc = 0
    for n in nums:
        acc ^= n
    return acc
$c$),

('00000000-0000-0000-0000-0000000b0026', '00000000-0000-0000-0000-0000000a0014', 'cpp', 'shift bits out of one end and into the other',
$c$#include <cstdint>

uint32_t reverseBits(uint32_t n) {
    uint32_t out = 0;
    for (int i = 0; i < 32; i++) {
        out = (out << 1) | (n & 1u);
        n >>= 1;
    }
    return out;
}
$c$),
('00000000-0000-0000-0000-0000000b0027', '00000000-0000-0000-0000-0000000a0014', 'python', 'shift bits out of one end and into the other',
$c$def reverse_bits(n):
    out = 0
    for _ in range(32):
        out = (out << 1) | (n & 1)
        n >>= 1
    return out
$c$),

('00000000-0000-0000-0000-0000000b0028', '00000000-0000-0000-0000-0000000a0015', 'cpp', 'accumulate seven bits at a time',
$c$vector<long long> decodeVarints(const vector<int>& bytes) {
    vector<long long> out;
    long long value = 0;
    int shift = 0;
    for (int b : bytes) {
        value |= (long long)(b & 0x7F) << shift;
        shift += 7;
        if ((b & 0x80) == 0) {
            out.push_back(value);
            value = 0;
            shift = 0;
        }
    }
    // Anything still accumulating here is an incomplete tail: dropped.
    return out;
}
$c$),
('00000000-0000-0000-0000-0000000b0029', '00000000-0000-0000-0000-0000000a0015', 'python', 'accumulate seven bits at a time',
$c$def decode_varints(data):
    out = []
    value = 0
    shift = 0
    for b in data:
        value |= (b & 0x7F) << shift
        shift += 7
        if not (b & 0x80):
            out.append(value)
            value = 0
            shift = 0
    # Anything still accumulating here is an incomplete tail: dropped.
    return out
$c$),

('00000000-0000-0000-0000-0000000b0030', '00000000-0000-0000-0000-0000000a0016', 'cpp', 'binary search, one half is always sorted',
$c$// However the array is rotated, at least one side of the midpoint is a plain
// ascending run. Decide which one, then ask whether the target lies inside it.
int searchRotated(const vector<int>& nums, int target) {
    int lo = 0, hi = (int)nums.size() - 1;
    while (lo <= hi) {
        int mid = lo + (hi - lo) / 2;
        if (nums[mid] == target) {
            return mid;
        }
        if (nums[lo] <= nums[mid]) {
            if (nums[lo] <= target && target < nums[mid]) {
                hi = mid - 1;
            } else {
                lo = mid + 1;
            }
        } else {
            if (nums[mid] < target && target <= nums[hi]) {
                lo = mid + 1;
            } else {
                hi = mid - 1;
            }
        }
    }
    return -1;
}
$c$),
('00000000-0000-0000-0000-0000000b0031', '00000000-0000-0000-0000-0000000a0016', 'python', 'binary search, one half is always sorted',
$c$def search_rotated(nums, target):
    lo, hi = 0, len(nums) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if nums[mid] == target:
            return mid
        if nums[lo] <= nums[mid]:
            if nums[lo] <= target < nums[mid]:
                hi = mid - 1
            else:
                lo = mid + 1
        else:
            if nums[mid] < target <= nums[hi]:
                lo = mid + 1
            else:
                hi = mid - 1
    return -1
$c$),

('00000000-0000-0000-0000-0000000b0032', '00000000-0000-0000-0000-0000000a0017', 'cpp', 'binary search on the answer',
$c$// The predicate "speed k finishes in time" is monotone: if k works, so does
// every larger speed. That is what makes the answer itself searchable, even
// though the input is not sorted in any useful way.
int minEatingSpeed(const vector<int>& piles, int h) {
    int lo = 1, hi = *max_element(piles.begin(), piles.end());
    while (lo < hi) {
        int mid = lo + (hi - lo) / 2;
        long long hours = 0;
        for (int p : piles) {
            hours += (p + mid - 1) / mid;
        }
        if (hours <= h) {
            hi = mid;
        } else {
            lo = mid + 1;
        }
    }
    return lo;
}
$c$),
('00000000-0000-0000-0000-0000000b0033', '00000000-0000-0000-0000-0000000a0017', 'python', 'binary search on the answer',
$c$def min_eating_speed(piles, h):
    lo, hi = 1, max(piles)
    while lo < hi:
        mid = (lo + hi) // 2
        hours = sum((p + mid - 1) // mid for p in piles)
        if hours <= h:
            hi = mid
        else:
            lo = mid + 1
    return lo
$c$),

('00000000-0000-0000-0000-0000000b0034', '00000000-0000-0000-0000-0000000a0018', 'cpp', 'two rolling counters',
$c$int climbStairs(int n) {
    int prev = 1, cur = 1;
    for (int i = 2; i <= n; i++) {
        int next = prev + cur;
        prev = cur;
        cur = next;
    }
    return cur;
}
$c$),
('00000000-0000-0000-0000-0000000b0035', '00000000-0000-0000-0000-0000000a0018', 'python', 'two rolling counters',
$c$def climb_stairs(n):
    prev, cur = 1, 1
    for _ in range(2, n + 1):
        prev, cur = cur, prev + cur
    return cur
$c$),

('00000000-0000-0000-0000-0000000b0036', '00000000-0000-0000-0000-0000000a0019', 'cpp', 'bottom-up over every amount',
$c$int coinChange(const vector<int>& coins, int amount) {
    const int unreachable = amount + 1;
    vector<int> best(amount + 1, unreachable);
    best[0] = 0;
    for (int a = 1; a <= amount; a++) {
        for (int c : coins) {
            if (c <= a && best[a - c] + 1 < best[a]) {
                best[a] = best[a - c] + 1;
            }
        }
    }
    return best[amount] == unreachable ? -1 : best[amount];
}
$c$),
('00000000-0000-0000-0000-0000000b0037', '00000000-0000-0000-0000-0000000a0019', 'python', 'bottom-up over every amount',
$c$def coin_change(coins, amount):
    unreachable = amount + 1
    best = [unreachable] * (amount + 1)
    best[0] = 0
    for a in range(1, amount + 1):
        for c in coins:
            if c <= a:
                best[a] = min(best[a], best[a - c] + 1)
    return -1 if best[amount] == unreachable else best[amount]
$c$),

('00000000-0000-0000-0000-0000000b0038', '00000000-0000-0000-0000-0000000a0020', 'cpp', 'patience sorting, O(n log n)',
$c$// tails[i] is the smallest value that can end an increasing subsequence of
// length i+1. It stays sorted, so the position to overwrite is a lower_bound
// away - and its final length is the answer.
int lengthOfLIS(const vector<int>& nums) {
    vector<int> tails;
    for (int n : nums) {
        auto it = lower_bound(tails.begin(), tails.end(), n);
        if (it == tails.end()) {
            tails.push_back(n);
        } else {
            *it = n;
        }
    }
    return (int)tails.size();
}
$c$),
('00000000-0000-0000-0000-0000000b0039', '00000000-0000-0000-0000-0000000a0020', 'python', 'patience sorting, O(n log n)',
$c$import bisect


def length_of_lis(nums):
    tails = []
    for n in nums:
        i = bisect.bisect_left(tails, n)
        if i == len(tails):
            tails.append(n)
        else:
            tails[i] = n
    return len(tails)
$c$),

('00000000-0000-0000-0000-0000000b0040', '00000000-0000-0000-0000-0000000a0021', 'cpp', 'sort by start, then extend',
$c$vector<vector<int>> mergeIntervals(vector<vector<int>> intervals) {
    if (intervals.empty()) {
        return {};
    }
    sort(intervals.begin(), intervals.end());
    vector<vector<int>> out;
    out.push_back(intervals[0]);
    for (size_t i = 1; i < intervals.size(); i++) {
        if (intervals[i][0] <= out.back()[1]) {
            out.back()[1] = max(out.back()[1], intervals[i][1]);
        } else {
            out.push_back(intervals[i]);
        }
    }
    return out;
}
$c$),
('00000000-0000-0000-0000-0000000b0041', '00000000-0000-0000-0000-0000000a0021', 'python', 'sort by start, then extend',
$c$def merge_intervals(intervals):
    out = []
    for start, end in sorted(intervals):
        if out and start <= out[-1][1]:
            out[-1][1] = max(out[-1][1], end)
        else:
            out.append([start, end])
    return out
$c$),

('00000000-0000-0000-0000-0000000b0042', '00000000-0000-0000-0000-0000000a0022', 'cpp', 'sweep the starts and ends separately',
$c$// The rooms are not the meetings - only the count matters, so the two ends of
// each meeting can be sorted independently and walked as a single sweep.
int minMeetingRooms(vector<vector<int>> meetings) {
    vector<int> starts, ends;
    for (const auto& m : meetings) {
        starts.push_back(m[0]);
        ends.push_back(m[1]);
    }
    sort(starts.begin(), starts.end());
    sort(ends.begin(), ends.end());

    int rooms = 0, best = 0;
    size_t e = 0;
    for (size_t s = 0; s < starts.size(); s++) {
        while (e < ends.size() && ends[e] <= starts[s]) {
            rooms--;
            e++;
        }
        rooms++;
        best = max(best, rooms);
    }
    return best;
}
$c$),
('00000000-0000-0000-0000-0000000b0043', '00000000-0000-0000-0000-0000000a0022', 'python', 'sweep the starts and ends separately',
$c$def min_meeting_rooms(meetings):
    starts = sorted(m[0] for m in meetings)
    ends = sorted(m[1] for m in meetings)
    rooms = best = 0
    e = 0
    for s in starts:
        while e < len(ends) and ends[e] <= s:
            rooms -= 1
            e += 1
        rooms += 1
        best = max(best, rooms)
    return best
$c$),

('00000000-0000-0000-0000-0000000b0044', '00000000-0000-0000-0000-0000000a0023', 'cpp', 'a second stack of running minima',
$c$// Every push records what the minimum is *while that element is on the stack*,
// so popping restores the previous answer for free - no rescanning, and
// duplicates of the minimum each keep their own entry.
class MinStack
{
public:
    void push(int value)
    {
        values_.push_back(value);
        mins_.push_back(mins_.empty() ? value : min(mins_.back(), value));
    }

    void pop()
    {
        values_.pop_back();
        mins_.pop_back();
    }

    int top() const
    {
        return values_.back();
    }

    int getMin() const
    {
        return mins_.back();
    }

private:
    vector<int> values_;
    vector<int> mins_;
};
$c$),
('00000000-0000-0000-0000-0000000b0045', '00000000-0000-0000-0000-0000000a0023', 'python', 'a second stack of running minima',
$c$class MinStack:
    def __init__(self):
        self._values = []
        self._mins = []

    def push(self, value):
        self._values.append(value)
        self._mins.append(value if not self._mins else min(self._mins[-1], value))

    def pop(self):
        self._values.pop()
        self._mins.pop()

    def top(self):
        return self._values[-1]

    def get_min(self):
        return self._mins[-1]
$c$),

('00000000-0000-0000-0000-0000000b0046', '00000000-0000-0000-0000-0000000a0024', 'cpp', 'monotonic stack of unresolved days',
$c$// The stack holds the days still waiting for a warmer one, coldest on top.
// A new day resolves every day it beats, and each index is pushed and popped
// exactly once - that is where the O(n) comes from.
vector<int> dailyTemperatures(const vector<int>& temps) {
    vector<int> out(temps.size(), 0);
    vector<int> pending;
    for (int i = 0; i < (int)temps.size(); i++) {
        while (!pending.empty() && temps[i] > temps[pending.back()]) {
            out[pending.back()] = i - pending.back();
            pending.pop_back();
        }
        pending.push_back(i);
    }
    return out;
}
$c$),
('00000000-0000-0000-0000-0000000b0047', '00000000-0000-0000-0000-0000000a0024', 'python', 'monotonic stack of unresolved days',
$c$def daily_temperatures(temps):
    out = [0] * len(temps)
    pending = []
    for i, t in enumerate(temps):
        while pending and t > temps[pending[-1]]:
            j = pending.pop()
            out[j] = i - j
        pending.append(i)
    return out
$c$)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Test code. public_code runs on "Run", hidden_code additionally on "Submit".
-- --------------------------------------------------------------------------
INSERT INTO problem_test_code (problem_id, language, public_code, hidden_code) VALUES
('00000000-0000-0000-0000-0000000a0013', 'cpp',
$c$TEST(SingleNumber, Example) {
    EXPECT_EQ(singleNumber({2, 2, 1}), 1);
}

TEST(SingleNumber, LongerArray) {
    EXPECT_EQ(singleNumber({4, 1, 2, 1, 2}), 4);
}
$c$,
$c$TEST(SingleNumber, OneElement) {
    EXPECT_EQ(singleNumber({7}), 7);
}

TEST(SingleNumber, Negatives) {
    EXPECT_EQ(singleNumber({-3, 5, 5, -3, -9}), -9);
}

TEST(SingleNumber, ZeroIsTheOddOneOut) {
    EXPECT_EQ(singleNumber({1, 0, 1}), 0);
}

TEST(SingleNumber, PairsSplitApart) {
    EXPECT_EQ(singleNumber({8, 3, 9, 3, 8}), 9);
}
$c$),
('00000000-0000-0000-0000-0000000a0013', 'python',
$c$class TestSingleNumber(unittest.TestCase):
    def test_example(self):
        self.assertEqual(single_number([2, 2, 1]), 1)

    def test_longer_array(self):
        self.assertEqual(single_number([4, 1, 2, 1, 2]), 4)
$c$,
$c$class TestSingleNumberHidden(unittest.TestCase):
    def test_one_element(self):
        self.assertEqual(single_number([7]), 7)

    def test_negatives(self):
        self.assertEqual(single_number([-3, 5, 5, -3, -9]), -9)

    def test_zero_is_the_odd_one_out(self):
        self.assertEqual(single_number([1, 0, 1]), 0)

    def test_pairs_split_apart(self):
        self.assertEqual(single_number([8, 3, 9, 3, 8]), 9)
$c$),

('00000000-0000-0000-0000-0000000a0014', 'cpp',
$c$TEST(ReverseBits, LowestBitBecomesHighest) {
    EXPECT_EQ(reverseBits(1u), 2147483648u);
}

TEST(ReverseBits, KnownValue) {
    EXPECT_EQ(reverseBits(43261596u), 964176192u);
}
$c$,
$c$TEST(ReverseBits, Zero) {
    EXPECT_EQ(reverseBits(0u), 0u);
}

TEST(ReverseBits, AllOnes) {
    EXPECT_EQ(reverseBits(4294967295u), 4294967295u);
}

TEST(ReverseBits, SecondBit) {
    EXPECT_EQ(reverseBits(2u), 1073741824u);
}

TEST(ReverseBits, TwiceIsIdentity) {
    for (uint32_t sample : {0u, 1u, 12345u, 4026531840u}) {
        EXPECT_EQ(reverseBits(reverseBits(sample)), sample);
    }
}
$c$),
('00000000-0000-0000-0000-0000000a0014', 'python',
$c$class TestReverseBits(unittest.TestCase):
    def test_lowest_bit_becomes_highest(self):
        self.assertEqual(reverse_bits(1), 2147483648)

    def test_known_value(self):
        self.assertEqual(reverse_bits(43261596), 964176192)
$c$,
$c$class TestReverseBitsHidden(unittest.TestCase):
    def test_zero(self):
        self.assertEqual(reverse_bits(0), 0)

    def test_all_ones(self):
        self.assertEqual(reverse_bits(0xFFFFFFFF), 0xFFFFFFFF)

    def test_second_bit(self):
        self.assertEqual(reverse_bits(2), 1073741824)

    def test_twice_is_identity(self):
        for sample in (0, 1, 12345, 0xF0000000):
            self.assertEqual(reverse_bits(reverse_bits(sample)), sample)
$c$),

('00000000-0000-0000-0000-0000000a0015', 'cpp',
$c$TEST(DecodeVarints, SingleByteValue) {
    const vector<long long> got = decodeVarints({0x7F});
    EXPECT_EQ(got, (vector<long long>{127}));
}

TEST(DecodeVarints, TwoBytesAreLittleEndian) {
    const vector<long long> got = decodeVarints({0x80, 0x01});
    EXPECT_EQ(got, (vector<long long>{128}));
}

TEST(DecodeVarints, ThreeByteValue) {
    const vector<long long> got = decodeVarints({0xE5, 0x8E, 0x26});
    EXPECT_EQ(got, (vector<long long>{624485}));
}
$c$,
$c$TEST(DecodeVarints, EmptyBuffer) {
    const vector<long long> got = decodeVarints({});
    EXPECT_TRUE(got.empty());
}

TEST(DecodeVarints, SeveralNumbersBackToBack) {
    const vector<long long> got = decodeVarints({0x01, 0x80, 0x01, 0x00, 0xE5, 0x8E, 0x26});
    EXPECT_EQ(got, (vector<long long>{1, 128, 0, 624485}));
}

TEST(DecodeVarints, IncompleteTailIsDropped) {
    const vector<long long> got = decodeVarints({0x2A, 0x80, 0x80});
    EXPECT_EQ(got, (vector<long long>{42}));
}

TEST(DecodeVarints, LargeValue) {
    const vector<long long> got = decodeVarints({0xFF, 0xFF, 0xFF, 0xFF, 0x0F});
    EXPECT_EQ(got, (vector<long long>{4294967295LL}));
}
$c$),
('00000000-0000-0000-0000-0000000a0015', 'python',
$c$class TestDecodeVarints(unittest.TestCase):
    def test_single_byte_value(self):
        self.assertEqual(decode_varints([0x7F]), [127])

    def test_two_bytes_are_little_endian(self):
        self.assertEqual(decode_varints([0x80, 0x01]), [128])

    def test_three_byte_value(self):
        self.assertEqual(decode_varints([0xE5, 0x8E, 0x26]), [624485])
$c$,
$c$class TestDecodeVarintsHidden(unittest.TestCase):
    def test_empty_buffer(self):
        self.assertEqual(decode_varints([]), [])

    def test_several_numbers_back_to_back(self):
        self.assertEqual(decode_varints([0x01, 0x80, 0x01, 0x00, 0xE5, 0x8E, 0x26]), [1, 128, 0, 624485])

    def test_incomplete_tail_is_dropped(self):
        self.assertEqual(decode_varints([0x2A, 0x80, 0x80]), [42])

    def test_large_value(self):
        self.assertEqual(decode_varints([0xFF, 0xFF, 0xFF, 0xFF, 0x0F]), [4294967295])
$c$),

('00000000-0000-0000-0000-0000000a0016', 'cpp',
$c$TEST(SearchRotated, FindsAfterThePivot) {
    EXPECT_EQ(searchRotated({4, 5, 6, 7, 0, 1, 2}, 0), 4);
}

TEST(SearchRotated, MissingValue) {
    EXPECT_EQ(searchRotated({4, 5, 6, 7, 0, 1, 2}, 3), -1);
}
$c$,
$c$TEST(SearchRotated, SingleElementFound) {
    EXPECT_EQ(searchRotated({1}, 1), 0);
}

TEST(SearchRotated, SingleElementMissing) {
    EXPECT_EQ(searchRotated({1}, 0), -1);
}

TEST(SearchRotated, NotRotatedAtAll) {
    EXPECT_EQ(searchRotated({1, 2, 3, 4, 5}, 5), 4);
}

TEST(SearchRotated, EveryElementIsFoundAtItsOwnIndex) {
    const vector<int> nums = {7, 8, 9, 10, 1, 2, 3, 4, 5, 6};
    for (int i = 0; i < (int)nums.size(); i++) {
        EXPECT_EQ(searchRotated(nums, nums[i]), i);
    }
}

TEST(SearchRotated, PivotAtTheVeryEnd) {
    EXPECT_EQ(searchRotated({2, 3, 4, 5, 1}, 1), 4);
}
$c$),
('00000000-0000-0000-0000-0000000a0016', 'python',
$c$class TestSearchRotated(unittest.TestCase):
    def test_finds_after_the_pivot(self):
        self.assertEqual(search_rotated([4, 5, 6, 7, 0, 1, 2], 0), 4)

    def test_missing_value(self):
        self.assertEqual(search_rotated([4, 5, 6, 7, 0, 1, 2], 3), -1)
$c$,
$c$class TestSearchRotatedHidden(unittest.TestCase):
    def test_single_element_found(self):
        self.assertEqual(search_rotated([1], 1), 0)

    def test_single_element_missing(self):
        self.assertEqual(search_rotated([1], 0), -1)

    def test_not_rotated_at_all(self):
        self.assertEqual(search_rotated([1, 2, 3, 4, 5], 5), 4)

    def test_every_element_is_found_at_its_own_index(self):
        nums = [7, 8, 9, 10, 1, 2, 3, 4, 5, 6]
        for i, n in enumerate(nums):
            self.assertEqual(search_rotated(nums, n), i)

    def test_pivot_at_the_very_end(self):
        self.assertEqual(search_rotated([2, 3, 4, 5, 1], 1), 4)
$c$),

('00000000-0000-0000-0000-0000000a0017', 'cpp',
$c$TEST(MinEatingSpeed, Example) {
    EXPECT_EQ(minEatingSpeed({3, 6, 7, 11}, 8), 4);
}

TEST(MinEatingSpeed, JustEnoughHours) {
    EXPECT_EQ(minEatingSpeed({30, 11, 23, 4, 20}, 5), 30);
}
$c$,
$c$TEST(MinEatingSpeed, OneSpareHour) {
    EXPECT_EQ(minEatingSpeed({30, 11, 23, 4, 20}, 6), 23);
}

TEST(MinEatingSpeed, SinglePileSplitInTwo) {
    EXPECT_EQ(minEatingSpeed({1000000000}, 2), 500000000);
}

TEST(MinEatingSpeed, PlentyOfTime) {
    EXPECT_EQ(minEatingSpeed({3, 6, 7, 11}, 100), 1);
}

TEST(MinEatingSpeed, ManyPilesOneHourEach) {
    EXPECT_EQ(minEatingSpeed({5, 5, 5, 5}, 4), 5);
}
$c$),
('00000000-0000-0000-0000-0000000a0017', 'python',
$c$class TestMinEatingSpeed(unittest.TestCase):
    def test_example(self):
        self.assertEqual(min_eating_speed([3, 6, 7, 11], 8), 4)

    def test_just_enough_hours(self):
        self.assertEqual(min_eating_speed([30, 11, 23, 4, 20], 5), 30)
$c$,
$c$class TestMinEatingSpeedHidden(unittest.TestCase):
    def test_one_spare_hour(self):
        self.assertEqual(min_eating_speed([30, 11, 23, 4, 20], 6), 23)

    def test_single_pile_split_in_two(self):
        self.assertEqual(min_eating_speed([1000000000], 2), 500000000)

    def test_plenty_of_time(self):
        self.assertEqual(min_eating_speed([3, 6, 7, 11], 100), 1)

    def test_many_piles_one_hour_each(self):
        self.assertEqual(min_eating_speed([5, 5, 5, 5], 4), 5)
$c$),

('00000000-0000-0000-0000-0000000a0018', 'cpp',
$c$TEST(ClimbStairs, ThreeSteps) {
    EXPECT_EQ(climbStairs(3), 3);
}

TEST(ClimbStairs, FiveSteps) {
    EXPECT_EQ(climbStairs(5), 8);
}
$c$,
$c$TEST(ClimbStairs, OneStep) {
    EXPECT_EQ(climbStairs(1), 1);
}

TEST(ClimbStairs, TwoSteps) {
    EXPECT_EQ(climbStairs(2), 2);
}

TEST(ClimbStairs, TenSteps) {
    EXPECT_EQ(climbStairs(10), 89);
}

TEST(ClimbStairs, FortyFiveStepsStillFinishes) {
    EXPECT_EQ(climbStairs(45), 1836311903);
}
$c$),
('00000000-0000-0000-0000-0000000a0018', 'python',
$c$class TestClimbStairs(unittest.TestCase):
    def test_three_steps(self):
        self.assertEqual(climb_stairs(3), 3)

    def test_five_steps(self):
        self.assertEqual(climb_stairs(5), 8)
$c$,
$c$class TestClimbStairsHidden(unittest.TestCase):
    def test_one_step(self):
        self.assertEqual(climb_stairs(1), 1)

    def test_two_steps(self):
        self.assertEqual(climb_stairs(2), 2)

    def test_ten_steps(self):
        self.assertEqual(climb_stairs(10), 89)

    def test_forty_five_steps_still_finishes(self):
        self.assertEqual(climb_stairs(45), 1836311903)
$c$),

('00000000-0000-0000-0000-0000000a0019', 'cpp',
$c$TEST(CoinChange, Example) {
    EXPECT_EQ(coinChange({1, 2, 5}, 11), 3);
}

TEST(CoinChange, Impossible) {
    EXPECT_EQ(coinChange({2}, 3), -1);
}
$c$,
$c$TEST(CoinChange, ZeroAmount) {
    EXPECT_EQ(coinChange({1, 2, 5}, 0), 0);
}

TEST(CoinChange, GreedyWouldBeWrong) {
    EXPECT_EQ(coinChange({1, 3, 4}, 6), 2);
}

TEST(CoinChange, ExactSingleCoin) {
    EXPECT_EQ(coinChange({1, 5, 10, 25}, 25), 1);
}

TEST(CoinChange, LargerAmount) {
    EXPECT_EQ(coinChange({186, 419, 83, 408}, 6249), 20);
}
$c$),
('00000000-0000-0000-0000-0000000a0019', 'python',
$c$class TestCoinChange(unittest.TestCase):
    def test_example(self):
        self.assertEqual(coin_change([1, 2, 5], 11), 3)

    def test_impossible(self):
        self.assertEqual(coin_change([2], 3), -1)
$c$,
$c$class TestCoinChangeHidden(unittest.TestCase):
    def test_zero_amount(self):
        self.assertEqual(coin_change([1, 2, 5], 0), 0)

    def test_greedy_would_be_wrong(self):
        self.assertEqual(coin_change([1, 3, 4], 6), 2)

    def test_exact_single_coin(self):
        self.assertEqual(coin_change([1, 5, 10, 25], 25), 1)

    def test_larger_amount(self):
        self.assertEqual(coin_change([186, 419, 83, 408], 6249), 20)
$c$),

('00000000-0000-0000-0000-0000000a0020', 'cpp',
$c$TEST(LengthOfLIS, Example) {
    EXPECT_EQ(lengthOfLIS({10, 9, 2, 5, 3, 7, 101, 18}), 4);
}

TEST(LengthOfLIS, StrictlyIncreasing) {
    EXPECT_EQ(lengthOfLIS({0, 1, 0, 3, 2, 3}), 4);
}
$c$,
$c$TEST(LengthOfLIS, AllEqual) {
    EXPECT_EQ(lengthOfLIS({7, 7, 7, 7, 7}), 1);
}

TEST(LengthOfLIS, SingleElement) {
    EXPECT_EQ(lengthOfLIS({5}), 1);
}

TEST(LengthOfLIS, StrictlyDecreasing) {
    EXPECT_EQ(lengthOfLIS({9, 8, 7, 6}), 1);
}

TEST(LengthOfLIS, LongRunAtTheEnd) {
    EXPECT_EQ(lengthOfLIS({4, 10, 4, 3, 8, 9}), 3);
}
$c$),
('00000000-0000-0000-0000-0000000a0020', 'python',
$c$class TestLengthOfLis(unittest.TestCase):
    def test_example(self):
        self.assertEqual(length_of_lis([10, 9, 2, 5, 3, 7, 101, 18]), 4)

    def test_strictly_increasing(self):
        self.assertEqual(length_of_lis([0, 1, 0, 3, 2, 3]), 4)
$c$,
$c$class TestLengthOfLisHidden(unittest.TestCase):
    def test_all_equal(self):
        self.assertEqual(length_of_lis([7, 7, 7, 7, 7]), 1)

    def test_single_element(self):
        self.assertEqual(length_of_lis([5]), 1)

    def test_strictly_decreasing(self):
        self.assertEqual(length_of_lis([9, 8, 7, 6]), 1)

    def test_long_run_at_the_end(self):
        self.assertEqual(length_of_lis([4, 10, 4, 3, 8, 9]), 3)
$c$),

('00000000-0000-0000-0000-0000000a0021', 'cpp',
$c$TEST(MergeIntervals, Example) {
    const vector<vector<int>> got = mergeIntervals({{1, 3}, {2, 6}, {8, 10}, {15, 18}});
    EXPECT_EQ(got, (vector<vector<int>>{{1, 6}, {8, 10}, {15, 18}}));
}

TEST(MergeIntervals, TouchingIntervalsMerge) {
    const vector<vector<int>> got = mergeIntervals({{1, 4}, {4, 5}});
    EXPECT_EQ(got, (vector<vector<int>>{{1, 5}}));
}
$c$,
$c$TEST(MergeIntervals, Empty) {
    const vector<vector<int>> got = mergeIntervals({});
    EXPECT_TRUE(got.empty());
}

TEST(MergeIntervals, UnsortedInput) {
    const vector<vector<int>> got = mergeIntervals({{8, 10}, {1, 3}, {15, 18}, {2, 6}});
    EXPECT_EQ(got, (vector<vector<int>>{{1, 6}, {8, 10}, {15, 18}}));
}

TEST(MergeIntervals, OneSwallowsAllTheOthers) {
    const vector<vector<int>> got = mergeIntervals({{1, 100}, {5, 10}, {20, 30}});
    EXPECT_EQ(got, (vector<vector<int>>{{1, 100}}));
}

TEST(MergeIntervals, NothingOverlaps) {
    const vector<vector<int>> got = mergeIntervals({{5, 6}, {1, 2}, {3, 4}});
    EXPECT_EQ(got, (vector<vector<int>>{{1, 2}, {3, 4}, {5, 6}}));
}
$c$),
('00000000-0000-0000-0000-0000000a0021', 'python',
$c$class TestMergeIntervals(unittest.TestCase):
    def test_example(self):
        self.assertEqual(merge_intervals([[1, 3], [2, 6], [8, 10], [15, 18]]), [[1, 6], [8, 10], [15, 18]])

    def test_touching_intervals_merge(self):
        self.assertEqual(merge_intervals([[1, 4], [4, 5]]), [[1, 5]])
$c$,
$c$class TestMergeIntervalsHidden(unittest.TestCase):
    def test_empty(self):
        self.assertEqual(merge_intervals([]), [])

    def test_unsorted_input(self):
        self.assertEqual(merge_intervals([[8, 10], [1, 3], [15, 18], [2, 6]]), [[1, 6], [8, 10], [15, 18]])

    def test_one_swallows_all_the_others(self):
        self.assertEqual(merge_intervals([[1, 100], [5, 10], [20, 30]]), [[1, 100]])

    def test_nothing_overlaps(self):
        self.assertEqual(merge_intervals([[5, 6], [1, 2], [3, 4]]), [[1, 2], [3, 4], [5, 6]])
$c$),

('00000000-0000-0000-0000-0000000a0022', 'cpp',
$c$TEST(MinMeetingRooms, TwoRoomsNeeded) {
    EXPECT_EQ(minMeetingRooms({{0, 30}, {5, 10}, {15, 20}}), 2);
}

TEST(MinMeetingRooms, NoOverlap) {
    EXPECT_EQ(minMeetingRooms({{7, 10}, {2, 4}}), 1);
}
$c$,
$c$TEST(MinMeetingRooms, EndAndStartTouch) {
    EXPECT_EQ(minMeetingRooms({{1, 5}, {5, 9}, {9, 12}}), 1);
}

TEST(MinMeetingRooms, EverythingAtOnce) {
    EXPECT_EQ(minMeetingRooms({{1, 10}, {2, 9}, {3, 8}, {4, 7}}), 4);
}

TEST(MinMeetingRooms, NoMeetings) {
    EXPECT_EQ(minMeetingRooms({}), 0);
}

TEST(MinMeetingRooms, PeakInTheMiddle) {
    EXPECT_EQ(minMeetingRooms({{1, 4}, {2, 5}, {6, 8}, {3, 6}}), 3);
}
$c$),
('00000000-0000-0000-0000-0000000a0022', 'python',
$c$class TestMinMeetingRooms(unittest.TestCase):
    def test_two_rooms_needed(self):
        self.assertEqual(min_meeting_rooms([[0, 30], [5, 10], [15, 20]]), 2)

    def test_no_overlap(self):
        self.assertEqual(min_meeting_rooms([[7, 10], [2, 4]]), 1)
$c$,
$c$class TestMinMeetingRoomsHidden(unittest.TestCase):
    def test_end_and_start_touch(self):
        self.assertEqual(min_meeting_rooms([[1, 5], [5, 9], [9, 12]]), 1)

    def test_everything_at_once(self):
        self.assertEqual(min_meeting_rooms([[1, 10], [2, 9], [3, 8], [4, 7]]), 4)

    def test_no_meetings(self):
        self.assertEqual(min_meeting_rooms([]), 0)

    def test_peak_in_the_middle(self):
        self.assertEqual(min_meeting_rooms([[1, 4], [2, 5], [6, 8], [3, 6]]), 3)
$c$),

('00000000-0000-0000-0000-0000000a0023', 'cpp',
$c$TEST(MinStack, TopAndMinAfterPushes) {
    MinStack s;
    s.push(-2);
    s.push(0);
    s.push(-3);
    EXPECT_EQ(s.getMin(), -3);
    EXPECT_EQ(s.top(), -3);
}

TEST(MinStack, MinComesBackAfterAPop) {
    MinStack s;
    s.push(-2);
    s.push(0);
    s.push(-3);
    s.pop();
    EXPECT_EQ(s.top(), 0);
    EXPECT_EQ(s.getMin(), -2);
}
$c$,
$c$TEST(MinStack, SingleElement) {
    MinStack s;
    s.push(42);
    EXPECT_EQ(s.top(), 42);
    EXPECT_EQ(s.getMin(), 42);
}

TEST(MinStack, DuplicateMinimumSurvivesOnePop) {
    MinStack s;
    s.push(5);
    s.push(5);
    s.push(9);
    s.pop();
    s.pop();
    EXPECT_EQ(s.getMin(), 5);
    EXPECT_EQ(s.top(), 5);
}

TEST(MinStack, MinTracksTheWholeHistory) {
    MinStack s;
    for (int v : {3, 1, 4, 1, 5, 9, 2, 6}) {
        s.push(v);
    }
    EXPECT_EQ(s.getMin(), 1);
    s.pop();
    s.pop();
    s.pop();
    s.pop();
    s.pop();
    EXPECT_EQ(s.top(), 4);
    EXPECT_EQ(s.getMin(), 1);
}

TEST(MinStack, TwoStacksAreIndependent) {
    MinStack a;
    MinStack b;
    a.push(1);
    b.push(2);
    EXPECT_EQ(a.getMin(), 1);
    EXPECT_EQ(b.getMin(), 2);
}
$c$),
('00000000-0000-0000-0000-0000000a0023', 'python',
$c$class TestMinStack(unittest.TestCase):
    def test_top_and_min_after_pushes(self):
        s = MinStack()
        s.push(-2)
        s.push(0)
        s.push(-3)
        self.assertEqual(s.get_min(), -3)
        self.assertEqual(s.top(), -3)

    def test_min_comes_back_after_a_pop(self):
        s = MinStack()
        s.push(-2)
        s.push(0)
        s.push(-3)
        s.pop()
        self.assertEqual(s.top(), 0)
        self.assertEqual(s.get_min(), -2)
$c$,
$c$class TestMinStackHidden(unittest.TestCase):
    def test_single_element(self):
        s = MinStack()
        s.push(42)
        self.assertEqual(s.top(), 42)
        self.assertEqual(s.get_min(), 42)

    def test_duplicate_minimum_survives_one_pop(self):
        s = MinStack()
        s.push(5)
        s.push(5)
        s.push(9)
        s.pop()
        s.pop()
        self.assertEqual(s.get_min(), 5)
        self.assertEqual(s.top(), 5)

    def test_min_tracks_the_whole_history(self):
        s = MinStack()
        for v in (3, 1, 4, 1, 5, 9, 2, 6):
            s.push(v)
        self.assertEqual(s.get_min(), 1)
        for _ in range(5):
            s.pop()
        self.assertEqual(s.top(), 4)
        self.assertEqual(s.get_min(), 1)

    def test_two_stacks_are_independent(self):
        a = MinStack()
        b = MinStack()
        a.push(1)
        b.push(2)
        self.assertEqual(a.get_min(), 1)
        self.assertEqual(b.get_min(), 2)
$c$),

('00000000-0000-0000-0000-0000000a0024', 'cpp',
$c$TEST(DailyTemperatures, Example) {
    const vector<int> got = dailyTemperatures({73, 74, 75, 71, 69, 72, 76, 73});
    EXPECT_EQ(got, (vector<int>{1, 1, 4, 2, 1, 1, 0, 0}));
}

TEST(DailyTemperatures, AlwaysWarmerTomorrow) {
    const vector<int> got = dailyTemperatures({30, 40, 50, 60});
    EXPECT_EQ(got, (vector<int>{1, 1, 1, 0}));
}
$c$,
$c$TEST(DailyTemperatures, NeverWarmsUp) {
    const vector<int> got = dailyTemperatures({80, 70, 60});
    EXPECT_EQ(got, (vector<int>{0, 0, 0}));
}

TEST(DailyTemperatures, EqualDoesNotCount) {
    const vector<int> got = dailyTemperatures({50, 50, 51});
    EXPECT_EQ(got, (vector<int>{2, 1, 0}));
}

TEST(DailyTemperatures, SingleDay) {
    const vector<int> got = dailyTemperatures({42});
    EXPECT_EQ(got, (vector<int>{0}));
}

TEST(DailyTemperatures, WarmSpikeAtTheEnd) {
    const vector<int> got = dailyTemperatures({30, 60, 90});
    EXPECT_EQ(got, (vector<int>{1, 1, 0}));
}
$c$),
('00000000-0000-0000-0000-0000000a0024', 'python',
$c$class TestDailyTemperatures(unittest.TestCase):
    def test_example(self):
        self.assertEqual(daily_temperatures([73, 74, 75, 71, 69, 72, 76, 73]), [1, 1, 4, 2, 1, 1, 0, 0])

    def test_always_warmer_tomorrow(self):
        self.assertEqual(daily_temperatures([30, 40, 50, 60]), [1, 1, 1, 0])
$c$,
$c$class TestDailyTemperaturesHidden(unittest.TestCase):
    def test_never_warms_up(self):
        self.assertEqual(daily_temperatures([80, 70, 60]), [0, 0, 0])

    def test_equal_does_not_count(self):
        self.assertEqual(daily_temperatures([50, 50, 51]), [2, 1, 0])

    def test_single_day(self):
        self.assertEqual(daily_temperatures([42]), [0])

    def test_warm_spike_at_the_end(self):
        self.assertEqual(daily_temperatures([30, 60, 90]), [1, 1, 0])
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

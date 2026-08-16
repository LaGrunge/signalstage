-- Debugging exercises for the other four languages with a test harness: Go,
-- Java, Python and Bash. Three each, same idea as "C++ Bugs Hunt" - programs
-- that read as if they worked, several bugs of deliberately different kinds,
-- and tests pinning the behaviour the code was supposed to have.
--
-- The bugs are language-knowledge bugs, not algorithmic ones: slice aliasing
-- and named-result defers in Go, equals/hashCode and reference identity in
-- Java, mutable defaults and late-binding closures in Python, quoting and
-- subshells in Bash.
--
-- 023 created the "debug" parent and moved 020's C++ folder under it.

INSERT INTO problem_folders (id, path, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0013', 'debug/Go', NULL),
  ('00000000-0000-0000-0000-0000000f0014', 'debug/Java', NULL),
  ('00000000-0000-0000-0000-0000000f0015', 'debug/Python', NULL),
  ('00000000-0000-0000-0000-0000000f0016', 'debug/Bash', NULL)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Problems
-- --------------------------------------------------------------------------
INSERT INTO problems (id, title, description, signature_hint, difficulty, folder_id, created_by, is_shared) VALUES
(
  '00000000-0000-0000-0000-0000000a0029',
  'Slices Share Their Array',
  $d$Analyse() should report three things about a list of numbers, without disturbing it:

  Sorted - a copy of the input, ascending
  Top3   - the three largest values, descending (all of them, if there are fewer than three)
  Sum    - the total

Only Sum is right. Sorted comes back empty, Top3 is not what it says it is, and the caller's own slice quietly comes back reordered.

Three bugs, all of them about the fact that a slice is a window onto an array rather than an array: what sorting a parameter does to the caller, what copy() does when the destination has no room, and what re-slicing shares with the slice it came from. The last one also panics on a short input.

Note that the harness owns the import block: testing, fmt, sort, strings, strconv and math are already imported and nothing else can be added.$d$,
  'func Analyse(nums []int) Report  -  Report { Sorted []int; Top3 []int; Sum int }',
  4,
  '00000000-0000-0000-0000-0000000f0013',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0030',
  'Words, Bytes and Map Order',
  $d$Summarise() should turn a line of text into

  Counts - "word=count" pairs joined by commas, words in alphabetical order, e.g. "c=1,go=2,rust=1"
  Runes  - how many characters the text has

For "go go rust  c" (note the double space) it should answer "c=1,go=2,rust=1" and 13.

Three bugs, three different lessons: how the text gets split into words, what len() counts when the text is not ASCII, and the one property of ranging over a map that Go deliberately does not give you - which is also why the same input can produce a different answer on every run.

Note that the harness owns the import block: testing, fmt, sort, strings, strconv and math are already imported and nothing else can be added.$d$,
  'func Summarise(text string) Summary  -  Summary { Counts string; Runes int }',
  3,
  '00000000-0000-0000-0000-0000000f0013',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0031',
  'Defer, Shadow, Reject',
  $d$Apply() walks a list of deltas over a starting balance. The rule is all-or-nothing: if any delta would take the balance below zero, the whole batch is rejected - Applied is 0, Balance is the starting balance, and Err names the *first* offending delta as "delta -20 would overdraw". Otherwise Applied is the number of deltas, Balance is the new balance and Err is empty.

Rejection happens to work. Everything else does not: a batch that should go through reports zero applied and an unchanged balance, a batch that overdraws only on the second step is happily accepted, and when two deltas overdraw the error names the wrong one.

Three bugs: one about a deferred function that runs on every path rather than one, one about what := does inside a loop body when the name already exists outside it, and one about continuing where the contract says to stop.

Note that the harness owns the import block: testing, fmt, sort, strings, strconv and math are already imported and nothing else can be added.$d$,
  'func Apply(start int, deltas []int) (l Ledger)  -  Ledger { Applied int; Balance int; Err string }',
  4,
  '00000000-0000-0000-0000-0000000f0013',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0032',
  'Equal But Not equals',
  $d$Registry has four one-line helpers and every one of them lies:

  distinct(points)     - how many different points are in the list
  contains(points, p)  - whether a point with those coordinates is in the list
  sameLabel(a, b)      - whether two strings hold the same text
  sameNumber(a, b)     - whether two Integers hold the same number

The catch with sameNumber is worth reading twice: it returns true for 100 and false for 1000, which is the single most convincing "it works on my machine" bug in Java.

Four bugs. Two of them are about a method that looks like an override and is not, and about the second method you always have to write next to it. Two are about comparing references where you meant to compare values.

Keep the class and method names as they are - the tests call them directly. The test code cannot add imports, so it names java.util types in full; your code may import whatever it needs at the top of the file.$d$,
  'class Point { int x, y }  |  Registry.distinct / contains / sameLabel / sameNumber',
  4,
  '00000000-0000-0000-0000-0000000f0014',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0033',
  'The List You Were Given',
  $d$Basket has three helpers that are supposed to leave their arguments alone and hand back new lists:

  withoutBlanks(items)  - the items that are not empty or all-whitespace, in order
  plus(items, extra)    - the items with one more appended
  sameItems(a, b)       - whether two String arrays hold the same values in the same order

withoutBlanks throws an exception on some inputs and silently edits the caller's list on others; plus throws on every input; sameItems answers false for two arrays that plainly hold the same strings.

Four bugs: one about removing from a collection while a for-each loop is walking it (and why the same code appears to work when the item you remove happens to be second to last), one about modifying an argument instead of copying it, one about what Arrays.asList actually returns, and one about what equals() means for an array.

Keep the class and method names as they are. The test code cannot add imports, so it names java.util types in full; your code may import whatever it needs at the top of the file.$d$,
  'Basket.withoutBlanks(List<String>) / plus(List<String>, String) / sameItems(String[], String[])',
  3,
  '00000000-0000-0000-0000-0000000f0014',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0034',
  'Numbers That Do Not Add Up',
  $d$Four small numeric helpers, four classic Java results:

  average(xs)        - the mean of the values, e.g. average([1, 2]) is 1.5
  nextLetter(c)      - the letter after c as a one-character string: nextLetter('a') is "b"
  nearlyEqual(a, b)  - whether two doubles are equal to within 1e-9, so 0.1 + 0.2 and 0.3 count as equal
  mod(a, m)          - a modulo m as a mathematician means it: never negative, so mod(-1, 3) is 2

average returns 1.0, nextLetter('a') returns "98", nearlyEqual(0.1 + 0.2, 0.3) is false, and mod(-1, 3) is -1.

Four bugs, four different rules: when integer division happens, what type you get when you add 1 to a char, why two doubles that print the same are not equal, and what sign Java's % gives a negative left operand.

Keep the class and method names as they are.$d$,
  'Numbers.average(List<Integer>) / nextLetter(char) / nearlyEqual(double, double) / mod(int, int)',
  3,
  '00000000-0000-0000-0000-0000000f0014',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0035',
  'The Default That Remembers',
  $d$Three helpers, three of Python's most famous surprises:

  add_item(item, basket=None)  - append the item to the basket and return it. Called without a basket it starts a fresh one - every time.
  multipliers(n)               - a list of n functions, where the i-th multiplies its argument by i: multipliers(3)[2](10) is 20.
  blank_grid(rows, cols)       - a rows x cols grid of zeros, where writing to one cell changes exactly one cell.

As written, the second call to add_item("b") returns ["a", "b"], every function multipliers() returns multiplies by the same number, and setting grid[0][0] = 1 lights up the whole first column.

Three bugs. Two of them are about *when* a piece of code runs: one about a value created once at definition time rather than once per call, one about a variable read at call time rather than captured at creation. The third is about what multiplying a list actually copies.

Keep the function names and their signatures as they are.$d$,
  'add_item(item, basket=None) -> list  |  multipliers(n) -> list  |  blank_grid(rows, cols) -> list',
  3,
  '00000000-0000-0000-0000-0000000f0015',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0036',
  'Copies, Truthiness and Suffixes',
  $d$Four helpers that each get one Python detail wrong:

  sorted_unique(values)          - the distinct values, ascending. The caller's list must come back in its original order.
  first_or_default(values, d=0)  - the first element, or d when the list is empty. A first element of 0 or "" is still the first element.
  merged(base, extra)            - a new dict with extra layered over base. Neither argument may be modified.
  trimmed(text, suffix)          - text with suffix removed from its end if it is there, otherwise text unchanged.

trimmed("banana", "na") should be "bana", and it currently returns "b".

Four bugs: two are about modifying an argument that the caller still owns, one is about "or" treating a legitimate value as missing, and one is about a string method whose argument is not a suffix at all but a set of characters.

Keep the function names and their signatures as they are.$d$,
  'sorted_unique(values)  |  first_or_default(values, default=0)  |  merged(base, extra)  |  trimmed(text, suffix)',
  3,
  '00000000-0000-0000-0000-0000000f0015',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0037',
  'Iterating While You Change It',
  $d$Three helpers over sequences:

  drop_negatives(values)  - a list with the negative values removed, in order. The caller's list must not change.
  summarise(numbers)      - a (count, total) pair. numbers may be any iterable, including a generator that can only be walked once.
  rounded(values)         - each value rounded to the nearest whole number, halves away from zero: 2.5 becomes 3 and -2.5 becomes -3.

drop_negatives([-1, -2, 3]) forgets to drop one of them, summarise over a generator reports a count of 0 with a correct total, and rounded([0.5, 1.5, 2.5]) answers [0, 2, 2].

Three bugs: one about deleting from a list while a for loop is walking it, one about an iterator that has already been consumed by the time you look at it again, and one about the rounding rule Python's round() actually implements (it is not the one from school, and it is not a mistake - but it is not what this contract asks for).

Keep the function names and their signatures as they are.$d$,
  'drop_negatives(values) -> list  |  summarise(numbers) -> (count, total)  |  rounded(values) -> list',
  4,
  '00000000-0000-0000-0000-0000000f0015',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0038',
  'Everything Is A String Until It Is Not',
  $d$join_with SEP ARG... prints the arguments joined by SEP:

  join_with ", " "a b" "c"   ->  a b, c
  join_with "-" "x  y"       ->  x  y

It prints "a, b, c" for the first and "x y" for the second, and it leaves two variables behind in whoever called it.

Three bugs, all of them about quoting and scope: iterating over the arguments in a way that re-splits them, printing a value in a way that collapses runs of whitespace, and two variables that were never declared local.

Keep the function name as it is. The tests call it as a function in the same shell, so anything it leaves behind is visible to them.$d$,
  'join_with SEP ARG... - prints the arguments joined by SEP',
  3,
  '00000000-0000-0000-0000-0000000f0016',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0039',
  'Where Did My Value Go',
  $d$Three functions, three values that never arrive:

  count_matching PATTERN ARG...  - prints how many of the arguments contain PATTERN. Always prints 0.
  run_and_report CMD...          - runs the command quietly and prints "status=N" with its exit code. Always prints status=0.
  sum_numbers N...               - prints the sum of its arguments. Chokes on 08 and 09.

Three bugs of three different kinds: a loop that runs somewhere its variables cannot escape from, an exit code that was read one command too late, and a number that bash does not think is a number.

Keep the function names as they are.$d$,
  'count_matching PATTERN ARG...  |  run_and_report CMD...  |  sum_numbers N...',
  4,
  '00000000-0000-0000-0000-0000000f0016',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0040',
  'Tests That Always Pass',
  $d$Three functions built on a test command that is not testing what it looks like:

  bigger_of A B  - prints the larger of two integers. bigger_of 5 10 prints 5, and leaves a file called 10 behind in the working directory.
  same_text A B  - prints "same" or "different" for two strings. Prints "different" for two identical words, with a complaint on stderr.
  label_for NAME - prints NAME, or "empty" when NAME is the empty string. Turns "a  b" into "a b".

Three bugs: one operator inside [ ] that bash reads as something else entirely before the test ever sees it, one comparison that insists on numbers when the values are words, and the usual missing quotes.

Keep the function names as they are.$d$,
  'bigger_of A B  |  same_text A B  |  label_for NAME',
  3,
  '00000000-0000-0000-0000-0000000f0016',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Starter code (the broken programs)
-- --------------------------------------------------------------------------
INSERT INTO problem_starters (problem_id, language, starter_code) VALUES
('00000000-0000-0000-0000-0000000a0029', 'go', $c$// Keep this struct as it is.
type Report struct {
	Sorted []int
	Top3   []int
	Sum    int
}

func Analyse(nums []int) Report {
	sort.Ints(nums)

	var sorted []int
	copy(sorted, nums)

	top := nums[len(nums)-3:]
	for i, j := 0, len(top)-1; i < j; i, j = i+1, j-1 {
		top[i], top[j] = top[j], top[i]
	}

	sum := 0
	for _, v := range nums {
		sum += v
	}

	return Report{Sorted: sorted, Top3: top, Sum: sum}
}
$c$),

('00000000-0000-0000-0000-0000000a0030', 'go', $c$// Keep this struct as it is.
type Summary struct {
	Counts string
	Runes  int
}

func Summarise(text string) Summary {
	counts := map[string]int{}
	for _, w := range strings.Split(text, " ") {
		counts[w]++
	}

	parts := []string{}
	for w, n := range counts {
		parts = append(parts, w+"="+strconv.Itoa(n))
	}

	return Summary{Counts: strings.Join(parts, ","), Runes: len(text)}
}
$c$),

('00000000-0000-0000-0000-0000000a0031', 'go', $c$// Keep this struct as it is.
type Ledger struct {
	Applied int
	Balance int
	Err     string
}

func Apply(start int, deltas []int) (l Ledger) {
	defer func() {
		l.Applied = 0
		l.Balance = start
	}()

	balance := start
	for _, d := range deltas {
		balance := balance + d
		if balance < 0 {
			l.Err = fmt.Sprintf("delta %d would overdraw", d)
			continue
		}
		l.Applied++
	}

	l.Balance = balance
	return
}
$c$),

('00000000-0000-0000-0000-0000000a0032', 'java', $c$import java.util.*;

class Point {
    final int x;
    final int y;

    Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    public boolean equals(Point other) {
        return x == other.x && y == other.y;
    }
}

class Registry {
    static int distinct(List<Point> points) {
        return new HashSet<>(points).size();
    }

    static boolean contains(List<Point> points, Point p) {
        return points.contains(p);
    }

    static boolean sameLabel(String a, String b) {
        return a == b;
    }

    static boolean sameNumber(Integer a, Integer b) {
        return a == b;
    }
}
$c$),

('00000000-0000-0000-0000-0000000a0033', 'java', $c$import java.util.*;

class Basket {
    static List<String> withoutBlanks(List<String> items) {
        for (String s : items) {
            if (s.trim().isEmpty()) {
                items.remove(s);
            }
        }
        return items;
    }

    static List<String> plus(List<String> items, String extra) {
        List<String> out = Arrays.asList(items.toArray(new String[0]));
        out.add(extra);
        return out;
    }

    static boolean sameItems(String[] a, String[] b) {
        return a.equals(b);
    }
}
$c$),

('00000000-0000-0000-0000-0000000a0034', 'java', $c$import java.util.*;

class Numbers {
    static double average(List<Integer> xs) {
        int sum = 0;
        for (int x : xs) {
            sum += x;
        }
        return sum / xs.size();
    }

    static String nextLetter(char c) {
        return "" + (c + 1);
    }

    static boolean nearlyEqual(double a, double b) {
        return a == b;
    }

    static int mod(int a, int m) {
        return a % m;
    }
}
$c$),

('00000000-0000-0000-0000-0000000a0035', 'python', $c$def add_item(item, basket=[]):
    basket.append(item)
    return basket


def multipliers(n):
    return [lambda x: x * i for i in range(n)]


def blank_grid(rows, cols):
    return [[0] * cols] * rows
$c$),

('00000000-0000-0000-0000-0000000a0036', 'python', $c$def sorted_unique(values):
    values.sort()
    out = []
    for v in values:
        if v not in out:
            out.append(v)
    return out


def first_or_default(values, default=0):
    if not values:
        return default
    return values[0] or default


def merged(base, extra):
    base.update(extra)
    return base


def trimmed(text, suffix):
    return text.rstrip(suffix)
$c$),

('00000000-0000-0000-0000-0000000a0037', 'python', $c$def drop_negatives(values):
    for v in values:
        if v < 0:
            values.remove(v)
    return values


def summarise(numbers):
    total = sum(numbers)
    count = len(list(numbers))
    return count, total


def rounded(values):
    return [round(v) for v in values]
$c$),

('00000000-0000-0000-0000-0000000a0038', 'bash', $c$join_with() {
  sep=$1
  shift
  out=""
  for arg in $@; do
    if [ -n "$out" ]; then
      out="$out$sep"
    fi
    out="$out$arg"
  done
  echo $out
}
$c$),

('00000000-0000-0000-0000-0000000a0039', 'bash', $c$count_matching() {
  local pattern=$1
  shift
  local count=0
  printf '%s\n' "$@" | while read -r line; do
    case "$line" in
      *"$pattern"*) count=$((count + 1)) ;;
    esac
  done
  echo "$count"
}

run_and_report() {
  local output=$("$@" 2>/dev/null)
  local status=$?
  echo "status=$status"
}

sum_numbers() {
  local total=0
  local n
  for n in "$@"; do
    total=$((total + n))
  done
  echo "$total"
}
$c$),

('00000000-0000-0000-0000-0000000a0040', 'bash', $c$bigger_of() {
  local a=$1
  local b=$2
  if [ $a > $b ]; then
    echo "$a"
  else
    echo "$b"
  fi
}

same_text() {
  if [ "$1" -eq "$2" ]; then
    echo same
  else
    echo different
  fi
}

label_for() {
  local name=$1
  if [ -z $name ]; then
    echo empty
  else
    echo $name
  fi
}
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

-- --------------------------------------------------------------------------
-- Reference solutions
-- --------------------------------------------------------------------------
INSERT INTO problem_solutions (id, problem_id, language, title, code) VALUES
('00000000-0000-0000-0000-0000000b0052', '00000000-0000-0000-0000-0000000a0029', 'go', 'all three bugs fixed',
$c$type Report struct {
	Sorted []int
	Top3   []int
	Sum    int
}

func Analyse(nums []int) Report {
	// FIX 1: a []int parameter is a window onto the caller's array, so
	// sort.Ints(nums) reorders their data. Copy first, sort the copy.
	// FIX 2: copy() copies min(len(dst), len(src)) elements - into a nil
	// slice that is zero, and it says so by returning 0 rather than failing.
	// The destination has to be made with room in it.
	sorted := make([]int, len(nums))
	copy(sorted, nums)
	sort.Ints(sorted)

	// FIX 3: sorted[len(sorted)-3:] shares the same backing array, so
	// reversing it in place scrambles the tail of Sorted as well - and it
	// panics outright when there are fewer than three elements.
	n := 3
	if len(sorted) < n {
		n = len(sorted)
	}
	top := make([]int, n)
	for i := 0; i < n; i++ {
		top[i] = sorted[len(sorted)-1-i]
	}

	sum := 0
	for _, v := range sorted {
		sum += v
	}

	return Report{Sorted: sorted, Top3: top, Sum: sum}
}
$c$),

('00000000-0000-0000-0000-0000000b0053', '00000000-0000-0000-0000-0000000a0030', 'go', 'all three bugs fixed',
$c$type Summary struct {
	Counts string
	Runes  int
}

func Summarise(text string) Summary {
	counts := map[string]int{}
	// FIX 1: Split on a single space turns every run of spaces into empty
	// fields (and gives one for a leading or trailing space). Fields splits
	// on runs of whitespace, which is what "words" means here.
	for _, w := range strings.Fields(text) {
		counts[w]++
	}

	// FIX 2: ranging over a map visits the keys in a deliberately randomised
	// order - not "insertion order", not "whatever it happened to be last
	// time". Collect the keys and sort them.
	words := make([]string, 0, len(counts))
	for w := range counts {
		words = append(words, w)
	}
	sort.Strings(words)

	parts := make([]string, 0, len(words))
	for _, w := range words {
		parts = append(parts, w+"="+strconv.Itoa(counts[w]))
	}

	// FIX 3: len() on a string is its length in bytes. A character outside
	// ASCII takes more than one, so counting characters means counting runes.
	return Summary{Counts: strings.Join(parts, ","), Runes: len([]rune(text))}
}
$c$),

('00000000-0000-0000-0000-0000000b0054', '00000000-0000-0000-0000-0000000a0031', 'go', 'all three bugs fixed',
$c$type Ledger struct {
	Applied int
	Balance int
	Err     string
}

func Apply(start int, deltas []int) (l Ledger) {
	// FIX 1: the deferred function runs on every return, not only the failing
	// one, so it wiped out every successful batch too. Undo the batch only
	// when there is something to undo.
	defer func() {
		if l.Err != "" {
			l.Applied = 0
			l.Balance = start
		}
	}()

	balance := start
	for _, d := range deltas {
		if balance+d < 0 {
			l.Err = fmt.Sprintf("delta %d would overdraw", d)
			// FIX 3: the contract says the first offender rejects the batch.
			// "continue" kept going and let a later one overwrite Err.
			break
		}
		// FIX 2: "balance := balance + d" declared a *new* balance scoped to
		// the loop body, so the outer one never moved and every delta was
		// tested against the starting balance. Assign, do not declare.
		balance += d
		l.Applied++
	}

	l.Balance = balance
	return
}
$c$),

('00000000-0000-0000-0000-0000000b0055', '00000000-0000-0000-0000-0000000a0032', 'java', 'all four bugs fixed',
$c$import java.util.*;

class Point {
    final int x;
    final int y;

    Point(int x, int y) {
        this.x = x;
        this.y = y;
    }

    // FIX 1: "equals(Point)" is an overload, not an override - HashSet and
    // List.contains() call equals(Object) and got Object's identity version.
    // @Override is what makes the compiler check that claim.
    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Point)) {
            return false;
        }
        Point other = (Point) o;
        return x == other.x && y == other.y;
    }

    // FIX 2: two objects that are equal must have the same hashCode, or a
    // HashSet looks for them in the wrong bucket and never finds them.
    @Override
    public int hashCode() {
        return Objects.hash(x, y);
    }
}

class Registry {
    static int distinct(List<Point> points) {
        return new HashSet<>(points).size();
    }

    static boolean contains(List<Point> points, Point p) {
        return points.contains(p);
    }

    // FIX 3: == on Strings compares references. Literals are interned, so it
    // appears to work right up until one of the strings was built at runtime.
    static boolean sameLabel(String a, String b) {
        return Objects.equals(a, b);
    }

    // FIX 4: the same for boxed Integers, with an extra trap - the JVM caches
    // boxes for -128..127, so == is true for 100 and false for 1000.
    static boolean sameNumber(Integer a, Integer b) {
        return Objects.equals(a, b);
    }
}
$c$),

('00000000-0000-0000-0000-0000000b0056', '00000000-0000-0000-0000-0000000a0033', 'java', 'all four bugs fixed',
$c$import java.util.*;

class Basket {
    // FIX 1: removing from a list while a for-each loop holds an iterator over
    // it throws ConcurrentModificationException - except when the removed item
    // is second to last, where the iterator's cursor happens to land on size()
    // and the loop just stops early. Both are bugs; building a new list is the
    // fix for both.
    // FIX 2: the old version also handed back the caller's own list, edited.
    static List<String> withoutBlanks(List<String> items) {
        List<String> out = new ArrayList<>();
        for (String s : items) {
            if (!s.trim().isEmpty()) {
                out.add(s);
            }
        }
        return out;
    }

    // FIX 3: Arrays.asList returns a fixed-size view over the array, so add()
    // on it throws UnsupportedOperationException. Copy into a real list.
    static List<String> plus(List<String> items, String extra) {
        List<String> out = new ArrayList<>(items);
        out.add(extra);
        return out;
    }

    // FIX 4: arrays do not override equals(), so a.equals(b) is a == b.
    static boolean sameItems(String[] a, String[] b) {
        return Arrays.equals(a, b);
    }
}
$c$),

('00000000-0000-0000-0000-0000000b0057', '00000000-0000-0000-0000-0000000a0034', 'java', 'all four bugs fixed',
$c$import java.util.*;

class Numbers {
    // FIX 1: sum and size() are both ints, so the division happened in integer
    // arithmetic and the result was only widened to double afterwards.
    static double average(List<Integer> xs) {
        int sum = 0;
        for (int x : xs) {
            sum += x;
        }
        return (double) sum / xs.size();
    }

    // FIX 2: char + int is an int, so "" + (c + 1) printed the number. Cast
    // back to char before turning it into a string.
    static String nextLetter(char c) {
        return String.valueOf((char) (c + 1));
    }

    // FIX 3: 0.1 + 0.2 is not 0.3 in binary floating point. Compare within a
    // tolerance, which is what the contract asked for anyway.
    static boolean nearlyEqual(double a, double b) {
        return Math.abs(a - b) < 1e-9;
    }

    // FIX 4: Java's % takes the sign of the left operand, so -1 % 3 is -1.
    // Shift it back into range for the mathematical definition.
    static int mod(int a, int m) {
        return ((a % m) + m) % m;
    }
}
$c$),

('00000000-0000-0000-0000-0000000b0058', '00000000-0000-0000-0000-0000000a0035', 'python', 'all three bugs fixed',
$c$def add_item(item, basket=None):
    # FIX 1: a default argument is evaluated once, when the def is executed -
    # so "basket=[]" was one list shared by every call that omitted it.
    if basket is None:
        basket = []
    basket.append(item)
    return basket


def multipliers(n):
    # FIX 2: the lambdas closed over the variable i, not over its value, so
    # after the comprehension finished they all saw the last one. Binding it
    # as a default argument captures the value at creation time.
    return [lambda x, i=i: x * i for i in range(n)]


def blank_grid(rows, cols):
    # FIX 3: [row] * rows repeats the *same* list object rows times, so every
    # row is the same row. Build each one separately.
    return [[0] * cols for _ in range(rows)]
$c$),

('00000000-0000-0000-0000-0000000b0059', '00000000-0000-0000-0000-0000000a0036', 'python', 'all four bugs fixed',
$c$def sorted_unique(values):
    # FIX 1: list.sort() sorts the caller's list in place (and returns None).
    # sorted() returns a new list and leaves the argument alone.
    out = []
    for v in sorted(values):
        if not out or v != out[-1]:
            out.append(v)
    return out


def first_or_default(values, default=0):
    # FIX 2: "values[0] or default" replaces any falsy first element - 0, "",
    # False - with the default. The contract is about an empty list, which the
    # check above already covers.
    if not values:
        return default
    return values[0]


def merged(base, extra):
    # FIX 3: dict.update() modifies base in place. Build a new dict instead.
    return {**base, **extra}


def trimmed(text, suffix):
    # FIX 4: rstrip() takes a *set of characters* to strip, not a suffix, so
    # "banana".rstrip("na") strips every trailing n and a and leaves "b".
    return text.removesuffix(suffix)
$c$),

('00000000-0000-0000-0000-0000000b0060', '00000000-0000-0000-0000-0000000a0037', 'python', 'all three bugs fixed',
$c$import math


def drop_negatives(values):
    # FIX 1: removing from a list while iterating over it makes the loop skip
    # the element that slides into the freed index - and it edited the
    # caller's list on top. Build a new one.
    return [v for v in values if v >= 0]


def summarise(numbers):
    # FIX 2: a generator can only be walked once, so sum() consumed it and the
    # count that followed saw nothing. Materialise it once, then measure.
    items = list(numbers)
    return len(items), sum(items)


def rounded(values):
    # FIX 3: Python's round() is banker's rounding - halves go to the nearest
    # *even* number, so round(0.5) is 0 and round(2.5) is 2. The contract asks
    # for halves away from zero.
    return [int(math.floor(v + 0.5)) if v >= 0 else int(math.ceil(v - 0.5)) for v in values]
$c$),

('00000000-0000-0000-0000-0000000b0061', '00000000-0000-0000-0000-0000000a0038', 'bash', 'all three bugs fixed',
$c$join_with() {
  # FIX 1: without "local", sep and out are global - the function overwrote
  # variables of the same name in whoever called it.
  local sep=$1
  shift
  local out=""
  local arg
  # FIX 2: "for arg in $@" expands unquoted and re-splits every argument on
  # its own spaces. "$@" keeps them as they were passed.
  for arg in "$@"; do
    if [ -n "$out" ]; then
      out="$out$sep"
    fi
    out="$out$arg"
  done
  # FIX 3: echo $out goes through word splitting too, which collapses runs of
  # spaces into one.
  printf '%s\n' "$out"
}
$c$),

('00000000-0000-0000-0000-0000000b0062', '00000000-0000-0000-0000-0000000a0039', 'bash', 'all three bugs fixed',
$c$count_matching() {
  local pattern=$1
  shift
  local count=0
  local line
  # FIX 1: the right-hand side of a pipe runs in a subshell, so the while loop
  # was incrementing a copy of count that died with it. Feed the loop from a
  # redirect instead, and it stays in this shell.
  while read -r line; do
    case "$line" in
      *"$pattern"*) count=$((count + 1)) ;;
    esac
  done < <(printf '%s\n' "$@")
  echo "$count"
}

run_and_report() {
  # FIX 2: "local output=$(cmd)" is one command whose exit status is local's,
  # not the command's - always 0. Declare first, assign second.
  local output
  output=$("$@" 2>/dev/null)
  local status=$?
  echo "status=$status"
}

sum_numbers() {
  local total=0
  local n
  for n in "$@"; do
    # FIX 3: inside $(( )) a leading zero means octal, so 08 and 09 are not
    # valid numbers at all. 10#$n forces base ten.
    total=$((total + 10#$n))
  done
  echo "$total"
}
$c$),

('00000000-0000-0000-0000-0000000b0063', '00000000-0000-0000-0000-0000000a0040', 'bash', 'all three bugs fixed',
$c$bigger_of() {
  local a=$1
  local b=$2
  # FIX 1: inside [ ], > is not a comparison - the shell strips it as an
  # output redirection before [ ever runs, so the test always succeeded and a
  # file named after $b appeared. -gt compares integers; [[ a > b ]] would
  # compare them as strings, which is a different bug again.
  if [ "$a" -gt "$b" ]; then
    echo "$a"
  else
    echo "$b"
  fi
}

same_text() {
  # FIX 2: -eq is an integer comparison and errors out on words. = compares
  # strings.
  if [ "$1" = "$2" ]; then
    echo same
  else
    echo different
  fi
}

label_for() {
  local name=$1
  # FIX 3: [ -z $name ] with a multi-word value expands into several arguments
  # and [ complains; echo $name then collapses runs of spaces. Quote both.
  if [ -z "$name" ]; then
    echo empty
  else
    printf '%s\n' "$name"
  fi
}
$c$)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Test code
-- --------------------------------------------------------------------------
INSERT INTO problem_test_code (problem_id, language, public_code, hidden_code) VALUES
('00000000-0000-0000-0000-0000000a0029', 'go',
$c$func sameInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestSortedIsAnAscendingCopy(t *testing.T) {
	got := Analyse([]int{5, 1, 9, 3})
	if !sameInts(got.Sorted, []int{1, 3, 5, 9}) {
		t.Fatalf("Sorted = %v, want [1 3 5 9]", got.Sorted)
	}
}

func TestInputIsLeftAlone(t *testing.T) {
	in := []int{5, 1, 9, 3}
	Analyse(in)
	if !sameInts(in, []int{5, 1, 9, 3}) {
		t.Fatalf("the caller's slice became %v", in)
	}
}

func TestSum(t *testing.T) {
	if got := Analyse([]int{5, 1, 9, 3}).Sum; got != 18 {
		t.Fatalf("Sum = %d, want 18", got)
	}
}
$c$,
$c$func sameInts(a, b []int) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

func TestTop3IsDescending(t *testing.T) {
	got := Analyse([]int{5, 1, 9, 3})
	if !sameInts(got.Top3, []int{9, 5, 3}) {
		t.Fatalf("Top3 = %v, want [9 5 3]", got.Top3)
	}
}

func TestSortedSurvivesTop3(t *testing.T) {
	got := Analyse([]int{5, 1, 9, 3, 7})
	if !sameInts(got.Sorted, []int{1, 3, 5, 7, 9}) {
		t.Fatalf("Sorted = %v after Top3 was built, want [1 3 5 7 9]", got.Sorted)
	}
}

func TestDuplicates(t *testing.T) {
	got := Analyse([]int{4, 4, 4})
	if !sameInts(got.Top3, []int{4, 4, 4}) {
		t.Fatalf("Top3 = %v, want [4 4 4]", got.Top3)
	}
}

func TestFewerThanThreeValues(t *testing.T) {
	got := Analyse([]int{2, 7})
	if !sameInts(got.Sorted, []int{2, 7}) {
		t.Fatalf("Sorted = %v, want [2 7]", got.Sorted)
	}
	if !sameInts(got.Top3, []int{7, 2}) {
		t.Fatalf("Top3 = %v, want [7 2]", got.Top3)
	}
}
$c$),

('00000000-0000-0000-0000-0000000a0030', 'go',
$c$func TestCountsAreSortedByWord(t *testing.T) {
	if got := Summarise("go go rust  c").Counts; got != "c=1,go=2,rust=1" {
		t.Fatalf("Counts = %q, want \"c=1,go=2,rust=1\"", got)
	}
}

func TestRunsOfSpacesAreNotWords(t *testing.T) {
	if got := Summarise("  a   b  ").Counts; got != "a=1,b=1" {
		t.Fatalf("Counts = %q, want \"a=1,b=1\"", got)
	}
}

func TestRuneCount(t *testing.T) {
	if got := Summarise("go go rust  c").Runes; got != 13 {
		t.Fatalf("Runes = %d, want 13", got)
	}
}
$c$,
$c$func TestRunesAreNotBytes(t *testing.T) {
	if got := Summarise("héllo wörld").Runes; got != 11 {
		t.Fatalf("Runes = %d, want 11", got)
	}
}

func TestNonASCIIWords(t *testing.T) {
	if got := Summarise("héllo wörld héllo").Counts; got != "héllo=2,wörld=1" {
		t.Fatalf("Counts = %q, want \"héllo=2,wörld=1\"", got)
	}
}

func TestTheSameInputTwice(t *testing.T) {
	text := "delta charlie bravo alpha echo foxtrot"
	first := Summarise(text).Counts
	for i := 0; i < 20; i++ {
		if got := Summarise(text).Counts; got != first {
			t.Fatalf("run %d gave %q, the first run gave %q", i, got, first)
		}
	}
}

func TestEmptyText(t *testing.T) {
	got := Summarise("")
	if got.Counts != "" || got.Runes != 0 {
		t.Fatalf("Summarise(\"\") = %+v, want an empty summary", got)
	}
}
$c$),

('00000000-0000-0000-0000-0000000a0031', 'go',
$c$func TestBatchThatGoesThrough(t *testing.T) {
	got := Apply(10, []int{5, 3})
	if got.Applied != 2 || got.Balance != 18 || got.Err != "" {
		t.Fatalf("Apply(10, [5 3]) = %+v, want {Applied:2 Balance:18 Err:}", got)
	}
}

func TestOverdrawIsRejected(t *testing.T) {
	got := Apply(10, []int{5, -20, 3})
	if got.Applied != 0 || got.Balance != 10 {
		t.Fatalf("Apply(10, [5 -20 3]) = %+v, want the batch rejected", got)
	}
	if got.Err != "delta -20 would overdraw" {
		t.Fatalf("Err = %q, want \"delta -20 would overdraw\"", got.Err)
	}
}

func TestBalanceMovesBetweenDeltas(t *testing.T) {
	got := Apply(5, []int{-3, -3})
	if got.Err != "delta -3 would overdraw" {
		t.Fatalf("Err = %q, want the second delta to overdraw", got.Err)
	}
	if got.Applied != 0 || got.Balance != 5 {
		t.Fatalf("Apply(5, [-3 -3]) = %+v, want the batch rejected", got)
	}
}
$c$,
$c$func TestTheFirstOffenderIsNamed(t *testing.T) {
	got := Apply(0, []int{-1, -2})
	if got.Err != "delta -1 would overdraw" {
		t.Fatalf("Err = %q, want the first offender", got.Err)
	}
}

func TestExactlyZeroIsAllowed(t *testing.T) {
	got := Apply(5, []int{-5})
	if got.Applied != 1 || got.Balance != 0 || got.Err != "" {
		t.Fatalf("Apply(5, [-5]) = %+v, want {Applied:1 Balance:0 Err:}", got)
	}
}

func TestNoDeltas(t *testing.T) {
	got := Apply(7, nil)
	if got.Applied != 0 || got.Balance != 7 || got.Err != "" {
		t.Fatalf("Apply(7, nil) = %+v, want {Applied:0 Balance:7 Err:}", got)
	}
}
$c$),

('00000000-0000-0000-0000-0000000a0032', 'java',
$c$class SigTests {
    @Test
    public void distinctCountsEqualPointsOnce() {
        java.util.List<Point> points = new java.util.ArrayList<>();
        points.add(new Point(1, 2));
        points.add(new Point(1, 2));
        points.add(new Point(3, 4));
        org.junit.Assert.assertEquals(2, Registry.distinct(points));
    }

    @Test
    public void containsFindsAnEqualPoint() {
        java.util.List<Point> points = new java.util.ArrayList<>();
        points.add(new Point(1, 2));
        org.junit.Assert.assertTrue(Registry.contains(points, new Point(1, 2)));
    }

    @Test
    public void sameLabelComparesText() {
        String built = new StringBuilder("sig").append("nal").toString();
        org.junit.Assert.assertTrue(Registry.sameLabel("signal", built));
    }
}
$c$,
$c$class SigTests {
    @Test
    public void sameNumberBelowTheCache() {
        org.junit.Assert.assertTrue(Registry.sameNumber(100, 100));
    }

    @Test
    public void sameNumberAboveTheCache() {
        org.junit.Assert.assertTrue(Registry.sameNumber(1000, 1000));
    }

    @Test
    public void differentNumbersAreNotTheSame() {
        org.junit.Assert.assertFalse(Registry.sameNumber(1000, 1001));
    }

    @Test
    public void differentPointsStayDistinct() {
        java.util.List<Point> points = new java.util.ArrayList<>();
        points.add(new Point(1, 2));
        points.add(new Point(2, 1));
        org.junit.Assert.assertEquals(2, Registry.distinct(points));
        org.junit.Assert.assertFalse(Registry.contains(points, new Point(9, 9)));
    }

    @Test
    public void differentLabelsAreNotTheSame() {
        org.junit.Assert.assertFalse(Registry.sameLabel("signal", "stage"));
    }
}
$c$),

('00000000-0000-0000-0000-0000000a0033', 'java',
$c$class SigTests {
    @Test
    public void blanksAreDropped() {
        java.util.List<String> items = new java.util.ArrayList<>(
                java.util.Arrays.asList("  ", "a", "b"));
        org.junit.Assert.assertEquals(java.util.Arrays.asList("a", "b"), Basket.withoutBlanks(items));
    }

    @Test
    public void theCallersListIsLeftAlone() {
        java.util.List<String> items = new java.util.ArrayList<>(
                java.util.Arrays.asList("  ", "a", "b"));
        Basket.withoutBlanks(items);
        org.junit.Assert.assertEquals(java.util.Arrays.asList("  ", "a", "b"), items);
    }

    @Test
    public void plusAppends() {
        java.util.List<String> items = new java.util.ArrayList<>(java.util.Arrays.asList("a"));
        org.junit.Assert.assertEquals(java.util.Arrays.asList("a", "b"), Basket.plus(items, "b"));
    }
}
$c$,
$c$class SigTests {
    @Test
    public void plusDoesNotTouchTheInput() {
        java.util.List<String> items = new java.util.ArrayList<>(java.util.Arrays.asList("a"));
        Basket.plus(items, "b");
        org.junit.Assert.assertEquals(java.util.Arrays.asList("a"), items);
    }

    @Test
    public void blankMeansWhitespaceToo() {
        java.util.List<String> items = new java.util.ArrayList<>(
                java.util.Arrays.asList("a", "", "\t", "b"));
        org.junit.Assert.assertEquals(java.util.Arrays.asList("a", "b"), Basket.withoutBlanks(items));
    }

    @Test
    public void aBlankSecondToLastIsAlsoDropped() {
        java.util.List<String> items = new java.util.ArrayList<>(
                java.util.Arrays.asList("a", " ", "b"));
        org.junit.Assert.assertEquals(java.util.Arrays.asList("a", "b"), Basket.withoutBlanks(items));
    }

    @Test
    public void arraysWithTheSameContentsAreTheSame() {
        org.junit.Assert.assertTrue(Basket.sameItems(new String[] {"a", "b"}, new String[] {"a", "b"}));
        org.junit.Assert.assertFalse(Basket.sameItems(new String[] {"a", "b"}, new String[] {"b", "a"}));
    }
}
$c$),

('00000000-0000-0000-0000-0000000a0034', 'java',
$c$class SigTests {
    @Test
    public void averageIsNotAnInteger() {
        org.junit.Assert.assertEquals(1.5, Numbers.average(java.util.Arrays.asList(1, 2)), 1e-9);
    }

    @Test
    public void nextLetterIsALetter() {
        org.junit.Assert.assertEquals("b", Numbers.nextLetter('a'));
    }

    @Test
    public void almostEqualDoubles() {
        org.junit.Assert.assertTrue(Numbers.nearlyEqual(0.1 + 0.2, 0.3));
    }
}
$c$,
$c$class SigTests {
    @Test
    public void negativeModulo() {
        org.junit.Assert.assertEquals(2, Numbers.mod(-1, 3));
        org.junit.Assert.assertEquals(1, Numbers.mod(7, 3));
        org.junit.Assert.assertEquals(0, Numbers.mod(-9, 3));
    }

    @Test
    public void averageOfNegatives() {
        org.junit.Assert.assertEquals(-1.5, Numbers.average(java.util.Arrays.asList(-1, -2)), 1e-9);
    }

    @Test
    public void nextLetterWrapsThroughTheAlphabet() {
        org.junit.Assert.assertEquals("z", Numbers.nextLetter('y'));
        org.junit.Assert.assertEquals("B", Numbers.nextLetter('A'));
    }

    @Test
    public void clearlyDifferentDoublesAreNotEqual() {
        org.junit.Assert.assertFalse(Numbers.nearlyEqual(0.1, 0.2));
    }
}
$c$),

('00000000-0000-0000-0000-0000000a0035', 'python',
$c$class TestDefaults(unittest.TestCase):
    def test_each_call_starts_a_fresh_basket(self):
        self.assertEqual(add_item("a"), ["a"])
        self.assertEqual(add_item("b"), ["b"])

    def test_multipliers_multiply_by_their_index(self):
        fns = multipliers(3)
        self.assertEqual(fns[0](10), 0)
        self.assertEqual(fns[1](10), 10)
        self.assertEqual(fns[2](10), 20)

    def test_grid_cells_are_independent(self):
        grid = blank_grid(2, 3)
        grid[0][0] = 1
        self.assertEqual(grid, [[1, 0, 0], [0, 0, 0]])
$c$,
$c$class TestDefaultsHidden(unittest.TestCase):
    def test_an_explicit_basket_is_used(self):
        basket = ["x"]
        self.assertEqual(add_item("y", basket), ["x", "y"])
        self.assertEqual(basket, ["x", "y"])

    def test_many_calls_stay_independent(self):
        for _ in range(5):
            self.assertEqual(add_item("z"), ["z"])

    def test_no_multipliers(self):
        self.assertEqual(multipliers(0), [])

    def test_grid_shape(self):
        grid = blank_grid(3, 2)
        self.assertEqual(grid, [[0, 0], [0, 0], [0, 0]])
        grid[2][1] = 7
        self.assertEqual(grid[0][1], 0)
        self.assertEqual(grid[1][1], 0)
$c$),

('00000000-0000-0000-0000-0000000a0036', 'python',
$c$class TestCopies(unittest.TestCase):
    def test_sorted_unique_leaves_the_input_alone(self):
        values = [3, 1, 3, 2]
        self.assertEqual(sorted_unique(values), [1, 2, 3])
        self.assertEqual(values, [3, 1, 3, 2])

    def test_a_falsy_first_element_is_still_the_first(self):
        self.assertEqual(first_or_default([0, 1, 2], 9), 0)
        self.assertEqual(first_or_default([], 9), 9)

    def test_trimmed_removes_a_suffix_not_a_character_set(self):
        self.assertEqual(trimmed("banana", "na"), "bana")
$c$,
$c$class TestCopiesHidden(unittest.TestCase):
    def test_merged_touches_neither_argument(self):
        base = {"a": 1}
        extra = {"b": 2}
        self.assertEqual(merged(base, extra), {"a": 1, "b": 2})
        self.assertEqual(base, {"a": 1})
        self.assertEqual(extra, {"b": 2})

    def test_merged_prefers_extra(self):
        self.assertEqual(merged({"a": 1}, {"a": 2}), {"a": 2})

    def test_empty_string_is_a_value(self):
        self.assertEqual(first_or_default(["", "x"], "fallback"), "")

    def test_trimmed_leaves_other_text_alone(self):
        self.assertEqual(trimmed("banana", "xyz"), "banana")
        self.assertEqual(trimmed("aaa", "a"), "aa")

    def test_sorted_unique_on_an_empty_list(self):
        self.assertEqual(sorted_unique([]), [])
$c$),

('00000000-0000-0000-0000-0000000a0037', 'python',
$c$class TestIterating(unittest.TestCase):
    def test_every_negative_is_dropped(self):
        self.assertEqual(drop_negatives([-1, -2, 3]), [3])

    def test_the_input_is_left_alone(self):
        values = [-1, -2, 3]
        drop_negatives(values)
        self.assertEqual(values, [-1, -2, 3])

    def test_summarise_over_a_generator(self):
        self.assertEqual(summarise(x for x in [1, 2, 3]), (3, 6))
$c$,
$c$class TestIteratingHidden(unittest.TestCase):
    def test_rounding_halves_away_from_zero(self):
        self.assertEqual(rounded([0.5, 1.5, 2.5]), [1, 2, 3])

    def test_negative_halves(self):
        self.assertEqual(rounded([-0.5, -2.5]), [-1, -3])

    def test_ordinary_rounding(self):
        self.assertEqual(rounded([1.2, 1.8, -1.2]), [1, 2, -1])

    def test_summarise_over_a_list(self):
        self.assertEqual(summarise([4, 5]), (2, 9))

    def test_zero_is_not_negative(self):
        self.assertEqual(drop_negatives([0, -1, 0]), [0, 0])
$c$),

('00000000-0000-0000-0000-0000000a0038', 'bash',
$c$assert_eq "a b, c" "$(join_with ", " "a b" "c")" "an argument with a space stays one argument"
assert_eq "x  y" "$(join_with "-" "x  y")" "a run of spaces inside an argument survives"
assert_eq "a-b-c" "$(join_with "-" a b c)" "plain arguments join with the separator"
$c$,
$c$assert_eq "" "$(join_with ",")" "no arguments produce nothing"
assert_eq "only" "$(join_with ", " only)" "a single argument needs no separator"

out="mine"
sep="mine"
join_with ", " a b > /dev/null
assert_eq "mine" "$out" "the caller's out variable is untouched"
assert_eq "mine" "$sep" "the caller's sep variable is untouched"

assert_eq "a b" "$(join_with "" "a b")" "an empty separator joins nothing in between"
$c$),

('00000000-0000-0000-0000-0000000a0039', 'bash',
$c$assert_eq "2" "$(count_matching er water paper stone)" "counts every argument containing the pattern"
assert_eq "status=1" "$(run_and_report false)" "reports a failing command"
assert_eq "17" "$(sum_numbers 08 09)" "leading zeros are still decimal"
$c$,
$c$assert_eq "0" "$(count_matching zz water paper stone)" "counts nothing when nothing matches"
assert_eq "3" "$(count_matching a a ab ba)" "counts a pattern at either end"
assert_eq "status=0" "$(run_and_report true)" "reports a successful command"
assert_eq "status=3" "$(run_and_report bash -c 'exit 3')" "reports the real exit code"
assert_eq "6" "$(sum_numbers 1 2 3)" "adds ordinary numbers"
assert_eq "0" "$(sum_numbers)" "no numbers add up to zero"
$c$),

('00000000-0000-0000-0000-0000000a0040', 'bash',
$c$assert_eq "10" "$(bigger_of 5 10)" "picks the larger number"
assert_eq "same" "$(same_text abc abc)" "two identical words are the same"
assert_eq "a  b" "$(label_for "a  b")" "a name keeps its spacing"
$c$,
$c$assert_eq "10" "$(bigger_of 10 5)" "picks the larger number whichever side it is on"
assert_eq "-1" "$(bigger_of -5 -1)" "compares negative numbers"
assert_eq "different" "$(same_text abc abd)" "two different words are different"
assert_eq "same" "$(same_text 10 10)" "two identical numbers are the same"
assert_eq "empty" "$(label_for "")" "an empty name is reported as empty"

rm -f 10 5
bigger_of 5 10 > /dev/null
if [ -e 10 ]; then
  __sig_fail "no stray files are created" "a file named 10 appeared"
else
  __sig_ok "no stray files are created"
fi
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

-- Debugging problems get a folder of their own per language, and C++ gets four
-- more of them.
--
-- 020 shipped a single top-level "C++ debug" folder holding one problem. Now
-- that every supported language has debugging exercises (024), they live under
-- a shared "debug" parent, one folder per language:
--
--   debug/C++     Team of Gamers (from 020), plus the four added here
--   debug/Go      \
--   debug/Java     |  seeded by 024
--   debug/Python   |
--   debug/Bash    /
--
-- The move is guarded on the folder still being where 020 put it, so an
-- instance where somebody already renamed or moved it is left alone.

INSERT INTO problem_folders (id, path, created_by) VALUES
  ('00000000-0000-0000-0000-0000000f0012', 'debug', NULL)
ON CONFLICT (id) DO NOTHING;

UPDATE problem_folders
   SET path = 'debug/C++'
 WHERE id = '00000000-0000-0000-0000-0000000f0006'
   AND path = 'C++ debug'
   AND NOT EXISTS (SELECT 1 FROM problem_folders WHERE path = 'debug/C++');

-- --------------------------------------------------------------------------
-- Problems. Same shape as 020's "C++ Bugs Hunt": a program that reads as if it
-- worked, several bugs of deliberately different kinds, and tests that pin the
-- behaviour it was supposed to have. Every bug here is defined behaviour that
-- produces a specific wrong answer - none of them is undefined behaviour that
-- might accidentally look right on a different compiler.
-- --------------------------------------------------------------------------
INSERT INTO problems (id, title, description, signature_hint, difficulty, folder_id, created_by, is_shared) VALUES
(
  '00000000-0000-0000-0000-0000000a0025',
  'Erasing While You Iterate',
  $d$analyse() is supposed to drop every even value from the list, keeping the order of what is left, and report three things:

  odds          - the input with the even values removed
  evensRemoved  - how many values it dropped
  distinctOdds  - how many *different* values are left

It gets all three wrong. For [4, 2, 7, 7, -3, 6] it should answer [7, 7, -3], 3 and 2.

There are four bugs, of three different kinds: what happens to the indices when you erase from a vector you are walking, what "% 2" does to a negative number, and two separate misunderstandings of what std::unique is for.

Keep the Stats struct and the signature of analyse() as they are - the tests use them.$d$,
  'Stats analyse(vector<int> values)  -  Stats { vector<int> odds; int evensRemoved; int distinctOdds; }',
  4,
  '00000000-0000-0000-0000-0000000f0006',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0026',
  'Prices and Rounding',
  $d$checkOut() totals a list of prices and reports:

  average       - the mean price, as an exact fraction of the total
  cheapest      - the index of the smallest price
  roundedTotal  - the total rounded to the nearest whole unit, halves away from zero (so -2.5 rounds to -3)
  sumsToWhole   - whether the total lands on a whole number, allowing 1e-9 of slack for the arithmetic

The list always holds at least one price, and a price can be negative - that is a refund.

Every field except cheapest comes back wrong, and none of the reasons is the same as another: one is about which type is holding the running total, one is about when a value gets truncated to an integer, one is about how rounding treats negative numbers, and one is about comparing floating-point numbers for equality.

Keep the Receipt struct and the signature of checkOut() as they are.$d$,
  'Receipt checkOut(const vector<double>& prices)  -  Receipt { double average; int cheapest; int roundedTotal; bool sumsToWhole; }',
  3,
  '00000000-0000-0000-0000-0000000f0006',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0027',
  'Sliced Shapes',
  $d$A tiny shape hierarchy that does not behave like one. describe() builds a rectangle 2 by 3 and a circle of radius 1, and should report

  totalArea = 6 + pi
  names     = "rect,circle"
  leaked    = 0

It reports a total area of 0 and the names "shape,shape" instead, and two of the tests here do not even go through describe() - they take a plain reference to a Rect and a Circle and ask for the area and the name directly.

Four things are wrong, and each is a different way of losing polymorphism: how the shapes are stored, which member functions are virtual, one function that looks like an override and is not (the compiler would have told you if it had been asked), and a destructor that will only start to matter once you have fixed the first one.

Keep the type names (Shape, Rect, Circle, Summary), their constructors and describe() as they are. The alive counters exist so the tests can see leaks - leave them in.$d$,
  'Summary describe()  -  Summary { double totalArea; string names; int leaked; }',
  4,
  '00000000-0000-0000-0000-0000000f0006',
  NULL,
  true
),
(
  '00000000-0000-0000-0000-0000000a0028',
  'The Same Call Twice',
  $d$runBatch() should report, for the jobs it was given:

  processed - how many jobs it handled
  total     - their sum
  summary   - their values joined by commas, e.g. "1,2,3" (no trailing comma)

Called with [1, 2, 3] it should answer 3, 6 and "1,2,3" - and answer exactly the same thing when called again with the same jobs. It does neither.

Three bugs: two of them are the same mistake about where a value lives, one is about how a struct gets filled in by position, and one is an off-by-one in string building. Note that the second call is wrong in a way the first one is not - a function that only works once is the interesting half of this exercise.

Keep the Report struct and the signature of runBatch() as they are.$d$,
  'Report runBatch(const vector<int>& jobs)  -  Report { int processed; int total; string summary; }',
  3,
  '00000000-0000-0000-0000-0000000f0006',
  NULL,
  true
)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Starter code (the broken programs)
-- --------------------------------------------------------------------------
INSERT INTO problem_starters (problem_id, language, starter_code) VALUES
('00000000-0000-0000-0000-0000000a0025', 'cpp', $c$// Keep this struct as it is.
struct Stats
{
    vector<int> odds;
    int evensRemoved = 0;
    int distinctOdds = 0;
};

Stats analyse(vector<int> values)
{
    Stats s;

    for (size_t i = 0; i < values.size(); i++)
    {
        if (values[i] % 2 == 1)
        {
            continue;
        }
        values.erase(values.begin() + i);
        s.evensRemoved++;
    }
    s.odds = values;

    vector<int> distinct = s.odds;
    unique(distinct.begin(), distinct.end());
    s.distinctOdds = (int)distinct.size();

    return s;
}
$c$),

('00000000-0000-0000-0000-0000000a0026', 'cpp', $c$// Keep this struct as it is.
struct Receipt
{
    double average = 0.0;
    int cheapest = 0;
    int roundedTotal = 0;
    bool sumsToWhole = false;
};

Receipt checkOut(const vector<double>& prices)
{
    Receipt r;

    float sum = 0;
    size_t cheapest = 0;
    for (size_t i = 0; i < prices.size(); i++)
    {
        sum += prices[i];
        if (prices[i] < prices[cheapest])
        {
            cheapest = i;
        }
    }

    r.average = (int)sum / prices.size();
    r.cheapest = (int)cheapest;
    r.roundedTotal = (int)(sum + 0.5);
    r.sumsToWhole = (sum == (int)sum);

    return r;
}
$c$),

('00000000-0000-0000-0000-0000000a0027', 'cpp', $c$static constexpr double kPi = 3.14159265358979323846;

struct Shape
{
    static int alive;

    Shape() { alive++; }
    ~Shape() { alive--; }

    virtual double area() const { return 0.0; }
    string name() const { return "shape"; }
};

int Shape::alive = 0;

struct Rect : Shape
{
    static int alive;

    double w = 0.0;
    double h = 0.0;

    Rect(double w, double h) : w(w), h(h) { alive++; }
    ~Rect() { alive--; }

    double area() { return w * h; }
    string name() const { return "rect"; }
};

int Rect::alive = 0;

struct Circle : Shape
{
    static int alive;

    double r = 0.0;

    explicit Circle(double r) : r(r) { alive++; }
    ~Circle() { alive--; }

    double area() const { return kPi * r * r; }
    string name() const { return "circle"; }
};

int Circle::alive = 0;

// Keep this struct as it is.
struct Summary
{
    double totalArea = 0.0;
    string names;
    int leaked = 0;
};

Summary describe()
{
    Summary out;
    {
        vector<Shape> shapes;
        shapes.push_back(Rect(2.0, 3.0));
        shapes.push_back(Circle(1.0));

        for (const Shape& s : shapes)
        {
            out.totalArea += s.area();
            if (!out.names.empty())
            {
                out.names += ",";
            }
            out.names += s.name();
        }
    }
    out.leaked = Rect::alive + Circle::alive;
    return out;
}
$c$),

('00000000-0000-0000-0000-0000000a0028', 'cpp', $c$// Keep this struct as it is.
struct Report
{
    int processed = 0;
    int total = 0;
    string summary;
};

Report runBatch(const vector<int>& jobs)
{
    static int processed = 0;
    static string summary;

    int total = 0;
    for (int j : jobs)
    {
        processed++;
        total += j;
        summary += to_string(j) + ",";
    }

    return Report{ total, processed, summary };
}
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

-- --------------------------------------------------------------------------
-- Reference solutions (every fix commented with what it was)
-- --------------------------------------------------------------------------
INSERT INTO problem_solutions (id, problem_id, language, title, code) VALUES
('00000000-0000-0000-0000-0000000b0048', '00000000-0000-0000-0000-0000000a0025', 'cpp', 'all four bugs fixed',
$c$struct Stats
{
    vector<int> odds;
    int evensRemoved = 0;
    int distinctOdds = 0;
};

Stats analyse(vector<int> values)
{
    Stats s;

    // FIX 1: erase() shifts everything down by one, so the loop index must NOT
    // advance when an element was removed - otherwise every value that lands
    // in the freed slot is skipped (two evens in a row keep the second).
    // FIX 2: "% 2 == 1" is false for negative odd numbers - in C++ the result
    // of % keeps the sign of the dividend, so -3 % 2 is -1. Test against 0.
    for (size_t i = 0; i < values.size(); )
    {
        if (values[i] % 2 != 0)
        {
            i++;
            continue;
        }
        values.erase(values.begin() + i);
        s.evensRemoved++;
    }
    s.odds = values;

    // FIX 3: std::unique only collapses *adjacent* duplicates, so the range
    // has to be sorted first.
    // FIX 4: it does not shrink the container either - it moves the survivors
    // to the front and returns the new end, which is what has to be erased.
    vector<int> distinct = s.odds;
    sort(distinct.begin(), distinct.end());
    distinct.erase(unique(distinct.begin(), distinct.end()), distinct.end());
    s.distinctOdds = (int)distinct.size();

    return s;
}
$c$),

('00000000-0000-0000-0000-0000000b0049', '00000000-0000-0000-0000-0000000a0026', 'cpp', 'all four bugs fixed',
$c$#include <cmath>

struct Receipt
{
    double average = 0.0;
    int cheapest = 0;
    int roundedTotal = 0;
    bool sumsToWhole = false;
};

Receipt checkOut(const vector<double>& prices)
{
    Receipt r;

    // FIX 1: float carries ~7 decimal digits, so a running total of prices
    // drifts off the exact value (ten times 0.10f lands on 1.0000001).
    double sum = 0.0;
    size_t cheapest = 0;
    for (size_t i = 0; i < prices.size(); i++)
    {
        sum += prices[i];
        if (prices[i] < prices[cheapest])
        {
            cheapest = i;
        }
    }

    // FIX 2: the cast truncated the total to an integer *before* dividing, and
    // dividing by size() then made it an unsigned division on top - which
    // turns any negative total into a huge positive one.
    r.average = sum / (double)prices.size();
    r.cheapest = (int)cheapest;

    // FIX 3: "(int)(x + 0.5)" rounds -2.5 to -2, not -3: adding a half and
    // truncating rounds towards zero on the negative side. llround() rounds
    // halves away from zero, which is what was asked for.
    r.roundedTotal = (int)llround(sum);

    // FIX 4: == on a computed floating-point value is a coin flip. Compare
    // against the nearest whole number with the tolerance the contract gives.
    r.sumsToWhole = fabs(sum - (double)llround(sum)) < 1e-9;

    return r;
}
$c$),

('00000000-0000-0000-0000-0000000b0050', '00000000-0000-0000-0000-0000000a0027', 'cpp', 'all four bugs fixed',
$c$#include <memory>

static constexpr double kPi = 3.14159265358979323846;

struct Shape
{
    static int alive;

    Shape() { alive++; }

    // FIX 1: deleting a Rect through a Shape* runs only ~Shape unless the base
    // destructor is virtual - the derived part is never destroyed. Harmless
    // while everything is a value; a live bug the moment the shapes are owned
    // by pointers, which is exactly what fixing the slicing below requires.
    virtual ~Shape() { alive--; }

    virtual double area() const { return 0.0; }

    // FIX 2: name() was not virtual, so a call through Shape& always ran this
    // one no matter what the object really was.
    virtual string name() const { return "shape"; }
};

int Shape::alive = 0;

struct Rect : Shape
{
    static int alive;

    double w = 0.0;
    double h = 0.0;

    Rect(double w, double h) : w(w), h(h) { alive++; }
    ~Rect() override { alive--; }

    // FIX 3: the base declares "double area() const". Without the const this
    // is a different signature, so it overrode nothing and merely hid the base
    // version for callers that already knew they had a Rect. Writing
    // "override" is what turns that silence into a compile error.
    double area() const override { return w * h; }

    string name() const override { return "rect"; }
};

int Rect::alive = 0;

struct Circle : Shape
{
    static int alive;

    double r = 0.0;

    explicit Circle(double r) : r(r) { alive++; }
    ~Circle() override { alive--; }

    double area() const override { return kPi * r * r; }
    string name() const override { return "circle"; }
};

int Circle::alive = 0;

struct Summary
{
    double totalArea = 0.0;
    string names;
    int leaked = 0;
};

Summary describe()
{
    Summary out;
    {
        // FIX 4: a vector<Shape> stores Shapes. Pushing a Rect into it copies
        // the Shape part and throws the rest away - "slicing" - so what comes
        // back out is a plain Shape with area 0 and the name "shape". Storing
        // owning pointers keeps the real objects.
        vector<unique_ptr<Shape>> shapes;
        shapes.push_back(make_unique<Rect>(2.0, 3.0));
        shapes.push_back(make_unique<Circle>(1.0));

        for (const auto& s : shapes)
        {
            out.totalArea += s->area();
            if (!out.names.empty())
            {
                out.names += ",";
            }
            out.names += s->name();
        }
    }
    out.leaked = Rect::alive + Circle::alive;
    return out;
}
$c$),

('00000000-0000-0000-0000-0000000b0051', '00000000-0000-0000-0000-0000000a0028', 'cpp', 'all four bugs fixed',
$c$struct Report
{
    int processed = 0;
    int total = 0;
    string summary;
};

Report runBatch(const vector<int>& jobs)
{
    // FIX 1 and 2: "static" gives these one instance for the whole program,
    // not one per call, so every later call kept counting and kept appending
    // where the previous one left off. The first call looked fine, which is
    // what made it invisible.
    Report r;

    for (int j : jobs)
    {
        r.processed++;
        r.total += j;

        // FIX 3: appending a separator after every element leaves a trailing
        // one. Put it before every element except the first instead.
        if (!r.summary.empty())
        {
            r.summary += ",";
        }
        r.summary += to_string(j);
    }

    // FIX 4: the old "Report{ total, processed, summary }" filled the struct
    // positionally, and the struct declares processed first - so the two
    // numbers arrived swapped. Nothing about the types could catch it.
    return r;
}
$c$)
ON CONFLICT (id) DO NOTHING;

-- --------------------------------------------------------------------------
-- Test code
-- --------------------------------------------------------------------------
INSERT INTO problem_test_code (problem_id, language, public_code, hidden_code) VALUES
('00000000-0000-0000-0000-0000000a0025', 'cpp',
$c$TEST(Analyse, KeepsTheOddValuesInOrder) {
    EXPECT_EQ(analyse({4, 2, 7, 7, -3, 6}).odds, (vector<int>{7, 7, -3}));
}

TEST(Analyse, CountsWhatItRemoved) {
    EXPECT_EQ(analyse({4, 2, 7, 7, -3, 6}).evensRemoved, 3);
}

TEST(Analyse, CountsDistinctOdds) {
    EXPECT_EQ(analyse({4, 2, 7, 7, -3, 6}).distinctOdds, 2);
}
$c$,
$c$TEST(Analyse, TwoEvensInARow) {
    EXPECT_EQ(analyse({2, 4, 6, 1}).odds, (vector<int>{1}));
}

TEST(Analyse, NegativeOddNumbersAreOdd) {
    const Stats s = analyse({-3, -5, -4});
    EXPECT_EQ(s.odds, (vector<int>{-3, -5}));
    EXPECT_EQ(s.evensRemoved, 1);
}

TEST(Analyse, DuplicatesAreNotAdjacent) {
    EXPECT_EQ(analyse({7, 1, 7, 1, 9}).distinctOdds, 3);
}

TEST(Analyse, EverythingIsEven) {
    const Stats s = analyse({2, 4, 6});
    EXPECT_TRUE(s.odds.empty());
    EXPECT_EQ(s.evensRemoved, 3);
    EXPECT_EQ(s.distinctOdds, 0);
}

TEST(Analyse, EmptyInput) {
    const Stats s = analyse({});
    EXPECT_TRUE(s.odds.empty());
    EXPECT_EQ(s.evensRemoved, 0);
    EXPECT_EQ(s.distinctOdds, 0);
}
$c$),

('00000000-0000-0000-0000-0000000a0026', 'cpp',
$c$TEST(CheckOut, AverageIsNotAnInteger) {
    EXPECT_NEAR(checkOut({1.5, 2.25, 3.25}).average, 7.0 / 3.0, 1e-9);
}

TEST(CheckOut, RefundRoundsAwayFromZero) {
    const Receipt r = checkOut({-2.5});
    EXPECT_EQ(r.roundedTotal, -3);
    EXPECT_NEAR(r.average, -2.5, 1e-9);
}

TEST(CheckOut, ManySmallPricesStayExact) {
    const vector<double> tenth(10, 0.1);
    const Receipt r = checkOut(tenth);
    EXPECT_NEAR(r.average, 0.1, 1e-9);
    EXPECT_EQ(r.roundedTotal, 1);
    EXPECT_TRUE(r.sumsToWhole);
}
$c$,
$c$TEST(CheckOut, CheapestPrice) {
    EXPECT_EQ(checkOut({4.0, 1.25, 9.5}).cheapest, 1);
}

TEST(CheckOut, TotalRounds) {
    EXPECT_EQ(checkOut({1.5, 2.25, 3.25}).roundedTotal, 7);
}

TEST(CheckOut, WholeTotalIsRecognised) {
    EXPECT_TRUE(checkOut({1.5, 2.25, 3.25}).sumsToWhole);
}

TEST(CheckOut, NegativeAverage) {
    EXPECT_NEAR(checkOut({-4.0, -1.0}).average, -2.5, 1e-9);
}

TEST(CheckOut, FractionalTotalIsNotWhole) {
    EXPECT_FALSE(checkOut({1.25, 2.0}).sumsToWhole);
}
$c$),

('00000000-0000-0000-0000-0000000a0027', 'cpp',
$c$TEST(Shapes, AreaThroughABaseReference) {
    Rect r(2.0, 3.0);
    const Shape& s = r;
    EXPECT_NEAR(s.area(), 6.0, 1e-9);
}

TEST(Shapes, NameThroughABaseReference) {
    Circle c(1.0);
    const Shape& s = c;
    EXPECT_EQ(s.name(), "circle");
}

TEST(Shapes, DescribeAddsUpEveryArea) {
    EXPECT_NEAR(describe().totalArea, 6.0 + kPi, 1e-9);
}
$c$,
$c$TEST(Shapes, DescribeNamesEveryShape) {
    EXPECT_EQ(describe().names, "rect,circle");
}

TEST(Shapes, NothingIsLeaked) {
    EXPECT_EQ(describe().leaked, 0);
}

TEST(Shapes, RepeatedCallsAgree) {
    const Summary first = describe();
    const Summary second = describe();
    EXPECT_EQ(first.names, second.names);
    EXPECT_EQ(first.leaked, second.leaked);
    EXPECT_NEAR(first.totalArea, second.totalArea, 1e-12);
}

TEST(Shapes, RectAreaDirectly) {
    Rect r(2.5, 4.0);
    EXPECT_NEAR(r.area(), 10.0, 1e-9);
    EXPECT_EQ(r.name(), "rect");
}
$c$),

('00000000-0000-0000-0000-0000000a0028', 'cpp',
$c$TEST(RunBatch, CountsAndSums) {
    const Report r = runBatch({1, 2, 3});
    EXPECT_EQ(r.processed, 3);
    EXPECT_EQ(r.total, 6);
}

TEST(RunBatch, JoinsWithoutATrailingComma) {
    EXPECT_EQ(runBatch({1, 2, 3}).summary, "1,2,3");
}
$c$,
$c$TEST(RunBatch, TheSameCallTwice) {
    const Report first = runBatch({1, 2, 3});
    const Report second = runBatch({1, 2, 3});
    EXPECT_EQ(first.processed, second.processed);
    EXPECT_EQ(first.total, second.total);
    EXPECT_EQ(first.summary, second.summary);
}

TEST(RunBatch, NoJobs) {
    const Report r = runBatch({});
    EXPECT_EQ(r.processed, 0);
    EXPECT_EQ(r.total, 0);
    EXPECT_EQ(r.summary, "");
}

TEST(RunBatch, SingleJob) {
    const Report r = runBatch({42});
    EXPECT_EQ(r.processed, 1);
    EXPECT_EQ(r.total, 42);
    EXPECT_EQ(r.summary, "42");
}

TEST(RunBatch, DifferentBatchesDoNotBleedIntoEachOther) {
    runBatch({5, 5, 5});
    const Report r = runBatch({7});
    EXPECT_EQ(r.processed, 1);
    EXPECT_EQ(r.total, 7);
    EXPECT_EQ(r.summary, "7");
}
$c$)
ON CONFLICT (problem_id, language) DO NOTHING;

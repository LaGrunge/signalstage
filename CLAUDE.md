# CLAUDE.md

Guidance for Claude Code when working on SignalStage. Read `README.md` first
for user-facing docs (architecture, quick start, env vars). This file is for
picking the work back up: what's actually deployed, what's fragile, what's
still missing, and lessons already paid for once.

## What this project is

A self-hosted online-interview tool: Monaco + Yjs collaborative editor,
self-hosted Judge0 for real code execution (C++/Python/Go/Java/Bash/MariaDB),
a hand-rolled LSP bridge for real IDE features, code templates, and a
version-history panel. Four services: `frontend` (nginx + static React),
`api` (Express + Hocuspocus, one Node process, two ports), `lsp` (Node,
language-server bridge), and a separate `judge0/` docker-compose stack.

## Live deployment

Runs on a **dedicated, isolated EC2 instance** (not the machine you're
probably reading this from) — a separate VPC with no route to whatever other
infrastructure exists, no IAM role attached, SSH key-only. This was
deliberate: an earlier session ran this on a shared dev box and the user
asked for real isolation once it went from "toy" to "let people other than
me hit this."

- Repo checked out at `/opt/signalstage` on that box, plain `git clone` of
  this GitHub repo (`LaGrunge/signalstage`), same `main` branch.
- Redeploy pattern: commit + push from wherever you're working, then on the
  box, `git pull` and `docker compose up -d --build <service>` for whatever
  changed. Judge0 is a **separate** compose stack in `judge0/` — rebuild it
  independently (`cd judge0 && docker compose build ... && docker compose up
  -d ...`).
- **Gotcha, bit twice already**: nginx (the `frontend` container) caches the
  `api` container's Docker DNS resolution for its own process lifetime. If
  you rebuild/recreate `api` (or `lsp`) without touching `frontend`, nginx
  keeps proxying to the old container's now-dead IP and every `/api/*`
  request 502s even though `docker compose ps` shows everything "Up". Fix:
  `docker compose restart frontend` after recreating any container nginx
  proxies to. Do this reflexively, don't wait for the 502 to remind you.
- `.env`, `judge0/judge0.conf`, and now `frontend/.htpasswd` hold real
  secrets and are git-ignored — they exist only on the box's disk, not in
  this repo. `.env.example` and `judge0/judge0.conf.example` are the tracked
  templates; keep them in sync with whatever you actually change live, or
  the next fresh deploy silently regresses (this happened once — the
  rlimit/cgroup tuning below was live on the box but not reflected in
  `judge0.conf.example` for a while). `frontend/.htpasswd` has no example
  file (it's a password hash, not a template to fill in) — `docker compose
  up` for `frontend` will refuse to start without it since it's bind-mounted;
  see README "Security and production checklist" for how to generate one.
- nginx enforces an HTTP Basic Auth gate on the interviewer surface
  (`frontend/nginx.conf`) — page load, login/register, `/api/auth/*`,
  templates/problems APIs, bare `/api/rooms`. The candidate path is
  deliberately exempt via `auth_basic off;` blocks (`/room/<uuid>` page,
  `/assets/*`, room-scoped `/api/rooms/<id>...`, `/api/execute`,
  `/api/languages`, `/collab`, `/lsp`) so candidates need only their room
  link, never the Basic Auth password — the room UUID is the bearer secret
  and app-layer JWT/toggles guard everything else. Two nginx traps already
  hit while building this, don't reintroduce them: `try_files $uri
  /index.html` inside an exempt location internally redirects to
  `location /` where auth is back on (use `try_files /index.html =404;`);
  and without the exact-match `location = /api/rooms` block, the prefix
  location `/api/rooms/` makes nginx 301 bare `/api/rooms` to add the
  slash, which both skips Basic Auth and turns the dashboard's POST
  (create room) into a GET. `/lsp` is exempt with no app-layer auth of its
  own yet (accepted: isolated box; follow-up: `?room=<uuid>` validation in
  `lsp/bridge.js`). The gate also forced the app's own JWT off the
  `Authorization` header (both would otherwise collide on the same header)
  and onto a custom `X-SignalStage-Token` header — see `server/src/auth.js`
  and `frontend/src/lib/api.js`. Don't move it back onto `Authorization`
  while this gate exists.

## The Judge0 sandbox saga (read before touching `judge0/`)

This ate the most time in this project's history and is easy to accidentally
undo. Full narrative is in README's "Ubuntu 26.04 vs. Debian buster" section
— read it before changing anything under `judge0/`. Condensed version:

1. Upstream Judge0's image is Debian buster (EOL) with isolate 1.8.1, which
   can't drive cgroup v2 at all on this kind of host. `judge0/Dockerfile`
   rebuilds the whole image on Ubuntu 26.04 with a from-source isolate 2.6.
2. isolate 2.6 *can* do real cgroup v2 limits, but Judge0 v1.13.1's own Ruby
   (`isolate_job.rb`) unconditionally passes `--cg-timing`/`--no-cg-timing`,
   flags isolate 2.x deleted. The only config that avoids ever emitting
   either flag is `ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=true` +
   `..._MEMORY_LIMIT=true` together — which also disables `--cg` outright.
   **This deployment runs on rlimits, not real cgroups, on purpose.** If you
   see either of those two flags set to `false`/blank in `judge0.conf` or
   its `.example`, that's a regression, not a cleanup — it will silently
   break every language the next time the config gets reloaded, and the
   failure mode is cryptic (`isolate: unrecognized option '--cg-timing'`
   deep in a stdout blob, not an obvious startup error).
3. Language `compile_cmd`/`run_cmd` overrides live in `judge0/Dockerfile`,
   appended to Judge0's own `db/seeds.rb` at build time — **not** a one-shot
   SQL script. Judge0 reseeds `languages` from its hardcoded defaults on
   *every* container boot; a one-shot fixup (there used to be a
   `judge0/fixups.sql`, now deleted) gets silently wiped on the next
   restart, crash-recovery, or redeploy. If you ever apply a SQL fix
   directly via `psql` to unblock something urgently, **also** port it into
   the Dockerfile's seed-append block before you consider it done, or it
   will vanish on the next restart and you'll be debugging the same thing
   again from scratch.
4. Per-language landmines already found and fixed (don't rediscover these):
   Java's `/usr/bin/java(c)` are `/etc/alternatives` symlinks isolate can't
   resolve (use the real `/usr/lib/jvm/.../bin/...` path); Go's build cache
   needs `flock()`, blocked by isolate's default `syscall_flags` (trimmed in
   the Dockerfile); MariaDB's Unix socket must live on `/dev/shm` (tmpfs) —
   `bind()` on the overlayfs-backed box directory silently no-ops without
   creating the file, so `mariadbd` claims "ready for connections" against a
   socket that doesn't exist; MariaDB also needs a much bigger
   `max_file_size` (InnoDB's datadir alone is ~140MB) via
   `server/src/judge0.js`'s per-language `maxFileSize`.
5. `server/src/judge0.js`'s axios `timeout` (currently 35s) must stay above
   the longest per-language `wallTimeLimit` (MariaDB's 25s), or legitimately
   slow-but-successful runs get killed client-side before Judge0 replies.

6. **Per-run limits are per language, in `judge0.js`'s `LANGUAGES` /
   `TEST_LANGUAGES`, not in `judge0.conf`.** Judge0's own defaults are 1.5GB
   / 5s CPU / 10s wall; C++ asks for 3GB / 15s / 20s, everything else takes
   the defaults, and `judge0.conf`'s MAX_* ceilings (4GB / 30s / 30s) stay
   untouched. Since isolate runs on rlimits here, `memory_limit` is
   `RLIMIT_AS` — address space, not RSS — and ~60MB of it goes to the binary,
   libstdc++ and stack before `main()`: measured, a C++ program gets ~3008MB
   of touchable heap out of the 3072MB limit.

   The C++ numbers are sized around the shared "query" template and the
   reasoning is in a comment there — the short version is that the naive
   template is *meant* to be unrunnable (~8.5GB, ~4:50 unoptimised), while a
   correct solution that never materialises the join fits in ~1.7–2GB. If
   someone later "fixes" the template by shrinking its dataset, that was
   considered and deliberately declined.

**Before believing any change to this area actually works**, run
`tests/system-check.mjs` against the live URL — it does a real compile+run
and a real LSP `initialize` handshake per language, not just a health check.
A websocket upgrading successfully proves nothing about whether the language
server behind it actually started (also learned the hard way — see the LSP
section of README).

## Remote cursor/selection rendering (`CollabEditor.jsx`)

`y-monaco` only assigns bare decoration classNames
(`yRemoteSelection-<clientId>`, `yRemoteSelectionHead-<clientId>`) — it
renders no color, label, or highlight itself. All of that (colored caret,
name label, colored selection background) is generated client-side into a
`<style>` tag, rebuilt from Yjs awareness state on every change. Two things
already bit us here:

- Awareness `user.color`/`user.name` are attacker-controlled (any peer can
  set arbitrary JSON via devtools) and land directly in a CSS rule — colors
  are validated against `isSafeCssColor` (hex/rgb/hsl only) and names are
  escaped before use.
- The selection background used to add alpha by string-concatenating a hex
  suffix (`` `${color}55` ``), which only produces valid CSS when `color` is
  hex. Since our own client always sends `hsl(...)`, that concatenation
  produced an invalid color value, so the whole `background-color`
  declaration was silently dropped — cursors/labels rendered fine (a plain,
  valid color), but the selection highlight was invisible. Fixed by using
  `color-mix(in srgb, ${color} 33%, transparent)`, which is valid for any of
  the color formats `isSafeCssColor` allows. If you touch this again, don't
  reintroduce string-suffix alpha tricks on a color of unknown format.

## Line endings in the shared document (CollabEditor.jsx)

**`\r` must never enter `ydoc.getText("code")`.** Monaco keeps a single EOL
for the whole buffer and rewrites everything written into it to match, while
`y-monaco` maps model offsets 1:1 onto `Y.Text` indices (it feeds
`change.rangeOffset` straight into `ytext.delete/insert`). So the moment one
peer's buffer normalises to CRLF while the shared text holds bare LF, every
edit that peer makes lands one character too far right *per line above the
cursor*, and the drift grows with the file.

This wrecked the 2026-08-13 interview (room `ddcf9bfe`): the candidate pasted
a CRLF snippet, his buffer later flipped to CRLF, and his `struct Gamer` →
`class Gamer` edit landed four characters off as `struclasser`. **The failure
is invisible to the person causing it** - their own Monaco buffer stays
coherent, only everyone else watches the file turn to mush - so nobody in the
room can be expected to notice and reload. Three layers now guard it, keep
all three: EOL pinned to LF on mount, a `\r` scrub (on mount, on any peer
inserting one, and server-side in `onLoadDocument` so a document persisted
with `\r` heals), and a 5s watchdog comparing `model.getValue()` against
`ytext.toString()` that rebuilds the binding on any mismatch.

Verified end-to-end with two headless-Chromium peers against the live URL:
flip one peer's model to CRLF mid-session, keep typing, assert both documents
stay identical - plus a control run asserting the watchdog never fires during
normal two-way editing (a spurious resync yanks the cursor). Unit-level
checks of the scrub are not enough; the interesting half is Monaco's own
normalisation.

Forensics, if a session is ever suspected of diverging again: replay
`yjs_updates` for the room through Yjs and observe the per-update deltas
(`ytext.observe` while applying) - that gives every op's landing offset. A
victim's *own* view can be reconstructed by replaying the same ops at their
raw offsets into a separate string seeded with the CRLF-normalised text,
which is how the candidate's real code was recovered intact.

## Connection health (Room.jsx)

Born from a real interview where a flaky link left both sides silently
editing diverged local copies (Yjs is offline-first; a stalled-but-not-closed
websocket fires no event). Two coupled mechanisms, don't change one without
the other:

- `messageReconnectTimeout: 10000` on an explicitly-constructed
  `HocuspocusProviderWebsocket` — passing it to `HocuspocusProvider` directly
  is silently ignored (only `url`/`connect`/`parameters` are forwarded to the
  internal socket).
- A 4s awareness heartbeat (`setAwarenessField("heartbeat", …)`). The server
  echoes awareness updates back to their sender, so this guarantees incoming
  traffic more often than the 10s timeout even in an idle room. **Removing
  the heartbeat while keeping the 10s timeout makes every idle connection
  churn through close/reconnect** (awareness's own renewal is only every
  ~15s). The heartbeat also feeds the peer-staleness banner (13s threshold,
  vs. awareness's own 30s removal).

The connection-lost banner is gated on `everConnectedRef` so it doesn't flash
during the initial handshake.

## Interview problems and automated tests

Problems (`server/src/problems.js`, `server/migrations/008_problems.sql` +
`009_problems_v2.sql`) and their test-running pipeline
(`server/src/testRunner.js`, `server/src/testHarness/*.js`) are additive
alongside `templates` — a room references *either* `template_id` (quick,
free-form starter code, no tests) *or* `problem_id` (structured task:
description, per-language starters, reference solutions, real test code),
not both.

**Tests are real per-language test code the problem author writes**
(GoogleTest/unittest/JUnit/`go test`/bash asserts) — there is no JSON args/
expected/type system anymore (that was 008's v1 design; 009 replaced it
after the user explicitly asked for "tests as code, like GoogleTest").
`problem_test_code` stores exactly two blobs per problem+language
(`public_code`/`hidden_code`); "Run" submits candidate+public as one Judge0
call, "Submit" does that plus a *second*, independent candidate+hidden
call, merged client-side — not one combined run, specifically so a crash
partway through doesn't leave you guessing which of the merged tests
actually executed. See README's "Automated tests for problems" for the
full per-language harness contract and the sandbox lessons below — read
that (and its lessons) before touching anything under
`server/src/testHarness/` or `judge0/Dockerfile`'s language 91/92/93 seeds.

**Do not reintroduce these, they were each found by actually running
generated output through the real Judge0/isolate stack, not by
inspection:**
- New vendored files/directories for the sandbox (JUnit/hamcrest jars, the
  pre-warmed Go build cache) **must** live under `/usr/local/...`, never
  `/opt/...` - isolate's default sandbox directory rules don't expose
  `/opt` to the box at all, so a file that's right there on the host image
  is simply invisible from inside a submission ("package org.junit does
  not exist" despite the jar existing).
- `go test`'s Judge0 language entry (id 92) needs `GOCACHE` pointed at that
  pre-warmed, world-writable cache directory, or every single submission
  pays the cost of compiling a large chunk of the Go standard library's
  `testing`-adjacent dependency graph from scratch - slow enough to blow
  both the wall time limit and (before `-p 1`) the sandbox's open-file and
  per-process memory limits.
- Java's harness runs `@Test` methods via plain reflection, deliberately
  **not** `org.junit.runner.JUnitCore` - JUnit's own runner requires the
  test class to be `public`, but javac allows only one `public` top-level
  class per file and it must match the filename (fixed at `SigRunner.java`
  here), so a public author-written test class can never coexist with
  anything else in that file. The author's test class must be named
  exactly `SigTests` and left non-public.
- A Judge0 `NZEC`/"Runtime Error" status is *expected* whenever a real test
  actually fails, not a sign something's broken - `RUN_ALL_TESTS()`/`go
  test` both exit non-zero on failure by design. Never gate success/failure
  on Judge0's own status field, only on whether the harness's structured
  per-test output could be parsed.
- Go's per-test isolation is *not* like Python/Java/C++: a panicking Go
  test kills the whole process after logging the failure (deliberate
  re-panic in `testing.tRunner`), so anything after it in the same run
  simply never executes. `testRunner.js`'s "fewer results than expected →
  report the rest as errored" fallback already covers this.

**The bank ships populated** (`020`, `022`, `023`, `024`): a folder tree
(`algorithms/{arrays and hashing,strings,geometry,graphs,bits and bytes,binary
search,dynamic programming,intervals and sorting,stacks and queues}` and
`debug/{C++,Go,Java,Python,Bash}`) and 40 shared problems - 23 algorithmic
with C++ *and* Python starters/solutions/tests, and 17 debugging exercises,
each in one language only. See README's "What ships in the bank" for the list
and for which language subtlety each debugging problem is about. Every bug in
those is *defined* behaviour with one specific wrong answer: undefined
behaviour would be the more realistic exercise and the less reliable test, and
that trade was made deliberately. `023` also created the `debug/` parent and
moved 020's top-level `C++ debug` folder under it as `debug/C++`, guarded on
the folder still being where 020 put it. Two of 020's problems replace
shared *templates* that were being used as problems in practice ("Vertical
Symmetry"/"Symmetry Solution" and "C++ Bugs Hunt") - a template has no
description, no hidden tests and no Run/Submit pipeline, so anything meant to
be graded belongs in the bank. The old templates were left in place, not
deleted; they belong to the user, not to the instance.

**Migrations run once per database now** (`schema_migrations`, recorded by
`runMigrations` in `server/src/db.js`), not on every API boot as they did
through 020. The old behaviour could not express "stay deleted": editing a
seeded problem reinserts its reference solutions with fresh ids, so the next
restart re-ran the seed and added its fixed-id rows *alongside* them - the
shipped "Is Palindrome" had accumulated three identical copies of every
solution (cleaned up by `021_dedupe_seeded_solutions.sql`), and deleting a
seeded problem outright had it reappear. Consequences: existing files stay
idempotent but nothing rests on that any more, **a mistake in a released
migration needs a new file rather than an edit**, and editing a seed blob
never reaches an instance that already ran it - change the problem through
the UI.

Nothing in a seeded problem is trustworthy until it has actually been through
Judge0. `server/scripts/validate-problems.mjs` runs every reference solution
against its own public+hidden tests via the real pipeline (same work as `POST
/problems/:id/validate`, minus HTTP/auth, so it can run inside the api
container against a deployment). `--starters` is the other half and catches
what solution-validation structurally cannot: a starter that doesn't compile.
Both were run against the live box for all 23 seeded language variants before
this landed.

Only `mariadb` has no test harness at all - a single SQL statement doesn't
fit any "author writes real test code" story. Problems also carry a 1–5 star
difficulty and a per-interviewer like toggle - ordinary CRUD, nothing
sandbox-related.

**Folders are a nested tree keyed by a materialized path** (`algorithms/
graphs`, migration `013_folder_paths.sql`), not the flat titles 009 shipped:
that is the shape the planned Git-repo backing wants, since each segment is
a directory, import/export is a straight mapping, and a rename/move is one
prefix rewrite over the subtree (`PATCH /problems/folders/:id`). Ancestors
always exist as their own rows (`mkdir -p`) so the tree never has to invent a
folder that only exists as someone else's prefix. Deleting still refuses a
non-empty folder (now counting subfolders too), and renaming is open to any
interviewer while deletion stays owner-only - same split as shared problems.

Two things about the `react-arborist` tree in `ProblemTree.jsx` that were
found by running it, not by reading it:

- **The node renderer must be a stable component reference.** Passing
  `{(props) => <TreeNode {...props} cb={cb} />}` to `<Tree>` creates a new
  component *type* every render, so React unmounts and remounts every row -
  which silently breaks anything spanning two events on one element
  (double-click to open a problem stopped working). Callbacks reach the
  renderer through a context instead.
- **Expansion state is owned by the page, not the tree.** Opening a problem
  unmounts the tree (the editor takes the pane), and arborist's internal open
  state goes with it - so the tree collapsed to the root every time you came
  back from editing. The page holds the open map and feeds it back as
  `initialOpenState`.

## Known gaps / not done

- **Automated tests: no mariadb harness.** Tests are real per-language test
  code (see "Interview problems and automated tests" above); mariadb has no
  harness at all since a single SQL statement doesn't fit that model.
- **No markdown rendering for problem descriptions.** `Room.jsx`'s Task
  panel renders `problem.description` as plain preformatted text
  (`white-space: pre-wrap`), not parsed markdown - no `react-markdown` (or
  equivalent) dependency has been added yet. Fine for plain-text task
  descriptions; add the dependency if descriptions start using real
  markdown syntax that needs to render, not just line breaks.
- **No LSP for MariaDB.** `sql-language-server` (the only maintained generic
  SQL LSP on npm) crashes on startup on every currently-installable version
  — a real bug in that package, not this codebase. Monaco still gets SQL
  syntax highlighting, just no diagnostics/completion for that language.
  Revisit if the package gets fixed, or find a different SQL LSP.
- ~~No TLS~~ **Done (2026-07-30):** Let's Encrypt cert for
  `signalstage.duckdns.org` (a free DuckDNS subdomain on the user's
  account, A-record → 63.182.202.51). nginx serves 443 only; port 80 is
  ACME webroot + a 301 to the canonical domain (deliberately not `$host` —
  old plain-IP links redirect onto the name the cert is valid for). The
  `certbot` compose service renews via the shared webroot volume; the
  frontend's wrapper `command` reloads nginx every 6h to pick renewals up.
  First-time issuance on a fresh box is a manual one-shot (README "TLS") —
  nginx won't start while the cert files are missing, so the renew-only
  loop can't bootstrap. The EC2 hostname was tried first and is
  policy-blocked by Let's Encrypt (`*.compute.amazonaws.com` is
  unissuable); bare-IP certs were an option (GA since 2026-01) but the
  user picked the domain. The `execCommand` clipboard fallback in
  `frontend/src/lib/api.js` is still there — keep it until every entry
  point is confirmed HTTPS-only.
- **LSP browser-level UX not human-verified.** Protocol-level tests pass
  (real `initialize`, real `didOpen`→`publishDiagnostics`), but nobody has
  actually opened a room and eyeballed a red squiggle or a completion
  dropdown. Do this once before an interview depends on it.
- **Yjs persistence is still debounced.** `rooms.ydoc_state` (binary Yjs
  state, what document reloads restore) and `rooms.last_code` (text, for
  dashboard previews and as the pre-012 fallback) both catch up on
  Hocuspocus's own debounce timer; there's a small window of very recent
  edits that could be lost on an ungraceful crash. Fine for this product's
  actual use case (a live interview session), not a general-purpose
  durability guarantee. The playback recording (`yjs_updates`, 3s in-memory
  buffer in `collabServer.js`) accepts the same window on purpose.
- **Playback storage is never reclaimed.** `yjs_updates` grows ~1-2 MB per
  heavy interview hour and "Delete" is a soft delete (`active=false`), so
  nothing ever prunes the update log. A real cleanup (hard delete or a
  retention sweep) is future work.

## Admins, accounts and instance settings

Two admin-only tabs sit next to Sessions and Problem bank: **Settings**
(migration `018_app_settings.sql`) and **Users** (`017_admin.sql`,
`server/src/users.js`). Non-admins see neither the tab nor the endpoints -
the API refuses them independently, the hidden tab is not the boundary.

- **Admin means "owner of everything"**: sessions, templates, problems and
  folders all changed from `created_by = $me` to `(created_by = $me OR
  $isAdmin)` in the queries themselves, so one handler serves both cases.
- `req.user.isAdmin` is loaded from the database inside `requireAuth`, not
  carried in the JWT - tokens live 12h and an admin flag that only applies
  after the next login is exactly the thing nobody remembers. `GET /auth/me`
  exists so the navigation can refresh the stored session object the same way.
- **The last admin cannot be demoted or deleted** (server-side): losing it
  makes accounts and settings unreachable with no route back except psql.
- The first account to register on a fresh install becomes the admin; this
  deployment names `aa@aa` in 017 because its earliest row is a smoke-test
  account.
- Settings is instance policy, one row (`app_settings`, `id = 1` enforced by
  a check constraint): how new sessions start (candidate run allowed,
  copy/paste blocked). `POST /rooms` reads it; both switches stay changeable
  inside a running session.

## Routes must not be able to kill the process

Express 4 does not catch a rejected promise coming out of an async handler:
it escapes as an unhandled rejection and **exits the process**. That process
also runs Hocuspocus, so one unexpected query error drops every live
interview, not just the request that hit it. Build routers with
`asyncRouter()` (`server/src/asyncRouter.js`), never bare `Router()`; the
error middleware at the end of `index.js` turns what it forwards into a 500.

This was not theoretical: `PATCH /problems/folders/:id` passed the substring
offset for its subtree prefix rewrite as an untyped parameter, so Postgres
resolved `substring(text FROM $3)` to the **regular expression** form instead
of the offset one, the pattern `"11"` matched nothing, and the NULL that came
back violated `problem_folders.path`'s NOT NULL. The user-visible symptom was
"renaming a folder does nothing" - the API had died, so there was no error to
show. Two lessons, both now encoded: cast integer parameters that feed
`substring` (`$3::int`), and never let a handler's rejection reach the top.

## Languages

`frontend/src/lib/languages.js` owns the order, the display names and
`DEFAULT_LANGUAGE` for everywhere the UI names a language itself; the room's
and dashboard's `<select>`s take their labels from `GET /languages` instead,
which carries the toolchain version. **C++ is first and is the default**
everywhere - new sessions, new problems, the problem bank's tab strips.

Two behaviours that are easy to break:

- **The dashboard's title and language fields feed every way of starting a
  session**, not just "Create blank session" - a template brings its own
  language, but a problem's session takes both. Starting a liked problem in a
  language it has no starter for is allowed (empty editor) but asks first,
  which is why `GET /problems` returns `starterLanguages`.
- **Switching a session's language switches the starter code with it**
  (`changeLanguage` in `Room.jsx`), because leaving one language's skeleton
  behind while the toolbar claims another is how you compile C++ with a Python
  toolchain. The editor is the shared document, so it replaces silently only
  while the buffer still *is* the current language's starter (or is empty),
  and asks first once anything has been typed; declining leaves the language
  alone too. `insertTemplate` deliberately calls `setSessionLanguage` rather
  than `changeLanguage` - it just replaced the code on purpose and must not
  have the attached problem's starter undo that.

The authoring form edits one language tab at a time by *updating* that
language's entry, so `withEveryLanguage` pads a loaded problem out to all five
testable languages - otherwise typing into a language the problem doesn't have
yet silently does nothing, and a C++-only problem can never gain a Python
starter. `saveDraft` strips the still-empty ones back out, so a C++-only
problem stays C++-only.

## Copy/paste blocking is best effort, on purpose

`rooms.copy_paste_blocked` (migration `016`) mirrors through the same Yjs
config map as `run_enabled`, so toggling it lands live and applies to anyone
joining later. Enforcement is a capture-phase `copy`/`cut`/`paste`/drag
listener on `document` in `Room.jsx`, candidate-side only, plus the Save
button and its Ctrl+S binding - downloading the file is copying the code by
another name, and Ctrl+S has to stay `preventDefault`ed even when refused or
the browser's own "Save page" dialog does the job instead. The notice is
transient, shown only in reaction to an attempt: a permanent banner is one
more thing for a nervous candidate to read past. That means a
second window, devtools or a phone camera all still work - it raises the cost
of pasting in a prepared solution, it does not make it impossible, and the
banner tells the candidate rather than swallowing the keystroke silently.
Don't "harden" this into something it can't be.

## Who can see which session

The dashboard's Sessions tab has a checkbox, on by default: **only sessions I
took part in** - the ones I created plus the ones I actually opened. Off, it
lists every interviewer's sessions.

"Took part in" is `room_participants` (migration `014_room_participants.sql`),
written from the authenticated `GET /rooms/:id` - the one request every
interviewer joining a room makes. It deliberately does *not* reuse
`room_events.actor`: that is a free-text display name the candidate types
themselves, so it identifies nobody. 014 does backfill old rooms by matching
`room_events.actor` to `users.name`, as a one-time convenience only.

Access, once other people's rooms can appear in the list:

- **Read is open to any signed-in interviewer** - the room, its submissions,
  and its playback. The list itself already ships a 400-char code preview of
  every room it returns, so withholding the replay would protect nothing while
  leaving visible cards whose panels 404.
- **Write stays with the room's owner**: end, rename, delete. Seeing someone
  else's session is not the same as being able to close it out from under
  them. The frontend hides those actions on other people's cards and the API
  refuses them independently (404), so the UI is not the security boundary.

If the set of interviewers ever stops being small and trusted, the read side
is the part to revisit - narrowing playback to participants is a one-line
`EXISTS` in `rooms.js`.

## Session playback (recording + replay)

Added after the first interview deployment; know these invariants before
touching `collabServer.js`, `011_playback.sql`, or `Playback.jsx`:

- **Keyframe rows are load-bearing for replay correctness, not an
  optimization.** Client Yjs updates causally depend on the server-side
  restore/seed done inside `onLoadDocument` - which `onChange` never sees -
  so every document (re)load records a `Y.encodeStateAsUpdate` snapshot
  flagged `is_keyframe`, and replay (server has no replay path;
  `Playback.jsx` + the verification scripts do) must reset to a fresh
  `Y.Doc` at every keyframe row. Since 012, reloads restore
  `rooms.ydoc_state`, so the history is usually *continuous* across
  segments - but keep the reset-at-keyframe contract: pre-012 recordings
  contain fresh-history segments (that's where "two segments' updates into
  one Y.Doc duplicates the text" was found empirically), and the text-seed
  fallback for never-stored rooms still creates one. A log without
  keyframes replays to an *empty* document (Yjs silently parks updates
  whose dependencies are missing).
- **`yjs_updates` ordering rides on BIGSERIAL**, and flushes are chained
  per-room (`flushChains` in `collabServer.js`) precisely so overlapping
  batch INSERTs can't interleave id assignment. Don't parallelize them.
- **Archiving is a third state, on top of the two below.** `archived_at`
  moves a finished session to its own dashboard tab: it keeps playback, drops
  out of the main list, can no longer be renamed (`PATCH /rooms/:id` refuses),
  and only an admin may delete it - an interviewer archives the record of an
  interview they ran, they don't get to erase it. Archiving also stamps
  `ended_at` if the room was only *derived* as ended (idle >12h), so an
  archived session can't come back to life when someone opens the link.
  Unarchiving returns it to the main list without reopening it.
- **Session end is two distinct states.** `ended_at` (POST `/rooms/:id/end`)
  locks the room (onAuthenticate rejects, live connections kicked via
  `closeConnections`, `getRoomAccess` blocks run/tests) but keeps it on the
  dashboard for playback; `active=false` (DELETE) hides it forever. The
  dashboard's "ended" state is `ended_at` OR a read-time derivation (idle
  >12h and 0 participants) that stamps nothing - joining an idle room
  revives it, deliberately.
- **`/playback/:id` must stay outside `/room/`** in both react-router and
  nginx terms: `location /room/` is Basic-Auth-exempt for candidates, so a
  playback path under it would leak the replay UI shell to anyone with a
  room link (the API itself would still 401, but don't rely on one layer).

## Working conventions specific to this project

- **Commits**: no Co-Authored-By / Claude-Session footers, ever — the user
  explicitly asked for a clean history matching their other projects. Git
  identity is configured locally in this repo (`LaGrunge <leontodys@gmail.com>`,
  pushed via a dedicated SSH host alias) — don't touch global git config.
- **Deploying**: prefer `git commit` + `push` + `git pull` on the box over
  ad-hoc `scp`. Mid-incident firefighting in this project's history did use
  direct `scp` a few times to iterate faster than a commit/push/pull cycle
  — if you do that, reconcile it back into a real commit before moving on,
  and diff the box's working tree against `origin/main` first so you don't
  clobber or lose whatever's live there.
- **A local vite dev/preview server is not a faithful stand-in for the
  collab websocket.** Its `/collab` proxy drops Yjs traffic to a client that
  reconnects, so after a page reload that tab silently stops receiving
  updates - live edits, config toggles, everything. The nginx deployment
  handles the same reload fine (checked with two candidate tabs against the
  live URL). Don't chase that as a product bug, and don't write local tests
  whose assertions depend on a reload.
- **Verify on the real thing.** This project's history is full of fixes that
  looked right in isolation (a config value, a flag, a code path) but only
  actually got confirmed by hitting the live `/api/execute` and `/lsp/*`
  endpoints end to end. Curl-level or docker-level checks that "the process
  is up" are not equivalent to "the feature works" for anything touching
  Judge0 or LSP — both have failure modes where the process looks healthy
  and just silently doesn't do the thing.
- If multiple agents/sessions might be touching this repo's working
  directory concurrently (forked sub-agents inheriting the same filesystem,
  not isolated worktrees), check `git status`/`git diff` before staging
  broadly — `git add -A` has swept up another in-flight agent's uncommitted
  work here before. Stage specific paths when in doubt.

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
- nginx enforces a site-wide HTTP Basic Auth gate (`frontend/nginx.conf`),
  which forced the app's own JWT off the `Authorization` header (both would
  otherwise collide on the same header) and onto a custom
  `X-SignalStage-Token` header — see `server/src/auth.js` and
  `frontend/src/lib/api.js`. Don't move it back onto `Authorization` while
  this gate exists.

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

Only `mariadb` has no test harness at all - a single SQL statement doesn't
fit any "author writes real test code" story. Problems also have a flat
folder structure (create/delete-if-empty, no nesting), a 1–5 star
difficulty, and a per-interviewer like toggle - ordinary CRUD, nothing
sandbox-related.

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
- **No TLS.** The live deployment is plain HTTP behind the isolated VPC.
  Put Caddy/Traefik/certbot in front of nginx once there's a domain.
  `navigator.clipboard`-based copy-link already has an `execCommand`
  fallback for this reason (see `frontend/src/lib/api.js`) — don't remove it
  when TLS eventually lands unless you're sure every client is HTTPS.
- **LSP browser-level UX not human-verified.** Protocol-level tests pass
  (real `initialize`, real `didOpen`→`publishDiagnostics`), but nobody has
  actually opened a room and eyeballed a red squiggle or a completion
  dropdown. Do this once before an interview depends on it.
- **Yjs persistence is a debounced snapshot, not a real persistence
  extension.** `rooms.last_code` catches up on Hocuspocus's own debounce
  timer; there's a small window of very recent edits that could be lost on
  an ungraceful crash. Fine for this product's actual use case (a live
  interview session), not a general-purpose durability guarantee.

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

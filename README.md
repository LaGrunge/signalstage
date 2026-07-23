# SignalStage

Self-hosted online interview platform: a collaborative code editor (Monaco +
Yjs) with real code execution (C++, Python, Go, Java, Bash, MariaDB) via a
self-hosted Judge0, plus real IDE features (diagnostics, completion, hover)
through a small custom LSP bridge.

## Architecture

```
browser
  │
  ▼
frontend (nginx, static React build)
  ├── /api/*   → api (Express, :4000)      — auth, rooms, templates, /execute proxy
  ├── /collab  → api (Hocuspocus, :1234)    — Yjs websocket sync
  └── /lsp/*   → lsp (:3001)                — LSP websocket bridge
                       │
                       ▼
                 postgres (users, rooms, templates, submissions)
                       │
        api ── signalstage_net ──► judge0-server (:2358) ──► judge0 workers
                                          │
                                    redis + postgres (Judge0's own, separate)
```

- An interviewer logs in (email/password), creates a session, and gets a
  `/room/<uuid>` link — the link itself is the room's access secret (the same
  pattern most self-hosted "join by link" interview tools use). A candidate
  opens the link with no account, picks a display name, and lands in the same
  document.
- Collaborative editing is a Yjs CRDT document per room, synced via
  Hocuspocus. The live document lives in the `api` process's memory; its text
  is also snapshotted to Postgres on Hocuspocus's own debounce (`rooms.last_code`)
  so dashboard previews and freshly-reconnecting clients survive a container
  restart, not just an active connection.
- Code execution is a separate self-hosted Judge0 stack (`judge0/`), rebuilt
  on Ubuntu 26.04 rather than upstream's Debian-buster image — see "Ubuntu
  26.04 vs. Debian buster" below for why, and for the several sandbox-specific
  fixes each language needed. `api` calls its REST API synchronously
  (`wait=true`) and returns stdout/stderr/compile_output; every attempt is
  also persisted to `submissions` so interviewers can review a candidate's
  history of tries, not just the latest run.
- Editor IDE features (diagnostics, completion, hover) are a separate `lsp/`
  service — see the "LSP" section below.
- Interviewers can save named, per-language code templates and either start a
  new session from one (dashboard) or insert one into a live session (side
  panel) without losing existing candidate code unless confirmed.
- An interviewer can disable/re-enable the Run button for candidates
  mid-session, and sees a live "candidate is running code" indicator driven
  by Yjs awareness — both synced instantly to every participant, no polling.

## Quick start

```bash
cp .env.example .env         # fill in real secrets
vim .env

# 1. Bring up the main stack (creates the signalstage_net network)
docker compose up -d --build

# 2. Bring up Judge0 (shares the same signalstage_net network)
cd judge0
cp judge0.conf.example judge0.conf
vim judge0.conf              # MUST change the passwords and AUTHN_TOKEN -
                              # AUTHN_TOKEN must match JUDGE0_AUTH_TOKEN in ../.env
                              # (judge0.conf holds real secrets - it's git-ignored)
docker compose up -d
cd ..
```

Open `http://<host>:${HTTP_PORT:-80}`, register an interviewer, create a
session, and send the candidate the link. Language versions and every
sandbox-specific fix behind them (step by step, with the *why*) are in
"Ubuntu 26.04 vs. Debian buster" below. To actually verify everything works
end to end (compile + run + LSP for every language) against a live
deployment, see "Tests".

## Ubuntu 26.04 vs. Debian buster

`judge0/Dockerfile` rebuilds the entire Judge0 image on Ubuntu 26.04 instead
of upstream's `judge0/compilers` base (Debian 10 buster, unsupported since
2019) — so GCC/Python/Go/OpenJDK/Bash/MariaDB come from plain apt packages
current as of build time, instead of being hand-built for whatever was
current in 2019–2021. Ruby 2.7 (the version Judge0 v1.13.1 itself is written
for) and OpenSSL 1.1.1 (which that Ruby needs) are still built from source —
upstream Judge0 was never ported to Ruby 3.x, and patching Judge0's own
application code to run on a modern Ruby was judged riskier than building the
right toolchain for it once (see the project history/commits for the
reasoning if you want the details).

This image also installs **isolate 2.6** (vs. 1.8.1 in the upstream image) —
the only version that understands cgroup v2 at all. That said, this specific
deployment **deliberately does not use** `isolate --cg` (real cgroup limits)
and stays on rlimit-based sandboxing instead — not because isolate can't do
better, but because Judge0 v1.13.1's own `isolate_job.rb` (written for
isolate 1.x) unconditionally passes `--cg-timing`/`--no-cg-timing`, flags
isolate 2.x removed from its CLI outright. The whole invocation fails with
`unrecognized option '--cg-timing'` under every config combination except
one: both `ENABLE_PER_PROCESS_AND_THREAD_*` flags set to true, which disables
`--cg` entirely so neither removed flag is ever emitted. Patching
`isolate_job.rb` directly would be the "real" fix, but was judged not worth
the risk against an already-stable prod stack; if you want to go that route,
look for `isolate_job.rb`'s three occurrences of the `--cg-timing` ternary.

That decision drives the rest of `judge0/judge0.conf` (template in
`judge0.conf.example`):

- `ENABLE_PER_PROCESS_AND_THREAD_TIME_LIMIT=true` and `..._MEMORY_LIMIT=true`
  — the mandatory combination that avoids the incompatible flag (see above).
- `MEMORY_LIMIT=1572864` (1.5GB) — without cgroups this is a per-process
  virtual-address-space limit (RLIMIT_AS), not RSS: JVM/Go both reserve
  hundreds of MB of virtual memory for their own runtime before touching any
  real user code.
- `MAX_PROCESSES_AND_OR_THREADS=200` — JVM's GC/JIT thread pools and Go's
  GOMAXPROCS worker pool both size themselves off the host's visible core
  count.
- `MAX_FILE_SIZE=20480` — the 1MB default is too small for Go's build cache.
- `worker` in `judge0/docker-compose.yml` is pinned to a subset of cores via
  `cpuset` (see the comment in that file) - otherwise the JVM sizes its
  default GC/JIT thread pools off every core the host has.
- isolate's `syscall_flags` in `judge0/Dockerfile` is trimmed (65535 → 27,
  dropping only the "i-node operations" bit), otherwise `go build` fails with
  `failed to trim cache: ... function not implemented` — Go's build-cache
  trimming needs `flock()`, which is blocked by default.

Per-language `compile_cmd`/`run_cmd` overrides are no longer applied via a
one-shot SQL script — `judge0/Dockerfile` appends them straight into Judge0's
own `db/seeds.rb` at image build time (see the comment there), because Judge0
reseeds the entire `languages` table from its hardcoded defaults on **every
boot**, not just once — a one-shot fixup silently got wiped on every restart.
A few language-specific gotchas found the hard way:

- **Java**: `/usr/bin/java`/`/usr/bin/javac` are symlinks through
  `/etc/alternatives` to `/usr/lib/jvm/java-25-openjdk-amd64/bin/...` -
  isolate can't resolve that symlink chain from inside the sandbox
  (`execve: No such file or directory`), so `compile_cmd`/`run_cmd` point at
  the real path directly. Both `javac` and `java` also get explicit JVM flags
  (`-Xmx`, `-XX:MaxMetaspaceSize`, `-XX:CompressedClassSpaceSize`, ...) -
  without them, default ergonomics reserve more virtual memory than
  RLIMIT_AS allows.
- **MariaDB** (id 90 — upstream has no language for it; id 82 is SQLite, a
  single-file embedded db): spins up a disposable `mariadbd` inside the
  sandbox on a Unix socket. That socket must live under `/dev/shm` (tmpfs),
  not the box's own working directory - `bind()` for an AF_UNIX socket
  silently "succeeds" on overlayfs (which backs the container's root)
  without ever creating the file, so `mariadbd` logs "ready for connections"
  against a socket that never actually exists. `/dev/shm` is shared across
  every box on the host (unlike each box's own working directory), hence the
  random suffix in the socket filename and the mandatory `rm -f` at the end.
  This language also needs a much higher `max_file_size`
  (`server/src/judge0.js`'s `maxFileSize: 256000`) - a fresh, empty InnoDB
  datadir is already ~140MB.
- Our own `judge0` API client timeout in `server/src/judge0.js` (35s) must
  stay above the longest per-language `wallTimeLimit` (MariaDB's 25s) -
  otherwise our own HTTP client aborts a legitimately slow (but successful)
  run before Judge0 ever gets to respond.

**No LSP for MariaDB**: `sql-language-server` (the only maintained
generic-SQL LSP on npm) crashes on startup on every currently-installable
version (`ERR_PACKAGE_PATH_NOT_EXPORTED` - a real dependency conflict inside
the package itself, not an environment issue here). The editor still gets
Monaco's built-in SQL syntax highlighting, just no diagnostics/completion.
See the comment in `lsp/bridge.js`.

If you ever move this stack to a cgroup v1/hybrid host, or if upstream Judge0
gets ported to a modern Ruby, this whole section becomes moot - the
workarounds described are specific to this exact combination (Judge0 v1.13.1
+ isolate 2.x + cgroup v2 + overlayfs).

## Tests

`tests/system-check.mjs` is an end-to-end check against a live deployment:
for every language `GET /api/languages` reports, it verifies (1) the
language is actually listed, (2) a real compile+run through `/api/execute`
produces the expected output, and (3) the LSP bridge completes a real
`initialize` handshake - not just a websocket upgrade, which proves nothing
about whether the underlying language server actually started (a lesson
learned the hard way while building this).

```bash
cd tests
npm install
SIGNALSTAGE_URL=http://<host> npm test
```

MariaDB is intentionally skipped in the LSP step (see "Ubuntu 26.04 vs.
Debian buster" above) — that's expected, not a test bug.

## Local development without Docker

```bash
# the judge/execution backend still needs to run as its own stack, once
cd judge0 && docker compose up -d && cd ..

# a minimal postgres just for the main app
docker run -d --name signalstage-pg -p 5432:5432 \
  -e POSTGRES_DB=signalstage -e POSTGRES_USER=signalstage \
  -e POSTGRES_PASSWORD=devpassword postgres:16.2

cd server
cp .env.example .env  # or export the variables by hand
npm install
npm start

cd ../frontend
npm install
npm run dev            # http://localhost:5173, proxies /api and /collab to :4000/:1234
```

## Environment variables (root `.env`)

| Variable | Purpose |
|---|---|
| `POSTGRES_PASSWORD` | password for the app's own DB (users/rooms/templates) |
| `JWT_SECRET` | secret used to sign interviewer JWTs |
| `JUDGE0_AUTH_TOKEN` | token for the Judge0 API; must match `AUTHN_TOKEN` in `judge0/judge0.conf` |
| `HTTP_PORT` | host port nginx (the frontend) is published on |

## Adding / changing languages

The list of languages and their Judge0 `language_id`s lives in
`server/src/judge0.js` (`LANGUAGES`). IDs can differ depending on your
Judge0 build/version - check `GET http://<judge0-host>:2358/languages` on
your own instance and adjust if needed. Per-language `compile_cmd`/`run_cmd`
overrides live in `judge0/Dockerfile`'s seed-append block (see "Ubuntu 26.04
vs. Debian buster" above for why they live there instead of a one-shot SQL
script).

## LSP (diagnostics, completion, hover in the editor)

`lsp/` is a separate Node service giving Monaco real IDE features (not
word-based completion — actual symbol-aware completion from real language
servers):

- **C++** — `clangd` 22, from LLVM's own apt repo (`apt.llvm.org`), not
  Debian bookworm's apt package (clangd 14, which predates `-std=c++2c`/C++26
  support entirely — Judge0 compiles C++ with GCC 15's `-std=c++26`, see
  "Ubuntu 26.04 vs. Debian buster" above). Pointed at LLVM's own `libc++`
  (also from apt.llvm.org) instead of bookworm's `libstdc++-12-dev` — the
  latter is GCC 12 (2022) and is missing `<print>`, `<expected>`, and other
  C++23/26 library additions outright, so those headers showed as "file not
  found" even once the `-std` flag itself was accepted. Both are pinned per
  session via a generated `.clangd` file (`lsp/bridge.js`), since clangd has
  no `-std`/`-stdlib` command-line flag of its own.
- **Python** — `pylsp` / python-lsp-server (pip)
- **Go** — `gopls` (official Go toolchain, fetched directly from go.dev —
  bookworm's `golang-go` apt package is too old, its go.mod parser can't even
  read gopls's own go.mod)
- **Java** — `jdtls` (Eclipse JDT Language Server). `download.eclipse.org`
  no longer serves `jdtls-*.tar.gz` directly (the documented URL 404s, the
  mirror redirect returns an HTML picker page, and the project has no GitHub
  releases) — instead we pull `server/` (the jar plugins + `config_linux` +
  the equinox launcher) straight out of the VS Code "Language Support for
  Java" extension's `.vsix` via open-vsx.org (just a versioned zip). The
  launcher jar's filename is version-stamped, so `lsp/bridge.js` globs for
  it at runtime rather than hardcoding a version.
- **Bash** — `bash-language-server`, picks up `shellcheck` off `PATH`
  automatically for real diagnostics, not just completion/hover.
- **MariaDB** — none; see "Ubuntu 26.04 vs. Debian buster" above.

All five servers live in one image (`lsp/Dockerfile`); the bridge
(`lsp/bridge.js`) routes by URL path: `/lsp/cpp`, `/lsp/python`, `/lsp/go`,
`/lsp/java`, `/lsp/bash`. On every websocket connection the bridge spawns a
**fresh** language-server process in a throwaway temp working directory and
kills it on disconnect — one candidate's state never leaks into another
session.

**Architecture note:** we deliberately didn't pull in
`monaco-languageclient` + `@codingame/monaco-vscode-api` — that stack
reimplements a large part of the VS Code workbench (services, extension
host) just to give Monaco a "real" LSP client, and drags in a fast-moving,
tightly-version-locked dependency graph for what we actually need: real
diagnostics/completion/hover on a plain `<Editor>`. Instead,
`frontend/src/lib/lspClient.js` is a compact, hand-rolled LSP client over a
plain WebSocket, wired directly into Monaco's own native APIs
(`registerCompletionItemProvider`, `registerHoverProvider`,
`editor.setModelMarkers`).

The browser never learns the real server-side temp directory path — both
client and server talk in terms of a fixed placeholder,
`file:///workspace/...`, and the bridge rewrites `file://` URIs (and bare
paths inside diagnostic message text, e.g. gopls's "no active builds contain
/tmp/...") both ways as messages pass through.

**Known limitations, single-file mode without a real project:**
- **Go**: `gopls` sometimes reports an informational "no active builds
  contain main.go" diagnostic — expected for a single file with a synthetic
  `go.mod` and no real module; completion/hover still work fine.
- **Java**: `jdtls` explicitly marks the file as "non-project file, only
  syntax errors are reported" — its normal behavior for a standalone file
  with no Maven/Gradle project; semantic errors (undefined symbols etc.)
  aren't checked, only syntax.

**Resources:** the `lsp` service is capped at `mem_limit: 3g` in
`docker-compose.yml` — on a 4 vCPU / 16GB box (alongside the rest of the
stack and Judge0) that's comfortable headroom for a handful of concurrent
interviews; `jdtls` is the heaviest (it gets its own `-Xmx768m`). Raise the
limit if you expect more concurrent sessions.

**Redeploying after a change:**
```bash
cd /opt/signalstage
git pull
docker compose up -d --build lsp             # if only lsp/ changed
docker compose up -d --build lsp frontend    # if the client changed too
```

**What's actually been verified vs. not:** protocol-level, end to end - a
real `initialize` handshake and a full `didOpen` (deliberately broken code)
→ `publishDiagnostics` round trip with correctly rewritten URIs, for every
language, both directly against the `lsp` container and through the public
nginx `/lsp/*` path (`tests/system-check.mjs` runs this against a live
deployment). Actually eyeballing it in a browser (open a room, type broken
code and see the red squiggle, start typing a known symbol and see real
completions) hasn't been done by a human — worth doing once before relying
on it in a real interview.

## Security and production checklist

- **Judge0 runs `privileged: true`** — required for the `isolate` sandbox.
  Keep Judge0 on its own isolated network/host and don't expose `2358`
  publicly (`judge0/docker-compose.yml` binds it to `127.0.0.1` already, but
  double-check on your own host). `ENABLE_NETWORK=false` by default -
  candidate-submitted code has no network access; don't change this without
  a real reason.
- Change **every** password/token in `.env` and `judge0/judge0.conf` — the
  `change-me-*` placeholders are not meant for real use.
- Put TLS in front of nginx (Caddy/Traefik/certbot, etc.) — this stack is
  built to sit behind your own reverse proxy or run on a private network as-is.
- The room link (`/room/<uuid>`) is the candidate's only access secret -
  don't post it anywhere beyond a direct message to that specific candidate.
- The live Yjs document snapshots to Postgres on Hocuspocus's own debounce
  (`rooms.last_code`), but there's still a small window where very recent
  edits aren't persisted yet - for anything mission-critical, consider a
  full Hocuspocus persistence extension instead of relying on the debounce
  window.

## Manual testing checklist

1. Register an interviewer, create a session.
2. Open the session link in two tabs (or two browsers) under different
   names - confirm edits and cursors sync in real time, and the participant
   badges in the header update live.
3. Pick a language, type `Hello, world!`, click Run - check stdout for each
   of the six languages (or run `tests/system-check.mjs` instead, which does
   this for all of them automatically).
4. Trigger a compile error (e.g. a syntax error in C++) - confirm
   `compile_output` shows up with real ANSI colors from the compiler, not a
   flat single color.
5. Save a template from a live session, then start a new session from it on
   the dashboard, and separately insert it into an existing session via the
   side panel - confirm both actually replace the session content.
6. As the interviewer, disable candidate Run, confirm a candidate's Run
   button greys out live; re-enable and confirm it's usable again.
7. Run some code as a "candidate" (second tab, no login) and confirm the
   interviewer's tab shows the "running code" indicator while it executes.

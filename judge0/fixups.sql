-- Judge0 seeds its `languages` table only on first boot, from hardcoded
-- Ruby definitions - there's no config-file knob for compile_cmd/run_cmd.
--
-- judge0/Dockerfile rebuilds the whole Judge0 image on Ubuntu 26.04 instead
-- of the upstream judge0/compilers:1.4.0 image (Debian 10 buster, EOL since
-- 2019) - see README's "Ubuntu 26.04 vs. Debian buster" section for why and
-- how. That gives every toolchain here a plain apt-installed, currently
-- supported version instead of a hand-built-from-source one pinned to
-- whatever was current in 2019-2021. The old per-language /usr/local/<lang>-
-- <version>/ paths judge0's own seed data points at don't exist in this
-- image at all - every language actually exposed by SignalStage needs its
-- compile_cmd/run_cmd repointed at the new location.
--
-- Run once after the Judge0 stack's first boot (languages table must already
-- be seeded): docker compose exec -T db psql -U judge0 -d judge0 -f /dev/stdin < fixups.sql
-- (or: cat fixups.sql | docker compose exec -T db psql -U judge0 -d judge0)

-- C++ (was GCC 9.2.0, id 54) -> GCC 15, -std=c++23.
-- -fdiagnostics-color=always: GCC disables colored diagnostics by default
-- whenever stdout/stderr isn't a TTY, which is always true when Judge0
-- captures compile_output to a file - without this flag the frontend's ANSI
-- renderer has nothing to render and compile errors show up monochrome.
UPDATE languages
SET name = 'C++ (GCC 15, C++23)',
    compile_cmd = '/usr/bin/g++-15 %s -std=c++23 -fdiagnostics-color=always main.cpp',
    run_cmd = './a.out'
WHERE id = 54;

-- Python (was 3.8.1, id 71) -> 3.14.
UPDATE languages
SET name = 'Python (3.14)',
    run_cmd = '/usr/bin/python3 script.py'
WHERE id = 71;

-- Go (was 1.13.5, id 60) -> 1.26. GO111MODULE=off: a lone submitted main.go
-- has no go.mod, and module-aware mode (the default since Go 1.16) refuses
-- to build a file with no module context.
UPDATE languages
SET name = 'Go (1.26)',
    compile_cmd = 'GOCACHE=/tmp/.cache/go-build GO111MODULE=off /usr/bin/go build %s main.go',
    run_cmd = './main'
WHERE id = 60;

-- Java (was OpenJDK 13.0.1, id 62) -> OpenJDK 25. The elaborate JVM flags
-- from the Debian-buster/rlimit-only era (-XX:+UseSerialGC, -Xshare:off,
-- -XX:TieredStopAtLevel=1, ...) existed to keep heap/metaspace/thread-count
-- ergonomics inside a virtual-address-space rlimit standing in for real
-- cgroup memory accounting (see README's now-superseded "cgroup v2 хосты"
-- section). isolate 2.6 enforces real cgroup v2 memory/pids limits again, so
-- none of that workaround is needed - just cap the heap.
UPDATE languages
SET name = 'Java (OpenJDK 25)',
    compile_cmd = '/usr/bin/javac %s Main.java',
    run_cmd = '/usr/bin/java -Xmx256m Main'
WHERE id = 62;

-- Bash (was 5.0.0, id 46) -> 5.3 (Ubuntu 26.04's system bash).
UPDATE languages
SET name = 'Bash (5.3)',
    run_cmd = '/usr/bin/bash script.sh'
WHERE id = 46;

-- MariaDB: no existing Judge0 language for it (SQL id 82 is SQLite, a
-- single-file embedded db - MariaDB needs an actual running server). Spin up
-- a private, disposable mariadbd per submission inside the sandbox's own box
-- directory: install a fresh datadir, start it on a local Unix socket only
-- (--skip-networking - no reason to expose a TCP port from inside a
-- submission sandbox), poll until it accepts connections, run the
-- submitted script, and let isolate tear the whole box down afterwards.
-- Heavier than every other language here (~1-2s of server startup on top of
-- actual query time) - server/src/judge0.js requests a longer wall_time_limit
-- specifically for this language to cover it.
INSERT INTO languages (name, compile_cmd, run_cmd, source_file, is_archived)
SELECT
  'MariaDB (11.8)',
  NULL,
  'mariadb-install-db --auth-root-authentication-method=normal --datadir=./db >/tmp/mariadb-install.log 2>&1 && ' ||
  '(mariadbd --datadir=./db --socket=./mysql.sock --skip-networking --pid-file=./mariadb.pid >/tmp/mariadbd.log 2>&1 &) && ' ||
  'for i in $(seq 1 30); do mariadb --socket=./mysql.sock -e ''SELECT 1'' >/dev/null 2>&1 && break; sleep 0.2; done && ' ||
  'mariadb --socket=./mysql.sock < script.sql',
  'script.sql',
  false
WHERE NOT EXISTS (SELECT 1 FROM languages WHERE name = 'MariaDB (11.8)');

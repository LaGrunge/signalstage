-- Judge0 seeds its `languages` table only on first boot, from hardcoded
-- Ruby definitions - there's no config-file knob for run_cmd. This host runs
-- a cgroup v2-only kernel, so judge0.conf disables isolate's --cg (cgroup)
-- mode entirely (see ENABLE_PER_PROCESS_AND_THREAD_* comments there). Without
-- cgroup memory accounting, the JVM's default ergonomics (heap sized off
-- total host RAM, ~1GB metaspace/compressed-class-space reservation, one
-- OS thread per GC/JIT worker sized off visible CPU count) blow straight
-- through any reasonable per-process RLIMIT_AS/RLIMIT_NPROC before user code
-- even starts. Pin them down explicitly instead:
--   -Xmx256m / -Xss512k        keep heap + thread stacks inside MEMORY_LIMIT
--   -XX:MaxMetaspaceSize=128m
--   -XX:CompressedClassSpaceSize=64m   default reserves ~1GB up front
--   -XX:TieredStopAtLevel=1    interpreter + C1 only, skips the C2 thread
--   -XX:+UseSerialGC           single-threaded GC instead of G1's worker pool
--   -XX:-UsePerfData, -Xshare:off   skip a couple of incidental threads/mmaps
--
-- Run once after the Judge0 stack's first boot (languages table must already
-- be seeded): docker compose exec -T db psql -U judge0 -d judge0 -f /dev/stdin < fixups.sql
-- (or: cat fixups.sql | docker compose exec -T db psql -U judge0 -d judge0)

UPDATE languages
SET run_cmd = '/usr/local/openjdk13/bin/java -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -XX:-UsePerfData -Xshare:off -Xmx256m -Xss512k -XX:MaxMetaspaceSize=128m -XX:CompressedClassSpaceSize=64m Main'
WHERE id = 62 AND name = 'Java (OpenJDK 13.0.1)';

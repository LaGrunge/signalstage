FROM ubuntu:26.04 AS compilers

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
      build-essential git curl ca-certificates sudo cron \
      libcap-dev libsystemd-dev libseccomp-dev pkg-config asciidoc \
      libssl-dev libyaml-dev libreadline-dev zlib1g-dev libffi-dev libgdbm-dev \
      shared-mime-info \
      libpq-dev \
      gcc-15 g++-15 \
      python3 python3-pip \
      golang-go \
      openjdk-25-jdk-headless \
      bash \
      mariadb-client mariadb-server \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --depth 1 --branch v2.6 https://github.com/ioi/isolate.git /tmp/isolate && \
    cd /tmp/isolate && make -j"$(nproc)" && make install && \
    rm -rf /tmp/isolate

# isolate 2.x runs only on cgroup v2 (the whole reason to upgrade from 1.8.1 -
# see README "cgroup v2 хосты") and, since 2.3, gets its sandbox UID/GID range
# from /etc/subuid|subgid for a configured user by default. We have no need
# for that indirection (or systemd's isolate.service cgroup delegation, which
# "cg_root = auto:..." expects) in a single privileged container - configure
# the same explicit first_uid/num_boxes range 1.x used, and point cg_root at
# a real cgroup path we create ourselves instead of the systemd auto-detect.
#
# syscall_flags bit 4 ("i-node operations") blocks flock()/fcntl(F_SETLK...)
# outright by default - isolate's own man page notes this exists to stop
# sandboxes leaking data to each other via locks on an inode shared through
# a read-only bind-mount. Go's build cache takes exactly this legitimate
# flock() path to trim itself after a build and fails compilation entirely
# without it ("go: failed to trim cache: ... function not implemented").
# Disable only that bit (31 total - 4 = 27); keyrings/vsock/io_uring/legacy-
# arch restrictions (1+2+8+16) stay on.
RUN sed -i \
      -e 's|^subid_user = isolate|#subid_user = isolate|' \
      -e 's|^# first_uid = 60000|first_uid = 60000|' \
      -e 's|^# first_gid = 60000|first_gid = 60000|' \
      -e 's|^# num_boxes = 1000|num_boxes = 2000|' \
      -e 's|^cg_root = auto:/run/isolate/cgroup|cg_root = /sys/fs/cgroup/isolate|' \
      -e 's|^# syscall_flags = 65535|syscall_flags = 27|' \
      /usr/local/etc/isolate

# Judge0 v1.13.1's Gemfile pins Rails 5.0 / old gem versions verified against
# Ruby 2.7 + bundler 2.1.4 - running that combination under Ubuntu 26.04's
# system Ruby 3.3 hits both a hard Gemfile constraint (:development's `listen`
# caps Ruby < 3.0) and, more importantly, Rails 5 was never made compatible
# with Ruby 3.x keyword-argument semantics. Building Ruby 2.7.0 from source
# (same version judge0/compilers itself uses) sidesteps all of that - only
# the language toolchains below come from Ubuntu 26.04's own apt.
#
# Ubuntu 26.04's system OpenSSL is 3.x, but Ruby 2.7's bundled `openssl` C
# extension targets the 1.1 API and doesn't just warn on 3.x - it hard-fails
# (OpenSSL 3.0 deleted constants like RSA_SSLV23_PADDING outright, not just
# deprecated them). Ubuntu no longer ships a libssl1.1 package at all, so
# build OpenSSL 1.1.1 from source and point Ruby's ext at it explicitly,
# same fix rbenv/ruby-build use for this exact old-Ruby-on-new-distro case.
RUN curl -fSsL "https://www.openssl.org/source/openssl-1.1.1w.tar.gz" -o /tmp/openssl.tar.gz && \
    mkdir /tmp/openssl && tar -xf /tmp/openssl.tar.gz -C /tmp/openssl --strip-components=1 && \
    rm /tmp/openssl.tar.gz && cd /tmp/openssl && \
    ./config --prefix=/opt/openssl-1.1.1 --openssldir=/opt/openssl-1.1.1 shared && \
    make -j"$(nproc)" && make install_sw && \
    rm -rf /tmp/openssl

RUN curl -fSsL "https://cache.ruby-lang.org/pub/ruby/2.7/ruby-2.7.0.tar.gz" -o /tmp/ruby-2.7.0.tar.gz && \
    mkdir /tmp/ruby-2.7.0 && \
    tar -xf /tmp/ruby-2.7.0.tar.gz -C /tmp/ruby-2.7.0 --strip-components=1 && \
    rm /tmp/ruby-2.7.0.tar.gz && \
    cd /tmp/ruby-2.7.0 && \
    ./configure --disable-install-doc --prefix=/usr/local/ruby-2.7.0 \
      --with-openssl-dir=/opt/openssl-1.1.1 \
      CFLAGS="-std=gnu17 -Wno-error=implicit-function-declaration -Wno-error=incompatible-pointer-types -Wno-error=int-conversion" && \
    make -j"$(nproc)" && \
    make install && \
    rm -rf /tmp/ruby-2.7.0

ENV LD_LIBRARY_PATH="/opt/openssl-1.1.1/lib"
ENV PATH="/usr/local/ruby-2.7.0/bin:${PATH}"

# The private OpenSSL 1.1.1's --openssldir is otherwise empty - point it at
# Ubuntu's own CA bundle instead of shipping/maintaining a separate one.
ENV SSL_CERT_FILE="/etc/ssl/certs/ca-certificates.crt"
ENV SSL_CERT_DIR="/etc/ssl/certs"

RUN echo "gem: --no-document" > /root/.gemrc && \
    gem install bundler:2.1.4

WORKDIR /api
# `git clone` (unlike upstream's own COPY . . + .dockerignore, which excludes
# judge0.conf from the build) pulls the repo's own blank judge0.conf template
# straight into /api/judge0.conf - scripts/load-config checks /api/judge0.conf
# before the docker-compose-mounted /judge0.conf, so it silently shadows our
# real config (empty POSTGRES_PASSWORD etc.) unless removed.
RUN git clone --depth 1 --branch v1.13.1 https://github.com/judge0/judge0.git /api && \
    rm -f /api/judge0.conf

# db/seeds.rb does `Language.unscoped.delete_all` and unconditionally
# recreates all 89 stock languages EVERY boot (scripts/server runs
# `rails db:seed` on every start, not just once) - a one-shot SQL fixup
# applied by hand gets silently wiped on the next restart/redeploy. Append
# our overrides to the same seed file instead of fighting it, so they're
# reapplied automatically every time, in the same transaction as the stock
# seed.
COPY <<'SIGNALSTAGE_SEEDS' /tmp/signalstage_seeds.rb


# --- SignalStage: this deployment's own toolchain refresh, layered on top of
# the stock seed above (which just wiped and recreated everything) - see
# README's "Ubuntu 26.04 vs. Debian buster" and "cgroup v2 хосты" sections. ---
{
  54 => { name: 'C++ (GCC 15, C++23)',
          compile_cmd: '/usr/bin/g++-15 %s -std=c++23 -fdiagnostics-color=always main.cpp',
          run_cmd: './a.out' },
  71 => { name: 'Python (3.14)',
          run_cmd: '/usr/bin/python3 script.py' },
  60 => { name: 'Go (1.26)',
          compile_cmd: 'GOCACHE=/tmp/.cache/go-build GO111MODULE=off /usr/bin/go build %s main.go',
          run_cmd: './main' },
  62 => { name: 'Java (OpenJDK 25)',
          # /usr/bin/javac|java are symlinks through /etc/alternatives to
          # /usr/lib/jvm/java-25-openjdk-amd64/bin/{javac,java} - isolate's
          # default directory rules don't resolve that symlink chain from
          # inside the sandbox ("execve: No such file or directory" even
          # though the same binary runs fine outside isolate), so point
          # directly at the real path instead of chasing /etc/alternatives.
          compile_cmd: '/usr/lib/jvm/java-25-openjdk-amd64/bin/javac ' \
                       '-J-Xmx512m -J-XX:MaxMetaspaceSize=128m -J-XX:CompressedClassSpaceSize=64m ' \
                       '%s Main.java',
          # Same run_cmd flags proven necessary under the rlimit-only
          # workaround documented in README's "cgroup v2 хосты": under
          # ENABLE_PER_PROCESS_AND_THREAD_MEMORY_LIMIT=true, MEMORY_LIMIT is
          # a per-process RLIMIT_AS (virtual address space), and the JVM
          # reserves around 1GB of metaspace/compressed-class-space up front
          # regardless of what it will actually touch - cap it explicitly.
          # javac needs the identical caps for the same reason (it's a Java
          # program itself and hits the same ergonomics-driven reservation
          # during compilation, not just at runtime).
          run_cmd: '/usr/lib/jvm/java-25-openjdk-amd64/bin/java -XX:+UseSerialGC -XX:TieredStopAtLevel=1 ' \
                   '-XX:-UsePerfData -Xshare:off -Xmx256m -Xss512k -XX:MaxMetaspaceSize=128m ' \
                   '-XX:CompressedClassSpaceSize=64m Main' },
  46 => { name: 'Bash (5.3)',
          run_cmd: '/usr/bin/bash script.sh' },
}.each do |id, attrs|
  Language.find(id).update!(attrs)
end

# MariaDB: no existing Judge0 language for it (SQL id 82 is SQLite, a
# single-file embedded db - MariaDB needs an actual running server). Spin up
# a private, disposable mariadbd per submission inside the sandbox's own box
# directory: install a fresh datadir, start it on a local Unix socket only
# (--skip-networking - no reason to expose a TCP port from inside a
# submission sandbox), poll until it accepts connections, run the submitted
# script, and let isolate tear the whole box down afterwards.
#
# Two non-obvious fixes baked in here, both found the hard way:
# - The socket file lives under /dev/shm (tmpfs), not the box's own working
#   directory. The worker container's root (and therefore the isolate box
#   directory) is overlayfs, and mariadbd's bind() for the AF_UNIX socket
#   silently "succeeds" on overlayfs without ever creating the socket file -
#   mariadbd logs "ready for connections" and the client then fails to
#   connect to a socket path that was never actually created. tmpfs doesn't
#   have this problem. /dev/shm is shared across all boxes on this host (not
#   per-box like the box directory is), hence the random suffix plus the
#   explicit `rm -f` at the end so concurrent submissions can't collide and
#   old sockets don't accumulate.
# - max_file_size is set much higher for this language only (see
#   server/src/judge0.js's maxFileSize override) - InnoDB's initial datadir
#   (ibdata1 + redo logs) lands around 140MB even for a fresh, empty
#   instance, and mariadb-install-db simply dies ("File size limit
#   exceeded") under the ~20MB quota sized for the other languages' build
#   artifacts.
Language.create!(
  id: 90,
  name: 'MariaDB (11.8)',
  source_file: 'script.sql',
  run_cmd: 'mariadb-install-db --auth-root-authentication-method=normal --force --datadir=./db >/dev/null 2>&1 && ' \
           'SOCK=$(mktemp -u /dev/shm/mariadb-XXXXXX.sock) && ' \
           '(mariadbd --datadir=./db --socket=$SOCK --skip-networking --pid-file=./mariadb.pid >/dev/null 2>&1 &) && ' \
           'for i in $(seq 1 30); do mariadb --socket=$SOCK -e "SELECT 1" >/dev/null 2>&1 && break; sleep 0.2; done && ' \
           'mariadb --socket=$SOCK < script.sql; RC=$?; rm -f "$SOCK"; exit $RC'
)
SIGNALSTAGE_SEEDS
RUN cat /tmp/signalstage_seeds.rb >> /api/db/seeds.rb && rm /tmp/signalstage_seeds.rb

RUN RAILS_ENV=production bundle _2.1.4_

RUN cat /etc/cron.d/* 2>/dev/null | crontab - || true

RUN (id -u judge0 >/dev/null 2>&1 || useradd -m -r judge0) && \
    echo "judge0 ALL=(ALL) NOPASSWD: ALL" > /etc/sudoers.d/judge0 && \
    chown judge0: /api/tmp/ && \
    ln -sf /usr/bin/g++-15 /usr/bin/g++ && ln -sf /usr/bin/gcc-15 /usr/bin/gcc

# /sys/fs/cgroup is a fresh kernel-provided mount at container start, not
# part of the image, so this has to run every time the container starts, not
# at build time: create the isolate subgroup and delegate the memory/pids/cpu
# controllers down into it via cgroup.subtree_control - a child cgroup only
# gets access to controllers its parent explicitly hands down, and isolate's
# --cg mode needs memory.events/pids.max etc. to exist in box-N's cgroup.
RUN printf '%s\n' \
      '#!/bin/bash' \
      'sudo mkdir -p /sys/fs/cgroup/isolate' \
      "echo '+memory +pids +cpu' | sudo tee /sys/fs/cgroup/cgroup.subtree_control >/dev/null" \
      "echo '+memory +pids +cpu' | sudo tee /sys/fs/cgroup/isolate/cgroup.subtree_control >/dev/null" \
      'exec /api/docker-entrypoint.sh "$@"' \
      > /usr/local/bin/signalstage-entrypoint.sh && \
    chmod +x /usr/local/bin/signalstage-entrypoint.sh

EXPOSE 2358
ENTRYPOINT ["/usr/local/bin/signalstage-entrypoint.sh"]
CMD ["/api/scripts/server"]

ENV JUDGE0_HOMEPAGE="https://judge0.com"
ENV JUDGE0_SOURCE_CODE="https://github.com/judge0/judge0"
ENV JUDGE0_MAINTAINER="SignalStage"
ENV JUDGE0_VERSION="1.13.1-signalstage-ubuntu26.04"

USER judge0

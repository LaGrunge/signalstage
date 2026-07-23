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
RUN sed -i \
      -e 's|^subid_user = isolate|#subid_user = isolate|' \
      -e 's|^# first_uid = 60000|first_uid = 60000|' \
      -e 's|^# first_gid = 60000|first_gid = 60000|' \
      -e 's|^# num_boxes = 1000|num_boxes = 2000|' \
      -e 's|^cg_root = auto:/run/isolate/cgroup|cg_root = /sys/fs/cgroup/isolate|' \
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
RUN git clone --depth 1 --branch v1.13.1 https://github.com/judge0/judge0.git /api

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

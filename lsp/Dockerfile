FROM node:20-bookworm

# clangd (C++), python3/pip (pylsp), shellcheck (bash diagnostics) - Go and
# Java toolchains are fetched directly below since Debian bookworm's apt
# versions are too old (golang-go's go.mod parser can't even read gopls's own
# go.mod, and there's no openjdk-21 package in bookworm main, which jdtls
# needs). One image for all six language servers, path-routed by the bridge -
# simpler to build and deploy than six separate services for a box this
# size; revisit only if image size becomes a problem.
RUN apt-get update && apt-get install -y --no-install-recommends \
      python3 \
      python3-pip \
      shellcheck \
      curl \
      wget \
      gnupg \
      unzip \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Bookworm's own `clangd` apt package is clang/clangd 14, which predates any
# -std=c++2c (C++26) support (that landed in Clang 17) - Judge0 compiles C++
# with GCC 15's -std=c++26 (see judge0/Dockerfile), so clangd needs to be new
# enough to parse the same flag or every C++ session gets spurious "unknown
# standard" / missing-feature diagnostics. Pull clangd straight from the LLVM
# project's own apt repo instead of waiting on Debian to backport a newer one.
RUN wget -qO /tmp/llvm.sh https://apt.llvm.org/llvm.sh \
    && chmod +x /tmp/llvm.sh \
    && /tmp/llvm.sh 21 \
    && apt-get install -y --no-install-recommends clangd-21 \
    && ln -sf /usr/bin/clangd-21 /usr/local/bin/clangd \
    && rm -f /tmp/llvm.sh \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir 'python-lsp-server[all]'

# Picks up shellcheck off PATH automatically for real diagnostics, not just
# completion/hover. (No sql-language-server here - see bridge.js's comment on
# LANGUAGES for why MariaDB has no LSP entry.)
RUN npm install -g bash-language-server

# Debian bookworm only ships OpenJDK 17, but current jdtls snapshots require a
# 21+ runtime to launch - install Temurin 21 directly rather than pulling in a
# whole extra apt repo for one package.
RUN curl -fsSL "https://api.adoptium.net/v3/assets/latest/21/hotspot?image_type=jdk&os=linux&architecture=x64" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)[0]['binary']['package']['link'])" > /tmp/temurin21.url \
    && curl -fsSL "$(cat /tmp/temurin21.url)" -o /tmp/temurin21.tar.gz \
    && mkdir -p /opt/java21 \
    && tar -xzf /tmp/temurin21.tar.gz -C /opt/java21 --strip-components=1 \
    && rm /tmp/temurin21.tar.gz /tmp/temurin21.url
ENV JAVA_HOME=/opt/java21
ENV PATH="/opt/java21/bin:${PATH}"

# Same story as Temurin above: fetch the official Go toolchain directly.
RUN curl -fsSL "https://go.dev/dl/?mode=json" \
      | python3 -c "import json,sys; d=json.load(sys.stdin); print(next(f['filename'] for f in d[0]['files'] if f['os']=='linux' and f['arch']=='amd64'))" > /tmp/go.filename \
    && curl -fsSL "https://go.dev/dl/$(cat /tmp/go.filename)" -o /tmp/go.tar.gz \
    && tar -xzf /tmp/go.tar.gz -C /opt \
    && rm /tmp/go.tar.gz /tmp/go.filename
ENV PATH="/opt/go/bin:${PATH}"
ENV GOPATH=/opt/gopath
RUN go install golang.org/x/tools/gopls@latest \
    && cp /opt/gopath/bin/gopls /usr/local/bin/gopls \
    && rm -rf /opt/gopath/pkg /opt/gopath/src /opt/go

# Eclipse JDT Language Server. download.eclipse.org's project download area no
# longer serves the standalone jdtls-*.tar.gz distribution directly (the
# well-documented URL 404s, the mirror-redirect helper returns an HTML
# picker page, and jdt.ls has no GitHub releases) - so instead we pull the
# exact same server/ directory (plugins + config_linux + the equinox
# launcher jar) out of the Red Hat "Language Support for Java" VS Code
# extension's .vsix via open-vsx.org, which is just a versioned zip. The
# launcher jar filename is version-stamped, so bridge.js resolves it with a
# glob at runtime instead of hardcoding a version here.
RUN curl -fsSL "https://open-vsx.org/api/redhat/java/latest" \
      | python3 -c "import json,sys; print(json.load(sys.stdin)['files']['download'])" > /tmp/redhat-java.url \
    && curl -fsSL "$(cat /tmp/redhat-java.url)" -o /tmp/redhat-java.vsix \
    && mkdir -p /opt/jdtls \
    && cd /tmp && unzip -q redhat-java.vsix "extension/server/*" \
    && mv extension/server/* /opt/jdtls/ \
    && rm -rf /tmp/redhat-java.vsix /tmp/redhat-java.url /tmp/extension

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY bridge.js ./

EXPOSE 3001
CMD ["node", "bridge.js"]

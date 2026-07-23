FROM node:20-bookworm

# clangd (C++), golang-go (Go, to build/run gopls), python3/pip (pylsp),
# openjdk-21-jdk (jdtls runtime) - one image for all four language servers,
# path-routed by the bridge. Simpler to build and deploy than four separate
# services for a box this size; revisit only if image size becomes a problem.
RUN apt-get update && apt-get install -y --no-install-recommends \
      clangd \
      golang-go \
      python3 \
      python3-pip \
      openjdk-21-jdk-headless \
      curl \
      ca-certificates \
    && rm -rf /var/lib/apt/lists/*

RUN pip3 install --break-system-packages --no-cache-dir 'python-lsp-server[all]'

ENV GOPATH=/opt/go
RUN go install golang.org/x/tools/gopls@latest \
    && cp /opt/go/bin/gopls /usr/local/bin/gopls \
    && rm -rf /opt/go/pkg /opt/go/src

# Eclipse JDT Language Server - ships its own launcher (bin/jdtls) that wires
# up the right jars/config dir per platform, so we don't hand-build the
# `java -jar plugins/...` classpath invocation ourselves.
RUN mkdir -p /opt/jdtls && \
    curl -fsSL https://download.eclipse.org/jdtls/snapshots/jdtls-latest.tar.gz | tar -xz -C /opt/jdtls

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY bridge.js ./

EXPOSE 3001
CMD ["node", "bridge.js"]

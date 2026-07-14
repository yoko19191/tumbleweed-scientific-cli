#!/usr/bin/env bash
set -euo pipefail

mkdir -p dist

for target in darwin-arm64 darwin-x64 linux-x64 linux-arm64; do
  bun build --compile --target="bun-${target}" src/bin.ts \
    --outfile "dist/tumbleweed-${target}"
done

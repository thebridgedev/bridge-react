#!/usr/bin/env bash
# Test that the packed package installs cleanly with React 18 and React 19.
# Run from repo root: bun run test:install (or ./scripts/test-install.sh)
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Building and packing package..."
bun install
bun run build
bun run package
# package script outputs to repo root (destination ../ from bridge-react)
PACKED=$(ls "$ROOT"/nebulr-group-bridge-react-*.tgz 2>/dev/null | head -1)
if [ -z "$PACKED" ] || [ ! -f "$PACKED" ]; then
  echo "Could not find packed tarball" >&2
  exit 1
fi
mv "$PACKED" "$ROOT/install-test-pkg.tgz"

TEST_DIR="$ROOT/install-test-tmp"
TGZ="$ROOT/install-test-pkg.tgz"
rm -rf "$TEST_DIR"
trap "rm -rf '$TEST_DIR'; rm -f '$TGZ'" EXIT

for REACT_VER in 18 19; do
  echo "==> Testing install with react@$REACT_VER..."
  mkdir -p "$TEST_DIR"
  cd "$TEST_DIR"
  npm init -y
  npm install "react@^$REACT_VER" "react-dom@^$REACT_VER"
  npm install "$ROOT/install-test-pkg.tgz"
  echo "    react@$REACT_VER: OK"
  cd "$ROOT"
  rm -rf "$TEST_DIR"
done
rm -f "$TGZ"

echo "==> All install tests passed."

#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")/../vocab-mcp" && pwd)"

if [[ ! -d "$DIR/node_modules" ]]; then
  cd "$DIR" && bun install --frozen-lockfile 2>/dev/null || bun install
fi

if [[ -n "${1:-}" ]]; then
  export CLAUDE_PLUGIN_DATA="$1"
  mkdir -p "$CLAUDE_PLUGIN_DATA"
fi

exec bun run "$DIR/src/index.ts"

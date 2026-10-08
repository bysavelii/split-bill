#!/usr/bin/env bash
# SessionStart hook: prepares a cloud Claude Code session for work by installing the project dependencies.
# Does nothing locally: a person sets up the environment there.
# Installation output goes to stderr: the stdout of a SessionStart hook ends up in the agent context.
set -euo pipefail

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$project_dir"

if [[ -f package-lock.json ]]; then
  echo "session-start: installing dependencies (npm ci)…" >&2
  npm ci --no-audit --no-fund >&2
fi

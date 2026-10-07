#!/usr/bin/env bash
# Хук SessionStart: готовит облачную сессию Claude Code к работе — ставит зависимости проекта.
# Локально ничего не делает: там окружение настраивает человек.
# Вывод установки уходит в stderr: stdout хука SessionStart попадает в контекст агента.
set -euo pipefail

if [[ "${CLAUDE_CODE_REMOTE:-}" != "true" ]]; then
  exit 0
fi

project_dir="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
cd "$project_dir"

if [[ -f package-lock.json ]]; then
  echo "session-start: ставлю зависимости (npm ci)…" >&2
  npm ci --no-audit --no-fund >&2
fi

#!/usr/bin/env bash
# CI wrapper: propagate cron-smoke exit through tee (avoid false-green pipelines).
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_PATH="${1:-evidence/cron-smoke.log}"

mkdir -p "$(dirname "$LOG_PATH")"
bash "${SCRIPT_DIR}/cron-smoke.sh" 2>&1 | tee "$LOG_PATH"
exit "${PIPESTATUS[0]}"

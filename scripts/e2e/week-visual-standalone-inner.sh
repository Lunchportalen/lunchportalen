#!/usr/bin/env bash
set -euo pipefail

UPDATE_FLAGS=""
if [[ "${1:-}" == "--update-snapshots" ]]; then
  UPDATE_FLAGS="--update-snapshots"
fi

npm ci
npx next build
npm run start &

for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --connect-timeout 2 http://127.0.0.1:3000/ || true)
  if [[ "$code" =~ ^[23][0-9][0-9]$ ]]; then
    echo "Server ready ($code)"
    break
  fi
  if [ "$i" -eq 60 ]; then
    echo "Server did not become ready"
    exit 1
  fi
  sleep 2
done

npx playwright test --config playwright.week-visual.config.ts --reporter=list ${UPDATE_FLAGS}

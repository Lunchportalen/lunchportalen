#!/usr/bin/env bash
set -euo pipefail

: "${BASE_URL:?Set BASE_URL (e.g. https://lunchportalen.no)}"
OUT_DIR="${OUT_DIR:-evidence/$(date +%F)}"
mkdir -p "$OUT_DIR"

echo "== ENV ==" | tee "$OUT_DIR/RUNTIME_TESTS.txt"
echo "BASE_URL=$BASE_URL" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"
echo "DATE=$(date -Is)" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"
echo "" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"

IDEM="idem-$(date +%s)"
echo "== REGISTER (happy + idempotent retry) ==" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"

curl -i -sS "$BASE_URL/api/register" \
  -H "content-type: application/json" \
  -H "x-idempotency-key: $IDEM" \
  -d '{
    "companyName":"Test Firma AS",
    "orgNr":"999999999",
    "employeeCount":20,
    "adminEmail":"test-admin+reg@lunchportalen.no",
    "adminName":"Test Admin",
    "acceptedPowerOfAttorney":true
  }' | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"

echo "" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"

curl -i -sS "$BASE_URL/api/register" \
  -H "content-type: application/json" \
  -H "x-idempotency-key: $IDEM" \
  -d '{
    "companyName":"Test Firma AS",
    "orgNr":"999999999",
    "employeeCount":20,
    "adminEmail":"test-admin+reg@lunchportalen.no",
    "adminName":"Test Admin",
    "acceptedPowerOfAttorney":true
  }' | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"

echo "" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"

echo "== CRON SECRET CHECK (optional) ==" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"
if [[ -n "${CRON_SECRET:-}" ]]; then
  curl -i -sS "$BASE_URL/api/cron/publish-week" \
    -H "authorization: Bearer $CRON_SECRET" \
    | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"
else
  echo "(CRON_SECRET not set; skipping)" | tee -a "$OUT_DIR/RUNTIME_TESTS.txt"
fi

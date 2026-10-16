#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
base=https://127.0.0.1:9443
health=$(curl --insecure --fail --silent --show-error --max-time 10 "$base/api/health")
test "$health" = '{"status":"ok"}'
for path in /admin/login /test-catalog; do
  code=$(curl --insecure --location --silent --show-error --output /dev/null \
    --write-out '%{http_code}' --max-time 15 "$base$path")
  test "$code" = 200 || { echo "$path returned $code" >&2; exit 1; }
done
internal=$(curl --insecure --silent --output /dev/null --write-out '%{http_code}' \
  --max-time 10 "$base/api/internal/telegram/retry")
test "$internal" = 404 || { echo "Internal route is exposed: $internal" >&2; exit 1; }
echo "OK: health, admin login, test catalog; internal route hidden by proxy."

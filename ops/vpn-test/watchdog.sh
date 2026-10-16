#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
command -v flock >/dev/null
exec 9>/tmp/domkazan-vpn-test-watchdog.lock
flock -n 9 || { echo "Watchdog already running" >&2; exit 1; }
compose=(docker compose --project-name domkazan-vpn-test --profile tools --profile worker --env-file .env.vpn-test -f compose.vpn-test.yaml)
soft_count=0
echo "Watching host memory and 1-minute load every 10 s; stops only domkazan-vpn-test."
while :; do
  available_kib=$(awk '/^MemAvailable:/ {print $2}' /proc/meminfo)
  load_1m=$(awk '{print $1}' /proc/loadavg)
  if ! [[ "$available_kib" =~ ^[0-9]+$ ]]; then
    echo "Cannot read MemAvailable; stop test services manually." >&2
    exit 1
  fi
  hard=$(awk -v m="$available_kib" 'BEGIN {print m <= 256000 ? 1 : 0}')
  soft=$(awk -v m="$available_kib" -v l="$load_1m" 'BEGIN {print (m <= 358400 || l >= 1.25) ? 1 : 0}')
  if (( hard )); then
    echo "Critical host memory: ${available_kib} KiB available. Stopping test project."
    "${compose[@]}" stop --timeout 20
    exit 2
  fi
  if (( soft )); then ((soft_count+=1)); else soft_count=0; fi
  if (( soft_count >= 3 )); then
    echo "Sustained pressure: ${available_kib} KiB available, load ${load_1m}. Stopping test project."
    "${compose[@]}" stop --timeout 20
    exit 2
  fi
  echo "MemAvailable=${available_kib} KiB load1=${load_1m}"
  sleep 10
done

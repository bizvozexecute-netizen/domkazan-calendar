#!/bin/sh
set -eu
umask 077
target=${1:-/backups/domkazan-$(date -u +%Y%m%dT%H%M%SZ).dump}
if [ -e "$target" ] || [ -e "$target.partial" ]; then echo 'Backup target already exists' >&2; exit 1; fi
mkdir -p "$(dirname "$target")"
trap 'rm -f -- "$target.partial"' EXIT HUP INT TERM
pg_dump --format=custom --no-owner --no-privileges --file="$target.partial"
pg_restore --list "$target.partial" >/dev/null
mv -- "$target.partial" "$target"
(cd "$(dirname "$target")" && sha256sum "$(basename "$target")" > "$(basename "$target").sha256")
echo "Backup complete: $target"

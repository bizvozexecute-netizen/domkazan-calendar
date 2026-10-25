#!/usr/bin/env bash
set -euo pipefail
umask 077
test "$(id -u)" -eq 0
source_sha=${1:?Pass the full verified image source commit}
[[ "$source_sha" =~ ^[a-f0-9]{40}$ ]] || { echo 'Invalid source commit' >&2; exit 1; }
root=/srv/domkazan
test -s "$root/config/app.env"
test -s "$root/config/migration.env"
test -s /etc/letsencrypt/live/domkazan-ip/fullchain.pem
server_ip=$(python3 - <<'PY'
from ipaddress import ip_address
from pathlib import Path
from urllib.parse import urlparse
root = Path('/srv/domkazan/config')
for file, user in [('app.env', 'domkazan_app'), ('migration.env', 'domkazan_owner')]:
    env = dict(line.split('=', 1) for line in (root / file).read_text().splitlines() if line)
    database = urlparse(env['DATABASE_URL'])
    assert database.hostname == 'postgres' and database.path == '/domkazan_calendar' and database.username == user
    if file == 'app.env':
        origin = urlparse(env['APP_ORIGIN'])
        assert origin.scheme == 'https' and not origin.username and not origin.password and not origin.port
        assert origin.path in ('', '/') and not origin.query and not origin.fragment
        print(str(ip_address(origin.hostname)))
PY
)
docker image inspect "domkazan-calendar:app-$source_sha" >/dev/null
docker image inspect "domkazan-calendar:tools-$source_sha" >/dev/null
systemctl start domkazan-db-backup.service
printf 'APP_IMAGE=domkazan-calendar:app-%s\nTOOLS_IMAGE=domkazan-calendar:tools-%s\n' "$source_sha" "$source_sha" > "$root/config/release.env"
compose=(docker compose --env-file "$root/config/release.env" -f "$root/operations/compose.app.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" run --rm migrate
# Runtime has DML privileges only. Prisma migration history is not application data.
docker compose --env-file "$root/config/database.env" -f "$root/compose.infrastructure.yaml" exec -T postgres psql -U postgres -d domkazan_calendar -v ON_ERROR_STOP=1 -c 'REVOKE ALL ON TABLE "_prisma_migrations" FROM domkazan_app;'
"${compose[@]}" up -d --wait --wait-timeout 120 app
cp -p /etc/nginx/sites-available/domkazan "$root/config/nginx.previous"
restore_nginx() { cp -p "$root/config/nginx.previous" /etc/nginx/sites-available/domkazan; }
trap restore_nginx ERR
python3 "$root/operations/render-nginx.py"
nginx -t
systemctl reload nginx
trap - ERR
curl --fail --silent --show-error "https://$server_ip/api/health"
printf '\nDeployed %s; public routes follow explicit release flags. Tilda was not changed.\n' "$source_sha"

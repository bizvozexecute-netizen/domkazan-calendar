"""Render an explicit public-route allowlist; no shell evaluation of secrets."""
from pathlib import Path
from ipaddress import ip_address
from urllib.parse import urlparse


def render(template, env):
    origin = urlparse(env['APP_ORIGIN'])
    assert origin.scheme == 'https' and not origin.username and not origin.password
    assert not origin.port and origin.path in ('', '/') and not origin.query and not origin.fragment
    host = str(ip_address(origin.hostname))
    secret = env['TRUSTED_PROXY_SECRET']
    assert len(secret) >= 32 and all(c in '0123456789abcdefABCDEF' for c in secret)
    for flag in ['PUBLIC_CATALOG_ENABLED', 'PUBLIC_REQUESTS_ENABLED']:
        assert env.get(flag, 'false') in ('true', 'false'), 'Invalid public route flag'
    catalog = env.get('PUBLIC_CATALOG_ENABLED') == 'true'
    requests = env.get('PUBLIC_REQUESTS_ENABLED') == 'true'
    assert not requests or catalog, 'Requests require the public catalog'
    if requests:
        policy = urlparse(env.get('PRIVACY_POLICY_URL', ''))
        assert policy.scheme == 'https' and policy.hostname and not policy.username and not policy.password, 'Configure the approved policy before requests'
    api = '|api/(?:catalog|client-settings|availability|house-calendar)$' if catalog else ''
    if requests:
        api += '|api/requests$'
    result = template.replace('${PUBLIC_API_PATTERN}', api)
    result = result.replace('${SERVER_IP}', host).replace('${TRUSTED_PROXY_SECRET}', secret)
    # Assets are public code only. APIs set their own strict CORS headers.
    assets = '''location ^~ /embed/ {
    proxy_pass http://127.0.0.1:3000;
    proxy_hide_header Access-Control-Allow-Origin;
    add_header Access-Control-Allow-Origin "https://domkazan116.ru" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy same-origin always;
  }''' if catalog else ''
    result = result.replace('${PUBLIC_ASSETS_LOCATION}', assets)
    assert '${' not in result
    return result


if __name__ == '__main__':
    root = Path('/srv/domkazan')
    env = dict(line.split('=', 1) for line in (root/'config/app.env').read_text().splitlines() if line and not line.startswith('#'))
    config = render((root/'operations/nginx-ip.conf.template').read_text(), env)
    Path('/etc/nginx/sites-available/domkazan').write_text(config)

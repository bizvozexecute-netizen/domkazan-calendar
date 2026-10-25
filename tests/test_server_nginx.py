import importlib.util
from pathlib import Path
import re
import unittest

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('server_nginx', root/'ops/server/render-nginx.py')
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class ServerNginxTests(unittest.TestCase):
    def setUp(self):
        self.env = {'APP_ORIGIN': 'https://192.0.2.1', 'TRUSTED_PROXY_SECRET': 'ab'*32}
        self.template = (root/'ops/server/nginx-ip.conf.template').read_text()

    def config(self, **flags):
        return module.render(self.template, {**self.env, **flags})

    def allows(self, config, path):
        pattern = re.search(r'location ~ (\S+) \{', config)[1]
        return bool(re.search(pattern, path))

    def test_default_remains_admin_only(self):
        config = self.config()
        self.assertTrue(self.allows(config, '/api/admin/calendar'))
        self.assertTrue(self.allows(config, '/admin/privacy-draft'))
        for path in ['/api/catalog', '/api/requests', '/api/internal/telegram/retry', '/test-tilda', '/api/catalog-extra']:
            self.assertFalse(self.allows(config, path))
        self.assertNotIn('location ^~ /embed/', config)

    def test_catalog_release_does_not_open_form_or_internal_routes(self):
        config = self.config(PUBLIC_CATALOG_ENABLED='true')
        for path in ['/api/catalog', '/api/client-settings', '/api/availability', '/api/house-calendar']:
            self.assertTrue(self.allows(config, path))
        for path in ['/api/requests', '/api/catalog-extra', '/api/internal/telegram/retry', '/test-policy']:
            self.assertFalse(self.allows(config, path))
        self.assertIn('Access-Control-Allow-Origin "https://domkazan116.ru"', config)
        self.assertNotIn('Access-Control-Allow-Credentials', config)
        self.assertIn('proxy_set_header X-Forwarded-For ""', config)
        self.assertIn('proxy_set_header X-DomKazan-Client-IP $remote_addr', config)

    def test_requests_need_catalog_and_configured_https_policy(self):
        for flags in [dict(PUBLIC_REQUESTS_ENABLED='true'), dict(PUBLIC_CATALOG_ENABLED='true', PUBLIC_REQUESTS_ENABLED='true'),
                      dict(PUBLIC_CATALOG_ENABLED='true', PUBLIC_REQUESTS_ENABLED='true', PRIVACY_POLICY_URL='http://invalid.example/privacy')]:
            with self.assertRaises(AssertionError):
                self.config(**flags)
        config = self.config(PUBLIC_CATALOG_ENABLED='true', PUBLIC_REQUESTS_ENABLED='true', PRIVACY_POLICY_URL='https://192.0.2.1/privacy')
        self.assertTrue(self.allows(config, '/api/requests'))
        self.assertFalse(self.allows(config, '/api/requests/extra'))

    def test_rejects_config_injection_and_invalid_flags(self):
        for flags in [dict(TRUSTED_PROXY_SECRET='x'*32+';'), dict(APP_ORIGIN='https://192.0.2.1/path'),
                      dict(PUBLIC_CATALOG_ENABLED='yes'), dict(APP_ORIGIN='https://user@192.0.2.1')]:
            with self.assertRaises(AssertionError):
                self.config(**flags)


if __name__ == '__main__':
    unittest.main()

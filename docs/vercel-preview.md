# Separate Vercel preview

This is a public-URL test stand, separate from the loopback-only VPN Docker project. Deploy only to Vercel **Preview**, using a dedicated PostgreSQL database whose name ends in `_test`. Do not connect it to the VPN database or a production database. The working Tilda page is outside this deployment.

## Before deploying

1. Create a separate Vercel project with Node.js 22 and automatic system environment variables enabled. Keep Preview deployment protection on until sharing is intentional. Do not deploy the `main` branch to Vercel Production.
2. Provision a separate managed PostgreSQL database. Its name must end in `_test`; the seed script and synthetic catalog reject other names. Store its connection URL as a sensitive `DATABASE_URL` variable for **Preview only**. Do not put the URL in Git or a ticket.
3. Set Preview-only `ADMIN_EMAIL` to a test identity, `ADMIN_PASSWORD_HASH` to a fresh scrypt hash, `SESSION_SECRET` to a fresh random value of at least 32 characters, and `TEST_CATALOG_ENABLED=true`. Leave `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, owner contact settings, and `TILDA_ORIGIN` unset. Do not use VPN stand secrets. `APP_ORIGIN` and `PRIVACY_POLICY_URL` should be unset: the preview derives its HTTPS origin from trusted `VERCEL_URL` and uses `/test-policy`.
4. From a trusted workstation with the test database URL in a temporary environment variable, run `npm ci`, `npm run db:deploy`, then set `ALLOW_TEST_SEED=true` in that shell and run `npm run db:seed:test`. The seed creates nine fictional houses and no client records. Clear the database URL from the shell afterward. Never log the full connection URL.
5. Deploy the reviewed Git commit to **Preview**. Verify `/api/health`, `/admin/login`, `/test-catalog`, `/test-policy`, and the date/guest search. The Telegram retry route must return 404 in Preview. Test applications must use fictional names and contacts; no Telegram bot is connected.

The preview URL changes with each deployment. `VERCEL_ENV=preview` and a valid `VERCEL_URL` are required for application forms. Production has no automatic origin fallback, so an accidental Production deployment cannot accept applications without separate configuration.

## Sharing and later Tilda testing

Share only the verified Preview URL and test credentials through a private channel. If deployment protection blocks the customer, use Vercel's controlled sharing flow. For cross-origin calls from a Tilda test page, configure its distinct test origin as `TILDA_ORIGIN` and review the exposure of the test API first. CORS cannot distinguish two pages on the same origin. A Tilda T778 catalog requires a verified Product UID mapping to the test database; the fictional catalog does not provide that mapping. Do not point the working Tilda page at this preview.

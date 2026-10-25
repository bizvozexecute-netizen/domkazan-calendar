# Separate Vercel preview

This is a public-URL test stand, separate from the loopback-only VPN Docker project. Deploy only to Vercel **Preview**, using a dedicated PostgreSQL resource. Do not connect it to the VPN database or a production database. The working Tilda page is outside this deployment.

## Before deploying

1. Create a separate Vercel project with Node.js 22 and automatic system environment variables enabled. Keep Preview deployment protection on until sharing is intentional. Do not deploy the `main` branch to Vercel Production.
2. Provision a separate managed PostgreSQL database. Connect it to **Preview only**. Prisma Postgres uses the fixed database name `postgres`; for that provider, calculate SHA-256 of the exact `DATABASE_URL` string and set `TEST_DATABASE_URL_SHA256` for Preview. The seed script and synthetic catalog require the matching fingerprint and `VERCEL_ENV=preview`. A conventional database ending in `_test` remains supported for the isolated Docker test stand. Never put the URL in Git or a ticket.
3. Set Preview-only `ADMIN_EMAIL` to a test identity, `ADMIN_PASSWORD_HASH` to a fresh scrypt hash, `SESSION_SECRET` to a fresh random value of at least 32 characters, and `TEST_CATALOG_ENABLED=true`. Leave `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`, owner contact settings, and `TILDA_ORIGIN` unset. Do not use VPN stand secrets. `APP_ORIGIN` should be unset: the preview derives its HTTPS origin from trusted `VERCEL_URL`. For the approved public Tilda test gateway, set Preview-only `PRIVACY_POLICY_URL` to `https://domkazan-calendar-tilda-test-gatewa.vercel.app/test-policy` before deploying; otherwise it falls back to its protected `/test-policy`.
4. Set this Vercel project's build command to `npm run build:vercel-preview`. Its guard checks Preview and the database fingerprint before applying committed migrations, seeding nine fictional houses (without client records), and building Next.js. A mismatched or rotated URL fails the build safely; recalculate the fingerprint only after confirming the new URL still belongs to the dedicated test resource. Never log the full connection URL.
5. Deploy the reviewed Git commit to **Preview**. Verify `/api/health`, `/admin/login`, `/test-catalog`, `/test-policy`, and the date/guest search. The Telegram retry route must return 404 in Preview. Test applications must use fictional names and contacts; no Telegram bot is connected.

Before relying on the deployment URL, inspect its Vercel target. A first deployment of a new project can be misclassified as `production` even when Preview is explicitly requested ([Vercel issue #17069](https://github.com/vercel/vercel/issues/17069)). The Preview build guard intentionally fails before migrations in that case. Stop there; do not retry through CLI, Git, or API while Production deployments remain prohibited.

The preview URL changes with each deployment. `VERCEL_ENV=preview` and a valid `VERCEL_URL` are required for application forms. Production has no automatic origin fallback, so an accidental Production deployment cannot accept applications without separate configuration.

## Sharing and later Tilda testing

### Customer access approved on 18 October 2026

The owner explicitly approved disabling Vercel Authentication for the entire separate
`domkazan-calendar-test` project, including its previous Preview deployments. Its
`ssoProtection` is now `null`. Deployment protection instructions above describe the
initial setup; Vercel sign-in is no longer required for this customer's test.

Use the exact application origin for login (an arbitrary alias is not a valid form origin):
https://domkazan-calendar-test-aponge33w-iss-projects-5d0a08b3.vercel.app/admin/login

Share the URL and existing test application credentials privately. A local ignored
`.local-customer-access.txt` contains the handoff details; never commit it. This is
the same single test administrator account, not a separate customer role. Signing in
keeps up to five eight-hour sessions so phone and desktop access can coexist. A sixth
login removes the oldest session; logout revokes only that browser's token. Changing
the password invalidates all previous sessions. No production credentials or customer records are used.

Application authentication remains required: anonymous admin pages redirect to
login; admin APIs return 401; wrong-origin writes return 403. Successful login uses
a Secure, HttpOnly, SameSite=Strict cookie; logout revokes the server session.
All of these checks passed against the public deployment on 18 October 2026.
Internal Telegram retry remains disabled (404), and Preview requests still accept
only the fictional test name and phone. No application redeployment or data change
was required for this access-setting update.

The approved [public Tilda gateway](tilda-test-gateway.md) continues to serve the test
page and forward search and fictional requests. Its existing Trusted Sources rule
can remain configured but is no longer needed while Vercel Authentication is off.
The working Tilda page must not load this adapter.

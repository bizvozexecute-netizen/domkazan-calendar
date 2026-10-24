# Tilda catalog copy for the protected test stand

On 17 October 2026, the public Tilda catalog response and the authorized editor
for test page `311744409` both contained 63 distinct Product UIDs. The earlier
proposed mapping contained 64. UID `851186077552` (Казанка Терраса) was absent
from both current sources and must not be mapped into the current catalog.

`data/tilda-catalog-public.json` records only current UID, title, product URL,
published capacity, and four published base night prices. It excludes product
descriptions, photos, contacts, HomeReserve links, booking records, and client
data. Regenerate with `node scripts/snapshot-tilda-catalog.mjs` and review the
diff against the Tilda test editor before updating the test database.

The Preview build inserts these 63 houses into its separately identified test
database as `tilda-<Product UID>`. Existing tester edits are preserved. The
snapshot contains no live occupancy, so dates are only test availability.
Published base prices can omit extra guest charges, service fees, optional
facilities, seasonal changes, minimum nights, and other conditions. They must
not be presented as confirmed booking totals. The Chebaksa listing specifies
6 adults and 6 children; the current single guest-count field cannot enforce
that rule, so the house is inactive in automated results pending a richer rule.
The API accepts at most 50 guests, while one listing advertises up to 100.

Vercel Preview requires Vercel Authentication. Tilda therefore calls the
separate [public test gateway](tilda-test-gateway.md), which accepts only the
exact Tilda origin and fictional request details. The gateway's server-side
Vercel identity reaches only the protected Preview. No protection-bypass
secret is embedded in Tilda. CORS by origin alone cannot distinguish this
test page from another page on the same domain; this is why the gateway
exposes only synthetic data and rejects real contacts. The working Tilda page
and production database remain untouched.

Generate the enabled test-page T123 code with
`node scripts/render-tilda-test-snippet.mjs https://domkazan-calendar-tilda-test-gatewa.vercel.app`.
It writes `integration/tilda-311744409-t123.html`, pins the 63 UID-to-test-slug
rows, and checks JavaScript syntax. The current code saved in the test page's
T123 matched that local file exactly after saving. The gateway alias is
stable; update its server-side Preview target after each reviewed deployment.

In Vercel Preview, `/api/requests` accepts only `Тестовый Гость` with
`+70000000000` and no messenger contact. The test policy explains this. This
guard prevents test UI mistakes from storing real contact details; it does not
make a public application safe for production use.

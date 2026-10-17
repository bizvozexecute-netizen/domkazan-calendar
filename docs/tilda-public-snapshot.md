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

Vercel Preview requires Vercel Authentication. Its browser protection blocks
scripts and API calls from a Tilda page, and the Tilda editor preview displays
T123 code without executing it. Do not embed a protection-bypass secret in
Tilda. Keep the T123 integration disabled until an isolated, test-only HTTPS
endpoint and the exact test-page origin are approved and verified. CORS by
origin alone cannot distinguish the test page from another page on the same
Tilda domain. The working Tilda page and production database remain untouched.

In Vercel Preview, `/api/requests` accepts only `Тестовый Гость` with
`+70000000000` and no messenger contact. The test policy explains this. This
guard prevents test UI mistakes from storing real contact details; it does not
make a public application safe for production use.

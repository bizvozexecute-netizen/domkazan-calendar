# Public gateway for the Tilda test page

## Updated catalog, 17 October 2026

The test page now uses `domkazan-catalog.js` and `/api/catalog`, which serves sanitized
public Tilda descriptions, photos and features with a one-minute source cache.
It never forwards `product.text` or the legacy booking URLs. House links use the same
Tilda test page with `?house=<Product UID>` and carry dates/guest count to a full
house view instead of opening the shared Tilda popup. List/grid, amenity/bedroom/name/
budget filters and price sorting run with the database availability result.

The original T778 is hidden only after the new catalog reports ready. On load failure
the original page remains visible. This update is confined to page `311744409`.
The test gateway still accepts only fictional requests and has no administrative route.
See [delivery.md](delivery.md) for the owner walkthrough and go-live prerequisites.

The historical notes below describe the original T778 adapter deployment.

As verified on 17 October 2026, only Tilda page `311744409` is published for
this integration at `https://domkazan116.ru/calendar-test-311744409`. Its
HomeReserve T123 is disabled on that page, its T778 contains 63 current
Product UIDs, and its new T123 is enabled. The page has `noindex`. The live
homepage does not contain this integration code.

The separate Vercel project `domkazan-calendar-tilda-test-gateway` is public at
`https://domkazan-calendar-tilda-test-gatewa.vercel.app`. It is intentionally
deployed to that project's Production alias so Tilda can access it. This is
not a deployment of the full application to Production. The full Next.js
app and admin remain behind Vercel Authentication in project
`domkazan-calendar-test`, with protection set to All Deployments. A Trusted
Sources rule permits only Production tokens of the gateway project to reach
Preview deployments of the application. The gateway forwards a short-lived
Vercel OIDC token from its server-side function, never to the browser.
The reviewed gateway deployment is `dpl_H8imeyFmggPZp3jCMj9JS73wC75j`.

The gateway serves only:

- `GET /api/availability` and `OPTIONS` for the exact Tilda origin;
- `POST /api/requests` and `OPTIONS`, with the exact fictional name
  `Тестовый Гость`, phone `+70000000000`, no messenger contact, and a house
  returned in the current Tilda test search;
- `/embed/domkazan-search.js`, `/embed/domkazan-tilda.js`, and `/test-policy`.

It filters availability to `tilda-<12-digit UID>` houses, keeps the original
Tilda Product UID links, and removes owner contacts from successful request
responses. It has no admin or internal route and does not connect to a
database. The gateway requires `GATEWAY_UPSTREAM_ORIGIN` on its Production
environment, set to the exact protected Preview deployment URL. The
application Preview has `PRIVACY_POLICY_URL` set to the gateway's `/test-policy`.
Both projects need redeployment after their respective environment variable
changes. Never send an automation bypass secret to Tilda or the gateway.

## Updating the test stand

1. Review code and run `npm test`, `npm run typecheck`, and `npm run lint`.
   Ensure both gateway `/public/embed` files exactly match the reviewed app
   `/public/embed` files (the gateway test enforces this).
2. Redeploy the full app to Preview only. Verify its target, dedicated
   database fingerprint, `/test-catalog`, and the Preview request guard.
3. Set the gateway's Production-only `GATEWAY_UPSTREAM_ORIGIN` to that exact
   Preview deployment URL and deploy only the gateway directory to its own
   project. Verify the resulting alias, not just the generated deployment URL.
4. Generate `integration/tilda-311744409-t123.html` using
   `node scripts/render-tilda-test-snippet.mjs https://domkazan-calendar-tilda-test-gatewa.vercel.app`.
   Check the 63 UIDs against T778 before saving it in T123 `rec4862390501`.
   Republish only Tilda page `311744409`.
5. In a visitor browser, check the date and guest search, test prices, popup
   links, and one fictional application. Check that `/admin/login` and
   `/api/internal/telegram/retry` on the public gateway return 404, the
   protected app still requires login, and the homepage lacks the test code.

On 17 October 2026, the visitor browser showed 62 results for 20–22 October
and two guests, and 5 for 50 guests. A fictional request completed with ID
`cmvc7mteh000008jjbyn2t1b5`; no confirmed booking or payment was created. A separate
gateway API smoke test created `cmvc77c5h000007l6j5v5ie0f`. The gateway's
admin and internal paths returned 404; `/test-policy` and both scripts
returned 200. The original homepage and test page both returned 200, with
integration code only on the test page.

After visitor feedback, the test page's search block was given a contained,
responsive layout and a styled test notice. The gateway widget now leaves its
initial status empty while Tilda first loads its cards. The published page was
rechecked at a narrow viewport with the same 20–22 October, two-guest search:
62 results, no clipped submit button, and 63 Tilda catalog slots.

The follow-up design pass on the test page adds a heading and a contained search
panel, aligns its colors with the catalog, rounds the card edges, and formats
search prices as Russian ruble amounts without trailing zero kopecks. A live
visitor search for 20–22 October and two guests still returned 62 houses;
the first test price displayed as `12 000 ₽ за 2 ноч.`. The gateway and page
remain limited to the same test endpoints and page ID. The test page also
overrides its own Tilda navigation block from fixed to absolute positioning,
so its 160px menu no longer covers the search and catalog while scrolling.

The 63 homes reuse public titles, capacities and base nightly tariffs. No
live occupancy or client records were imported. Extra guest charges, service
fees, optional facilities and special stay rules are not included in the
test quote. One listing with an adult/child rule is inactive. Tilda's shared
product popup still contains its original HomeReserve link; removing that
link would require editing shared product content and could affect the live
site. The test adapter leaves those original links intact.

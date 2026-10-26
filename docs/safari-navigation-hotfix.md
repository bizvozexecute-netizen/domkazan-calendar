# House navigation on mobile Safari, 26 October 2026

## Evidence and limits

The supplied `IMG_6982.MP4` shows private browsing on an iPhone. The first
house's details link receives a visible active/hover state, but the catalog
remains on screen. There is no transition overlay in the recording.

A normal tap on the existing production build succeeds in the available
Playwright WebKit. This does not reproduce the customer's exact iOS version
or establish a single device-specific cause. No physical iPhone is connected.

The old navigation has independently reproducible defects:

- It rejects every click whose `button` is not exactly `0`, including
  compatibility events without mouse fields or with `button: -1`.
- Delegation outside the shadow tree relies exclusively on `composedPath()`.
  A click confined to the shadow tree never reaches it. Event retargeting also
  prevents a simple `event.target.closest()` fallback outside that tree.
- It cancels a real link before calling History API and rendering. A thrown
  `pushState()` leaves the overlay and `inert` enabled with no native fallback.
- A failure in scroll restoration likewise leaves the rendered house inert.

Fault-injection WebKit regressions fail on the original module for History API
and scroll failures. These are verified defects, rather than proof that the
customer's device threw those errors. The video is more consistent with a tap
that never reaches successful navigation than with the overlay failure.

## Change

Delegate inside the stable shadow root; accept primary, touch and keyboard
clicks while leaving auxiliary buttons and modifier clicks alone. Use the real
anchor URL when History API or synchronous rendering fails. Cancel default
navigation only after starting the replacement successfully. Bound a stalled
transition to 15 seconds and then use the native URL. Release `inert` even when
scrolling/focusing is unavailable. Keep real links for image, title and details.

Production T123 loads a versioned module URL to avoid using an older cached
copy after publication. The inspected production response already specifies
`Cache-Control: public, max-age=0`; stale cache is not established as the cause.
The test snippet is unchanged. The gateway asset is synchronized, not deployed.

Existing search parameters, return position and browser history remain intact.
Booking, rates, occupancy, database contents and VPN are outside this change.

## Checks and rollout

Run `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` and the
GitHub Actions readiness workflow, which includes PostgreSQL integration,
backup restoration, dependency audits and browser tests. Navigation regressions
now run in Chromium, WebKit desktop/mobile and Firefox. Existing resilience
tests cover filtered return, scroll position, forward/back and no hero flash.

Before publishing, save the current T123 through the Tilda editor, not merely
the previous legacy integration. The private exact backup for this change is
`.local-server-access/main-t123-before-safari-hotfix-20261026.html`.
Retain the running image tag and immutable original module for rollback.

Publish only the reviewed module and T123 of page `70446131`, block
`rec1184803096`, after successful checks. Do not publish all pages. Verify the
actual unmodified responses after publication, including the versioned module
and all three links. Roll back by restoring the saved T123 and prior application
image/module; never restore the database for this JavaScript-only change.

The release report and PR must state whether publication actually occurred,
which CI run passed, and that real iPhone acceptance remains a separate check.

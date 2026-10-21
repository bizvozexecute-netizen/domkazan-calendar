# Next ESLint root directory adapter

The root `package.json` replaces `fast-glob` **only below
`@next/eslint-plugin-next@16.4.0`** with this private local package. The installed
plugin uses one call: `globSync(pattern, { onlyDirectories: true })` in
`dist/utils/get-root-dirs.js`.

The implementation delegates to pinned `tinyglobby@0.2.17`, already used by the
project's TypeScript ESLint tooling. `expandDirectories: false` preserves literal
root matching. It rejects unexpected API/options and excessive input depth/length.
It does not implement the complete `fast-glob` API and must not be used as a
global replacement. There are no install hooks, copied upstream sources or
modified files in `node_modules`.

Why: [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
affects every released `braces` version as of 2026-10-21. The latest Next ESLint
still brings `fast-glob → micromatch → braces`. This adapter removes that code
from the installed tree while keeping Next/Prisma/ESLint versions and lint rules.

Compatibility tests exercise the actual plugin's default/literal/glob/array/
Windows-path root settings and assert that its real internal-link rule still
reports errors. They also check the supported plugin version and call site.
When upgrading Next ESLint, review those tests and the override; do not broaden
the override without auditing its consumer. Remove this package once upstream
eliminates the vulnerable dependency chain.

The directory must be copied before `npm ci` in Docker and included in source
archives. Full `npm audit` is a required CI check, without an advisory exception.

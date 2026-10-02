# CLAUDE.md

Working rules for anyone changing Arztool — people and coding agents. The why behind most rules
is in [docs/DECISIONS.md](docs/DECISIONS.md); the security model in
[docs/SECURITY.md](docs/SECURITY.md); the layout in [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Stack and commands

Electron 44 · TypeScript (strict) · electron-vite 5 · React 19 · Tailwind 4 · i18next (DE default,
EN) · zod · Vitest · Playwright (`_electron`) · pnpm 11 · Node ≥ 22.12.

| Task                      | Command                                              |
| ------------------------- | ---------------------------------------------------- |
| Dev app                   | `pnpm dev`                                           |
| Lint (must be 0 warnings) | `pnpm lint`                                          |
| Format check              | `pnpm format:check` (fix: `pnpm format`)             |
| Typecheck                 | `pnpm typecheck`                                     |
| Unit tests                | `pnpm test`                                          |
| E2E (builds first)        | `pnpm test:e2e`                                      |
| macOS installer           | `CSC_IDENTITY_AUTO_DISCOVERY=false pnpm package:mac` |
| Regenerate QR fixtures    | `pnpm fixtures` (HEIC needs macOS `sips`)            |

"Done" means all of lint, format, typecheck, unit, E2E and a package build pass.

## Non-negotiables

- **Security baseline stays intact:** `sandbox`, `contextIsolation`, no `nodeIntegration`, strict
  CSP (`shared/csp.ts`), deny-by-default navigation/popups/permissions (`main/security.ts`). A
  portal page never gets a preload.
- **Every IPC channel** is added in four places: `shared/ipc/channels.ts` (name + types),
  `shared/ipc/schemas.ts` (zod; the `satisfies` clause fails the build if missing), a handler via
  `main/ipc/handle.ts` (sender check), and the preload. Handlers that only the shell may call
  check the sender id (see `main/ipc/settings.ts`).
- **The renderer's verdict is never trusted** — main re-runs `assessUrl` before opening a viewer.
- **No network calls** except the portal URL the user opens and the opt-in update check.
  Decoding is local (bundled zxing WASM, bundled pdf.js worker); clipboard HTML images that are
  only links are never fetched.
- **Never store full portal URLs** (they carry access tokens): history keeps domain + time only;
  download marks and logs contain no URL; the viewer's home URL lives in memory only.
- **Patient data never enters the repo.** `qr-sample.*` and `samples-private/` are gitignored —
  never `git add -A`; never turn a real document into a fixture.

## Conventions

- **Version + CHANGELOG on every change** (semver: patch for fix/chore/docs, minor for features).
  CHANGELOG entries are written for clinicians, in plain language.
- **Non-obvious choices get a DECISIONS entry** (numbered, dated, context → decision → trade-off).
- **Every user-facing string in both** `shared/i18n/de.json` and `en.json` — a unit test enforces
  key and placeholder parity. German is the source catalogue.
- **Pure logic lives in `src/shared/`** and is unit-tested (URL safety, settings, input sniffing,
  HTML image extraction); Electron-bound code stays thin in `src/main/`.
- **Version pins** (vite 7, plugin-react 5, TypeScript 6.0, @types/node 24) are forced by peer
  ranges — DECISIONS 002/029. Dependabot is configured to respect them.
- Commits: Conventional Commits, one PR per change, PRs merged by the maintainer.

## Testing notes

- E2E launches the built app with a throwaway profile (`ARZTOOL_USER_DATA_DIR`, honoured only
  unpackaged) so a running Arztool's single-instance lock can't interfere.
- Reset to the idle screen before each E2E test (`resetToIdle`) — otherwise an assertion can pass
  on the previous test's output.
- Playwright `click()` waits for navigations the app cancels; trigger such clicks in-page. After a
  cancelled navigation, read URL/title from Electron, not Playwright.
- Test servers must listen dual-stack: CI resolves `localhost` to `::1`.
- For security fixes, prove the test: revert the fix and confirm the new test fails.
- Packaged builds can't be driven by Playwright (inspect fuse off); smoke-test the packaged
  `app.asar` with the dev Electron binary, or launch the binary with `--user-data-dir=<tmp>`.

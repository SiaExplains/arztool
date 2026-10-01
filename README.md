# Arztool

**Das digitale Werkzeug für Ärzte** — a desktop toolbox for doctors in German clinics.

The first tool opens a patient's imaging result (CT, MRI, X-ray) from the QR code on their
printout or screenshot in a large, clean viewer window, instead of on a phone screen.

> Status: early development (M4 — settings, DE/EN, About). See [CHANGELOG.md](CHANGELOG.md).

## Requirements

- Node.js **≥ 22.12** (22 LTS recommended)
- pnpm **11** (`corepack enable` picks up the pinned version from `package.json`)
- macOS: Xcode command line tools (for `.dmg` packaging)
- Windows: nothing extra; NSIS is downloaded by electron-builder

## Getting started

```bash
pnpm install
pnpm dev
```

Electron downloads its binary on first launch. To fetch it up front (e.g. before going offline):

```bash
node node_modules/electron/install.js
```

## Scripts

| Command            | What it does                                               |
| ------------------ | ---------------------------------------------------------- |
| `pnpm dev`         | Run the app with hot reload                                |
| `pnpm build`       | Production build of main, preload and renderer into `out/` |
| `pnpm start`       | Run the production build                                   |
| `pnpm lint`        | ESLint, zero warnings allowed                              |
| `pnpm format`      | Prettier write (`format:check` to verify only)             |
| `pnpm typecheck`   | `tsc` for main/preload, renderer and E2E projects          |
| `pnpm test`        | Vitest unit tests                                          |
| `pnpm test:e2e`    | Build, then Playwright against the real Electron app       |
| `pnpm package:mac` | Universal (arm64 + x64) `.dmg` into `release/<version>/`   |
| `pnpm package:win` | NSIS installer (x64 + arm64) into `release/<version>/`     |

## Building installers locally

### macOS

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false pnpm package:mac
```

Produces `release/<version>/Arztool-<version>-mac-universal.dmg`. Without the env var,
electron-builder will try to sign with any Developer ID it finds in your keychain.
Without a Developer ID the app is ad-hoc signed (an unsigned Electron app with fuses is killed by
macOS on Apple Silicon — see [DECISIONS 010](docs/DECISIONS.md)). It runs locally; a downloaded
copy needs right-click → Open the first time until notarization lands in M5.

### Windows

```powershell
$env:CSC_IDENTITY_AUTO_DISCOVERY="false"; pnpm package:win
```

Produces `release\<version>\Arztool-Setup-<version>.exe` (one installer, x64 + arm64).
Unsigned installers trigger a SmartScreen warning.

Cross-building Windows installers from macOS is not supported for this project; CI builds each
platform on its own runner.

## Test fixtures

`test/fixtures/` holds generated QR images (single, multiple, rotated, low-contrast, screenshot,
non-URL, `http:`, `javascript:`, `data:`, IDN homograph, PDF, BMP, HEIC) and a `manifest.json`
with their payloads. They are committed; regenerate with:

```bash
pnpm fixtures
```

The HEIC fixture needs macOS (`sips`).

## CI and releases

- Every push to `main` and every PR runs lint, format check, typecheck, unit + E2E tests and
  packaging on `macos-latest` and `windows-latest`. Installers are attached as workflow artifacts.
- Pushing a tag `vX.Y.Z` (matching `package.json`) builds both platforms and uploads the
  installers to a **draft** GitHub Release for review.

## Docs

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — process model, folders, how to add a tool
- [docs/SECURITY.md](docs/SECURITY.md) — Electron security checklist, item by item
- [docs/DECISIONS.md](docs/DECISIONS.md) — short decision log and future ideas

## Privacy

Arztool has no telemetry, no analytics and no accounts. The only network traffic is the portal
URL a doctor explicitly opens and, once enabled, the update check against GitHub Releases.

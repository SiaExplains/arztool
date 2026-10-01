# Decisions

Short, ADR-style. Newest at the bottom. Each entry: context → decision → consequence.

## 001 — Electron + electron-vite + React (2026-10-01)

Need a desktop app for macOS and Windows with a real browser engine for third-party portals.
Electron is the only mainstream option where the viewer is the same Chromium on both OSes
(Tauri would use WebKit on macOS and WebView2 on Windows, each rendering portals differently).
electron-vite gives one config for main, preload and renderer.

## 002 — Version pins forced by peer ranges (2026-10-01)

- **Vite 7**, not 8: electron-vite 5 peers `vite ^5 || ^6 || ^7`.
- **@vitejs/plugin-react 5**, not 6: v6 requires Vite 8.
- **TypeScript 6.0**, not 7: typescript-eslint 8 supports `<6.1`.

Revisit when electron-vite and typescript-eslint publish support.

## 003 — Serve the UI from `app://`, not `file://` (2026-10-01)

Follows Electron checklist #18. Gives the renderer a proper origin for CSP `'self'`, lets
WebAssembly load via fetch, and keeps the scheme off viewer partitions.

## 004 — CSP injected at build time (2026-10-01)

The dev server needs `unsafe-inline` (React Refresh preamble) and a websocket; production must not
have either. A small Vite plugin injects the right policy per mode from `shared/csp.ts`, which is
unit-tested.

## 005 — Single preload bundle without `isolatedEntries` (2026-10-01)

electron-vite 5's experimental `isolatedEntries` crashes when stdout is not a TTY (CI). With one
preload entry it is unnecessary. When the viewer toolbar preload arrives (M3), build it as a
separate entry and verify it has no shared chunk, or revisit the option.

## 006 — No electron-store (2026-10-01)

Settings and history are small. A zod-validated JSON file in `userData` with atomic writes avoids
a dependency and keeps validation in one place (M4).

## 007 — Popups: same registrable domain, https only (2026-10-01)

Portals often split login and viewer across subdomains (`portal.de` ↔ `viewer.portal.de`).
Strict same-origin would break them. Popups are allowed when the registrable domain (eTLD+1, via
the bundled Public Suffix List in `tldts`) matches and the scheme is https, and they open in a
viewer window sharing the opener's partition (M3).

## 008 — HEIC on macOS only (2026-10-01)

Chromium cannot decode HEIC. Electron's `nativeImage` can on macOS. On Windows the app shows a
clear "please convert to JPG/PNG" message rather than bundling an LGPL HEIF decoder (M2).

## 009 — Not a medical device (2026-10-01)

Arztool displays third-party portals and performs no diagnostic function, so it is not intended to
be a medical device under MDR. To be confirmed with legal before any marketing claim changes.

## 010 — Unsigned macOS builds are ad-hoc signed (2026-10-01)

Writing Electron fuses modifies the binary after the linker signed it, and Apple Silicon kills
(SIGKILL, exit 137) any binary with an invalid signature. A truly unsigned build therefore never
launches. Default `mac.identity: '-'` (ad-hoc) with `hardenedRuntime: false`, since hardened runtime
rejects ad-hoc-signed Electron frameworks. The Developer ID release path (M5) overrides both.
Ad-hoc builds still need right-click → Open after download; only notarization removes that.

## Future ideas (out of scope for now)

- Webcam QR scanning.
- Built-in DICOM viewer for downloaded studies.
- Web or mobile versions.
- Any cloud backend or user accounts.
- Dependabot/Renovate for Electron security updates.

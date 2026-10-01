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

## 008 — HEIC on macOS only (2026-10-01, revised in M2)

Chromium cannot decode HEIC. On Windows the app shows a clear "please convert to JPG/PNG" message
rather than bundling an LGPL HEIF decoder.

Revised: the original plan was Electron's `nativeImage`, but testing showed it cannot decode HEIC
on macOS either (from buffer or path). macOS ships `/usr/bin/sips`, which converts in ~0.1 s.
Main writes the bytes to a private `0700` temp dir, runs `sips` by absolute path with fixed
arguments and no shell, reads the PNG back and deletes the dir in `finally`. The image is on disk
for well under a second.

## 009 — Not a medical device (2026-10-01)

Arztool displays third-party portals and performs no diagnostic function, so it is not intended to
be a medical device under MDR. To be confirmed with legal before any marketing claim changes.

## 010 — Unsigned macOS builds are ad-hoc signed (2026-10-01)

Writing Electron fuses modifies the binary after the linker signed it, and Apple Silicon kills
(SIGKILL, exit 137) any binary with an invalid signature. A truly unsigned build therefore never
launches. Default `mac.identity: '-'` (ad-hoc) with `hardenedRuntime: false`, since hardened runtime
rejects ad-hoc-signed Electron frameworks. The Developer ID release path (M5) overrides both.
Ad-hoc builds still need right-click → Open after download; only notarization removes that.

## 011 — Decode in the renderer, bundled WASM only (2026-10-01)

zxing-wasm runs in the renderer, so image bytes never cross IPC except for HEIC conversion. The
library fetches its `.wasm` from jsDelivr by default; `prepareZXingModule` points `locateFile` at
the copy Vite bundles into the app, and the unit tests pass `wasmBinary` directly. pdf.js is
lazy-loaded only for PDFs, with its worker bundled and `useWasm: false`. An E2E test asserts no
network request leaves the app while decoding.

## 012 — Formats are sniffed from bytes (2026-10-01)

Drag sources and clipboard managers lie about names and MIME types. `sniffInputFormat` reads magic
bytes; the file name is only shown to the user.

## 013 — Electron 44 clipboard API (2026-10-01)

Electron 44 replaced the synchronous clipboard (`readImage`, `readBuffer`, `read(format)`) with an
async, W3C-style `ClipboardItem` API. Probing it showed a copied file arrives as `text/uri-list`
and a screenshot as `image/png` on macOS. The file reference is checked first because Finder also
offers the file's icon as an image.

## 014 — Isolated profile for tests (2026-10-01)

The single-instance lock is keyed on the user-data directory, so E2E runs failed whenever a
packaged Arztool was open. Unpackaged runs honour `ARZTOOL_USER_DATA_DIR`; each E2E launch gets
a throwaway directory. Packaged builds ignore the variable.

## 015 — Only main's runtime deps are `dependencies` (2026-10-01)

electron-builder copies everything in `dependencies` into the app. Renderer libraries (React,
i18next, zxing-wasm, pdf.js) are bundled by Vite and live in `devDependencies`; only `zod`, which
main keeps external, is a runtime dependency. Found when pdf.js's optional Node canvas
(`@napi-rs/canvas`, a native single-arch module) broke the universal macOS build.

## 016 — One preload with roles (2026-10-01, supersedes the open point in 005)

The viewer toolbar needs its own bridge. A second preload entry would make Rollup share a chunk,
which a sandboxed preload cannot `require`. One bundle exposes `window.arztool` or
`window.arztoolViewer` based on `--arztool-role=` from `additionalArguments`; main checks the
sender of every message independently, so the role switch is not the only gate.

## 017 — Popups open a new viewer, not a child window (2026-10-01)

Same-site https popups are denied and reopened in a fresh viewer on the opener's partition. The
login survives, but `window.opener` is lost. Portals that drive their popup through the opener
would break; none of the target portals are known to. Electron's `createWindow` hook could keep
the opener relationship if this turns out to matter.

## 018 — Downloads through `showSaveDialogSync` (2026-10-01)

Electron's built-in save prompt cannot be tested or parented reliably. Calling
`dialog.showSaveDialogSync(viewerWindow, …)` inside `will-download` gives a sheet on the viewer,
an explicit cancel path and a stub point for E2E. It blocks main only while the user chooses.

## 019 — External-protocol links are a permission, not a navigation (2026-10-01)

Clicking `mailto:` in Chromium surfaces as `will-navigate` _and_ as an `openExternal`
permission request. Both are denied; the toolbar says which scheme was blocked. Playwright's
`click()` waits for the cancelled navigation, so E2E clicks such links from inside the page.

## Future ideas (out of scope for now)

- Webcam QR scanning.
- Built-in DICOM viewer for downloaded studies.
- Web or mobile versions.
- Any cloud backend or user accounts.
- Dependabot/Renovate for Electron security updates.

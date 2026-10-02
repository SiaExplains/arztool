# Security

Arztool handles links to patient imaging results on shared clinic PCs. The threat model is:
phishing via QR codes, portal data lingering after use, and a compromised web page escalating
into the operating system.

## Electron security checklist

Status against <https://www.electronjs.org/docs/latest/tutorial/security>. "M3" etc. marks items
whose code lands with that milestone.

| #   | Recommendation                                         | How Arztool satisfies it                                                                                                                                                                                                                                                                                |
| --- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Only load secure content                               | App UI is served from the local `app://` scheme. Viewer: https opens after confirmation, http only after an explicit "open anyway", every other scheme is blocked — checked in the renderer for the card and again in main before opening.                                                              |
| 2   | No Node.js integration for remote content              | `nodeIntegration: false`, `nodeIntegrationInWorker: false` and `nodeIntegrationInSubFrames: false` everywhere; the viewer's portal view has **no preload at all**. E2E asserts the portal page sees no `arztool`, `arztoolViewer`, `require` or `process`.                                              |
| 3   | Context isolation                                      | `contextIsolation: true` on every window. E2E asserts `window.require` and `window.process` are undefined.                                                                                                                                                                                              |
| 4   | Process sandboxing                                     | `app.enableSandbox()` forces the sandbox on every renderer, in addition to `sandbox: true` per window.                                                                                                                                                                                                  |
| 5   | Permission request handlers                            | `hardenSession()` denies every permission on the app session. Viewer partitions allow only `fullscreen` and `clipboard-sanitized-write`; camera, microphone, location, notifications, HID/USB/serial and `openExternal` (mailto:, tel:, custom app schemes) are denied, the last with a toolbar notice. |
| 6   | Do not disable `webSecurity`                           | `webSecurity: true` set explicitly.                                                                                                                                                                                                                                                                     |
| 7   | Content-Security-Policy                                | Strict CSP injected into the app's HTML at build time (`shared/csp.ts`): no inline script, no eval (only `wasm-unsafe-eval` for the QR decoder), `connect-src 'self'`. Unit- and E2E-tested.                                                                                                            |
| 8   | Do not enable `allowRunningInsecureContent`            | Set to `false` explicitly.                                                                                                                                                                                                                                                                              |
| 9   | Do not enable experimental features                    | `experimentalFeatures: false`.                                                                                                                                                                                                                                                                          |
| 10  | Do not use `enableBlinkFeatures`                       | Not used anywhere.                                                                                                                                                                                                                                                                                      |
| 11  | `<webview>`: do not use `allowpopups`                  | `<webview>` is not used; `will-attach-webview` is cancelled globally.                                                                                                                                                                                                                                   |
| 12  | Verify webview options before creation                 | Same as above — every webview attach is refused.                                                                                                                                                                                                                                                        |
| 13  | Disable or limit navigation                            | Global `will-navigate`, `will-frame-navigate` and `will-redirect` guards. App windows cannot navigate at all; the viewer's portal view may only navigate to http/https. E2E covers both.                                                                                                                |
| 14  | Disable or limit creation of new windows               | Global `setWindowOpenHandler` returns `deny`. The viewer routes an https popup on the same registrable domain (PSL incl. private suffixes, so `a.github.io` ≠ `b.github.io`) into a new viewer on the same partition; everything else is denied with a notice. Unit- and E2E-tested.                    |
| 15  | Do not use `shell.openExternal` with untrusted content | Only the viewer's "open in default browser" button, only for the current http/https URL, and only on a user click.                                                                                                                                                                                      |
| 16  | Use a current version of Electron                      | Electron 44.5 (latest stable at bootstrap). Dependabot/Renovate is a follow-up.                                                                                                                                                                                                                         |
| 17  | Validate the `sender` of all IPC messages              | `main/ipc/handle.ts` rejects any frame whose URL is not `app://arztool` (or the dev server in development).                                                                                                                                                                                             |
| 18  | Avoid `file://`, prefer custom protocols               | Production UI is served from `app://arztool/` via `protocol.handle`, with path-traversal rejection (unit-tested). The protocol is registered on the default session only, so portal partitions cannot reach it.                                                                                         |
| 19  | Check which fuses you can change                       | electron-builder `electronFuses`: RunAsNode off, NODE_OPTIONS off, `--inspect` off, cookie encryption on, embedded asar integrity validation on, only-load-from-asar on, file:// extra privileges off.                                                                                                  |
| 20  | Do not expose Electron APIs to untrusted web content   | One preload, two roles: the shell gets `window.arztool`, the viewer toolbar gets `window.arztoolViewer`; neither exposes `ipcRenderer` or a generic `invoke`. Main additionally checks that `viewer:open` comes from the shell and `viewer:command` from that viewer's own toolbar.                     |

## Additional measures

- **IPC payload validation.** Every inbound payload is parsed by its zod schema before a handler
  runs (`shared/ipc/schemas.ts`).
- **Renderer import fence.** ESLint forbids `electron`, `node:*` and `main/`/`preload/` imports in
  the renderer.
- **DevTools** are disabled in packaged builds.
- **Single instance.** A second launch focuses the existing window instead of starting a second
  process with its own state.

## QR input (M2)

- **Decoding is local.** zxing-wasm and pdf.js load only from the app bundle (see DECISIONS 011);
  an E2E test asserts zero network requests while decoding.
- **Main never reads paths chosen by the renderer.** The picker path comes from the native
  dialog; the clipboard path comes from the OS clipboard. The renderer can only send bytes
  (HEIC conversion, ≤ 50 MB, zod-checked).
- **HEIC conversion** uses `/usr/bin/sips` via `execFile` (no shell) on a private temp file that
  is deleted immediately.
- **Clipboard writes** go through IPC (max 16 KB) instead of granting the
  `clipboard-sanitized-write` permission to the renderer.
- **Formats are sniffed from bytes**, so a renamed file cannot steer which decoder runs.

## Settings and history (M4)

- **Stored in `userData`, owner-only (`0600`), written atomically.** Every field is
  re-validated on read; anything unusable falls back to the privacy-first default
  (history off, no trusted domains, confirmation on).
- **History never stores URLs.** Entries are `{ domain, openedAt }`, validated with a strict
  schema; reading drops anything else. Turning history off deletes the file.
- **Trusted domains are normalised in main**, not just in the UI: only public registrable
  domains are accepted, inputs with credentials (`trusted.de@evil.com`) are refused, and the
  skip applies only to `ok` verdicts — never to http or any warning.
- **Settings and history IPC answer the shell only**; the viewer toolbar cannot read or change
  them.

## Clipboard (0.5.0)

- **HTML from the clipboard is never rendered.** `shared/qr/html-image.ts` only reads `<img src>`
  values; inline `data:` images in raster formats are decoded locally, SVG is refused, and size
  is capped. Images that are only _linked_ (`https:`, `cid:`, `blob:`) are reported to the user
  and never fetched.
- **Copied file references must be local.** `file://host/…` (and four-slash / `\\host` forms)
  is refused before any filesystem call: on Windows, merely `stat()`-ing a UNC path can open an
  SMB connection that leaks the user's NTLM hash (`main/file-url.ts`, unit-tested). The file
  picker is unaffected — there the user chooses the path.
- **Copied files go through the same path as the file picker** (`readInputFile`: size limit, magic
  byte sniffing, HEIC conversion). If files were copied but none is usable, nothing is decoded —
  in particular not Finder's file icon, which macOS puts on the clipboard alongside.

## Privacy

- No telemetry, analytics, crash reporting or accounts.
- Network traffic is limited to the portal URL the doctor explicitly opens and, once enabled, the
  update check against GitHub Releases (M5).
- Viewer sessions use a fresh in-memory partition per window (no `persist:`, `cache: false`) and
  are wiped on close: storage, cache, auth cache, host cache, open connections. E2E asserts the
  portal's cookie is gone after closing.
- The viewer presents itself to portals as plain Chrome (the `Electron/…` and `Arztool/…`
  user-agent tokens are removed) so portals don't refuse it; nothing identifying is added.
  Chromium keeps in-memory partitions allocated until the process exits; storage is cleared on
  close, but quitting Arztool is the only way to free them completely.
- History is off by default and, when enabled, stores only domain + timestamp (M4).

## Reporting

Report vulnerabilities privately to the maintainer, not in public issues.

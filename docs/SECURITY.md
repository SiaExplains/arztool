# Security

Arztool handles links to patient imaging results on shared clinic PCs. The threat model is:
phishing via QR codes, portal data lingering after use, and a compromised web page escalating
into the operating system.

## Electron security checklist

Status against <https://www.electronjs.org/docs/latest/tutorial/security>. "M3" etc. marks items
whose code lands with that milestone.

| #   | Recommendation                                         | How Arztool satisfies it                                                                                                                                                                                                         |
| --- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Only load secure content                               | App UI is served from the local `app://` scheme. Viewer: https opens normally, http needs explicit confirmation with a warning, every other scheme is blocked (M3).                                                              |
| 2   | No Node.js integration for remote content              | `nodeIntegration: false` and `nodeIntegrationInWorker: false` on every window; the viewer's content view has no preload at all (M3).                                                                                             |
| 3   | Context isolation                                      | `contextIsolation: true` on every window. E2E asserts `window.require` and `window.process` are undefined.                                                                                                                       |
| 4   | Process sandboxing                                     | `app.enableSandbox()` forces the sandbox on every renderer, in addition to `sandbox: true` per window.                                                                                                                           |
| 5   | Permission request handlers                            | `hardenSession()` denies every permission request, permission check and device request. Viewer partitions get the same treatment (M3).                                                                                           |
| 6   | Do not disable `webSecurity`                           | `webSecurity: true` set explicitly.                                                                                                                                                                                              |
| 7   | Content-Security-Policy                                | Strict CSP injected into the app's HTML at build time (`shared/csp.ts`): no inline script, no eval (only `wasm-unsafe-eval` for the QR decoder), `connect-src 'self'`. Unit- and E2E-tested.                                     |
| 8   | Do not enable `allowRunningInsecureContent`            | Set to `false` explicitly.                                                                                                                                                                                                       |
| 9   | Do not enable experimental features                    | `experimentalFeatures: false`.                                                                                                                                                                                                   |
| 10  | Do not use `enableBlinkFeatures`                       | Not used anywhere.                                                                                                                                                                                                               |
| 11  | `<webview>`: do not use `allowpopups`                  | `<webview>` is not used; `will-attach-webview` is cancelled globally.                                                                                                                                                            |
| 12  | Verify webview options before creation                 | Same as above — every webview attach is refused.                                                                                                                                                                                 |
| 13  | Disable or limit navigation                            | Global `will-navigate`, `will-frame-navigate` and `will-redirect` guards. Contents without a registered policy cannot navigate at all; the viewer registers its own policy (M3). E2E asserts the shell cannot be navigated away. |
| 14  | Disable or limit creation of new windows               | Global `setWindowOpenHandler` returns `deny`. The viewer allows https popups on the same registrable domain only and routes them into a viewer window (M3). E2E asserts `window.open` is blocked in the shell.                   |
| 15  | Do not use `shell.openExternal` with untrusted content | Only used by the viewer's "Open in default browser" button, for the current https/http URL only (M3).                                                                                                                            |
| 16  | Use a current version of Electron                      | Electron 44.5 (latest stable at bootstrap). Dependabot/Renovate is a follow-up.                                                                                                                                                  |
| 17  | Validate the `sender` of all IPC messages              | `main/ipc/handle.ts` rejects any frame whose URL is not `app://arztool` (or the dev server in development).                                                                                                                      |
| 18  | Avoid `file://`, prefer custom protocols               | Production UI is served from `app://arztool/` via `protocol.handle`, with path-traversal rejection (unit-tested). The protocol is registered on the default session only, so portal partitions cannot reach it.                  |
| 19  | Check which fuses you can change                       | electron-builder `electronFuses`: RunAsNode off, NODE_OPTIONS off, `--inspect` off, cookie encryption on, embedded asar integrity validation on, only-load-from-asar on, file:// extra privileges off.                           |
| 20  | Do not expose Electron APIs to untrusted web content   | The preload exposes one object with named functions; no `ipcRenderer`, no generic `invoke(channel)`. The viewer content view gets no preload (M3).                                                                               |

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

## Privacy

- No telemetry, analytics, crash reporting or accounts.
- Network traffic is limited to the portal URL the doctor explicitly opens and, once enabled, the
  update check against GitHub Releases (M5).
- Viewer sessions use a fresh in-memory partition per window and are cleared on close (M3).
  Chromium keeps in-memory partitions allocated until the process exits; storage is cleared on
  close, but quitting Arztool is the only way to free them completely.
- History is off by default and, when enabled, stores only domain + timestamp (M4).

## Reporting

Report vulnerabilities privately to the maintainer, not in public issues.

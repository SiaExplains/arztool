# Architecture

## Process model

```
┌──────────────────────── main (Node) ────────────────────────┐
│ index.ts      lifecycle, single-instance lock               │
│ security.ts   global deny-by-default guards, session perms  │
│ protocol.ts   serves out/renderer via app://arztool/        │
│ ipc/          one file per channel group; zod-validated     │
│ windows/      shell window (viewer window lands in M3)      │
└───────────────▲─────────────────────────────────────────────┘
                │ ipcRenderer.invoke (channels from shared/ipc)
┌───────────────┴──── preload (sandboxed) ────────────────────┐
│ shell.ts      contextBridge → window.arztool (typed, narrow)│
└───────────────▲─────────────────────────────────────────────┘
                │
┌───────────────┴──── renderer (React, sandboxed) ────────────┐
│ shell/        frame, navigation, (settings, about — M4)     │
│ tools/        one folder per tool + registry.ts             │
└─────────────────────────────────────────────────────────────┘
```

`src/shared/` holds code that every side may import: IPC channel names and types, IPC request
schemas (imported by main only), i18n catalogues, and the CSP builder. Anything that needs Node
lives in `src/main/`, never in `shared/`.

## IPC contract

- `shared/ipc/channels.ts` — channel names, the `IpcContract` request/response map and the
  `ArztoolApi` shape. No runtime dependencies, because the sandboxed preload bundles it.
- `shared/ipc/schemas.ts` — a zod schema per channel. A `satisfies` clause makes the build fail
  when a channel exists without a schema or when the schema drifts from the contract type.
- `main/ipc/handle.ts` — the only way to register a handler. It rejects senders that are not the
  app's own renderer and payloads that fail their schema.

Adding a channel: add it to `IpcChannel` and `IpcContract`, add its schema, register a handler
with `handle()`, expose it in the preload.

## Tools

A tool is a folder under `src/renderer/tools/` plus one entry in `tools/registry.ts`:

```ts
{ id: 'qr-viewer', titleKey: 'tools.qrViewer.title', descriptionKey: '…', Component: QrViewerTool }
```

The shell renders the list and mounts the active tool. Tools never import from each other; shared
UI goes in `renderer/shell/` once a second tool actually needs it.

## Internationalisation

German (`shared/i18n/de.json`) is the source catalogue and the default language; keys are
type-checked against it. English mirrors it. A unit test fails when key sets or interpolation
placeholders differ between catalogues.

## Build

electron-vite builds three targets into `out/`: `main/index.js`, `preload/shell.js` (CommonJS,
all dependencies inlined — sandboxed preloads may only `require('electron')`), and `renderer/`.
electron-builder packages `out/` into an asar with hardened Electron fuses.

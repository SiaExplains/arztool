# Changelog

All notable changes to Arztool are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.2.0] — 2026-10-01

### Added

- Load a patient's QR code three ways: drag an image anywhere onto the window, paste it
  (Cmd/Ctrl+V or the "Aus Zwischenablage" button), or open a file (button or Cmd/Ctrl+O).
  Pasting a file copied in Finder or Explorer works too.
- Supported inputs: PNG, JPG, WEBP, BMP, GIF, single-page PDF, and HEIC on macOS.
- QR codes are read entirely on the computer — nothing is uploaded. Small, rotated,
  low-contrast and inverted codes are handled.
- When an image has several codes, each is listed with a small preview to pick from.
- Clear results: the detected link, plain text with a copy button, or tips when no code was
  found (crop, light, resolution, angle). Every error has a plain-language message.

## [0.1.0] — 2026-10-01

### Added

- First runnable app shell: a calm sidebar with the tool list and a placeholder for the
  "QR-Befund öffnen" tool. German is the default language, English is included.
- Security baseline: every window is sandboxed and isolated, the app's own UI loads from a
  private `app://` scheme with a strict Content-Security-Policy, popups and navigation away from
  the app are blocked, and all device permissions are denied.
- Unsigned installers for macOS (universal `.dmg`) and Windows (NSIS `.exe`, x64 + arm64).
- Continuous integration on macOS and Windows: lint, typecheck, unit and end-to-end tests, and
  installers on every change; tagged versions produce a draft GitHub Release.

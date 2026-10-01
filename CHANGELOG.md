# Changelog

All notable changes to Arztool are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

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

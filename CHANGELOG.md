# Changelog

All notable changes to Arztool are documented here.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [0.6.2] — 2026-10-02

### Security

- Popups now only ever share the session of the portal the viewer was opened for. If the viewer
  is sent to a different website, that website can no longer open windows that would share the
  portal's login.

## [0.6.1] — 2026-10-02

### Security

- A popup is now opened in the viewer only if the part of the page that asked for it belongs to
  the portal. Ads or other embedded third-party content on a portal page can no longer open
  windows that share the doctor's logged-in session.

## [0.6.0] — 2026-10-02

### Added

- Updates (Settings → Updates, **off by default**): check GitHub for a newer Arztool, then
  download and restart-to-install — each step only after a click. Only GitHub is contacted, and
  no data about you or any result is sent. Unsigned builds explain that updates need a signed
  version instead of failing silently.
- Release builds can now be signed and notarized for macOS (Developer ID) and signed for Windows
  (Azure Trusted Signing or an OV/EV certificate) once the certificates are set up. Without them,
  builds work exactly as before.

### Fixed

- Settings switches now react instantly even on slower computers (the new updates switch could
  lag behind the click).

### Security

- Files downloaded in the viewer are now marked as coming from the internet (macOS quarantine,
  Windows "Mark of the Web"), so the operating system checks them before they are opened. The
  portal address is not recorded in the mark.
- Dependency updates for Electron and the build tools are proposed automatically every week.

## [0.5.0] — 2026-10-02

### Added

- Pasting a QR image copied in another app now works in more cases:
  - a selection copied from webmail, Outlook or a web page where the picture is embedded in the
    copied content;
  - several files dropped at once — the first image or PDF among them is used.
- Clearer messages when a paste cannot work:
  - the copied content only _links_ to an image on the internet — Arztool does not download
    anything for decoding, so it explains how to copy the image itself;
  - the copied file is not an image (for example when several files were copied and the first
    one is a document).

### Security

- Copied file references that point to another computer (network shares) are ignored instead
  of being opened, so pasting can never make Windows contact an untrusted server.

### Verified

- Images copied from Preview, Photos (TIFF), as JPEG or HEIC data, PDF page data, Chrome's
  "Copy image" and image files copied in Finder all paste correctly.

## [0.4.0] — 2026-10-01

### Added

- Settings page (sidebar, or Cmd/Ctrl+,):
  - **Language:** German or English. The whole app, the menus and open viewer windows switch
    immediately, and the choice is remembered.
  - **Trusted domains:** add the portals you know. Whatever is typed ("www.portal.de", a full
    address) is reduced to the domain; IP addresses, internal names and look-alike tricks are
    refused with an explanation. A "Domain vertrauen" button on the safety card adds one in a
    click.
  - **Open without asking (opt-in):** clean https links to a trusted domain open directly.
    http links and anything with a warning still ask, always. Trusting a domain from the safety card
    applies from the next scan on; it never opens the link already on screen.
  - **History (off by default):** when switched on, only the domain and time are kept — never
    the full address, which can contain access codes. Switching it off deletes it.
- About dialog with the version, from the sidebar and the app menu (macOS) / Help menu
  (Windows).

### Fixed

- A decoded result is no longer lost when visiting another page of the app and coming back.

## [0.3.0] — 2026-10-01

### Added

- Safety check before any link opens. A card shows the full address with the real domain
  highlighted, a scheme badge, and plain-language reasons for any concern.
  - `https` opens normally; `http` needs an explicit "Trotzdem öffnen".
  - `javascript:`, `data:`, `file:` and every other scheme are blocked and can only be copied.
  - Extra warnings for look-alike international domains (shown in their technical form),
    credentials hidden in front of the address, raw IP addresses and internal host names.
- Results open in a large viewer window with a read-only address bar, back/forward,
  reload, zoom (−/+/reset, also Cmd/Ctrl +/−/0), full screen and "open in default browser".
  Size and position are remembered.
- Every viewer runs in its own private, in-memory session that is wiped when the window
  closes, so nothing a portal stores stays on a shared clinic PC.
- Downloads (DICOM, ZIP, PDF) always ask where to save.
- Popups from the same portal (same domain, https) open in a viewer that shares the login;
  all other popups and links to apps like mail are blocked with a short notice.

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

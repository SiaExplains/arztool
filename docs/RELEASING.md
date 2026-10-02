# Releasing

How a signed, notarized Arztool release is produced, and what to set up once. Nothing secret is
ever committed: signing material lives only in GitHub Actions secrets.

## How signing is decided

`build/signing.cjs` reads the environment and returns one of:

| Platform | Mode                 | When                                                                    |
| -------- | -------------------- | ----------------------------------------------------------------------- |
| macOS    | `signed+notarized`   | `ARZTOOL_SIGN=1`, a Developer ID certificate and notarization secrets   |
| macOS    | `signed`             | `ARZTOOL_SIGN=1` and a certificate, but notarization secrets incomplete |
| macOS    | `ad-hoc` (default)   | everything else — local builds, PR CI, forks                            |
| Windows  | `azure`              | `ARZTOOL_SIGN=1` and the full Azure Trusted Signing set                 |
| Windows  | `certificate`        | `WIN_CSC_LINK` present (OV/EV `.pfx`)                                   |
| Windows  | `unsigned` (default) | everything else                                                         |

Only the tag-triggered release workflow sets `ARZTOOL_SIGN=1`. Missing or partial secrets never
fail the build — they downgrade with a warning in the log (`⚠ arztool signing …`). The decision is
unit-tested in `test/unit/signing.test.ts`.

## One-time setup

### macOS — Developer ID + notarization

1. Apple Developer Program membership (organisation account recommended for a medical product).
2. Create a **Developer ID Application** certificate, export it with its private key as `.p12`.
3. In App Store Connect → Users and Access → Integrations, create an **App Store Connect API key**
   with the _Developer_ role and download the `.p8` (only downloadable once).
4. Add these repository secrets:

| Secret                 | Value                                          |
| ---------------------- | ---------------------------------------------- |
| `MAC_CSC_LINK`         | `base64 -i DeveloperID.p12` (single line)      |
| `MAC_CSC_KEY_PASSWORD` | password of the `.p12`                         |
| `APPLE_API_KEY_P8`     | the full text of `AuthKey_XXXX.p8`             |
| `APPLE_API_KEY_ID`     | the key ID (`XXXX`)                            |
| `APPLE_API_ISSUER`     | the issuer ID (UUID shown above the keys list) |

The API key is the recommended route. As an alternative, `APPLE_ID`, `APPLE_APP_SPECIFIC_PASSWORD`
and `APPLE_TEAM_ID` work too.

Signed builds use the hardened runtime with a single entitlement, `com.apple.security.cs.allow-jit`
(`build/entitlements.mac.plist`) — V8 needs it; nothing else (camera, microphone, files) is asked
for.

### Windows — Azure Trusted Signing (preferred)

1. In Azure, create a **Trusted Signing account**, complete identity validation and create a
   **public trust certificate profile**.
2. Create an app registration (service principal) with the role _Trusted Signing Certificate
   Profile Signer_ on that account.
3. Add these repository secrets:

| Secret                       | Value                                                     |
| ---------------------------- | --------------------------------------------------------- |
| `AZURE_TENANT_ID`            | directory (tenant) ID                                     |
| `AZURE_CLIENT_ID`            | app registration client ID                                |
| `AZURE_CLIENT_SECRET`        | a client secret of that registration                      |
| `AZURE_SIGNING_ENDPOINT`     | e.g. `https://weu.codesigning.azure.net` (your region)    |
| `AZURE_SIGNING_ACCOUNT`      | Trusted Signing account name                              |
| `AZURE_SIGNING_CERT_PROFILE` | certificate profile name                                  |
| `AZURE_SIGNING_PUBLISHER`    | publisher name exactly as in the certificate subject (CN) |

**Alternative — OV/EV certificate:** set `WIN_CSC_LINK` (base64 `.pfx`) and `WIN_CSC_KEY_PASSWORD`
instead. EV certificates on hardware tokens cannot be used from hosted runners.

## Cutting a release

```bash
# 1. On main, with the version already bumped in package.json and CHANGELOG.md
git tag v0.6.0
git push origin v0.6.0
```

The **Release** workflow then, on macOS and Windows:

1. checks the tag matches `package.json`,
2. runs lint, typecheck, unit and E2E tests,
3. builds, signs/notarizes (as far as secrets allow) and uploads to a **draft** GitHub Release:
   `.dmg` + `.zip` + `latest-mac.yml` (macOS), `.exe` + `latest.yml` (Windows),
4. prints the signature status (`codesign`/`spctl`, `Get-AuthenticodeSignature`).

Review the draft (notes, files, the signature report in the workflow log), then publish it. Only a
**published** release is visible to the in-app update check.

## Verifying a build by hand

```bash
codesign --verify --deep --strict --verbose=2 /Applications/Arztool.app
spctl -a -vvv -t exec /Applications/Arztool.app   # "accepted, source=Notarized Developer ID"
xcrun stapler validate /Applications/Arztool.app
```

```powershell
Get-AuthenticodeSignature .\Arztool-Setup-0.6.0.exe | Format-List Status,SignerCertificate
```

## Auto-update

- electron-updater reads the `publish` block in `electron-builder.cjs` (GitHub Releases of
  `SiaExplains/arztool`). macOS updates install from the `.zip`, not the `.dmg`.
- The check is **off by default** and opt-in in Settings → Updates; downloading and installing each
  need a click. Unsigned macOS builds cannot install updates (Squirrel.Mac requires a valid
  signature) — the app says so instead of failing silently.
- Once releases are signed and notarized, consider switching the default to "check at start-up"
  (`DEFAULT_SETTINGS.updateCheck` in `src/shared/settings.ts`) and record it in DECISIONS.

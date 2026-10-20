# NorthGroup ONE security policy

NorthGroup ONE handles Microsoft work information, field records, photographs, coordinates and shared job files. Security changes must preserve field usability while keeping credentials and private files inside narrow, reviewable boundaries.

## Security boundaries

- Microsoft sign-in uses the OAuth authorization-code flow with PKCE. The mobile app is a public client and must never contain a Microsoft client secret.
- Microsoft sessions are stored only through Expo SecureStore using a device-bound Keychain policy that requires an iPhone passcode. Removing the passcode invalidates the stored session.
- `src/services/sync/graphClient.js` is the only JSON Microsoft Graph bearer-token boundary.
- `src/services/sync/graphFileTransfer.js` is the only binary Microsoft Graph bearer-token boundary.
- Feature code must pass Graph paths to those services. It must not construct an `Authorization: Bearer` header.
- Caller-provided authorization, cookie, proxy authorization and host headers are discarded case-insensitively before the app attaches its own bearer token.
- Preauthenticated Microsoft download and upload-session URLs must use HTTPS, contain no embedded credentials and must never receive the Graph bearer token.
- Preauthenticated transfer links are restricted to Microsoft OneDrive and SharePoint HTTPS hosts on the standard port; loopback, link-local, private-network, IPv6-literal and unrelated domains are rejected.
- SharePoint and Teams browser links are allowlisted before leaving the app.
- Downloaded previews, upload chunks and temporary shares are private cache files. They are deleted after use where possible and all private caches are cleared at Microsoft sign-out.
- Embedded WebViews use the minimum navigation, storage, JavaScript and local-file access required by their feature.
- iOS App Transport Security rejects arbitrary, media, WebView and local-network clear-text loads. Android application backups are disabled.
- iOS user-created files use complete data protection and are inaccessible while the phone is locked.
- The app-switcher snapshot is covered whenever the application becomes inactive or enters the background.

## Data handling rules

1. Do not log access tokens, refresh tokens, authorization codes, signed Microsoft URLs, form answers, coordinates or file contents.
2. Do not place secrets in `app.json`, `app.config.js`, JavaScript source, Git history or update ZIP files.
3. Do not store Microsoft sessions or sensitive cached files in AsyncStorage.
4. Validate local file existence, measured size and safe filename before upload.
5. Use ETags or another explicit conflict rule for shared records that multiple job members can edit.
6. Treat all remote URLs and Microsoft response fields as untrusted input until validated.
7. Keep iOS document-container sharing disabled. Export only through deliberate in-app share actions.
8. Use cryptographically secure UUIDs for record, upload, notification and attachment identifiers. `Math.random()` is allowed only for non-security UI timing or display variation.
9. Keep dependency versions exact, install from `package-lock.json`, and do not enable dependency lifecycle scripts without reviewing the package and the reason.

## Microsoft permissions

The app currently requests delegated Microsoft permissions required by its Teams, Shifts, SharePoint and Job Chat features. Redundant lower-level scopes are intentionally omitted.

`Files.ReadWrite.All` and `Sites.Read.All` remain high-impact permissions. Migrating the Entra registration to site-specific least privilege is a separate administrator-controlled change and must be tested against Job Files, shared briefs, KML, progress, accommodation and photo uploads before release.

## Release gate

Every checkpoint must pass:

```text
npm ci --ignore-scripts
npm run validate
npx expo-doctor
npx expo export --platform ios
```

The project checker enforces resolved Expo configuration, import reachability, no circular imports, shared-service dependency direction, module-size budgets, central bearer-token ownership, HTTPS-only source addresses, redacted production logging, exact dependencies, secret-pattern scanning, WebView guards, release identity and critical document-layout invariants. The automated test suite covers business rules, account/job isolation, conflicts and security boundaries.

The dependency audit currently blocks critical advisories. High or moderate advisories inherited through an Expo SDK must be reviewed during each incremental SDK upgrade and must not be hidden with unsupported package overrides.

## Reporting a security issue

Do not post credentials, signed links, employee records or job data in a public issue. Record the installed release ID from **Profile Settings → App & diagnostics**, sign out of Microsoft if exposure is suspected, and report the issue privately to the NorthGroup application owner and Microsoft 365 administrator.

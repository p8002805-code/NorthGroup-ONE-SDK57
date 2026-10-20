# NorthGroup ONE release workflow

Use one canonical project folder for all development. Do not apply a new changed-files ZIP to an older copied project.

## Before each release or testing build

1. Update only `release.json`:
   - `version`: user-facing app version.
   - `buildNumber`: source build number for local/development identification.
   - `releaseId`: dated checkpoint such as `2026.08.10-beta.1`.
   - `revision`: short unique change identifier.
   - `releasedAt` and `summary`.
2. Run `npm run validate`. This performs the structural project check and automated regression tests.
3. Run `npm audit --omit=dev --audit-level=critical`, `npx expo-doctor` and an iOS export before distribution.
4. Commit the working checkpoint to Git with the release ID in the commit message.
5. Restart Expo with `npx expo start --tunnel --clear` for JavaScript testing.
6. For iPhone field testing, prefer an EAS development/preview build over Expo Go. The production EAS profile controls its own auto-incrementing store build number.

`app.config.js` reads `release.json` automatically. The in-app Diagnostics screen reads the same release stamp and also shows the actual installed native build where available.

## Create a changed-files ZIP

After reviewing the Git diff, run:

```text
npm run package:update -- --name short-update-name
```

The command packages the tracked Git diff plus untracked project files, excludes local/build folders, and creates `_updates/NorthGroup-ONE-<release>-<name>-changed-files.zip` with a `CHANGE_MANIFEST.txt` inside.

To package an exact reviewed list instead:

```text
npm run package:update -- --name short-update-name --files App.js src/path/File.js
```

Always open the manifest, confirm the file list and run `npm run validate` before distributing the ZIP.

## Field issue reports

Open **Profile Settings → App & diagnostics**, then use **Copy diagnostics report**. Include that report with screenshots or recordings so the exact running release, runtime, account context and active job can be identified.

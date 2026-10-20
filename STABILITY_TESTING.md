# NorthGroup ONE stability testing

This checklist is the release gate for development and field builds. Record the release ID from **Profile Settings → App & diagnostics** before testing.

## Automated release gate

After `npm install`, run:

```text
npm run validate
```

This command performs the structural project check and the automated regression suite. Do not distribute a changed-files ZIP if either stage fails.

The automated suite protects:

- resolved Expo native privacy settings and the central Microsoft bearer-token transfer boundary.
- trusted Microsoft Graph, SharePoint, Teams and BOM navigation rules.
- import reachability and the no-circular-import architecture rule.
- KML nested layers, coordinate round trips, edits, moves, styles and deletion.
- Progress completion, `SX12`-style matching and duplicate nested-layer isolation.
- SharePoint progress ETag conflict handling.
- S-500 daily rollover and completion rules.
- SE-14 checklist migration, measurement tolerance, completion, sorting and archive/restore.
- Form status isolation by job.
- Job Chat outbox queue recovery and isolation.
- Photo date grouping, initials and form export filenames.
- Recently opened SharePoint file context.
- Shared Microsoft retry safety, error classification and account-isolated sync history.

## iPhone field-test matrix

Run the high-risk checks on one smaller iPhone and one larger iPhone when available. Use an EAS development or preview build for the release decision; Expo Go is suitable for quick visual checks only.

Test every applicable workflow in:

- Portrait and landscape.
- Online, poor connection and offline/airplane mode.
- Fresh launch, background/resume and force-close/reopen.
- Light and dark appearance.
- One user and two users editing the same shared job.

## Required manual checks

### Build and account

- [ ] Diagnostics shows the expected release ID, version, build and runtime.
- [ ] A new security release asks for Microsoft sign-in once, then reuses the protected session normally.
- [ ] Microsoft sign-in, token refresh and sign-out work.
- [ ] Signing out clears locally downloaded Job Files and previews.
- [ ] Active job and SharePoint status are correct.
- [ ] Copied diagnostics report matches the screen.

### Shared synchronisation

- [ ] Diagnostics shows the shared synchronisation system as Ready after a successful Microsoft action.
- [ ] Job Files, Progress, KML, Teams Shifts, Job Chat and Teams channels appear in Feature Sync History after use.
- [ ] A failed request records a useful issue without clearing the last successful sync time.
- [ ] Returning online allows a safe read to succeed without duplicating a file, chat or record.
- [ ] Progress and KML simultaneous saves still produce their existing conflict warning.
- [ ] Signing into a different Microsoft account does not show the previous account's sync history.
- [ ] Opening a new job creates one `NorthGroup ONE App Data` folder and one `Sections` child, even when several users open it together.
- [ ] A legacy root-level Overview, Progress or Accommodation JSON still loads; its next save creates the matching App Data file without deleting the legacy source.
- [ ] A second user sees the migrated App Data value and no duplicate App Data folders or section files are created.

### Navigation and shared UI

- [ ] Dashboard and Job Workspace expanded/collapsed headers align correctly.
- [ ] Bottom navigation returns to the expected screen without stale loading states.
- [ ] Native back behaviour returns to the exact parent screen/folder.
- [ ] No custom gesture blocks normal vertical scrolling.

### Job Files and PDFs

- [ ] Open nested folders, then return to each exact parent folder.
- [ ] Open a PDF; PREV/NEXT are the only document navigation controls.
- [ ] Horizontal swipes do not open a loading/history screen.
- [ ] Full-screen close/back returns to the PDF's containing folder.
- [ ] Create, rename, move, download/share and delete actions report success or a useful error.
- [ ] The internal `NorthGroup ONE App Data` folder does not appear in the crew-facing Job Files list.

### KML and Progress

- [ ] KML/KMZ opens with the expected folders, pins, lines, polygons and coordinates.
- [ ] Rename, recolour, reshape, move, hide and delete a test feature; save and reopen it.
- [ ] Compare at least one survey coordinate before and after the round trip.
- [ ] Complete a linked Progress task on User A; User B sees the matching layer hide.
- [ ] Reduce the task below target; the layer becomes visible again.
- [ ] Simultaneous saves produce a conflict warning instead of overwriting newer work.

### Forms and GNSS

- [ ] S-500 autosaves and reloads for the same day.
- [ ] At local midnight, or after reopening the next day, the S-500 is cleared for the new day.
- [ ] S-500 completion, initials and PDF filename are correct.
- [ ] SE-14 start/end validation does not advance on partial measurements.
- [ ] Save Progress works; completed sessions group and sort newest first.
- [ ] Archive, restore, export, SharePoint upload and typed DELETE confirmation work.
- [ ] S-500 PDF remains exactly two pages with no blank navy pages.

### Photo capture

- [ ] Capture, review and inspect work in portrait and landscape.
- [ ] Landscape controls do not cover the camera subject or iPhone safe areas.
- [ ] Inspector X and swipe-down dismissal both work.
- [ ] Tap hides photo metadata/actions; changing photo restores them.
- [ ] Photo ID, point ID, local capture date, GPS and EXIF survive save/export/upload.
- [ ] Gallery can open several different photos without a black loading screen.

### Offline and recovery

- [ ] Offline actions clearly state whether they are saved locally or queued.
- [ ] Job Chat pending items survive force-close and resume from queued state.
- [ ] Reconnecting retries safely without creating duplicate records/files.
- [ ] Expired Microsoft access produces a recoverable sign-in prompt.
- [ ] Diagnostics clearly distinguishes a connection timeout from sign-in, permission and version-conflict failures.

## Issue report template

For every failure, attach:

1. The copied Diagnostics report.
2. The checklist section and failed item.
3. Exact steps starting from app launch.
4. Expected and actual result.
5. Screenshot or screen recording.
6. Device model, iOS version, orientation and connection state.

# NorthGroup ONE shared synchronisation

NorthGroup ONE uses one common Microsoft synchronisation foundation without changing the data model of each field feature.

## Responsibilities

`src/services/sync/graphClient.js` owns:

- Microsoft Graph root and standard request headers.
- A 20-second request timeout.
- safe retry handling for network interruptions, throttling and temporary Microsoft server failures.
- `Retry-After` support and short exponential backoff.
- shared pagination for Microsoft collections.
- consistent response and error handling.

`src/services/sync/graphFileTransfer.js` owns authenticated binary uploads and downloads. It validates the Microsoft Graph origin before attaching a bearer token and ignores caller-supplied authorization headers. Feature services are not permitted to construct bearer headers themselves.

`src/services/sync/syncRules.js` owns the pure retry, delay and error-classification rules.

`src/services/sync/syncState.js` owns account-isolated status history:

- active operations;
- last success and failure;
- retry totals;
- per-feature history; and
- a short diagnostic event history.

## Feature adapters

Existing feature services remain responsible for their own business and conflict rules:

- Job Files and photo/form uploads retain SharePoint folder and filename rules.
- Job workspace JSON is stored beneath `NorthGroup ONE App Data`; section documents are stored beneath its `Sections` child folder.
- Job Progress retains ETag conflict recovery.
- KML retains version conflict protection and KML/KMZ round-trip logic.
- Job Chat retains its durable outbox and attachment cancellation/recovery.
- Teams Shifts and Teams channels retain their permission-specific messages.

This separation prevents a generic network layer from weakening feature-specific data safety.

## Per-job app data

Opening a job workspace resolves its SharePoint job folder and safely creates this internal hierarchy when missing:

```text
NorthGroup ONE App Data/
  Job Details.json
  Job Hub.json
  Job Progress.json
  Accommodation.json
  Sections/
    overview.json
    <section-id>.json
```

The folder is filtered from the crew-facing Job Files list. KML/KMZ, forms, photos and ordinary job documents remain in their existing user-facing locations.

Legacy root-level JSON remains readable. A document loaded from the legacy location is written into App Data on its next successful save, after which the new location takes priority. The legacy source is not automatically deleted, avoiding destructive migration and allowing controlled rollback. Folder creation uses conflict-safe discovery so several users can open a new job at the same time without creating duplicate folders.

## Dependency direction

- Screens and feature services may depend on shared sync and security services.
- Shared sync and security services must not depend on feature screens.
- Microsoft bearer authentication exists only in `graphClient.js` and `graphFileTransfer.js`.
- Circular source imports are rejected by `npm run check`.
- New source modules have a 1,200-line ceiling. Existing oversized screens have explicit frozen budgets and should be split rather than allowed to grow.
- Preauthenticated SharePoint transfer URLs are validated separately and never receive a Graph bearer token.

## Retry safety

Automatic retries are enabled for reads. Deterministic `PUT` and `DELETE` operations can opt into idempotent retry handling. `POST` actions are never automatically repeated because doing so could create duplicate chats, messages, folders or links.

HTTP `409` and `412` conflicts are never automatically retried. The calling feature must reload or merge the latest shared version.

## Diagnostics

Open **Profile Settings → App & diagnostics** to see:

- whether a shared operation is active;
- the last successful shared sync;
- the last failure and classified reason;
- automatic retry totals;
- tracked success/failure counts; and
- status for each migrated feature.

Sync history is scoped to the signed-in Microsoft account.

## Phase boundary

This release centralises live Microsoft communication and visibility. It does not yet create a universal offline queue. Job Chat keeps its existing outbox; queued offline writes for forms, photos, Job Files, Progress and KML belong to the next offline/reliability phase, where each queued item can receive an explicit duplicate and conflict policy.

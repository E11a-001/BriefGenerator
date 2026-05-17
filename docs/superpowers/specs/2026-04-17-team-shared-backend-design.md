# Team-Shared Backend Design

## Context

The current project is a static single-page tool with three files:

- `index.html`
- `style.css`
- `app.js`

It currently stores all application state in browser `localStorage`:

- `bg_kocs`
- `bg_usecases`
- `bg_template`

The current brief editor also auto-saves on every input change by calling `saveBriefToKoc()` inside `updateBriefPreview()`. This means data persistence is implicit, local to one browser, and not shared across a team.

## Goals

This change should convert the tool from a browser-local prototype into a team-shared internal tool.

Required outcomes:

1. Team members share one common backend data store.
2. Brief editing uses an explicit save action.
3. The UI shows save state clearly: `Unsaved changes`, `Saving`, `Saved`, or `Save failed`.
4. The existing UI structure remains mostly intact to keep delivery fast.
5. The first version does not require login and does not implement role-based permissions.

## Non-Goals

The first version will not include:

- public user registration
- per-user data isolation
- role-based access control
- audit history
- collaborative real-time editing
- a full frontend rewrite

## Constraints

- Fastest path matters more than architectural purity.
- Existing HTML/CSS/JS should be reused where practical.
- The app should stop relying on `localStorage` as the source of truth.
- Because there is no login in v1, the system is suitable only for internal/private use.

## Approaches Considered

### Approach A: Frontend directly connects to Supabase

Pros:

- fastest initial integration
- no custom API server required

Cons:

- weak boundary between client and data layer
- harder to protect write access without auth
- less flexible for future validation and business rules

### Approach B: Existing frontend plus lightweight backend API

Pros:

- keeps current UI
- introduces a stable server boundary
- easier to add validation, auth, and permissions later
- still relatively fast to ship

Cons:

- more moving parts than direct database access

### Approach C: Rewrite as full-stack framework app

Pros:

- clean long-term architecture
- easiest to scale later

Cons:

- too much cost for current scope
- unnecessary delay before the team can use it

## Recommended Approach

Use Approach B:

- keep the existing static frontend
- add a lightweight backend API
- persist data in Postgres
- deploy frontend and backend separately

For database hosting, Supabase Postgres is acceptable, but the frontend should not talk to the database directly in v1.

## High-Level Architecture

### Frontend

The frontend remains a simple browser app built from:

- `index.html`
- `style.css`
- `app.js`

Changes:

- remove `localStorage` as primary persistence
- fetch initial state from the backend on page load
- save mutations through HTTP API calls
- introduce explicit save behavior in the brief editor

### Backend

A lightweight Node.js API will provide CRUD endpoints for:

- KOCs
- use cases
- KOC/use case assignments
- brief template
- briefs

The backend is responsible for:

- validating payload shape
- reading and writing database records
- returning canonical JSON for the frontend

### Database

Use Postgres with normalized tables for shared team data.

## Data Model

### `kocs`

Fields:

- `id`
- `name`
- `platform`
- `email`
- `channel_url`
- `status`
- `draft_video_url`
- `script_value`
- `final_video_url`
- `created_at`
- `updated_at`

Notes:

- deliverables can remain flattened in this table for v1
- this is faster than introducing a separate deliverables table

### `use_cases`

Fields:

- `id`
- `title`
- `description`
- `links_json`
- `created_at`
- `updated_at`

Notes:

- links may be stored as JSON array in v1 for speed

### `koc_use_cases`

Fields:

- `koc_id`
- `use_case_id`

Notes:

- join table supports many-to-many assignment

### `brief_templates`

Fields:

- `id`
- `name`
- `content`
- `created_at`
- `updated_at`

Notes:

- v1 may only use one global template row
- schema still allows multiple templates later

### `briefs`

Fields:

- `id`
- `koc_id`
- `template_id`
- `compensation`
- `currency`
- `payment_terms`
- `draft_deadline`
- `publish_deadline`
- `video_format`
- `tracking_link`
- `promo_code`
- `license`
- `notes`
- `created_at`
- `updated_at`

Notes:

- one brief per KOC in v1
- keeping brief variables as columns is simpler than storing an opaque JSON blob

## API Design

### Read endpoints

- `GET /api/bootstrap`
- `GET /api/kocs`
- `GET /api/use-cases`
- `GET /api/template`
- `GET /api/briefs/:kocId`

### Write endpoints

- `POST /api/kocs`
- `PATCH /api/kocs/:id`
- `DELETE /api/kocs/:id`
- `POST /api/use-cases`
- `DELETE /api/use-cases/:id`
- `PUT /api/kocs/:id/use-cases`
- `PUT /api/template`
- `PUT /api/briefs/:kocId`

### Bootstrap response

`GET /api/bootstrap` should return the full initial dataset needed by the frontend:

- KOCs
- use cases
- global template
- brief records

This avoids multiple round trips during initial load and is the simplest way to migrate the current frontend.

## Frontend Behavior Changes

## Brief Editor Save Flow

The brief editor should no longer save on every keystroke.

New behavior:

1. Load the current brief from backend state when the editor opens.
2. Keep a local in-memory draft while the user edits fields.
3. Mark the editor as dirty once any field differs from the last saved version.
4. Show save status in the top bar.
5. Save only when the user clicks `Save Brief`.
6. After successful save, update the saved snapshot and clear dirty state.

### Save states

Required UI states:

- `Unsaved changes`
- `Saving...`
- `Saved`
- `Save failed`

### Leaving with unsaved changes

When the user:

- closes the brief editor
- switches tabs
- refreshes the page
- attempts to leave the browser tab

the app should warn if unsaved brief changes exist.

## Other Data Mutations

For speed, non-brief changes may remain auto-persisted in v1:

- KOC create
- KOC field edits
- KOC status changes
- use case create/delete
- use case assignment changes
- template save

Only the brief editor needs to change from implicit saving to explicit saving in this phase.

This keeps scope tight and matches the user request directly.

## Migration Strategy

### Phase 1

Introduce backend and database while preserving current UI behavior wherever possible.

Steps:

1. add backend project and database schema
2. create bootstrap endpoint
3. replace initial `localStorage` load with server bootstrap load
4. replace save mutations with API calls
5. remove brief auto-save behavior
6. add explicit brief save button and save state UI

### Phase 2

Optional future additions:

- internal login
- permissions
- workspace isolation
- audit history
- better search and filters

## Error Handling

### Backend errors

If an API request fails:

- show toast feedback
- preserve unsaved brief edits in memory
- do not silently discard local changes

### Network interruptions

If save fails due to network issues:

- keep the current local editor state
- show `Save failed`
- allow the user to retry manually

### Bootstrap failures

If initial data load fails:

- show a blocking error state in the UI
- provide a retry action

## Testing Strategy

### Manual verification

- create a KOC and reload the page
- create a use case and reload the page
- assign use cases and reload the page
- save a template and reload the page
- edit a brief, confirm `Unsaved changes`, save, reload, and confirm persistence
- attempt to leave the brief editor with unsaved changes and confirm warning

### Targeted code verification

- backend payload validation for all write endpoints
- integration test for `PUT /api/briefs/:kocId`
- integration test for `GET /api/bootstrap`

## Security Note

Because v1 has no login, the backend must be treated as private/internal infrastructure.

This version should not be exposed as an open public tool without:

- authentication
- authorization
- rate limiting
- environment secret protection

## Delivery Recommendation

Implement the first version as:

- static frontend based on the current files
- lightweight Node.js API
- Postgres database

This gives the fastest path to a real shared internal tool while preserving a clean enough migration path for future auth and permission work.
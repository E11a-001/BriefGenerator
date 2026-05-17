# AI Use Case Generation Design

## Context

The current tool already supports:

- a shared `Use Case Library`
- structured use case fields
- manual create and edit flows for use cases
- brief-side use case selection and reuse

The current problem is that creating a structured use case manually is still too slow. The user wants an AI-assisted workflow that starts from a webpage link and fills the use case fields automatically.

The agreed constraints are:

1. v1 only supports ordinary webpage links
2. AI should generate a draft, not write directly into the library
3. generated content must still be editable by hand
4. final save remains manual through the existing `Save Use Case` action
5. the model provider for v1 should be `MiniMax`

This feature is intended to reduce form-filling friction without reducing editorial control.

## Goals

Required outcomes:

1. Users can paste a webpage link into the use case form.
2. Users can click `Generate with AI` to draft the structured fields.
3. The app extracts page content on the backend and sends it to `MiniMax`.
4. The AI response fills the existing use case form fields.
5. Users can review and manually edit every generated field before saving.
6. Failed extraction or generation does not block the manual workflow.

## Non-Goals

This change will not include:

- automatic saving into the shared use case library
- support for YouTube links
- support for Notion links
- support for Google Docs links
- batch generation from multiple links
- background crawling or indexing of external pages
- confidence scoring or automatic approval
- AI editing of existing saved use cases without explicit user action

## Constraints

- `MiniMax` should be called from the backend, not the frontend.
- API credentials must not be exposed in browser code.
- The frontend should preserve the current manual create/edit use case flow.
- The backend should return structured JSON suitable for direct form population.
- Failure modes must leave the form intact and usable.

## Approaches Considered

### Approach A: Direct auto-save from link to library

Pros:

- least user effort after pasting a URL

Cons:

- high risk of polluting the shared use case library with bad AI output
- removes the editorial review step
- harder to trust in a shared internal tool

### Approach B: Generate AI draft into the current use case form

Pros:

- preserves human review before save
- fits the current UI with minimal disruption
- keeps AI output controllable and reversible
- easiest to adopt operationally

Cons:

- still requires a user confirmation click to save

### Approach C: Separate AI generation page

Pros:

- creates a clean, isolated generation workflow

Cons:

- heavier UI change than needed
- duplicates the existing use case form
- unnecessary for the current scope

## Recommended Approach

Use Approach B.

Add an AI-assisted generation entry point inside the existing `Use Case Library` create/edit form:

- one input for a webpage link
- one button: `Generate with AI`
- generated content populates the form fields
- the user can edit anything
- saving remains manual

This gives the user the speed benefit of AI while keeping the final shared library under explicit human control.

## High-Level Architecture

### Frontend

The existing `Use Case Library` form gets two additions:

- `Use Case Link` input
- `Generate with AI` button

Behavior:

1. user pastes a webpage URL
2. user clicks `Generate with AI`
3. button enters loading state
4. backend returns a structured draft
5. draft values populate the existing fields:
   - `Title`
   - `Description`
   - `Best-Fit User Situation`
   - `Problem`
   - `How To Show It`
   - `Expected Outcome`
   - `Must-Show Elements`
   - `Reference Links`
6. user can modify any field
7. user clicks `Save Use Case` to persist

This flow should work for both:

- creating a new use case
- drafting values before editing and saving

For v1, AI generation should target the create form only. Extending the same action into existing use case edit mode can be added later if needed.

### Backend

Add a backend-only generation endpoint:

- `POST /api/use-cases/generate`

Request:

- `url`

Response:

- `title`
- `description`
- `who_this_is_for`
- `problem`
- `how_to_show_it`
- `expected_outcome`
- `must_show_elements`
- `links`

The endpoint should:

1. validate that the request contains an ordinary HTTP or HTTPS URL
2. fetch the webpage HTML
3. extract readable text content
4. send a structured prompt to `MiniMax`
5. parse the model output into normalized JSON
6. return the JSON draft to the frontend

The endpoint must not insert anything into the database.

## Prompting Strategy

The prompt to `MiniMax` should frame the task as:

- convert webpage content into a reusable creator brief use case
- stay concrete and business-readable
- avoid hype and unsupported claims
- keep the content oriented toward creator execution

The model should be instructed to return only JSON matching the agreed schema.

Field guidance:

- `title`: short and reusable
- `description`: one or two concise sentences
- `who_this_is_for`: describe the best-fit user situation, not just demographics
- `problem`: the user pain or workflow friction being addressed
- `how_to_show_it`: what the creator should demonstrate on screen
- `expected_outcome`: what the audience should understand after watching
- `must_show_elements`: concrete required points or visuals
- `links`: include the source URL by default, plus any relevant extracted links only if clearly useful

## Extraction Strategy

For v1, use simple server-side webpage extraction:

1. fetch the page HTML
2. strip scripts, styles, and navigation-heavy noise where practical
3. extract title and readable body text
4. truncate overly large bodies before sending to `MiniMax`

This does not need to be a full crawler. One-page extraction is enough for the current requirement.

If extraction quality is poor, the API should fail clearly rather than silently generating from junk content.

## Error Handling

### Frontend

If generation fails:

- show a toast or inline error
- keep all manually entered field values unchanged
- reset the button out of loading state

Suggested messages:

- `Could not extract page content from this link.`
- `Failed to generate use case draft.`

### Backend

Handle these cases explicitly:

- invalid URL
- unsupported protocol
- fetch failure
- empty extracted content
- malformed AI output
- `MiniMax` API failure

Return short, user-readable error messages. Avoid exposing raw provider errors to the browser.

## Data Model Impact

No schema change is required for v1.

The existing `use_cases` table already supports the fields needed for generated drafts:

- `title`
- `description`
- `who_this_is_for`
- `problem`
- `how_to_show_it`
- `expected_outcome`
- `must_show_elements`
- `links_json`

The generation endpoint is draft-only and stateless.

## UI Details

### New form controls

Add above the structured use case fields:

- `Use Case Link`
- `Generate with AI`

Recommended button states:

- default: `Generate with AI`
- loading: `Generating...`
- success: no persistent state required; form fields update
- failure: show error toast and keep current values

### Editability

After generation:

- every generated field remains editable
- users may overwrite all or part of the draft
- `Reset` should still clear the form, including AI-filled values

## Security And Operations

- keep `MiniMax` credentials server-side in environment variables
- do not expose provider keys to the browser
- log failures in a way that helps debugging without leaking secrets
- consider basic rate limiting later if this endpoint becomes heavily used

For v1, internal-only usage and modest traffic are assumed.

## Testing

### Backend tests

Add tests for:

- invalid URL rejected
- extraction failure returns a clean error
- successful generation returns normalized structured JSON
- malformed provider output is handled safely

Provider calls should be mocked in tests.

### Frontend tests or verification

Verify manually that:

- generated values populate the correct fields
- user can edit generated fields before save
- `Reset` clears generated values
- existing manual save still works
- failure states do not erase typed form content

## Rollout Plan

Phase 1:

- ordinary webpage URL only
- draft-only generation
- create form integration
- manual save remains unchanged

Future extensions, if needed:

- support more source types
- allow regeneration for existing saved use cases
- provide multiple draft variants
- add source preview or extraction preview

## Open Decisions Resolved

The following product decisions are now fixed for v1:

- provider: `MiniMax`
- input type: ordinary webpage link only
- output mode: draft into form, not direct save
- user control: generated values remain manually editable
- persistence: only the existing `Save Use Case` action writes to the database
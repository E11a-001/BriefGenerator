# Agreement And Invoice Documents Design

## Context

The current tool already supports:

- shared KOC data
- shared brief data
- brief template editing
- PDF and Word export for briefs

The next requirement is to add two additional creator-facing documents:

- `Agreement`
- `Invoice`

These documents should not be merged into the brief system. They are part of the same campaign workflow, but serve different purposes:

- `Brief` explains execution requirements
- `Agreement` captures contract terms
- `Invoice` captures billing and payment details

The user provided two source files:

- `/Users/ella/Downloads/Creator Agreement.docx`
- `/Users/ella/Downloads/Invoice template .pdf`

The desired behavior is:

1. both documents are generated from fixed templates
2. both documents are editable inside the app
3. both documents pull known values from `KOC` and `Brief` automatically
4. any missing values can be filled in manually inside each document editor
5. final export format is `PDF`

## Goals

This feature should add a lightweight document workflow to each KOC without disrupting the current brief flow.

Required outcomes:

1. Each KOC gets a `Documents` section with `Agreement` and `Invoice`.
2. `Agreement` and `Invoice` each have their own editor view.
3. Each editor uses a fixed template, not a blank document.
4. Values already known from the KOC or Brief are prefilled automatically.
5. Missing document-specific values can be edited and saved independently.
6. Each document can be exported as a readable PDF.

## Non-Goals

This change will not include:

- e-signature workflows
- legal approval workflows
- invoice payment status automation
- tax calculation logic
- external accounting integrations
- uploading arbitrary document templates per KOC
- Word export for Agreement or Invoice

## Constraints

- The existing frontend structure should be reused where practical.
- The document editors should feel consistent with the current `Brief Editor`.
- `Agreement` content should follow the provided DOCX template as the fixed source.
- `Invoice` should be rebuilt as a fixed in-app template based on the provided PDF.
- The app remains an internal/shared tool without login in this phase.

## Approaches Considered

### Approach A: Store Agreement and Invoice as file attachments only

Pros:

- fastest implementation
- minimal UI changes

Cons:

- no editable document workflow
- does not satisfy the requirement for template-based generation
- no structured data reuse from KOC and Brief

### Approach B: Add separate Agreement and Invoice editors under each KOC

Pros:

- clear separation between execution brief and legal/billing documents
- reuses current left-editor plus right-preview pattern
- scales cleanly if more document types are added later

Cons:

- more UI and backend work than attachment-only handling

### Approach C: Put Agreement and Invoice fields directly inside the KOC detail modal

Pros:

- fewer navigation changes

Cons:

- the KOC detail modal becomes crowded
- poor fit for longer document templates
- harder to maintain as templates evolve

## Recommended Approach

Use Approach B.

Add a `Documents` section to the KOC detail view with two entry points:

- `Edit Agreement`
- `Edit Invoice`

Each entry opens a dedicated editor that mirrors the current brief editing pattern:

- left side: editable variables
- right side: formatted preview
- top bar: save state and export action

This preserves conceptual separation and avoids turning the KOC modal into a multi-document form.

## High-Level Architecture

### UI structure

The KOC detail modal gets a new `Documents` section containing:

- `Edit Brief`
- `Edit Agreement`
- `Edit Invoice`

`Agreement Editor` and `Invoice Editor` should be rendered as separate tabs or document modes within the existing full-page editor shell.

The shell behavior should match the brief editor where practical:

- explicit save
- `Unsaved changes`, `Saving...`, `Saved`, `Save failed`
- leave-with-unsaved-changes warning

### Template model

#### Agreement

Use the existing creator agreement DOCX as the fixed content source.

The template itself is not freeform-user-editable in v1. Instead:

- the app stores a normalized agreement template string in the backend
- dynamic placeholders are inserted for editable fields
- the preview renders the final document with those placeholders resolved

This keeps the agreement content stable while still allowing per-KOC edits to variable fields.

#### Invoice

The provided PDF acts as a visual/content reference only.

For v1:

- rebuild the invoice as a fixed in-app template
- define explicit editable fields for billing details
- render it in the same document preview system

This is necessary because the source PDF is not suitable as a directly editable template.

### Persistence model

Agreement and Invoice should be stored independently from briefs.

They are related to the same campaign, but should not share the `briefs` table because:

- their fields differ materially
- their save cadence differs
- they may need separate status or template versioning later

## Data Model

### `agreements`

Fields:

- `id`
- `koc_id`
- `template_version`
- `field_values_json`
- `created_at`
- `updated_at`

Notes:

- one agreement row per KOC in v1
- `field_values_json` is acceptable here because agreement fields are semi-structured and template-specific
- template version should default to a stable string such as `agreement_v1`

### `invoices`

Fields:

- `id`
- `koc_id`
- `template_version`
- `field_values_json`
- `created_at`
- `updated_at`

Notes:

- one invoice row per KOC in v1
- JSON storage is acceptable because invoice-specific fields are isolated from brief logic
- template version should default to a stable string such as `invoice_v1`

## Data Flow

### Prefill rules

When opening an Agreement or Invoice editor, the app should:

1. load the KOC record
2. load the related brief record, if present
3. load the saved document row, if present
4. build initial editor values using this precedence:
   - saved document values
   - derived values from KOC/Brief
   - hardcoded defaults for fixed template fields

This preserves user edits while still auto-filling new documents from shared campaign data.

### Derived values

The first version should derive values such as:

- creator name
- creator email
- channel or profile URL
- platform
- script date
- draft date
- launch date
- fee or total fee
- promotional license text
- use case related references where relevant

The document editor should also expose document-only fields that cannot be inferred, such as:

- sponsor or client entity
- signature block values
- invoice number
- invoice issue date
- billing address
- banking or payment recipient details

## API Design

### Read endpoints

- `GET /api/agreements/:kocId`
- `GET /api/invoices/:kocId`

Each endpoint should return:

- saved document values if present
- document metadata
- enough information for the frontend to merge with derived defaults

### Write endpoints

- `PUT /api/agreements/:kocId`
- `PUT /api/invoices/:kocId`

Each write endpoint should:

- upsert the document row
- store only the document-specific editable fields
- return the saved row

## Editor Design

### Agreement editor

The agreement editor should focus on contract variables, not freeform rewriting of the whole document.

Left-side fields should include:

- client or sponsor name
- channel or talent name
- script date
- draft date
- launch date
- fee
- total fee
- promotional license enforceable yes/no
- promotional license duration
- promotional license region
- additional info
- talent legal name
- talent representative if needed
- talent email
- talent address
- agency name
- agency representative
- agency email
- agency address
- appendix or deliverable rows if they need explicit per-deal edits

The right preview should preserve the fixed agreement text and slot these values into the template.

### Invoice editor

The invoice editor should focus on billing variables.

Left-side fields should include:

- invoice number
- issue date
- due date
- billed-to entity
- creator payee name
- creator payee email
- creator billing address
- payment method
- payment details
- line items
- subtotal
- fees or deductions
- total amount due
- notes

The invoice preview should look like a proper invoice document rather than a webpage card.

## Preview And Export Rules

Agreement and Invoice should use the same document-oriented rendering principles already being introduced for Brief:

- serif heading treatment
- sans-serif body text
- readable line spacing
- clean margins
- PDF-first output

Preview behavior:

- empty optional values should be hidden cleanly
- fixed legal or billing boilerplate should remain visible
- exported PDF should closely match the preview layout

## Error Handling

The editors should handle:

- missing brief data by falling back to blank but editable fields
- save failures by preserving unsaved draft values in memory
- export attempts before save by either auto-saving first or warning clearly

For v1, it is acceptable to require users to save before exporting if that is simpler and explicit in the UI.

## Testing

At minimum, implementation should verify:

1. opening Agreement/Invoice for a KOC with existing brief data prefills expected fields
2. saving Agreement persists document-specific values
3. saving Invoice persists document-specific values
4. reopening either editor restores saved overrides
5. export renders a readable PDF without empty placeholder text

## Rollout Notes

This feature should be implemented incrementally:

1. add persistence tables and APIs
2. add document entry points in the KOC modal
3. implement Agreement editor
4. implement Invoice editor
5. refine PDF export formatting

This ordering keeps the feature shippable in stages and avoids coupling agreement and invoice logic to the existing brief editor internals more than necessary.
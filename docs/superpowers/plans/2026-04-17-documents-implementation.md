# Agreement And Invoice Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-KOC Agreement and Invoice document workflows with fixed templates, editable field panels, shared-data prefills, persistent saves, and PDF export.

**Architecture:** Extend the current KOC-centered app with two new document resources: `agreements` and `invoices`. Add dedicated API routes and persistence tables, then reuse the existing editor-shell pattern so each document has a left-side variable form, a right-side preview, explicit save state, and PDF export.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js, Express, PostgreSQL, `node:test`

---

## File Structure

### Existing files to modify

- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`
- Modify: `server/app.js`
- Modify: `server/sql/schema.sql`

### New backend files

- Create: `server/routes/agreements.js`
- Create: `server/routes/invoices.js`

### New tests

- Create: `tests/api/agreements.test.js`
- Create: `tests/api/invoices.test.js`

### Responsibility boundaries

- `server/routes/agreements.js` owns agreement read/save behavior only.
- `server/routes/invoices.js` owns invoice read/save behavior only.
- `public/app.js` handles document navigation, prefills, dirty-state tracking, rendering, and export.
- `public/index.html` only adds document entry points and document editor shell markup.
- `public/style.css` only adds the UI needed for document editors and previews.

## Task 1: Add Agreement And Invoice Persistence

**Files:**
- Modify: `server/sql/schema.sql`
- Create: `server/routes/agreements.js`
- Create: `server/routes/invoices.js`
- Modify: `server/app.js`
- Test: `tests/api/agreements.test.js`
- Test: `tests/api/invoices.test.js`

- [ ] **Step 1: Write failing API tests for agreement and invoice upsert/read**

Add tests that verify:

- `GET /api/agreements/:kocId` returns `null` or an empty payload when no record exists
- `PUT /api/agreements/:kocId` stores `template_version` and `field_values_json`
- `GET /api/invoices/:kocId` returns `null` or an empty payload when no record exists
- `PUT /api/invoices/:kocId` stores `template_version` and `field_values_json`

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL because agreement/invoice routes and tables do not exist.

- [ ] **Step 3: Add schema and routes**

Extend `server/sql/schema.sql` with:

- `agreements`
- `invoices`

Use this shape for both:

```sql
create table if not exists agreements (
  id text primary key,
  koc_id text not null unique references kocs(id) on delete cascade,
  template_version text not null,
  field_values_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

```sql
create table if not exists invoices (
  id text primary key,
  koc_id text not null unique references kocs(id) on delete cascade,
  template_version text not null,
  field_values_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Add:

- `GET /api/agreements/:kocId`
- `PUT /api/agreements/:kocId`
- `GET /api/invoices/:kocId`
- `PUT /api/invoices/:kocId`

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for agreement/invoice API tests.

- [ ] **Step 5: Commit**

```bash
git add server/sql/schema.sql server/app.js server/routes/agreements.js server/routes/invoices.js tests/api/agreements.test.js tests/api/invoices.test.js
git commit -m "feat: add agreement and invoice persistence"
```

## Task 2: Add Document Entry Points To KOC Detail

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add a failing UI-level regression test or checklist**

Because this app does not yet have browser automation tests, add a manual verification checklist to the implementation notes:

- KOC detail shows `Documents`
- user can click `Edit Agreement`
- user can click `Edit Invoice`

- [ ] **Step 2: Add document buttons to the KOC modal**

In `renderKocDetail()`, add a `Documents` section with:

- `Edit Brief`
- `Edit Agreement`
- `Edit Invoice`

Do not remove the existing brief entry point.

- [ ] **Step 3: Add minimal styling**

Ensure the new section matches the current detail modal styling and does not crowd the modal.

- [ ] **Step 4: Verify manually**

Run: `open http://127.0.0.1:3000/`
Expected: KOC modal shows a dedicated `Documents` section with all three document entry points.

- [ ] **Step 5: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: add document entry points to koc detail"
```

## Task 3: Build Agreement Editor

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Add a failing agreement prefill test or fixture check**

Add a focused API or unit-style test that verifies the frontend agreement prefill helper prefers:

1. saved agreement values
2. brief values
3. KOC values

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL because agreement prefill helpers do not exist.

- [ ] **Step 3: Add agreement editor shell and prefill logic**

In `public/index.html` and `public/app.js`:

- add a document mode for `agreement`
- add left-side agreement fields
- add a right-side agreement preview container
- add save state, save button, and export PDF button

Agreement fields should include:

- sponsor/client
- channel/talent
- script date
- draft date
- launch date
- fee
- total fee
- license enforceable yes/no
- license duration
- license region
- additional info
- talent legal name
- talent email
- talent address
- agency fields

Use the fixed agreement content source and render placeholders into it.

- [ ] **Step 4: Run tests and verify manually**

Run: `npm test`
Expected: PASS

Manual check:

- open a KOC with brief data
- click `Edit Agreement`
- verify fields prefill from KOC/Brief
- save, close, and reopen
- verify saved values persist

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: add agreement editor"
```

## Task 4: Build Invoice Editor

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Add a failing invoice prefill test or fixture check**

Add a focused test for invoice prefills and saved override precedence.

- [ ] **Step 2: Run tests to verify failure**

Run: `npm test`
Expected: FAIL because invoice prefill helpers do not exist.

- [ ] **Step 3: Add invoice editor and fixed template rendering**

Implement:

- `invoice` document mode
- invoice field panel
- invoice preview
- save and dirty-state behavior

Invoice fields should include:

- invoice number
- issue date
- due date
- billed-to entity
- payee name
- payee email
- billing address
- payment method
- payment details
- line items
- subtotal
- fees/deductions
- total amount
- notes

The invoice should be rebuilt as a clean fixed layout based on the provided PDF reference, not as a raw PDF embed.

- [ ] **Step 4: Run tests and verify manually**

Run: `npm test`
Expected: PASS

Manual check:

- open `Edit Invoice`
- verify shared values prefill where expected
- save, reopen, and verify persistence

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: add invoice editor"
```

## Task 5: Add PDF Export For Agreement And Invoice

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`

- [ ] **Step 1: Add a failing export behavior checklist**

Manual checks must verify:

- Agreement export does not show raw placeholder tokens
- Invoice export does not show blank optional rows
- PDF layout is readable and document-like

- [ ] **Step 2: Implement export wiring**

Reuse the current HTML-to-PDF pipeline, but make the document previews export-specific:

- document margins
- stable typography
- hidden empty optional rows
- correct filenames such as `creator-name-agreement.pdf` and `creator-name-invoice.pdf`

- [ ] **Step 3: Verify manually**

Run: `open http://127.0.0.1:3000/`

Export:

- one Agreement PDF
- one Invoice PDF

Expected:

- readable PDF layout
- no empty placeholders
- no obvious web-app styling artifacts

- [ ] **Step 4: Run full verification**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add public/app.js public/style.css
git commit -m "feat: add agreement and invoice pdf export"
```

## Task 6: Final Integration Verification

**Files:**
- Modify: `public/app.js`
- Modify: `public/style.css`
- Modify: `public/index.html`
- Modify: `server/routes/agreements.js`
- Modify: `server/routes/invoices.js`

- [ ] **Step 1: Run schema update**

Run: `source .env; /opt/homebrew/opt/postgresql@16/bin/psql "$DATABASE_URL" -f server/sql/schema.sql`
Expected: agreement and invoice tables created or already present.

- [ ] **Step 2: Run automated tests**

Run: `npm test`
Expected: all tests pass.

- [ ] **Step 3: Run end-to-end manual verification**

Manual checklist:

- create/open a KOC
- open `Edit Agreement`
- confirm prefilled values
- save agreement
- reopen and verify persistence
- export Agreement PDF
- open `Edit Invoice`
- confirm prefilled values
- save invoice
- reopen and verify persistence
- export Invoice PDF

- [ ] **Step 4: Restart app and verify shared persistence**

Run: `node server/app.js`
Expected: app starts cleanly and restored documents remain available after reload.

- [ ] **Step 5: Commit**

```bash
git add public/index.html public/style.css public/app.js server/app.js server/sql/schema.sql server/routes/agreements.js server/routes/invoices.js tests/api/agreements.test.js tests/api/invoices.test.js
git commit -m "feat: add agreement and invoice document workflows"
```
# Team-Shared Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the current browser-local brief generator into an internal team-shared tool with a real backend, database persistence, and explicit brief saving with visible save state.

**Architecture:** Keep the existing browser UI, but move it into a small static frontend served from `public/`. Add a lightweight Express API in `server/` backed by Postgres. Replace `localStorage` bootstrapping with a single `/api/bootstrap` read, keep non-brief mutations auto-persisted through API calls, and change the brief editor to explicit save with dirty-state tracking.

**Tech Stack:** HTML, CSS, vanilla JavaScript, Node.js, Express, pg, PostgreSQL, node:test, supertest

---

## File Structure

### Existing files to preserve as source material

- Modify: `_home_user_.workspace_projects_brief-generator_index.html`
- Modify: `_home_user_.workspace_projects_brief-generator_style.css`
- Modify: `_home_user_.workspace_projects_brief-generator_app.js`

### New runtime structure

- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`
- Create: `server/app.js`
- Create: `server/db.js`
- Create: `server/config.js`
- Create: `server/routes/bootstrap.js`
- Create: `server/routes/kocs.js`
- Create: `server/routes/use-cases.js`
- Create: `server/routes/template.js`
- Create: `server/routes/briefs.js`
- Create: `server/sql/schema.sql`
- Create: `tests/api/bootstrap.test.js`
- Create: `tests/api/briefs.test.js`

### Responsibility boundaries

- `public/*` holds the browser app only.
- `server/app.js` wires middleware and routes.
- `server/db.js` owns Postgres access.
- `server/routes/*` keeps each resource focused.
- `server/sql/schema.sql` is the source of truth for schema creation.
- `tests/api/*` verifies server behavior independently of the browser.

### Important scope rule

Do not keep `_home_user_.workspace_projects_brief-generator_*.{html,css,js}` as the deployed runtime entrypoint. Use them as migration source only, then run from `public/`.

### Environment note

This directory is currently not a git repository. Commit steps are still included so the plan stays complete, but if `.git/` is still absent during execution, initialize git first or skip commit commands deliberately.

## Task 1: Scaffold Node App And Static Frontend Layout

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `public/index.html`
- Create: `public/style.css`
- Create: `public/app.js`
- Modify: `_home_user_.workspace_projects_brief-generator_index.html`
- Modify: `_home_user_.workspace_projects_brief-generator_style.css`
- Modify: `_home_user_.workspace_projects_brief-generator_app.js`

- [ ] **Step 1: Write the failing filesystem expectation**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';

test('public app scaffold exists', () => {
  assert.equal(existsSync('public/index.html'), true);
  assert.equal(existsSync('public/style.css'), true);
  assert.equal(existsSync('public/app.js'), true);
  assert.equal(existsSync('package.json'), true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test`
Expected: FAIL because `public/index.html` and `package.json` do not exist.

- [ ] **Step 3: Create the package manifest and static layout**

```json
{
  "name": "brief-generator",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node server/app.js",
    "start": "node server/app.js",
    "test": "node --test"
  },
  "dependencies": {
    "express": "^4.21.2",
    "pg": "^8.13.3"
  },
  "devDependencies": {
    "supertest": "^7.0.0"
  }
}
```

```gitignore
node_modules
.env
coverage
```

```env
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/brief_generator
PORT=3000
```

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MoClaw Brief Generator</title>
  <link href="https://fonts.googleapis.com/css2?family=Schibsted+Grotesk:wght@400;500;600;700&family=Source+Serif+4:wght@400;600;700&display=swap" rel="stylesheet">
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js"></script>
  <link rel="stylesheet" href="/style.css">
</head>
<body>
  <script src="/app.js"></script>
</body>
</html>
```

```bash
cp '_home_user_.workspace_projects_brief-generator_index.html' public/index.html
cp '_home_user_.workspace_projects_brief-generator_style.css' public/style.css
cp '_home_user_.workspace_projects_brief-generator_app.js' public/app.js
```

Then update `public/index.html` so:

- `<link rel="stylesheet" href="style.css">` becomes `<link rel="stylesheet" href="/style.css">`
- `<script src="app.js"></script>` becomes `<script src="/app.js"></script>`

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test`
Expected: PASS for scaffold existence check.

- [ ] **Step 5: Commit**

```bash
git add package.json .gitignore .env.example public/index.html public/style.css public/app.js
git commit -m "chore: scaffold static frontend and node app"
```

## Task 2: Add Database Schema And Server Bootstrap

**Files:**
- Create: `server/app.js`
- Create: `server/config.js`
- Create: `server/db.js`
- Create: `server/sql/schema.sql`
- Test: `tests/api/bootstrap.test.js`

- [ ] **Step 1: Write the failing server bootstrap test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../server/app.js';

test('GET /api/bootstrap returns empty shared payload', async () => {
  const app = createApp({
    db: {
      query: async () => ({ rows: [] })
    }
  });

  const response = await request(app).get('/api/bootstrap');

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.body, {
    kocs: [],
    useCases: [],
    template: null,
    briefs: []
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="bootstrap"`
Expected: FAIL because `server/app.js` does not exist.

- [ ] **Step 3: Write minimal server and schema implementation**

```js
// server/config.js
export function getConfig() {
  return {
    port: Number(process.env.PORT || 3000),
    databaseUrl: process.env.DATABASE_URL || ''
  };
}
```

```js
// server/db.js
import pg from 'pg';
const { Pool } = pg;

export function createDb(databaseUrl) {
  return new Pool({ connectionString: databaseUrl });
}
```

```sql
-- server/sql/schema.sql
create table if not exists kocs (
  id text primary key,
  name text not null,
  platform text not null,
  email text not null default '',
  channel_url text not null default '',
  status text not null,
  draft_video_url text not null default '',
  script_value text not null default '',
  final_video_url text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists use_cases (
  id text primary key,
  title text not null,
  description text not null default '',
  links_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists koc_use_cases (
  koc_id text not null references kocs(id) on delete cascade,
  use_case_id text not null references use_cases(id) on delete cascade,
  primary key (koc_id, use_case_id)
);

create table if not exists brief_templates (
  id text primary key,
  name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists briefs (
  id text primary key,
  koc_id text not null unique references kocs(id) on delete cascade,
  template_id text references brief_templates(id) on delete set null,
  compensation text not null default '',
  currency text not null default 'USD',
  payment_terms text not null default '',
  draft_deadline text not null default '',
  publish_deadline text not null default '',
  video_format text not null default '',
  tracking_link text not null default '',
  promo_code text not null default '',
  license text not null default '',
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

```js
// server/app.js
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { createDb } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function createApp(deps = {}) {
  const app = express();
  const db = deps.db;

  app.use(express.json());
  app.use(express.static(path.join(__dirname, '..', 'public')));

  app.get('/api/bootstrap', async (_req, res, next) => {
    try {
      const [kocs, useCases, template, briefs] = await Promise.all([
        db.query('select * from kocs order by created_at desc'),
        db.query('select * from use_cases order by created_at desc'),
        db.query('select * from brief_templates order by updated_at desc limit 1'),
        db.query('select * from briefs order by created_at desc')
      ]);

      res.json({
        kocs: kocs.rows,
        useCases: useCases.rows,
        template: template.rows[0] || null,
        briefs: briefs.rows
      });
    } catch (error) {
      next(error);
    }
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  });

  return app;
}

const config = getConfig();

if (process.env.NODE_ENV !== 'test') {
  const db = createDb(config.databaseUrl);
  const app = createApp({ db });
  app.listen(config.port, () => {
    console.log(`Server listening on http://127.0.0.1:${config.port}`);
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- --test-name-pattern="bootstrap"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/config.js server/db.js server/sql/schema.sql tests/api/bootstrap.test.js
git commit -m "feat: add express bootstrap endpoint and schema"
```

## Task 3: Implement Shared CRUD API For KOCs, Use Cases, Template, And Briefs

**Files:**
- Create: `server/routes/kocs.js`
- Create: `server/routes/use-cases.js`
- Create: `server/routes/template.js`
- Create: `server/routes/briefs.js`
- Modify: `server/app.js`
- Test: `tests/api/briefs.test.js`

- [ ] **Step 1: Write the failing brief save test**

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../../server/app.js';

test('PUT /api/briefs/:kocId saves explicit brief payload', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql.includes('insert into briefs')) {
        return {
          rows: [{ koc_id: 'koc_1', compensation: '$500', currency: 'USD' }]
        };
      }
      return { rows: [] };
    }
  };

  const app = createApp({ db });
  const response = await request(app).put('/api/briefs/koc_1').send({
    templateId: 'global',
    compensation: '$500',
    currency: 'USD',
    paymentTerms: '50/50',
    draftDeadline: '2026-04-20',
    publishDeadline: '2026-04-28',
    videoFormat: '3-5 min',
    trackingLink: 'https://moclaw.ai',
    promoCode: '',
    license: '',
    notes: ''
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length > 0, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- --test-name-pattern="explicit brief payload"`
Expected: FAIL because the route does not exist yet.

- [ ] **Step 3: Implement focused route modules and mount them**

```js
// server/routes/briefs.js
import { Router } from 'express';

export function createBriefRoutes(db) {
  const router = Router();

  router.put('/:kocId', async (req, res, next) => {
    try {
      const payload = req.body;
      const { rows } = await db.query(
        `
        insert into briefs (
          id, koc_id, template_id, compensation, currency, payment_terms,
          draft_deadline, publish_deadline, video_format, tracking_link,
          promo_code, license, notes
        ) values (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13
        )
        on conflict (koc_id) do update set
          template_id = excluded.template_id,
          compensation = excluded.compensation,
          currency = excluded.currency,
          payment_terms = excluded.payment_terms,
          draft_deadline = excluded.draft_deadline,
          publish_deadline = excluded.publish_deadline,
          video_format = excluded.video_format,
          tracking_link = excluded.tracking_link,
          promo_code = excluded.promo_code,
          license = excluded.license,
          notes = excluded.notes,
          updated_at = now()
        returning *
        `,
        [
          `brief_${req.params.kocId}`,
          req.params.kocId,
          payload.templateId,
          payload.compensation || '',
          payload.currency || 'USD',
          payload.paymentTerms || '',
          payload.draftDeadline || '',
          payload.publishDeadline || '',
          payload.videoFormat || '',
          payload.trackingLink || '',
          payload.promoCode || '',
          payload.license || '',
          payload.notes || ''
        ]
      );

      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

```js
// server/app.js
import { createBriefRoutes } from './routes/briefs.js';
import { createKocRoutes } from './routes/kocs.js';
import { createUseCaseRoutes } from './routes/use-cases.js';
import { createTemplateRoutes } from './routes/template.js';

app.use('/api/kocs', createKocRoutes(db));
app.use('/api/use-cases', createUseCaseRoutes(db));
app.use('/api/template', createTemplateRoutes(db));
app.use('/api/briefs', createBriefRoutes(db));
```

```js
// server/routes/kocs.js
import { Router } from 'express';

const FIELD_MAP = {
  name: 'name',
  platform: 'platform',
  email: 'email',
  channelUrl: 'channel_url',
  channel_url: 'channel_url',
  status: 'status',
  draft_video: 'draft_video_url',
  draftVideo: 'draft_video_url',
  script: 'script_value',
  final_video: 'final_video_url',
  finalVideo: 'final_video_url'
};

export function createKocRoutes(db) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const id = `koc_${Date.now()}`;
      const { rows } = await db.query(
        `
        insert into kocs (
          id, name, platform, email, channel_url, status
        ) values ($1, $2, $3, $4, $5, 'draft')
        returning *
        `,
        [
          id,
          req.body.name,
          req.body.platform || 'YouTube',
          req.body.email || '',
          req.body.channelUrl || ''
        ]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id', async (req, res, next) => {
    try {
      const [clientField, value] = Object.entries(req.body)[0];
      const column = FIELD_MAP[clientField];
      const { rows } = await db.query(
        `update kocs set ${column} = $1, updated_at = now() where id = $2 returning *`,
        [value, req.params.id]
      );
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id/use-cases', async (req, res, next) => {
    try {
      await db.query('delete from koc_use_cases where koc_id = $1', [req.params.id]);
      for (const useCaseId of req.body.useCaseIds || []) {
        await db.query(
          'insert into koc_use_cases (koc_id, use_case_id) values ($1, $2)',
          [req.params.id, useCaseId]
        );
      }
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await db.query('delete from kocs where id = $1', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

```js
// server/routes/use-cases.js
import { Router } from 'express';

export function createUseCaseRoutes(db) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `
        insert into use_cases (id, title, description, links_json)
        values ($1, $2, $3, $4::jsonb)
        returning *
        `,
        [
          `uc_${Date.now()}`,
          req.body.title,
          req.body.description || '',
          JSON.stringify(req.body.links || [])
        ]
      );
      res.status(201).json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  router.delete('/:id', async (req, res, next) => {
    try {
      await db.query('delete from use_cases where id = $1', [req.params.id]);
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

```js
// server/routes/template.js
import { Router } from 'express';

export function createTemplateRoutes(db) {
  const router = Router();

  router.put('/', async (req, res, next) => {
    try {
      const { rows } = await db.query(
        `
        insert into brief_templates (id, name, content)
        values ('global', $1, $2)
        on conflict (id) do update set
          name = excluded.name,
          content = excluded.content,
          updated_at = now()
        returning *
        `,
        [req.body.name || 'Global Template', req.body.content || '']
      );
      res.json(rows[0]);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS for bootstrap and brief-save tests.

- [ ] **Step 5: Commit**

```bash
git add server/app.js server/routes/kocs.js server/routes/use-cases.js server/routes/template.js server/routes/briefs.js tests/api/briefs.test.js
git commit -m "feat: add shared data crud routes"
```

## Task 4: Replace Browser Local State With API Bootstrap And Shared Mutations

**Files:**
- Modify: `public/app.js`
- Modify: `public/index.html`

- [ ] **Step 1: Write the failing browser bootstrap expectation**

```js
console.assert(typeof loadAppData === 'function', 'loadAppData must exist');
```

- [ ] **Step 2: Run app to verify the current UI still depends on localStorage**

Run: `npm run dev`
Expected: Browser app still reads `bg_kocs`, `bg_usecases`, and `bg_template` from localStorage.

- [ ] **Step 3: Add shared fetch layer and bootstrap flow**

```js
// public/app.js
let kocs = [];
let useCaseLib = [];
let template = DEFAULT_TEMPLATE;
let briefsByKocId = {};
let isAppLoaded = false;

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${response.status}`);
  }

  return response.status === 204 ? null : response.json();
}

async function loadAppData() {
  const payload = await api('/api/bootstrap');
  kocs = payload.kocs.map(mapServerKocToClient);
  useCaseLib = payload.useCases.map(mapServerUseCaseToClient);
  template = payload.template?.content || DEFAULT_TEMPLATE;
  briefsByKocId = Object.fromEntries(payload.briefs.map(brief => [brief.koc_id, mapServerBriefToClient(brief)]));
  kocs.forEach(koc => {
    koc.brief = briefsByKocId[koc.id] || {};
  });
  isAppLoaded = true;
}
```

```js
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadAppData();
    switchTab('board');
    setupBriefAutoUpdate();
  } catch (error) {
    document.body.innerHTML = `<div class="panel" style="margin:40px;">Failed to load shared data. <button onclick="window.location.reload()">Retry</button></div>`;
  }
});
```

- [ ] **Step 4: Replace each non-brief mutation with API writes**

```js
async function createKoc() {
  const payload = {
    name,
    platform: document.getElementById('new-koc-platform').value,
    email: document.getElementById('new-koc-email').value.trim(),
    channelUrl: document.getElementById('new-koc-channel').value.trim()
  };
  const created = await api('/api/kocs', {
    method: 'POST',
    body: JSON.stringify(payload)
  });
  kocs.unshift(mapServerKocToClient(created));
}
```

```js
async function updateKocField(field, value) {
  const k = getKoc(currentKocId);
  k[field] = value;
  await api(`/api/kocs/${k.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ [field]: value })
  });
}
```

```js
async function saveTemplate() {
  template = document.getElementById('template-editor').value;
  await api('/api/template', {
    method: 'PUT',
    body: JSON.stringify({ name: 'Global Template', content: template })
  });
  showToast('Template saved!');
}
```

- [ ] **Step 5: Run the app and verify shared persistence manually**

Run: `npm run dev`
Expected:
- page loads from `/api/bootstrap`
- creating a KOC writes through API
- use case operations write through API
- template save writes through API

- [ ] **Step 6: Commit**

```bash
git add public/app.js public/index.html
git commit -m "feat: replace local browser persistence with shared api"
```

## Task 5: Change Brief Editor From Auto-Save To Explicit Save

**Files:**
- Modify: `public/index.html`
- Modify: `public/style.css`
- Modify: `public/app.js`

- [ ] **Step 1: Write the failing UI state expectation**

```js
console.assert(document.getElementById('brief-save-btn'), 'brief save button must exist');
console.assert(document.getElementById('brief-save-status'), 'brief save status indicator must exist');
```

- [ ] **Step 2: Run app to verify the current brief editor still auto-saves**

Run: `npm run dev`
Expected: Editing any brief field immediately persists because `updateBriefPreview()` calls `saveBriefToKoc()`.

- [ ] **Step 3: Add explicit save controls to the editor top bar**

```html
<div class="export-buttons">
  <span id="brief-save-status" class="save-status is-saved">Saved</span>
  <button class="btn-secondary" id="brief-save-btn" onclick="saveBrief()">Save Brief</button>
  <button class="btn-export btn-pdf" onclick="exportPDF()">Export PDF</button>
  <button class="btn-export btn-word" onclick="exportWord()">Export Word</button>
</div>
```

```css
.save-status {
  display: inline-flex;
  align-items: center;
  padding: 0 10px;
  border-radius: 999px;
  border: 1px solid var(--border);
  font-size: 12px;
  color: var(--text-secondary);
}

.save-status.is-dirty { color: #92400E; border-color: #F59E0B; background: #FEF3C7; }
.save-status.is-saving { color: white; border-color: var(--blue); background: var(--blue); }
.save-status.is-saved { color: #065F46; border-color: #A7F3D0; background: #D1FAE5; }
.save-status.is-error { color: white; border-color: #DC2626; background: #DC2626; }
```

- [ ] **Step 4: Remove implicit brief persistence and add draft-state tracking**

```js
let briefDraft = {};
let lastSavedBrief = {};
let briefIsDirty = false;

function openBriefEditor(id) {
  editingKocId = id;
  const k = getKoc(id);
  briefDraft = { ...(k.brief || {}) };
  lastSavedBrief = { ...(k.brief || {}) };
  briefIsDirty = false;
  syncBriefFormFromDraft();
  setBriefSaveState('saved');
  updateBriefPreview();
}

function collectBriefFormValues() {
  const next = {};
  BRIEF_VARS.forEach(v => {
    const el = document.getElementById('var-' + v);
    next[v] = el ? el.value : '';
  });
  return next;
}

function updateBriefPreview() {
  briefDraft = collectBriefFormValues();
  briefIsDirty = JSON.stringify(briefDraft) !== JSON.stringify(lastSavedBrief);
  setBriefSaveState(briefIsDirty ? 'dirty' : 'saved');
  const vars = getBriefVarsFromDraft();
  document.getElementById('brief-preview').innerHTML = mdToHtml(renderBriefContent(vars));
}
```

```js
async function saveBrief() {
  const k = getKoc(editingKocId);
  if (!k) return;

  try {
    setBriefSaveState('saving');
    const saved = await api(`/api/briefs/${k.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        templateId: 'global',
        compensation: briefDraft.compensation || '',
        currency: briefDraft.currency || 'USD',
        paymentTerms: briefDraft.payment_terms || '',
        draftDeadline: briefDraft.draft_deadline || '',
        publishDeadline: briefDraft.publish_deadline || '',
        videoFormat: briefDraft.video_format || '',
        trackingLink: briefDraft.tracking_link || '',
        promoCode: briefDraft.promo_code || '',
        license: briefDraft.license || '',
        notes: briefDraft.notes || ''
      })
    });

    k.brief = mapServerBriefToClient(saved);
    briefDraft = { ...k.brief };
    lastSavedBrief = { ...k.brief };
    briefIsDirty = false;
    setBriefSaveState('saved');
    showToast('Brief saved!');
  } catch (error) {
    setBriefSaveState('error');
    showToast(error.message || 'Failed to save brief');
  }
}
```

- [ ] **Step 5: Add unsaved-change guards**

```js
function confirmDiscardBriefChanges() {
  return !briefIsDirty || window.confirm('You have unsaved brief changes. Leave without saving?');
}

function closeBriefEditor() {
  if (!confirmDiscardBriefChanges()) return;
  editingKocId = null;
  switchTab('board');
}

window.addEventListener('beforeunload', event => {
  if (!briefIsDirty) return;
  event.preventDefault();
  event.returnValue = '';
});
```

- [ ] **Step 6: Run manual verification**

Run: `npm run dev`
Expected:
- opening a brief shows `Saved`
- changing any field switches status to `Unsaved changes`
- clicking `Save Brief` switches to `Saving...`, then `Saved`
- reload keeps saved values
- leaving with dirty changes shows confirmation

- [ ] **Step 7: Commit**

```bash
git add public/index.html public/style.css public/app.js
git commit -m "feat: add explicit brief save state and dirty tracking"
```

## Task 6: Wire Database Setup And Verify End-To-End Locally

**Files:**
- Modify: `.env.example`
- Modify: `server/sql/schema.sql`
- Modify: `package.json`

- [ ] **Step 1: Add a runnable schema setup command**

```json
{
  "scripts": {
    "dev": "node server/app.js",
    "start": "node server/app.js",
    "test": "node --test",
    "db:schema": "psql \"$DATABASE_URL\" -f server/sql/schema.sql"
  }
}
```

- [ ] **Step 2: Run the schema against local Postgres**

Run: `npm run db:schema`
Expected: `CREATE TABLE` or `NOTICE` output for the five tables.

- [ ] **Step 3: Install dependencies and run all verification commands**

Run: `npm install`
Expected: packages installed successfully

Run: `npm test`
Expected: PASS

Run: `npm run dev`
Expected: server starts on `http://127.0.0.1:3000`

- [ ] **Step 4: Verify end-to-end behavior in browser**

Manual checks:
- create KOC, reload, confirm persistence
- create use case, reload, confirm persistence
- assign use case, reload, confirm persistence
- save template, reload, confirm persistence
- edit brief, save, reload, confirm persistence
- attempt to navigate away from dirty brief without saving

- [ ] **Step 5: Commit**

```bash
git add package.json .env.example server/sql/schema.sql
git commit -m "chore: add local database setup and verification workflow"
```

## Self-Review

### Spec coverage

- Shared backend data store: covered by Tasks 2, 3, 4, and 6.
- Explicit brief save action: covered by Task 5.
- Save-state UI: covered by Task 5.
- Existing UI retained: covered by Tasks 1 and 4.
- No login and no permissions in v1: preserved throughout; no auth task introduced.

### Placeholder scan

The route module placeholders in Task 3 were expanded inline. Task 1 also now uses concrete file-copy commands instead of “move current file” wording. No remaining `TBD`, `TODO`, or “implement later” placeholders should remain.

### Type consistency

- Client brief keys remain snake_case in browser state.
- API payload keys use camelCase for request bodies.
- Server column names stay snake_case.
- Mapping helpers in `public/app.js` must normalize these consistently before any manual verification.
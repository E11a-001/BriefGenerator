# AI Use Case Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `Use Case Link + Generate with AI` workflow that fetches an ordinary webpage, asks `MiniMax` to draft structured use case fields, and fills the existing use case form without auto-saving.

**Architecture:** Add one backend draft-generation endpoint and keep all persistence on the existing manual `Save Use Case` path. The frontend adds a link input, generation button, loading/error handling, and form backfill logic. The backend handles URL validation, page extraction, MiniMax prompting, and normalized JSON response.

**Tech Stack:** Express, browser Fetch API, existing shared frontend (`public/app.js`), Node test runner, MiniMax HTTP API, simple HTML extraction on the backend.

---

## File Map

- Modify: `public/index.html`
  - Add `Use Case Link` input and `Generate with AI` button to the use case form.
- Modify: `public/app.js`
  - Add generation form state, API call, loading state, field backfill, and error handling.
- Modify: `server/app.js`
  - Register a new `use-case generation` route if needed by current route structure.
- Modify: `server/routes/use-cases.js`
  - Add `POST /api/use-cases/generate`.
- Create: `server/lib/use-case-generation.js`
  - Hold URL validation, HTML extraction, MiniMax request, response parsing, and normalization helpers.
- Modify: `tests/api/use-cases.test.js`
  - Add route tests for generation success and failure.
- Optionally create: `tests/lib/use-case-generation.test.js`
  - Add focused unit tests for normalization helpers if the extraction/parser logic grows enough to justify it.

## Task 1: Add Failing Backend Tests For Use Case Draft Generation

**Files:**
- Modify: `tests/api/use-cases.test.js`
- Reference: `server/routes/use-cases.js`

- [ ] **Step 1: Add a failing test for invalid URL rejection**

```js
test('POST /api/use-cases/generate rejects invalid URLs', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const router = createUseCaseRoutes(db, {
    generateUseCaseDraft: async () => {
      throw new Error('should not be called');
    }
  });

  const response = await request(router)
    .post('/generate')
    .send({ url: 'not-a-url' });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Please enter a valid webpage URL.');
});
```

- [ ] **Step 2: Add a failing test for successful draft generation**

```js
test('POST /api/use-cases/generate returns normalized AI draft fields', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const router = createUseCaseRoutes(db, {
    generateUseCaseDraft: async () => ({
      title: 'Monitoring price on Amazon',
      description: 'Monitor a product and surface updates.',
      who_this_is_for: 'Shoppers waiting for a better buying moment.',
      problem: 'Manual price checking is repetitive.',
      how_to_show_it: 'Show the watch setup and the surfaced update.',
      expected_outcome: 'The audience sees time saved and clearer timing.',
      must_show_elements: 'Product page, setup, update, result.',
      links: ['https://example.com/use-case']
    })
  });

  const response = await request(router)
    .post('/generate')
    .send({ url: 'https://example.com/use-case' });

  assert.equal(response.statusCode, 200);
  assert.equal(response.body.title, 'Monitoring price on Amazon');
  assert.deepEqual(response.body.links, ['https://example.com/use-case']);
});
```

- [ ] **Step 3: Run the route tests to verify they fail**

Run:

```bash
npm test -- tests/api/use-cases.test.js
```

Expected:

- FAIL because `/generate` does not exist yet or because the route factory does not accept a generation dependency.

## Task 2: Implement Backend Draft Generation Route Skeleton

**Files:**
- Modify: `server/routes/use-cases.js`
- Modify: `server/app.js`

- [ ] **Step 1: Extend the route factory to accept a generation dependency**

```js
export function createUseCaseRoutes(db, deps = {}) {
  const router = Router();
  const generateUseCaseDraft = deps.generateUseCaseDraft;

  // existing routes...
  return router;
}
```

- [ ] **Step 2: Add the new POST route with request validation**

```js
router.post('/generate', async (req, res, next) => {
  try {
    const url = String(req.body?.url || '').trim();

    if (!/^https?:\/\/.+/i.test(url)) {
      return res.status(400).json({ error: 'Please enter a valid webpage URL.' });
    }

    if (!generateUseCaseDraft) {
      return res.status(500).json({ error: 'AI generation is not configured.' });
    }

    const draft = await generateUseCaseDraft({ url });
    res.json(draft);
  } catch (error) {
    next(error);
  }
});
```

- [ ] **Step 3: Wire the route in the app bootstrap**

```js
import { createGenerateUseCaseDraft } from './lib/use-case-generation.js';

const generateUseCaseDraft = createGenerateUseCaseDraft({
  fetch: globalThis.fetch,
  apiKey: process.env.MINIMAX_API_KEY,
  apiUrl: process.env.MINIMAX_API_URL
});

app.use('/api/use-cases', createUseCaseRoutes(db, { generateUseCaseDraft }));
```

- [ ] **Step 4: Run the targeted tests again**

Run:

```bash
npm test -- tests/api/use-cases.test.js
```

Expected:

- The invalid URL test now passes.
- The success test still fails because `server/lib/use-case-generation.js` is not implemented.

## Task 3: Implement HTML Extraction And MiniMax Draft Generation

**Files:**
- Create: `server/lib/use-case-generation.js`
- Reference: `server/routes/use-cases.js`

- [ ] **Step 1: Create extraction and normalization helpers**

```js
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeDraft(url, payload = {}) {
  return {
    title: String(payload.title || '').trim(),
    description: String(payload.description || '').trim(),
    who_this_is_for: String(payload.who_this_is_for || '').trim(),
    problem: String(payload.problem || '').trim(),
    how_to_show_it: String(payload.how_to_show_it || '').trim(),
    expected_outcome: String(payload.expected_outcome || '').trim(),
    must_show_elements: String(payload.must_show_elements || '').trim(),
    links: Array.from(new Set([url, ...(Array.isArray(payload.links) ? payload.links : [])].filter(Boolean)))
  };
}
```

- [ ] **Step 2: Implement the MiniMax prompt call**

```js
async function requestMiniMaxDraft({ fetch, apiUrl, apiKey, url, pageTitle, pageText }) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'MiniMax-Text-01',
      messages: [
        {
          role: 'system',
          content: 'Return only JSON for a reusable creator brief use case draft.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            url,
            page_title: pageTitle,
            page_text: pageText,
            schema: {
              title: 'string',
              description: 'string',
              who_this_is_for: 'string',
              problem: 'string',
              how_to_show_it: 'string',
              expected_outcome: 'string',
              must_show_elements: 'string',
              links: ['string']
            }
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error('Failed to generate use case draft.');
  }

  const data = await response.json();
  return JSON.parse(data.choices?.[0]?.message?.content || '{}');
}
```

- [ ] **Step 3: Export the route dependency factory**

```js
export function createGenerateUseCaseDraft({ fetch, apiKey, apiUrl }) {
  return async function generateUseCaseDraft({ url }) {
    if (!apiKey || !apiUrl) {
      throw new Error('AI generation is not configured.');
    }

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error('Could not extract page content from this link.');
    }

    const html = await response.text();
    const pageText = stripHtml(html).slice(0, 12000);
    if (!pageText) {
      throw new Error('Could not extract page content from this link.');
    }

    const pageTitleMatch = html.match(/<title>(.*?)<\/title>/i);
    const pageTitle = pageTitleMatch ? pageTitleMatch[1].trim() : '';
    const draft = await requestMiniMaxDraft({ fetch, apiUrl, apiKey, url, pageTitle, pageText });
    return normalizeDraft(url, draft);
  };
}
```

- [ ] **Step 4: Run route tests again**

Run:

```bash
npm test -- tests/api/use-cases.test.js
```

Expected:

- route tests pass with mocked generator dependency
- no regressions in existing use case tests

## Task 4: Add Focused Backend Error Handling

**Files:**
- Modify: `server/routes/use-cases.js`
- Modify: `server/lib/use-case-generation.js`
- Modify: `tests/api/use-cases.test.js`

- [ ] **Step 1: Convert known generation failures into user-readable HTTP responses**

```js
router.post('/generate', async (req, res, next) => {
  try {
    // ...
  } catch (error) {
    if (
      error.message === 'Could not extract page content from this link.' ||
      error.message === 'Failed to generate use case draft.' ||
      error.message === 'AI generation is not configured.'
    ) {
      return res.status(400).json({ error: error.message });
    }
    next(error);
  }
});
```

- [ ] **Step 2: Add a failing test for extraction/generation failure**

```js
test('POST /api/use-cases/generate returns a clean error when generation fails', async () => {
  const db = { query: async () => ({ rows: [] }) };
  const router = createUseCaseRoutes(db, {
    generateUseCaseDraft: async () => {
      throw new Error('Failed to generate use case draft.');
    }
  });

  const response = await request(router)
    .post('/generate')
    .send({ url: 'https://example.com/use-case' });

  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, 'Failed to generate use case draft.');
});
```

- [ ] **Step 3: Run the use case test file**

Run:

```bash
npm test -- tests/api/use-cases.test.js
```

Expected:

- PASS

## Task 5: Add Frontend AI Draft Controls

**Files:**
- Modify: `public/index.html`
- Modify: `public/app.js`

- [ ] **Step 1: Add the new controls to the use case form**

```html
<div class="form-group">
  <label>Use Case Link</label>
  <div class="inline-action-row">
    <input type="url" id="uc-source-url" placeholder="https://example.com/use-case" />
    <button class="btn-secondary" type="button" id="uc-generate-btn" onclick="generateUseCaseDraft()">Generate with AI</button>
  </div>
</div>
```

- [ ] **Step 2: Add generation state to the frontend**

```js
let useCaseSourceUrl = '';
let isGeneratingUseCase = false;
```

- [ ] **Step 3: Implement the generate action**

```js
async function generateUseCaseDraft() {
  const url = document.getElementById('uc-source-url')?.value.trim();
  if (!url) {
    showToast('Please enter a valid webpage URL.');
    return;
  }

  const button = document.getElementById('uc-generate-btn');
  isGeneratingUseCase = true;
  button.disabled = true;
  button.textContent = 'Generating...';

  try {
    const draft = await api('/api/use-cases/generate', {
      method: 'POST',
      body: JSON.stringify({ url })
    });

    document.getElementById('uc-new-title').value = draft.title || '';
    document.getElementById('uc-new-desc').value = draft.description || '';
    document.getElementById('uc-new-who').value = draft.who_this_is_for || '';
    document.getElementById('uc-new-problem').value = draft.problem || '';
    document.getElementById('uc-new-how').value = draft.how_to_show_it || '';
    document.getElementById('uc-new-outcome').value = draft.expected_outcome || '';
    document.getElementById('uc-new-must').value = draft.must_show_elements || '';
    newUcLinks = Array.isArray(draft.links) ? draft.links : [];
    renderNewUcLinks();
    showToast('AI draft generated');
  } catch (error) {
    showToast(error.message || 'Failed to generate use case draft.');
  } finally {
    isGeneratingUseCase = false;
    button.disabled = false;
    button.textContent = 'Generate with AI';
  }
}
```

- [ ] **Step 4: Ensure reset clears AI-filled values too**

```js
function resetUseCaseForm() {
  editingUseCaseId = null;
  document.getElementById('uc-source-url').value = '';
  document.getElementById('uc-new-title').value = '';
  document.getElementById('uc-new-desc').value = '';
  document.getElementById('uc-new-who').value = '';
  document.getElementById('uc-new-problem').value = '';
  document.getElementById('uc-new-how').value = '';
  document.getElementById('uc-new-outcome').value = '';
  document.getElementById('uc-new-must').value = '';
  newUcLinks = [];
  renderNewUcLinks();
}
```

- [ ] **Step 5: Run app syntax check**

Run:

```bash
node --check public/app.js
```

Expected:

- PASS with no syntax errors

## Task 6: Manual Verification And Full Test Pass

**Files:**
- Modify if needed after manual checks: `public/index.html`, `public/app.js`, `server/routes/use-cases.js`, `server/lib/use-case-generation.js`
- Test: `tests/api/use-cases.test.js`

- [ ] **Step 1: Run the full automated test suite**

Run:

```bash
npm test
```

Expected:

- PASS with all existing tests and new generation tests green

- [ ] **Step 2: Start the local server**

Run:

```bash
node server/app.js
```

Expected:

- `Server listening on http://127.0.0.1:3000`

- [ ] **Step 3: Manually verify the browser flow**

Check:

- a valid webpage URL generates a draft
- generated values populate the create form
- generated values remain editable
- `Reset` clears generated values
- `Save Use Case` still saves normally
- a bad URL shows a clean error and does not wipe current form values

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/app.js server/app.js server/routes/use-cases.js server/lib/use-case-generation.js tests/api/use-cases.test.js docs/superpowers/specs/2026-04-18-ai-use-case-generation-design.md docs/superpowers/plans/2026-04-18-ai-use-case-generation-implementation.md
git commit -m "feat: add AI use case draft generation"
```

## Self-Review

Spec coverage check:

- webpage-link-only input is covered in Tasks 2, 3, and 5
- backend-only `MiniMax` integration is covered in Tasks 2 and 3
- draft-only behavior is covered in Tasks 2 and 5
- editable generated output is covered in Task 5
- manual save remains unchanged and verified in Task 6
- clean error handling is covered in Task 4

Placeholder scan:

- no `TBD`, `TODO`, or deferred implementation markers remain

Type consistency:

- route contract uses `url`
- generated response fields match existing use case schema:
  - `title`
  - `description`
  - `who_this_is_for`
  - `problem`
  - `how_to_show_it`
  - `expected_outcome`
  - `must_show_elements`
  - `links`
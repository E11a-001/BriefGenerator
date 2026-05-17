# Playwright Rendered-Page Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a fallback extraction path that uses Playwright only for likely front-end-rendered pages so AI use case generation can read sites like `manus.space`.

**Architecture:** Keep the current `fetch -> stripHtml -> MiniMax` path for normal content pages. Add a rendered-page detector plus a Playwright extraction helper that launches local Chrome, reads rendered text and meta fields, and feeds that text into the existing generator only when the static HTML looks too thin or app-shell-like.

**Tech Stack:** Node.js, Express, Playwright Core, local Google Chrome, Node test runner

---

### Task 1: Add extraction decision tests

**Files:**
- Modify: `tests/api/use-cases.test.js`
- Test: `tests/api/use-cases.test.js`

- [ ] Add tests that cover two cases: static HTML stays on the existing path, and app-shell HTML triggers the rendered fallback dependency.
- [ ] Mock the rendered extractor dependency instead of opening a real browser in tests.
- [ ] Run: `npm test`
- [ ] Expected: new tests fail before implementation because the dependency is never called yet.

### Task 2: Add rendered extraction helper

**Files:**
- Create: `server/lib/rendered-page-extraction.js`
- Modify: `server/lib/use-case-generation.js`
- Test: `tests/api/use-cases.test.js`

- [ ] Create a helper that launches local Chrome through Playwright Core and returns `{ pageTitle, pageText, metaDescription }`.
- [ ] Add a detector in `use-case-generation.js` for likely front-end-rendered pages using signals like `div id="root"`, large script-heavy HTML, and weak visible text.
- [ ] When detection matches, call the rendered extractor and prefer its text over raw `stripHtml`.
- [ ] Expand the prompt payload to include `metaDescription` so terms like `product sourcing research` and `pricing strategy` survive even when body text is thin.
- [ ] Run: `npm test`
- [ ] Expected: tests pass.

### Task 3: Wire config and safe fallback

**Files:**
- Modify: `server/app.js`
- Modify: `.env.example`
- Test: `tests/api/use-cases.test.js`

- [ ] Wire the rendered extractor into the existing dependency graph in `server/app.js`.
- [ ] Add optional env config for Chrome executable path in `.env.example`.
- [ ] Keep failure behavior safe: if Playwright extraction fails, fall back to static extraction unless the page was unreadable altogether.
- [ ] Run: `npm test`
- [ ] Expected: tests still pass with no browser required in test mode.

### Task 4: Verify against a rendered page manually

**Files:**
- Modify: `public` files only if manual verification exposes a UI issue. Otherwise no code changes.

- [ ] Run the local app.
- [ ] Generate a use case draft from the existing `manus.space` eBay page.
- [ ] Confirm the resulting draft mentions the specific business nouns from the source such as product sourcing and pricing strategy rather than generic repetitive work.
- [ ] If needed, tighten the detector or prompt once, then rerun `npm test`.

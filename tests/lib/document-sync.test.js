import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';

const ROOT = process.cwd();

function createElementStub() {
  return {
    value: '',
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() {
        return false;
      }
    },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    focus() {}
  };
}

async function loadBrowserScripts() {
  const elements = new Map();
  const document = {
    body: createElementStub(),
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return createElementStub();
    },
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, createElementStub());
      return elements.get(id);
    }
  };

  const context = vm.createContext({
    console,
    setTimeout,
    clearTimeout,
    URL,
    AbortSignal,
    fetch: async () => {
      throw new Error('fetch should not be called in this test');
    },
    document,
    window: {
      addEventListener() {},
      confirm() {
        return true;
      },
      location: {
        reload() {}
      }
    }
  });
  context.globalThis = context;

  const sharedConfig = await fs.readFile(path.join(ROOT, 'public/shared-config.js'), 'utf8');
  const primaryAudience = await fs.readFile(path.join(ROOT, 'public/primary-audience.js'), 'utf8');
  const appJs = await fs.readFile(path.join(ROOT, 'public/app.js'), 'utf8');
  vm.runInContext(sharedConfig, context);
  vm.runInContext(primaryAudience, context);
  vm.runInContext(appJs, context);

  return context;
}

test('syncDocumentFieldsWithBrief forces invoice synced fields to follow latest brief defaults', async () => {
  const context = await loadBrowserScripts();

  const merged = context.syncDocumentFieldsWithBrief(
    'invoice',
    {
      payee_name: 'Nik',
      line_items: 'Creator campaign fee — Nik — 50 USD',
      total_amount: '50 USD',
      notes: 'Use creator-specific invoice notes',
      invoice_number: '',
      bank_name: ''
    },
    {
      payee_name: 'Old Name',
      line_items: 'Old line item',
      total_amount: 'Old total',
      notes: 'Old payment terms',
      invoice_number: 'INV-001',
      bank_name: 'Old Bank'
    }
  );

  assert.equal(merged.payee_name, 'Nik');
  assert.equal(merged.line_items, 'Creator campaign fee — Nik — 50 USD');
  assert.equal(merged.total_amount, '50 USD');
  assert.equal(merged.notes, 'Use creator-specific invoice notes');
  assert.equal(merged.invoice_number, 'INV-001');
  assert.equal(merged.bank_name, 'Old Bank');
});

test('invoice defaults use brief notes instead of payment terms for notes field', async () => {
  const context = await loadBrowserScripts();

  const defaults = context.getInvoiceDefaults({
    name: 'Nik',
    brief: {
      compensation: '50',
      currency: 'USD',
      payment_terms: '50 percent after script approval',
      notes: 'Please include your legal entity name on the invoice.'
    }
  });

  assert.equal(defaults.notes, 'Please include your legal entity name on the invoice.');
});

test('agreement defaults keep date placeholders as N/A instead of syncing brief timeline wording', async () => {
  const context = await loadBrowserScripts();

  const defaults = context.getAgreementDefaults({
    name: 'Nik',
    email: 'nik@example.com',
    brief: {
      script_deadline: 'Within 1 day of posting the task',
      draft_deadline: 'Within 3 days of posting the task',
      publish_deadline: 'Post within 1 day after confirming the content.'
    }
  });

  assert.equal(defaults.script_date, 'N/A');
  assert.equal(defaults.draft_date, 'N/A');
  assert.equal(defaults.launch_date, 'N/A');
});

test('brief timeline inputs support relative wording instead of date-only values', async () => {
  const html = await fs.readFile(path.join(ROOT, 'public/index.html'), 'utf8');

  assert.match(html, /id="var-script_deadline"[^>]*type="text"/);
  assert.match(html, /id="var-draft_deadline"[^>]*type="text"/);
  assert.match(html, /id="var-publish_deadline"[^>]*type="text"/);
});

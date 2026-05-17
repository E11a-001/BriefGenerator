import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

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

  const sharedConfig = await fs.readFile('/Users/ella/Downloads/brief generator 2/public/shared-config.js', 'utf8');
  const appJs = await fs.readFile('/Users/ella/Downloads/brief generator 2/public/app.js', 'utf8');
  vm.runInContext(sharedConfig, context);
  vm.runInContext(appJs, context);

  return context;
}

function createAgreementFixture() {
  return {
    name: 'Mah',
    email: 'mah@example.com',
    platform: 'X / Twitter',
    brief: {
      video_duration: 'N/A',
      video_format: 'Twitter post + bundle',
      language: 'English',
      script_deadline: 'Within 1 day of posting the task',
      draft_deadline: 'Within 3 days of posting the task',
      publish_deadline: 'Post within 1 day after confirming the content.',
      compensation: '140',
      currency: 'USD',
      payment_method: 'PayPal',
      payment_schedule_type: 'net_20_after_completion',
      payment_terms: 'Payment is due 20 days after completion of services and receipt of invoice.',
      license: '',
      license_duration: '',
      license_region: '',
      notes: 'Please follow the approved brief.',
      use_cases: [
        {
          title: 'AI Morning Briefing',
          link: 'https://moclaw.ai/use-cases/ai-morning-briefing',
          who_this_is_for: 'Busy professionals who want a concise daily priority digest.'
        }
      ]
    }
  };
}

test('agreement preview renders formal cover, license page, legal clauses, and appendix', async () => {
  const context = await loadBrowserScripts();
  const koc = createAgreementFixture();
  const vars = context.getAgreementDefaults(koc);

  const html = context.renderAgreementPreviewHtml(koc, vars);

  assert.match(html, /Tomato Creator Agreement/);
  assert.match(html, /Deliverables: See Appendix 1/i);
  assert.match(html, /Promotional License Terms/i);
  assert.match(html, /Terms of Agreement/i);
  assert.match(html, /1\.\s*Obligations of BlueFocus/i);
  assert.match(html, /8\.\s*Governing Law and Dispute Resolution/i);
  assert.match(html, /APPENDIX 1/i);
  assert.match(html, /Specification of the Service/i);
  assert.match(html, /Content Guidelines/i);
  assert.match(html, /The creative brief for the Service is the document titled/i);
  assert.doesNotMatch(html, /Within 1 day of posting the task/i);
  assert.doesNotMatch(html, /Within 3 days of posting the task/i);
  assert.doesNotMatch(html, /Post within 1 day after confirming the content/i);
});

test('agreement appendix includes use case links only when they exist', async () => {
  const context = await loadBrowserScripts();
  const koc = createAgreementFixture();
  const vars = context.getAgreementDefaults(koc);

  const withLink = context.renderAgreementPreviewHtml(koc, vars);
  assert.match(withLink, /href="https:\/\/moclaw\.ai\/use-cases\/ai-morning-briefing"/i);

  koc.brief.use_cases = [
    {
      title: 'AI Morning Briefing',
      link: '',
      who_this_is_for: 'Busy professionals who want a concise daily priority digest.'
    }
  ];

  const withoutLink = context.renderAgreementPreviewHtml(koc, vars);
  assert.doesNotMatch(withoutLink, /href="https:\/\/moclaw\.ai\/use-cases\/ai-morning-briefing"/i);
  assert.doesNotMatch(withoutLink, /It is located here:/i);
});

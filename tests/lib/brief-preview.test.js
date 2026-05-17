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
  const appJs = await fs.readFile(path.join(ROOT, 'public/app.js'), 'utf8');
  vm.runInContext(sharedConfig, context);
  vm.runInContext(appJs, context);

  return context;
}

test('selecting campaign preset via change handler applies preset fields before preview refresh', async () => {
  const context = await loadBrowserScripts();
  const elements = {};
  const makeElement = (id, value = '', tagName = 'INPUT') => ({
    id,
    value,
    tagName,
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    focus() {}
  });

  elements['var-campaign_preset_id'] = makeElement('var-campaign_preset_id', 'preset_1', 'SELECT');
  elements['var-trending_hook_topics'] = makeElement('var-trending_hook_topics', '');
  elements['var-trending_hook_angle'] = makeElement('var-trending_hook_angle', '');
  elements['var-cover_poster_url'] = makeElement('var-cover_poster_url', '');
  elements['var-cover_poster_note'] = makeElement('var-cover_poster_note', '');

  context.document.getElementById = id => {
    if (!elements[id]) elements[id] = makeElement(id, '');
    return elements[id];
  };

  vm.runInContext(`
    campaignPresets = [{
      id: 'preset_1',
      name: 'Preset One',
      trending_hook_topics: 'DeepSeek, OpenClaw',
      trending_hook_angle: 'Lead with the free angle.',
      cover_poster_url: '/uploads/campaign-presets/preset_1/preset.png',
      cover_poster_note: 'Keep the headline readable.'
    }];
    editingKocId = 'koc_1';
    kocs = [{ id: 'koc_1', name: 'Nik', platform: 'YouTube', email: '', brief: {}, use_case_ids: [], primary_use_case_id: '' }];
    briefDraft = { campaign_preset_id: '', trending_hook_topics: '', trending_hook_angle: '', cover_poster_url: '', cover_poster_note: '' };
    updateBriefPreview = () => { briefDraft = collectBriefFormValues(); };
  `, context);

  context.applyCampaignPresetSelection('preset_1');

  assert.equal(elements['var-trending_hook_topics'].value, 'DeepSeek, OpenClaw');
  assert.equal(elements['var-trending_hook_angle'].value, 'Lead with the free angle.');
  assert.equal(elements['var-cover_poster_url'].value, '/uploads/campaign-presets/preset_1/preset.png');
  assert.equal(elements['var-cover_poster_note'].value, 'Keep the headline readable.');
});

test('clearing campaign preset via change handler removes preset-backed fields', async () => {
  const context = await loadBrowserScripts();
  const elements = {};
  const makeElement = (id, value = '', tagName = 'INPUT') => ({
    id,
    value,
    tagName,
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    focus() {}
  });

  elements['var-campaign_preset_id'] = makeElement('var-campaign_preset_id', '', 'SELECT');
  elements['var-trending_hook_topics'] = makeElement('var-trending_hook_topics', 'DeepSeek, OpenClaw');
  elements['var-trending_hook_angle'] = makeElement('var-trending_hook_angle', 'Lead with the free angle.');
  elements['var-cover_poster_url'] = makeElement('var-cover_poster_url', '/uploads/campaign-presets/preset_1/preset.png');
  elements['var-cover_poster_note'] = makeElement('var-cover_poster_note', 'Keep the headline readable.');

  context.document.getElementById = id => {
    if (!elements[id]) elements[id] = makeElement(id, '');
    return elements[id];
  };

  vm.runInContext(`
    editingKocId = 'koc_1';
    kocs = [{ id: 'koc_1', name: 'Nik', platform: 'YouTube', email: '', brief: {}, use_case_ids: [], primary_use_case_id: '' }];
    briefDraft = {
      campaign_preset_id: 'preset_1',
      trending_hook_topics: 'DeepSeek, OpenClaw',
      trending_hook_angle: 'Lead with the free angle.',
      cover_poster_url: '/uploads/campaign-presets/preset_1/preset.png',
      cover_poster_note: 'Keep the headline readable.'
    };
    updateBriefPreview = () => { briefDraft = collectBriefFormValues(); };
  `, context);

  context.applyCampaignPresetSelection('');

  assert.equal(elements['var-campaign_preset_id'].value, '');
  assert.equal(elements['var-trending_hook_topics'].value, '');
  assert.equal(elements['var-trending_hook_angle'].value, '');
  assert.equal(elements['var-cover_poster_url'].value, '');
  assert.equal(elements['var-cover_poster_note'].value, '');
});

test('stale preset-backed values are cleared when no preset is selected', async () => {
  const context = await loadBrowserScripts();

  vm.runInContext(`
    campaignPresets = [{
      id: 'preset_1',
      name: 'Preset One',
      trending_hook_topics: 'DeepSeek, OpenClaw',
      trending_hook_angle: 'Lead with the free angle.',
      cover_poster_url: '/uploads/campaign-presets/preset_1/preset.png',
      cover_poster_note: 'Keep the headline readable.'
    }];
    briefDraft = {
      campaign_preset_id: '',
      trending_hook_topics: 'DeepSeek, OpenClaw',
      trending_hook_angle: 'Lead with the free angle.',
      cover_poster_url: '/uploads/campaign-presets/preset_1/preset.png',
      cover_poster_note: 'Keep the headline readable.'
    };
    sanitizePresetBackedFieldsOnDraft();
  `, context);

  const sanitizedDraft = vm.runInContext('briefDraft', context);
  assert.equal(sanitizedDraft.campaign_preset_id, '');
  assert.equal(sanitizedDraft.trending_hook_topics, '');
  assert.equal(sanitizedDraft.trending_hook_angle, '');
  assert.equal(sanitizedDraft.cover_poster_url, '');
  assert.equal(sanitizedDraft.cover_poster_note, '');
});

test('updating an active campaign preset syncs all preset-backed brief fields when they still match the old preset', async () => {
  const context = await loadBrowserScripts();
  const elements = {};
  const makeElement = (id, value = '', tagName = 'INPUT') => ({
    id,
    value,
    tagName,
    innerHTML: '',
    textContent: '',
    className: '',
    style: {},
    dataset: {},
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; }
    },
    appendChild() {},
    addEventListener() {},
    removeEventListener() {},
    focus() {}
  });

  elements['var-trending_hook_topics'] = makeElement('var-trending_hook_topics', 'DeepSeek, OpenClaw');
  elements['var-trending_hook_angle'] = makeElement('var-trending_hook_angle', 'Lead with the free angle.');
  elements['var-cover_poster_url'] = makeElement('var-cover_poster_url', '/uploads/campaign-presets/preset_1/old.png');
  elements['var-cover_poster_note'] = makeElement('var-cover_poster_note', 'Keep the headline readable.');

  context.document.getElementById = id => {
    if (!elements[id]) elements[id] = makeElement(id, '');
    return elements[id];
  };

  vm.runInContext(`
    campaignPresets = [{
      id: 'preset_1',
      name: 'Preset One',
      trending_hook_topics: 'DeepSeek, OpenClaw',
      trending_hook_angle: 'Lead with the free angle.',
      cover_poster_url: '/uploads/campaign-presets/preset_1/old.png',
      cover_poster_note: 'Keep the headline readable.'
    }];
    editingKocId = 'koc_1';
    briefDraft = {
      campaign_preset_id: 'preset_1',
      trending_hook_topics: 'DeepSeek, OpenClaw',
      trending_hook_angle: 'Lead with the free angle.',
      cover_poster_url: '/uploads/campaign-presets/preset_1/old.png',
      cover_poster_note: 'Keep the headline readable.'
    };
  `, context);

  context.replaceCampaignPresetInState({
    id: 'preset_1',
    name: 'Preset One',
    trending_hook_topics: 'DeepSeek v4 Pro, OpenClaw',
    trending_hook_angle: 'Lead with the 100% free angle.',
    cover_poster_url: '/uploads/campaign-presets/preset_1/new.png',
    cover_poster_note: 'Keep the logo and whale icon visible.'
  });

  assert.equal(elements['var-trending_hook_topics'].value, 'DeepSeek v4 Pro, OpenClaw');
  assert.equal(elements['var-trending_hook_angle'].value, 'Lead with the 100% free angle.');
  assert.equal(elements['var-cover_poster_url'].value, '/uploads/campaign-presets/preset_1/new.png');
  assert.equal(elements['var-cover_poster_note'].value, 'Keep the logo and whale icon visible.');
});

test('brief preview omits Primary KPI and CTA when those fields are blank', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Walk through a repeatable workflow.',
    primary_kpi: '',
    cta: '',
    primary_audience: 'Operators who need practical automation help.',
    tracking_link: '',
    promo_code: '',
    compensation: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: 'YouTube',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.doesNotMatch(output, /Primary KPI:/);
  assert.doesNotMatch(output, /\n## 9\. CTA & Tracking\n\nUse the link below/i);
});

test('brief preview renders suggested elements as bullets and reference links as list items', async () => {
  const context = await loadBrowserScripts();

  vm.runInContext(`
    editingKocId = 'koc_1';
    kocs = [{
      id: 'koc_1',
      name: 'Nik',
      platform: 'YouTube',
      email: '',
      brief: {},
      use_case_ids: ['uc_1'],
      primary_use_case_id: 'uc_1'
    }];
    useCaseLib = [{
      id: 'uc_1',
      title: 'AI-Powered Daily News Digest',
      description: 'Automate your daily news briefing with AI.',
      opening_hook: 'You are probably checking too many tabs to know what changed.',
      who_this_is_for: 'Professionals who follow multiple sources.',
      problem: 'Manually scanning sources takes too much time.',
      how_to_show_it: 'Show the setup once, then the scheduled delivery.',
      expected_outcome: 'Audience understands the value of scheduled delivery.',
      suggested_elements: ['An easy setup prompt', 'The scheduled morning run', 'The delivered digest in Telegram'],
      reference_links: ['https://moclaw.dev/use-cases/daily-news-digest']
    }];
  `, context);

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Drive qualified consideration and sign-ups.',
    primary_kpi: 'Link clicks + Sign-ups',
    cta: '',
    primary_audience: 'Busy professionals who need clearer information and less noise.',
    tracking_link: '',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: 'YouTube',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.match(output, /\*\*Recommended opening hook:\*\* You are probably checking too many tabs to know what changed\./);
  assert.doesNotMatch(output, /\*\*Hook format direction:\*\*/);
  assert.match(output, /\*\*Suggested elements to showcase:\*\*\n- An easy setup prompt\n- The scheduled morning run\n- The delivered digest in Telegram/);
  assert.match(output, /Assets \/ References:\n- \*\*Reference link:\*\* https:\/\/moclaw\.dev\/use-cases\/daily-news-digest/);
});

test('template variable tags do not expose legacy hook format direction placeholders', async () => {
  const context = await loadBrowserScripts();
  const variableTags = context.document.getElementById('variable-tags');

  context.renderVarTags();

  assert.equal(variableTags.innerHTML.includes('{{recommended_hook_direction}}'), false);
  assert.equal(variableTags.innerHTML.includes('{{hook_direction_block}}'), true);
});

test('opening a brief upgrades legacy auto payment terms to the current draft-video wording', async () => {
  const context = await loadBrowserScripts();
  context.formatPrimaryAudienceSuggestion = () => '';

  vm.runInContext(`
    kocs = [{
      id: 'koc_1',
      name: 'Nik',
      platform: 'YouTube',
      email: '',
      use_case_ids: [],
      primary_use_case_id: '',
      brief: {
        payment_schedule_type: 'split_50_script_50_live',
        payment_terms: '50% of the total fee will be paid after the script is reviewed and approved. The remaining 50% will be paid after the video goes live and a valid invoice is received.'
      }
    }];
    useCaseLib = [];
  `, context);

  context.openBriefEditor('koc_1');

  const upgradedTerms = vm.runInContext('briefDraft.payment_terms', context);
  assert.equal(
    upgradedTerms,
    '50% of the total fee will be paid after the draft video is reviewed and approved. The remaining 50% will be paid after the video goes live and a valid invoice is received.'
  );
});

test('mapServerBriefToClient upgrades legacy saved payment terms during bootstrap mapping', async () => {
  const context = await loadBrowserScripts();

  const result = context.mapServerBriefToClient({
    payment_schedule_type: 'split_50_script_50_live',
    payment_terms: '50% of the total fee will be paid after the script is reviewed and approved. The remaining 50% will be paid after the video goes live and a valid invoice is received.'
  });

  assert.equal(
    result.payment_terms,
    '50% of the total fee will be paid after the draft video is reviewed and approved. The remaining 50% will be paid after the video goes live and a valid invoice is received.'
  );
});

test('brief preview keeps CTA guidance concise when tracking link is present', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Drive qualified consideration and sign-ups.',
    primary_kpi: 'Link clicks + Sign-ups',
    cta: "I'll leave the link in the description, just give it a try.",
    primary_audience: 'Busy professionals who need clearer information and less noise.',
    tracking_link: 'https://moclaw.ai/?utm_source=youtube',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: 'YouTube',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.match(output, /### Suggested CTA phrasing\n\n- "I'll leave the link in the description, just give it a try\."/);
  assert.doesNotMatch(output, /- "Try it out\."/);
});

test('brief preview hides empty sections when corresponding left-side fields are blank', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: '',
    campaign_goal: '',
    primary_kpi: '',
    cta: '',
    primary_audience: '',
    tracking_link: '',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: '',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.doesNotMatch(output, /## 2\. Campaign Audience/);
  assert.doesNotMatch(output, /## 3\. Core Use Cases/);
  assert.doesNotMatch(output, /## 4\. Campaign-Specific Posting Requirements/);
  assert.doesNotMatch(output, /## 6\. Delivery Details/);
  assert.doesNotMatch(output, /## 7\. Commercial Terms/);
  assert.doesNotMatch(output, /## 8\. Promotional License/);
  assert.doesNotMatch(output, /## 9\. CTA & Tracking/);
});

test('brief preview omits tracking-only instructions when tracking link is blank', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Walk through a repeatable workflow.',
    primary_kpi: 'Link clicks',
    cta: 'Show viewers where to click and mention the promo code in the outro.',
    primary_audience: 'Operators who need practical automation help.',
    tracking_link: '',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: '',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.doesNotMatch(output, /Use the assigned tracking link exactly as provided/i);
  assert.doesNotMatch(output, /Put the tracking link in the first line of the description/i);
  assert.doesNotMatch(output, /promo code/i);
});

test('brief preview adds tracking link and promo code only when those variables exist', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Walk through a repeatable workflow.',
    primary_kpi: 'Link clicks',
    cta: 'Show viewers where to click and mention the promo code in the outro.',
    primary_audience: 'Operators who need practical automation help.',
    tracking_link: 'https://moclaw.ai/test',
    promo_code: 'MOCLAW50',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: '',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.match(output, /Use the assigned tracking link exactly as provided/i);
  assert.match(output, /Put the tracking link in the first line of the description/i);
  assert.match(output, /\*\*Tracking link:\*\* https:\/\/moclaw\.ai\/test/);
  assert.match(output, /\*\*Promo code:\*\* MOCLAW50/);
});

test('brief preview renders CTA placement in the new structured format when tracking link exists', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Walk through a repeatable workflow.',
    primary_kpi: 'Link clicks',
    cta: "I'll leave the link in the description, just give it a try.",
    primary_audience: 'Operators who need practical automation help.',
    tracking_link: 'https://moclaw.ai/test',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: '',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.match(output, /### CTA placement/);
  assert.match(output, /Mid-video \(after the demo\)/);
  assert.match(output, /Description first line/);
  assert.match(output, /Pinned comment/);
  assert.match(output, /### Suggested CTA phrasing/);
  assert.match(output, /I'll leave the link in the description, just give it a try/);
  assert.equal((output.match(/I'll leave the link in the description, just give it a try/g) || []).length, 1);
  assert.doesNotMatch(output, /under 5 minutes/i);
  assert.doesNotMatch(output, /promo code/i);
});

test('brief preview omits CTA placement block when tracking link is blank', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Walk through a repeatable workflow.',
    primary_kpi: 'Link clicks',
    cta: "I'll leave the link in the description, just give it a try.",
    primary_audience: 'Operators who need practical automation help.',
    tracking_link: '',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: '',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.doesNotMatch(output, /### CTA placement/);
  assert.doesNotMatch(output, /Description first line/);
  assert.doesNotMatch(output, /Pinned comment/);
  assert.doesNotMatch(output, /\*\*Tracking link:\*\*/);
});

test('brief preview renders trending hook and cover poster blocks when provided', async () => {
  const context = await loadBrowserScripts();

  const output = context.renderBriefContent({
    content_type: 'tutorial_how_to_video',
    campaign_goal: 'Walk through a repeatable workflow.',
    primary_kpi: 'Link clicks',
    cta: '',
    primary_audience: '',
    trending_hook_topics: 'DeepSeek, Grok 3',
    trending_hook_angle: 'Frame the opening around why these launches matter for daily work.',
    cover_poster_url: 'https://example.com/poster.png',
    cover_poster_note: 'Keep the poster readable on mobile.',
    tracking_link: '',
    promo_code: '',
    compensation: '',
    currency: '',
    payment_method: '',
    payment_terms: '',
    posting_retention_period: '',
    post_publish_edit_rule: '',
    category_exclusivity_window: '',
    other_sponsor_mention_rule: '',
    script_revision_rounds: '',
    video_revision_rounds: '',
    script_deadline: '',
    draft_deadline: '',
    publish_deadline: '',
    platform: '',
    video_duration: '',
    video_format: '',
    language: '',
    license: '',
    license_duration: '',
    license_region: '',
    notes: ''
  });

  assert.match(output, /Trending hook:\*\* Reference these topics/i);
  assert.match(output, /DeepSeek, Grok 3/i);
  assert.match(output, /Suggested angle:\*\* Frame the opening/i);
  assert.match(output, /Cover \/ thumbnail:\*\* Please use the provided poster/i);
  assert.match(output, /!\[Cover poster\]\(https:\/\/example\.com\/poster\.png\)/i);
  assert.match(output, /Original poster file will be shared as a separate attachment/i);
  assert.match(output, /Note:\*\* Keep the poster readable on mobile/i);
  assert.doesNotMatch(output, /Campaign preset:/i);
});

test('brief vars fall back to the primary use case audience when the field is blank', async () => {
  const context = await loadBrowserScripts();

  vm.runInContext(`
    editingKocId = 'koc_1';
    briefDraft = {
      campaign_preset_id: '',
      primary_audience: '',
      trending_hook_topics: '',
      trending_hook_angle: '',
      cover_poster_url: '',
      cover_poster_note: ''
    };
    kocs = [{
      id: 'koc_1',
      name: 'Nik',
      platform: 'YouTube',
      email: '',
      brief: {},
      use_case_ids: ['uc_1'],
      primary_use_case_id: 'uc_1'
    }];
    useCaseLib = [{
      id: 'uc_1',
      title: 'AI Morning Briefing',
      description: '',
      who_this_is_for: 'Professionals with fragmented mornings.',
      problem: '',
      how_to_show_it: '',
      expected_outcome: '',
      suggested_elements: [],
      reference_links: []
    }];
  `, context);

  const vars = context.getBriefVarsFromDraft();
  assert.equal(vars.primary_audience, 'Professionals with fragmented mornings.');
});

test('mapServerUseCaseToClient preserves structured suggested elements arrays', async () => {
  const context = await loadBrowserScripts();

  const useCase = context.mapServerUseCaseToClient({
    id: 'uc_1',
    title: 'Structured use case',
    description: '',
    opening_hook: 'This is the opener.',
    who_this_is_for: '',
    problem: '',
    how_to_show_it: '',
    expected_outcome: '',
    must_show_elements: 'Old fallback',
    suggested_elements_json: ['Prompt setup', 'Delivered digest'],
    links_json: ['https://example.com/use-case']
  });

  assert.equal(useCase.opening_hook, 'This is the opener.');
  assert.deepEqual(Array.from(useCase.suggested_elements), ['Prompt setup', 'Delivered digest']);
  assert.deepEqual(Array.from(useCase.reference_links), ['https://example.com/use-case']);
});

test('mapServerUseCaseToClient preserves structured reference materials and AI context', async () => {
  const context = await loadBrowserScripts();

  const useCase = context.mapServerUseCaseToClient({
    id: 'uc_2',
    title: 'Prompt-driven workflow',
    description: '',
    who_this_is_for: '',
    problem: '',
    how_to_show_it: '',
    expected_outcome: '',
    must_show_elements: 'Prompt, Result',
    suggested_elements_json: ['Prompt', 'Result'],
    reference_materials_json: [
      { type: 'prompt', title: 'Example prompt', content: 'Create a daily summary.' },
      { type: 'output', title: 'Example output', content: 'Top updates and blockers.' }
    ],
    ai_context_json: {
      audienceKeywords: ['operators'],
      mustHighlight: ['delivery']
    }
  });

  assert.deepEqual(Array.from(useCase.reference_materials), [
    { type: 'prompt', title: 'Example prompt', content: 'Create a daily summary.' },
    { type: 'output', title: 'Example output', content: 'Top updates and blockers.' }
  ]);
  assert.deepEqual(useCase.ai_context, {
    audienceKeywords: ['operators'],
    mustHighlight: ['delivery']
  });
});

test('buildUseCaseMarkdown renders assets and references for the brief', async () => {
  const context = await loadBrowserScripts();

  vm.runInContext(`
    editingKocId = 'koc_1';
    kocs = [{
      id: 'koc_1',
      name: 'Ella',
      platform: 'YouTube',
      email: 'ella@example.com',
      audience_profile_text: '',
      use_case_ids: ['uc_1'],
      primary_use_case_id: 'uc_1',
      brief: {}
    }];
    useCaseLib = [{
      id: 'uc_1',
      title: 'Prompt-based Daily Digest',
      description: 'Turn one prompt into a scheduled briefing.',
      opening_hook: 'Stop scanning every source one by one each morning.',
      who_this_is_for: 'Busy operators.',
      problem: 'Checking updates manually takes too long.',
      how_to_show_it: 'Show the prompt, then the generated digest.',
      expected_outcome: 'The audience understands the daily workflow.',
      suggested_elements: ['Prompt input', 'Digest output'],
      reference_materials: [
        { type: 'prompt', title: 'Example prompt', content: 'Build my daily digest.' },
        { type: 'output', title: 'Example output', content: 'Top 5 updates with summaries.' },
        { type: 'link', title: 'Reference page', url: 'https://example.com/digest' }
      ],
      reference_links: ['https://example.com/digest']
    }];
  `, context);

  const markdown = context.buildUseCaseMarkdown();

  assert.match(markdown, /\*\*Opening hook:\*\* Stop scanning every source one by one each morning\./);
  assert.match(markdown, /Assets \/ References:/);
  assert.match(markdown, /\*\*Example prompt:\*\* Build my daily digest\./);
  assert.match(markdown, /\*\*Example output:\*\* Top 5 updates with summaries\./);
  assert.match(markdown, /\*\*Reference page:\*\* https:\/\/example.com\/digest/);
});
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

async function loadPrimaryAudienceHelpers() {
  const context = vm.createContext({
    console,
    window: {}
  });
  context.globalThis = context;

  const source = await fs.readFile('/Users/ella/Downloads/brief generator 2/public/primary-audience.js', 'utf8');
  vm.runInContext(source, context);
  return context;
}

test('primary audience suggestion turns fragmented mornings use case into campaign-level audience copy', async () => {
  const context = await loadPrimaryAudienceHelpers();

  const result = context.formatPrimaryAudienceSuggestion({
    kocAudience: '',
    useCaseAudience: 'Professionals with fragmented mornings who currently switch between 4-5 apps to piece together what matters for the day ahead.'
  });

  assert.equal(result, 'Busy professionals who want a clearer, lower-friction start to the day.');
});

test('primary audience suggestion turns e-commerce monitoring use case into broader campaign audience copy', async () => {
  const context = await loadPrimaryAudienceHelpers();

  const result = context.formatPrimaryAudienceSuggestion({
    kocAudience: '',
    useCaseAudience: 'E-commerce sellers currently spending 5-10 hours per week manually checking competitor prices on Amazon and copying data into spreadsheets.'
  });

  assert.equal(result, 'E-commerce sellers and operators who need faster competitor monitoring and pricing visibility.');
});

test('primary audience suggestion combines KOC audience with the derived campaign audience instead of repeating use-case wording', async () => {
  const context = await loadPrimaryAudienceHelpers();

  const result = context.formatPrimaryAudienceSuggestion({
    kocAudience: 'Productivity-focused creators with a tech-savvy audience',
    useCaseAudience: 'Professionals who need to track specific industry news but lack time to manually scan multiple sources.'
  });

  assert.equal(
    result,
    'Productivity-focused creators with a tech-savvy audience who are especially likely to care about busy professionals who want a faster way to stay on top of relevant industry news.'
  );
});

test('primary audience rules provide a generic fallback for broader professional use cases', async () => {
  const context = await loadPrimaryAudienceHelpers();

  const result = context.deriveCampaignAudience(
    'Operations managers and small teams who need a more reliable daily workflow across recurring admin tasks.'
  );

  assert.equal(
    result,
    'Professionals and operators who want a simpler, more efficient workflow for this use case'
  );
});

test('audience suggestion candidates include legacy auto-generated e-commerce copy so stale values can be replaced', async () => {
  const context = await loadPrimaryAudienceHelpers();

  const result = context.listAudienceSuggestionCandidates({
    kocAudience: '',
    useCaseAudience: 'E-commerce sellers currently spending 5-10 hours per week manually checking competitor prices on Amazon and copying data into spreadsheets.'
  });

  assert.ok(
    result.includes('E-commerce operators who need fast competitor research.'),
    'expected legacy e-commerce audience copy to remain recognized as system-generated'
  );
  assert.ok(
    result.includes('E-commerce operators who need fast competitor research'),
    'expected legacy e-commerce audience copy without punctuation to remain recognized as system-generated'
  );
  assert.equal(
    result[0],
    'E-commerce sellers and operators who need faster competitor monitoring and pricing visibility.'
  );
});

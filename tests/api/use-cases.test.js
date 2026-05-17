import test from 'node:test';
import assert from 'node:assert/strict';
import { createUseCaseRoutes } from '../../server/routes/use-cases.js';
import { UserFacingError } from '../../server/lib/errors.js';

function getRouteHandler(app, routePath, method) {
  const layer = app.stack.find(
    entry => entry.route?.path === routePath && entry.route.methods?.[method]
  );
  return layer.route.stack[0].handle;
}

async function invokeJsonRoute(handler, req = {}) {
  let statusCode = 200;
  let jsonBody;

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonBody = body;
      return this;
    },
    end() {
      return this;
    }
  };

  await handler(req, res, error => {
    throw error;
  });

  return { statusCode, jsonBody };
}

test('PATCH /api/use-cases/:id updates structured use case fields', async () => {
  const calls = [];
  const router = createUseCaseRoutes({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 'uc_1',
          title: 'Updated title',
          description: 'Updated description',
          opening_hook: 'Most token research is built on low-credibility sources.',
          who_this_is_for: 'Creators',
          problem: 'Manual research is slow',
          how_to_show_it: 'Show the workflow',
          expected_outcome: 'Audience understands the value',
          must_show_elements: 'Prompt and result',
          suggested_elements_json: ['Prompt and result'],
          links_json: ['https://example.com']
        }]
      };
    }
  });
  const handler = getRouteHandler(router, '/:id', 'patch');

  const response = await invokeJsonRoute(handler, {
    params: { id: 'uc_1' },
      body: {
        title: 'Updated title',
        description: 'Updated description',
        openingHook: 'Most token research is built on low-credibility sources.',
        whoThisIsFor: 'Creators',
        problem: 'Manual research is slow',
        howToShowIt: 'Show the workflow',
        expectedOutcome: 'Audience understands the value',
        suggestedElements: ['Prompt and result'],
        links: ['https://example.com'],
        referenceMaterials: [
          { type: 'prompt', title: 'Example prompt', content: 'Summarize the latest stories.' },
          { type: 'output', title: 'Example output', content: 'Top 5 stories with summaries.' }
        ],
        aiContext: {
          audienceKeywords: ['crypto creators'],
          mustHighlight: ['scheduled delivery']
        }
      }
    });

  assert.equal(response.statusCode, 200);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params[0], 'Updated title');
  assert.equal(calls[0].params[2], 'Most token research is built on low-credibility sources.');
  assert.equal(calls[0].params[7], 'Prompt and result');
  assert.equal(calls[0].params[8], JSON.stringify(['Prompt and result']));
  assert.equal(calls[0].params[9], JSON.stringify([
    { type: 'prompt', title: 'Example prompt', content: 'Summarize the latest stories.' },
    { type: 'output', title: 'Example output', content: 'Top 5 stories with summaries.' }
  ]));
  assert.equal(calls[0].params[10], JSON.stringify({
    audienceKeywords: ['crypto creators'],
    mustHighlight: ['scheduled delivery']
  }));
  assert.equal(calls[0].params[11], JSON.stringify(['https://example.com']));
  assert.equal(calls[0].params[12], 'uc_1');
  assert.equal(response.jsonBody.id, 'uc_1');
});

test('POST /api/use-cases accepts suggested element arrays and stores a legacy text fallback', async () => {
  const calls = [];
  const router = createUseCaseRoutes({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 'uc_created',
          title: 'Created title',
          description: 'Created description',
          opening_hook: 'Stop checking prices manually.',
          who_this_is_for: 'Operators',
          problem: 'Manual work is slow',
          how_to_show_it: 'Show the setup',
          expected_outcome: 'Audience sees the value',
          must_show_elements: 'Prompt, Digest',
          suggested_elements_json: ['Prompt', 'Digest'],
          links_json: ['https://example.com/use-case']
        }]
      };
    }
  });
  const handler = getRouteHandler(router, '/', 'post');

  const response = await invokeJsonRoute(handler, {
      body: {
        title: 'Created title',
        description: 'Created description',
        openingHook: 'Stop checking prices manually.',
        whoThisIsFor: 'Operators',
        problem: 'Manual work is slow',
        howToShowIt: 'Show the setup',
        expectedOutcome: 'Audience sees the value',
        suggestedElements: ['Prompt', 'Digest'],
        links: ['https://example.com/use-case'],
        referenceMaterials: [
          { type: 'link', title: 'Use case page', url: 'https://example.com/use-case' },
          { type: 'prompt', title: 'Prompt', content: 'Create a daily digest for me.' }
        ],
        aiContext: {
          audienceKeywords: ['operators'],
          problemKeywords: ['information overload']
        }
      }
    });

  assert.equal(response.statusCode, 201);
  assert.equal(calls[0].params[2], 'Created description');
  assert.equal(calls[0].params[3], 'Stop checking prices manually.');
  assert.equal(calls[0].params[8], 'Prompt, Digest');
  assert.equal(calls[0].params[9], JSON.stringify(['Prompt', 'Digest']));
  assert.equal(calls[0].params[10], JSON.stringify([
    { type: 'link', title: 'Use case page', url: 'https://example.com/use-case' },
    { type: 'prompt', title: 'Prompt', content: 'Create a daily digest for me.' }
  ]));
  assert.equal(calls[0].params[11], JSON.stringify({
    audienceKeywords: ['operators'],
    problemKeywords: ['information overload']
  }));
  assert.equal(calls[0].params[12], JSON.stringify(['https://example.com/use-case']));
  assert.equal(response.jsonBody.id, 'uc_created');
});

test('POST /api/use-cases/generate rejects invalid URLs', async () => {
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
      generateUseCaseDraft: async () => {
        throw new Error('should not be called');
      }
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: { url: 'not-a-url' }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody.error, 'Please enter a valid webpage URL.');
});

test('POST /api/use-cases/generate returns normalized AI draft fields', async () => {
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
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
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: { url: 'https://example.com/use-case' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.title, 'Monitoring price on Amazon');
  assert.deepEqual(response.jsonBody.suggested_elements, ['Product page, setup, update, result.']);
  assert.deepEqual(response.jsonBody.links, ['https://example.com/use-case']);
});

test('POST /api/use-cases/generate preserves separate reference links alongside structured materials', async () => {
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
      generateUseCaseDraft: async () => ({
        title: 'Digest workflow',
        description: 'Turn one prompt into a reusable digest.',
        who_this_is_for: 'Operators',
        problem: 'Too much scattered information',
        how_to_show_it: 'Show the prompt and the delivered digest',
        expected_outcome: 'Audience understands the workflow',
        reference_materials: [
          { type: 'prompt', title: 'Prompt', content: 'Build my daily digest.' },
          { type: 'output', title: 'Output', content: 'Five updates.' }
        ],
        links: ['https://example.com/digest']
      })
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: { url: 'https://example.com/use-case' }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody.links, ['https://example.com/digest']);
  assert.deepEqual(response.jsonBody.reference_materials, [
    { type: 'prompt', title: 'Prompt', content: 'Build my daily digest.' },
    { type: 'output', title: 'Output', content: 'Five updates.' },
    { type: 'link', title: 'Reference link', url: 'https://example.com/digest' }
  ]);
});

test('POST /api/use-cases/generate accepts manual prompt/output materials without a source URL', async () => {
  let receivedInput = null;
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
      generateUseCaseDraft: async input => {
        receivedInput = input;
        return {
          title: 'AI Morning Briefing',
          description: 'Turn a prompt and output into a reusable daily briefing workflow.',
          opening_hook: 'Most people do morning research the slowest possible way.',
          who_this_is_for: 'Busy operators who want a concise morning overview.',
          problem: 'Important updates get missed across multiple tools.',
          how_to_show_it: 'Show the prompt, then the generated morning summary.',
          expected_outcome: 'The audience sees how one prompt can produce a useful morning digest.',
          suggested_elements: ['Prompt input', 'Generated briefing'],
          reference_materials: [
            { type: 'prompt', title: 'Prompt', content: 'Give me my morning briefing.' },
            { type: 'output', title: 'Output', content: 'Top priorities, new messages, and blockers.' }
          ]
        };
      }
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: {
      prompt: 'Give me my morning briefing.',
      outputText: 'Top priorities, new messages, and blockers.',
      screenshotNote: 'Show the final digest card in the Telegram delivery view.',
      audienceKeywords: ['busy operators'],
      mustHighlight: ['scheduled delivery']
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody.opening_hook, 'Most people do morning research the slowest possible way.');
  assert.deepEqual(receivedInput, {
    url: '',
    prompt: 'Give me my morning briefing.',
    outputText: 'Top priorities, new messages, and blockers.',
    screenshotNote: 'Show the final digest card in the Telegram delivery view.',
    aiContext: {
      audienceKeywords: ['busy operators'],
      mustHighlight: ['scheduled delivery']
    },
    fieldHints: {}
  });
  assert.equal(response.jsonBody.title, 'AI Morning Briefing');
});

test('POST /api/use-cases/generate forwards field hints so AI can refine the drafted sections', async () => {
  let receivedInput = null;
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
      generateUseCaseDraft: async input => {
        receivedInput = input;
        return {
          title: 'AI Morning Briefing',
          description: 'Generated description',
          opening_hook: 'Generated opening hook',
          who_this_is_for: 'Generated audience',
          problem: 'Generated problem',
          how_to_show_it: 'Generated how to show it',
          expected_outcome: 'Generated outcome',
          suggested_elements: ['Prompt input', 'Digest delivery']
        };
      }
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: {
      prompt: 'Give me my morning briefing.',
      fieldHints: {
        opening_hook: 'Your current crypto research is probably built on weak sources.',
        how_to_show_it: 'Start by showing the profit chart, then begin the tutorial.',
        expected_outcome: 'Viewers should immediately see the business upside before the walkthrough.'
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(receivedInput.fieldHints, {
    opening_hook: 'Your current crypto research is probably built on weak sources.',
    how_to_show_it: 'Start by showing the profit chart, then begin the tutorial.',
    expected_outcome: 'Viewers should immediately see the business upside before the walkthrough.'
  });
  assert.equal(response.jsonBody.opening_hook, 'Generated opening hook');
  assert.equal(response.jsonBody.how_to_show_it, 'Generated how to show it');
  assert.equal(response.jsonBody.expected_outcome, 'Generated outcome');
  assert.equal(response.jsonBody.description, 'Generated description');
});

test('POST /api/use-cases/generate returns a clean error when generation fails', async () => {
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
      generateUseCaseDraft: async () => {
        throw new UserFacingError('Failed to generate use case draft.');
      }
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: { url: 'https://example.com/use-case' }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody.error, 'Failed to generate use case draft.');
});

test('POST /api/use-cases/generate returns a clean 404 message when extraction fails on missing page', async () => {
  const router = createUseCaseRoutes(
    { query: async () => ({ rows: [] }) },
    {
      generateUseCaseDraft: async () => {
        throw new UserFacingError('This webpage returned 404 Not Found.');
      }
    }
  );
  const handler = getRouteHandler(router, '/generate', 'post');

  const response = await invokeJsonRoute(handler, {
    body: { url: 'https://example.com/missing' }
  });

  assert.equal(response.statusCode, 400);
  assert.equal(response.jsonBody.error, 'This webpage returned 404 Not Found.');
});

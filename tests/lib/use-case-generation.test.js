import test from 'node:test';
import assert from 'node:assert/strict';
import { createGenerateUseCaseDraft } from '../../server/lib/use-case-generation.js';

function createAiResponse(payload) {
  return {
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: `\`\`\`json\n${JSON.stringify(payload)}\n\`\`\``
            }
          }
        ]
      };
    }
  };
}

function createAiThinkingResponse(payload) {
  return {
    ok: true,
    async json() {
      return {
        choices: [
          {
            message: {
              content: `<think>I will prepare the requested JSON.</think>\n\n${JSON.stringify(payload)}`
            }
          }
        ]
      };
    }
  };
}

test('use case generation falls back to rendered extraction for app-shell pages', async () => {
  let renderedCalls = 0;

  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return createAiResponse({
          title: 'Product Selection on eBay',
          description: 'Show product selection.',
          who_this_is_for: 'Sellers comparing options.',
          problem: 'Selection is slow.',
          how_to_show_it: 'Show comparison.',
          expected_outcome: 'Audience understands the workflow.',
          must_show_elements: 'Search, comparison, shortlist.',
          links: ['https://example.com/ebay']
        });
      }

      return {
        ok: true,
        async text() {
          return `
            <html>
              <head>
                <title>MoClaw — AI Agent for eBay Sellers</title>
                <meta property="og:description" content="Solves product sourcing research and pricing strategy." />
              </head>
              <body>
                <div id="root"></div>
                <script type="module" src="/assets/index.js"></script>
              </body>
            </html>
          `;
        }
      };
    },
    renderedExtractor: async () => {
      renderedCalls += 1;
      return {
        pageTitle: 'Rendered eBay Page',
        pageText: 'Use MoClaw for product sourcing research and pricing strategy on eBay.',
        metaDescription: 'Solves product sourcing research and pricing strategy.'
      };
    }
  });

  await generateUseCaseDraft({ url: 'https://example.com/ebay' });

  assert.equal(renderedCalls, 1);
});

test('use case generation stays on static extraction for content-heavy pages', async () => {
  let renderedCalls = 0;

  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return createAiResponse({
          title: 'Amazon Price Monitoring',
          description: 'Show price monitoring.',
          who_this_is_for: 'Operators watching competitor prices.',
          problem: 'Manual tracking is repetitive.',
          how_to_show_it: 'Show setup and CSV output.',
          expected_outcome: 'Audience understands the saved time.',
          must_show_elements: 'Prompt, schedule, CSV.',
          links: ['https://example.com/amazon']
        });
      }

      return {
        ok: true,
        async text() {
          return `
            <html>
              <head><title>How to Monitor Competitor Prices Automatically</title></head>
              <body>
                <article>
                  <h1>How to Monitor Competitor Prices Automatically</h1>
                  <p>Track Amazon prices daily, get CSV reports, and replace manual spreadsheet work.</p>
                  <p>This workflow saves 5-10 hours each week for small e-commerce teams.</p>
                </article>
              </body>
            </html>
          `;
        }
      };
    },
    renderedExtractor: async () => {
      renderedCalls += 1;
      return {
        pageTitle: 'Rendered fallback',
        pageText: 'Should not be used.',
        metaDescription: ''
      };
    }
  });

  await generateUseCaseDraft({ url: 'https://example.com/amazon' });

  assert.equal(renderedCalls, 0);
});

test('use case generation parses AI responses that include think tags before JSON', async () => {
  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return createAiThinkingResponse({
          title: 'Automated Follow-Ups',
          description: 'Show follow-up drafting.',
          who_this_is_for: 'Operators handling inbound leads.',
          problem: 'Manual follow-ups are inconsistent.',
          how_to_show_it: 'Show the draft and send flow.',
          expected_outcome: 'Audience sees how follow-up work becomes faster.',
          must_show_elements: 'Lead context, draft reply, final send.',
          links: ['https://example.com/followups']
        });
      }

      return {
        ok: true,
        async text() {
          return `
            <html>
              <head><title>Automated Follow-Ups</title></head>
              <body>
                <article>
                  <h1>Automated Follow-Ups</h1>
                  <p>Draft and send consistent replies faster.</p>
                </article>
              </body>
            </html>
          `;
        }
      };
    }
  });

  const draft = await generateUseCaseDraft({ url: 'https://example.com/followups' });

  assert.equal(draft.title, 'Automated Follow-Ups');
  assert.equal(draft.problem, 'Manual follow-ups are inconsistent.');
  assert.deepEqual(draft.links, ['https://example.com/followups']);
});

test('use case generation surfaces DeepSeek rate limit errors clearly', async () => {
  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return {
          ok: false,
          status: 429,
          async json() {
            return {
              error: {
                message: 'usage limit exceeded (2056)'
              }
            };
          }
        };
      }

      return {
        ok: true,
        async text() {
          return '<html><body><article><p>Prompt-only generation test.</p></article></body></html>';
        }
      };
    }
  });

  await assert.rejects(
    () => generateUseCaseDraft({ prompt: 'Create my daily morning digest.' }),
    error => {
      assert.equal(error.name, 'UserFacingError');
      assert.equal(error.statusCode, 429);
      assert.match(error.message, /DeepSeek rate limit/i);
      assert.match(error.message, /usage limit exceeded/i);
      return true;
    }
  );
});

test('use case generation surfaces DeepSeek authentication failures clearly', async () => {
  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'bad-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return {
          ok: false,
          status: 401,
          async json() {
            return {
              error: {
                message: 'Authentication Fails, Your api key: ****abcd is invalid'
              }
            };
          }
        };
      }

      return {
        ok: true,
        async text() {
          return '<html><body><article><p>Prompt-only generation test.</p></article></body></html>';
        }
      };
    }
  });

  await assert.rejects(
    () => generateUseCaseDraft({ prompt: 'Create my daily morning digest.' }),
    error => {
      assert.equal(error.name, 'UserFacingError');
      assert.equal(error.statusCode, 401);
      assert.match(error.message, /DeepSeek authentication failed/i);
      assert.match(error.message, /api key/i);
      return true;
    }
  );
});

test('use case generation keeps comma-heavy must_show_elements together when AI does not return an array', async () => {
  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return createAiResponse({
          title: 'Morning AI News Briefing',
          description: 'Use one prompt to generate a morning digest.',
          who_this_is_for: 'Professionals tracking multiple AI sources.',
          problem: 'Checking many sources manually each morning takes too long.',
          how_to_show_it: 'Show the prompt and the returned digest.',
          expected_outcome: 'Audience understands the time saved.',
          must_show_elements:
            "The exact prompt typed into the AI assistant: 'Summarize my morning AI news sources and push the top 5 updates.', The list of configured news sources visible before submission., The assistant response showing exactly 5 updates with short summaries."
        });
      }

      return {
        ok: true,
        async text() {
          return '<html><body><article><p>Prompt-only generation test.</p></article></body></html>';
        }
      };
    }
  });

  const draft = await generateUseCaseDraft({ prompt: 'Summarize my morning AI news sources and push the top 5 updates.' });

  assert.deepEqual(draft.suggested_elements, [
    "The exact prompt typed into the AI assistant: 'Summarize my morning AI news sources and push the top 5 updates.', The list of configured news sources visible before submission., The assistant response showing exactly 5 updates with short summaries."
  ]);
});

test('use case generation merges lower-case continuation fragments inside suggested_elements arrays', async () => {
  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return createAiResponse({
          title: 'Morning AI News Briefing',
          description: 'Use one prompt to generate a morning digest.',
          who_this_is_for: 'Professionals tracking multiple AI sources.',
          problem: 'Checking many sources manually each morning takes too long.',
          how_to_show_it: 'Show the prompt and the returned digest.',
          expected_outcome: 'Audience understands the time saved.',
          suggested_elements: [
            'The AI output – a clean numbered list of 5 AI news updates',
            'each with a short summary and source name',
            'Time saved indicator (optional',
            'e.g. a clock or timer showing the process took under 1 minute)'
          ]
        });
      }

      return {
        ok: true,
        async text() {
          return '<html><body><article><p>Prompt-only generation test.</p></article></body></html>';
        }
      };
    }
  });

  const draft = await generateUseCaseDraft({ prompt: 'Summarize my morning AI news sources and push the top 5 updates.' });

  assert.deepEqual(draft.suggested_elements, [
    'The AI output – a clean numbered list of 5 AI news updates, each with a short summary and source name',
    'Time saved indicator (optional, e.g. a clock or timer showing the process took under 1 minute)'
  ]);
});

test('use case generation treats field hints as guidance instead of locking the same copy', async () => {
  const generateUseCaseDraft = createGenerateUseCaseDraft({
    apiKey: 'test-key',
    fetch: async url => {
      if (String(url).includes('deepseek')) {
        return createAiResponse({
          title: 'Crypto Token Review Workflow',
          description: 'Turn one evaluation prompt into a repeatable token review workflow.',
          opening_hook: 'Most token research looks rigorous until you inspect the source quality.',
          who_this_is_for: 'Crypto creators who want a structured evaluation angle.',
          problem: 'Token reviews often feel subjective or rushed.',
          how_to_show_it: 'Open with the profit chart Moclaw helped produce, then transition into the evaluation workflow tutorial.',
          expected_outcome: 'Viewers understand how the workflow turns token research into a more disciplined, repeatable process.'
        });
      }

      return {
        ok: true,
        async text() {
          return '<html><body><article><p>Prompt-only generation test.</p></article></body></html>';
        }
      };
    }
  });

  const draft = await generateUseCaseDraft({
    prompt: 'Evaluate any crypto token with clear credibility rules and a numeric output.',
    fieldHints: {
      opening_hook: 'Most crypto research is built on weak sources.',
      how_to_show_it: 'Show the profit/result chart Moclaw helped produce first, then transition into the tutorial workflow.',
      expected_outcome: 'Audience learns a concrete framework for evaluating any crypto token.'
    }
  });

  assert.equal(
    draft.opening_hook,
    'Most token research looks rigorous until you inspect the source quality.'
  );
  assert.equal(
    draft.how_to_show_it,
    'Open with the profit chart Moclaw helped produce, then transition into the evaluation workflow tutorial.'
  );
  assert.equal(
    draft.expected_outcome,
    'Viewers understand how the workflow turns token research into a more disciplined, repeatable process.'
  );
});

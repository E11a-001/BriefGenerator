import test from 'node:test';
import assert from 'node:assert/strict';
import { createBootstrapRoutes } from '../../server/routes/bootstrap.js';

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
    }
  };

  await handler(req, res, error => {
    throw error;
  });

  return { statusCode, jsonBody };
}

test('GET /api/bootstrap returns empty shared payload', async () => {
  const router = createBootstrapRoutes({
    query: async () => ({ rows: [] })
  });
  const handler = getRouteHandler(router, '/', 'get');

  const response = await invokeJsonRoute(handler);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, {
    kocs: [],
    useCases: [],
    template: null,
    campaignPresets: [],
    briefs: [],
    history: {
      tracking_link: [],
      license: [],
      notes: []
    }
  });
});

test('GET /api/bootstrap includes audience profile text and images on kocs', async () => {
  const responses = [
    {
      rows: [
        {
          id: 'koc_1',
          name: '@creator',
          platform: 'YouTube',
          email: '',
          channel_url: '',
          status: 'draft',
          audience_profile_text: 'Women 18-24, beauty and lifestyle audience',
          primary_use_case_id: 'uc_1'
        }
      ]
    },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    { rows: [] },
    {
      rows: [
        {
          id: 'img_1',
          koc_id: 'koc_1',
          file_name: 'audience.png',
          file_url: '/uploads/audience/koc_1/audience.png'
        }
      ]
    }
  ];

  const router = createBootstrapRoutes({
    query: async () => responses.shift() || { rows: [] }
  });
  const handler = getRouteHandler(router, '/', 'get');

  const response = await invokeJsonRoute(handler);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody.kocs, [
    {
      id: 'koc_1',
      name: '@creator',
      platform: 'YouTube',
      email: '',
      channel_url: '',
      status: 'draft',
      audience_profile_text: 'Women 18-24, beauty and lifestyle audience',
      primary_use_case_id: 'uc_1',
      use_case_ids: [],
      audience_images: [
        {
          id: 'img_1',
          koc_id: 'koc_1',
          file_name: 'audience.png',
          file_url: '/uploads/audience/koc_1/audience.png'
        }
      ]
    }
  ]);
});

test('GET /api/bootstrap normalizes legacy template copy and duration-only format values', async () => {
  const responses = [
    { rows: [] },
    { rows: [] },
    {
      rows: [
        {
          id: 'global',
          name: 'Global Template',
          content: '# Brief\n\n### Do not use\n\n- Moclaw\n- @MoClaw AI\n- #MoClaw AI\n'
        }
      ]
    },
    {
      rows: [
        {
          id: 'brief_1',
          koc_id: 'koc_1',
          video_format: '6min',
          tracking_link: '',
          license: '',
          notes: ''
        },
        {
          id: 'brief_2',
          koc_id: 'koc_2',
          video_format: 'horizontal, English voice-over',
          tracking_link: '',
          license: '',
          notes: ''
        }
      ]
    },
    { rows: [] },
    { rows: [] }
  ];

  const router = createBootstrapRoutes({
    query: async () => responses.shift() || { rows: [] }
  });
  const handler = getRouteHandler(router, '/', 'get');

  const response = await invokeJsonRoute(handler);

  assert.equal(response.statusCode, 200);
  assert.match(response.jsonBody.template.content, /\n- Moclaw\n/);
  assert.doesNotMatch(response.jsonBody.template.content, /@MoClaw AI/);
  assert.doesNotMatch(response.jsonBody.template.content, /#MoClaw AI/);
  assert.equal(response.jsonBody.briefs[0].video_format, '');
  assert.equal(response.jsonBody.briefs[1].video_format, 'horizontal, English voice-over');
  assert.equal(Object.prototype.hasOwnProperty.call(response.jsonBody.history, 'video_format'), false);
});

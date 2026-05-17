import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createCampaignPresetsRoutes } from '../../server/routes/campaign-presets.js';

function getRouteHandler(app, routePath, method) {
  const layer = app.stack.find(
    entry => entry.route?.path === routePath && entry.route.methods?.[method]
  );
  return layer.route.stack[0].handle;
}

async function invokeJsonRoute(handler, req = {}) {
  let statusCode = 200;
  let jsonBody;
  let ended = false;

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
      ended = true;
      return this;
    }
  };

  await handler(req, res, error => {
    throw error;
  });

  return { statusCode, jsonBody, ended };
}

test('GET /api/campaign-presets returns preset list', async () => {
  const router = createCampaignPresetsRoutes({
    query: async () => ({
      rows: [{ id: 'preset_1', name: 'Q2 DeepSeek Wave' }]
    })
  });
  const handler = getRouteHandler(router, '/', 'get');

  const response = await invokeJsonRoute(handler);

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.jsonBody, [{ id: 'preset_1', name: 'Q2 DeepSeek Wave' }]);
});

test('POST /api/campaign-presets saves a preset', async () => {
  const calls = [];
  const router = createCampaignPresetsRoutes({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{
          id: params[0],
          name: params[1],
          trending_hook_topics: params[2],
          trending_hook_angle: params[3],
          cover_poster_url: params[4],
          cover_poster_note: params[5]
        }]
      };
    }
  });
  const handler = getRouteHandler(router, '/', 'post');

  const response = await invokeJsonRoute(handler, {
    body: {
      name: 'Q2 DeepSeek Wave',
      trendingHookTopics: 'DeepSeek, Grok 3',
      trendingHookAngle: 'Compare the buzz with practical daily workflows.',
      coverPosterUrl: 'https://example.com/poster.png',
      coverPosterNote: 'Use this as the thumbnail reference.'
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].params[1], 'Q2 DeepSeek Wave');
  assert.equal(calls[0].params[2], 'DeepSeek, Grok 3');
  assert.equal(calls[0].params[5], 'Use this as the thumbnail reference.');
});

test('PUT /api/campaign-presets/:id updates a preset', async () => {
  const calls = [];
  const router = createCampaignPresetsRoutes({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{
          id: params[5],
          name: params[0]
        }]
      };
    }
  });
  const handler = getRouteHandler(router, '/:id', 'put');

  const response = await invokeJsonRoute(handler, {
    params: { id: 'preset_1' },
    body: {
      name: 'Updated Preset'
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].params[5], 'preset_1');
  assert.equal(response.jsonBody.name, 'Updated Preset');
});

test('DELETE /api/campaign-presets/:id removes a preset', async () => {
  const calls = [];
  const router = createCampaignPresetsRoutes({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return { rows: [] };
    }
  });
  const handler = getRouteHandler(router, '/:id', 'delete');

  const response = await invokeJsonRoute(handler, {
    params: { id: 'preset_1' }
  });

  assert.equal(response.statusCode, 204);
  assert.equal(response.ended, true);
  assert.equal(calls[0].params[0], 'preset_1');
});

test('POST /api/campaign-presets/:id/poster stores uploaded poster and updates cover_poster_url', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-generator-preset-poster-'));
  const calls = [];
  const router = createCampaignPresetsRoutes({
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      if (sql === 'select * from campaign_presets order by created_at desc') {
        return {
          rows: [{
            id: 'preset_1',
            name: 'Free DeepSeek V4 Pro + OpenClaw',
            trending_hook_topics: 'DeepSeek',
            trending_hook_angle: 'Lead with the free angle.',
            cover_poster_url: '',
            cover_poster_note: 'Keep the headline readable.'
          }]
        };
      }
      return {
        rows: [{
          id: 'preset_1',
          name: params[0],
          trending_hook_topics: params[1],
          trending_hook_angle: params[2],
          cover_poster_url: params[3],
          cover_poster_note: params[4]
        }]
      };
    }
  }, { uploadsDir: tempDir });
  const handler = getRouteHandler(router, '/:id/poster', 'post');

  const response = await invokeJsonRoute(handler, {
    params: { id: 'preset_1' },
    body: {
      fileName: 'poster.png',
      dataUrl: 'data:image/png;base64,aGVsbG8='
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.jsonBody.cover_poster_url, '/uploads/campaign-presets/preset_1/preset_1-poster.png');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].params[3], '/uploads/campaign-presets/preset_1/preset_1-poster.png');

  const savedFile = path.join(tempDir, 'campaign-presets', 'preset_1', 'preset_1-poster.png');
  const savedContent = await fs.readFile(savedFile, 'utf8');
  assert.equal(savedContent, 'hello');

  await fs.rm(tempDir, { recursive: true, force: true });
});

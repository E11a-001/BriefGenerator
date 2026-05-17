import test from 'node:test';
import assert from 'node:assert/strict';
import { createAgreementRoutes, createSaveAgreementHandler } from '../../server/routes/agreements.js';

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

test('GET /api/agreements/:kocId returns null when no agreement exists', async () => {
  const router = createAgreementRoutes({
    query: async () => ({ rows: [] })
  });
  const handler = getRouteHandler(router, '/:kocId', 'get');

  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_1' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody, null);
});

test('PUT /api/agreements/:kocId saves agreement payload', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 'agreement_koc_1',
          koc_id: 'koc_1',
          template_version: 'agreement_v1',
          field_values_json: { sponsor_name: 'Tomato' }
        }]
      };
    }
  };

  const handler = createSaveAgreementHandler(db);
  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_1' },
    body: {
      templateVersion: 'agreement_v1',
      fields: {
        sponsor_name: 'Tomato'
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].params[0], 'agreement_koc_1');
  assert.equal(calls[0].params[1], 'koc_1');
  assert.equal(calls[0].params[2], 'agreement_v1');
  assert.equal(calls[0].params[3], JSON.stringify({ sponsor_name: 'Tomato' }));
});

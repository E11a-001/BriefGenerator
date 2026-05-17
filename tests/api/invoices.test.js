import test from 'node:test';
import assert from 'node:assert/strict';
import { createInvoiceRoutes, createSaveInvoiceHandler } from '../../server/routes/invoices.js';

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

test('GET /api/invoices/:kocId returns null when no invoice exists', async () => {
  const router = createInvoiceRoutes({
    query: async () => ({ rows: [] })
  });
  const handler = getRouteHandler(router, '/:kocId', 'get');

  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_1' }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.jsonBody, null);
});

test('PUT /api/invoices/:kocId saves invoice payload', async () => {
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [{
          id: 'invoice_koc_1',
          koc_id: 'koc_1',
          template_version: 'invoice_v1',
          field_values_json: { invoice_number: 'INV-001' }
        }]
      };
    }
  };

  const handler = createSaveInvoiceHandler(db);
  const response = await invokeJsonRoute(handler, {
    params: { kocId: 'koc_1' },
    body: {
      templateVersion: 'invoice_v1',
      fields: {
        invoice_number: 'INV-001'
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(calls[0].params[0], 'invoice_koc_1');
  assert.equal(calls[0].params[1], 'koc_1');
  assert.equal(calls[0].params[2], 'invoice_v1');
  assert.equal(calls[0].params[3], JSON.stringify({ invoice_number: 'INV-001' }));
});

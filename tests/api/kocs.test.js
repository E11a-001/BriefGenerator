import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createAudienceImageUploadHandler, createKocRoutes } from '../../server/routes/kocs.js';

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

function getRouteHandler(router, routePath, method) {
  const layer = router.stack.find(
    entry => entry.route?.path === routePath && entry.route.methods?.[method]
  );
  return layer.route.stack[0].handle;
}

test('PUT /api/kocs/:id/use-cases persists primary use case selection', async () => {
  const calls = [];
  const db = {
    connect: async () => ({
      async query(sql, params = []) {
        calls.push({ sql, params });
        return { rows: [{ id: 'koc_1', primary_use_case_id: 'uc_2' }] };
      },
      release() {}
    })
  };

  const router = createKocRoutes(db, {});
  const handler = getRouteHandler(router, '/:id/use-cases', 'put');

  const response = await invokeJsonRoute(handler, {
    params: { id: 'koc_1' },
    body: {
      useCaseIds: ['uc_1', 'uc_2'],
      primaryUseCaseId: 'uc_2'
    }
  });

  assert.equal(response.statusCode, 204);
  assert.equal(calls[0].sql, 'BEGIN');
  assert.equal(calls[1].sql, 'delete from koc_use_cases where koc_id = $1');
  assert.equal(calls[2].params[1], 'uc_1');
  assert.equal(calls[3].params[1], 'uc_2');
  assert.equal(calls[4].sql, 'update kocs set primary_use_case_id = $1, updated_at = now() where id = $2 returning *');
  assert.deepEqual(calls[4].params, ['uc_2', 'koc_1']);
});

test('POST /api/kocs/:id/audience-images stores uploaded image metadata and file', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'brief-generator-audience-'));
  const calls = [];
  const db = {
    query: async (sql, params = []) => {
      calls.push({ sql, params });
      return {
        rows: [
          {
            id: 'img_1',
            koc_id: 'koc_1',
            file_name: 'audience.png',
            file_url: '/uploads/audience/koc_1/img_1-audience.png'
          }
        ]
      };
    }
  };

  const handler = createAudienceImageUploadHandler(db, tempDir);

  const response = await invokeJsonRoute(handler, {
    params: { id: 'koc_1' },
    body: {
      fileName: 'audience.png',
      dataUrl: 'data:image/png;base64,aGVsbG8='
    }
  });

  assert.equal(response.statusCode, 201);
  assert.equal(response.jsonBody.file_name, 'audience.png');
  assert.equal(calls.length, 1);
  assert.match(calls[0].params[0], /^img_/);
  assert.equal(calls[0].params[1], 'koc_1');
  assert.equal(calls[0].params[2], 'audience.png');
  assert.equal(calls[0].params[3], `/uploads/audience/koc_1/${calls[0].params[0]}-audience.png`);

  const savedFile = path.join(tempDir, 'audience', 'koc_1', `${calls[0].params[0]}-audience.png`);
  const savedContent = await fs.readFile(savedFile, 'utf8');
  assert.equal(savedContent, 'hello');

  await fs.rm(tempDir, { recursive: true, force: true });
});

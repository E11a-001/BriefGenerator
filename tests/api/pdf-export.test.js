import test from 'node:test';
import assert from 'node:assert/strict';
import { createPdfExportRoutes } from '../../server/routes/pdf-export.js';

function getRouteHandler(router, routePath, method) {
  const layer = router.stack.find(
    entry => entry.route?.path === routePath && entry.route.methods?.[method]
  );
  return layer.route.stack[0].handle;
}

async function invokeRoute(handler, req = {}) {
  const response = {
    statusCode: 200,
    headers: {},
    body: null
  };

  const res = {
    status(code) {
      response.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      response.headers[name] = value;
      return this;
    },
    end(body) {
      response.body = body;
      return this;
    }
  };

  await handler(req, res, error => {
    throw error;
  });

  return response;
}

test('POST /api/export/pdf returns a downloadable PDF buffer with normalized margins', async () => {
  let capturedArgs = null;
  const router = createPdfExportRoutes({
    exportPdf: async args => {
      capturedArgs = args;
      return Buffer.from('%PDF-test');
    }
  });
  const handler = getRouteHandler(router, '/', 'post');

  const response = await invokeRoute(handler, {
    body: {
      html: '<div class="brief-preview"><h1>Hello</h1></div>',
      filename: 'brief.pdf',
      documentTitle: 'Brief Export',
      cssUrl: 'http://127.0.0.1:3000/style.css',
      baseUrl: 'http://127.0.0.1:3000/',
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    }
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.headers['Content-Type'], 'application/pdf');
  assert.equal(response.headers['Content-Disposition'], 'attachment; filename="brief.pdf"');
  assert.equal(String(response.body), '%PDF-test');
  assert.deepEqual(capturedArgs, {
    html: '<div class="brief-preview"><h1>Hello</h1></div>',
    cssUrl: 'http://127.0.0.1:3000/style.css',
    baseUrl: 'http://127.0.0.1:3000/',
    documentTitle: 'Brief Export',
    pdfOptions: {
      format: 'A4',
      landscape: false,
      margin: {
        top: '20mm',
        right: '20mm',
        bottom: '20mm',
        left: '20mm'
      }
    }
  });
});

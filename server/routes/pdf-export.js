import { Router } from 'express';

export function createPdfExportRoutes({ exportPdf }) {
  const router = Router();

  router.post('/', async (req, res, next) => {
    try {
      const payload = req.body || {};
      const margin = normalizeMargin(payload.margin);
      const pdfBuffer = await exportPdf({
        html: payload.html || '',
        cssUrl: payload.cssUrl || '',
        baseUrl: payload.baseUrl || '',
        documentTitle: payload.documentTitle || 'Export',
        pdfOptions: {
          format: payload.format || 'A4',
          landscape: Boolean(payload.landscape),
          margin
        }
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${sanitizeFilename(payload.filename || 'export.pdf')}"`);
      res.end(pdfBuffer);
    } catch (error) {
      next(error);
    }
  });

  return router;
}

function normalizeMargin(margin = {}) {
  const fallback = { top: '20mm', right: '20mm', bottom: '20mm', left: '20mm' };
  if (!margin || typeof margin !== 'object') return fallback;
  return {
    top: margin.top || fallback.top,
    right: margin.right || fallback.right,
    bottom: margin.bottom || fallback.bottom,
    left: margin.left || fallback.left
  };
}

function sanitizeFilename(filename = 'export.pdf') {
  return String(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

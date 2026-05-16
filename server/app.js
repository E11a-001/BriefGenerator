import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { createDb } from './db.js';
import { createBootstrapRoutes } from './routes/bootstrap.js';
import { createKocRoutes } from './routes/kocs.js';
import { createUseCaseRoutes } from './routes/use-cases.js';
import { createTemplateRoutes } from './routes/template.js';
import { createCampaignPresetsRoutes } from './routes/campaign-presets.js';
import { createBriefRoutes } from './routes/briefs.js';
import { createAgreementRoutes } from './routes/agreements.js';
import { createInvoiceRoutes } from './routes/invoices.js';
import { createPdfExportRoutes } from './routes/pdf-export.js';
import { createGenerateUseCaseDraft } from './lib/use-case-generation.js';
import { createRenderedPageExtractor } from './lib/rendered-page-extraction.js';
import { createPdfExporter } from './lib/pdf-export.js';

const modulePath = fileURLToPath(import.meta.url);
const __dirname = path.dirname(modulePath);

export function createApp(deps = {}) {
  const app = express();
  const db = deps.db;
  const uploadsDir = deps.uploadsDir || path.join(__dirname, '..', 'public', 'uploads');
  const renderedExtractor = deps.renderedExtractor || createRenderedPageExtractor();
  const exportPdf = deps.exportPdf || createPdfExporter();
  const generateUseCaseDraft = deps.generateUseCaseDraft || createGenerateUseCaseDraft({
    fetch: deps.fetch || globalThis.fetch,
    apiKey: process.env.DEEPSEEK_API_KEY || process.env.MINIMAX_API_KEY,
    apiUrl: process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/chat/completions',
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
    providerName: 'DeepSeek',
    renderedExtractor
  });

  app.use(express.json({ limit: '10mb' }));
  app.use(express.static(path.join(__dirname, '..', 'public'), {
    etag: false,
    lastModified: false,
    setHeaders(res, filePath) {
      if (filePath.endsWith('.html') || filePath.endsWith('.js') || filePath.endsWith('.css')) {
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
      }
    }
  }));
  app.use('/api/bootstrap', createBootstrapRoutes(db));
  app.use('/api/kocs', createKocRoutes(db, { uploadsDir }));
  app.use('/api/use-cases', createUseCaseRoutes(db, { generateUseCaseDraft }));
  app.use('/api/template', createTemplateRoutes(db));
  app.use('/api/campaign-presets', createCampaignPresetsRoutes(db, { uploadsDir }));
  app.use('/api/briefs', createBriefRoutes(db));
  app.use('/api/agreements', createAgreementRoutes(db));
  app.use('/api/invoices', createInvoiceRoutes(db));
  app.use('/api/export/pdf', createPdfExportRoutes({ exportPdf }));

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  });

  return app;
}

export function startServer() {
  const config = getConfig();
  const db = createDb(config.databaseUrl);
  const app = createApp({ db });

  return app.listen(config.port, config.host, () => {
    console.log(`Server listening on http://${config.host}:${config.port}`);
  });
}

if (process.argv[1] === modulePath) {
  startServer();
}

import { chromium } from 'playwright-core';

const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

export function createPdfExporter({
  chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || DEFAULT_CHROME_PATH
} = {}) {
  let browserPromise = null;

  function getBrowser() {
    if (!browserPromise) {
      browserPromise = chromium.launch({
        executablePath: chromeExecutablePath,
        headless: true
      }).catch(error => {
        browserPromise = null;
        throw error;
      });
    }
    return browserPromise;
  }

  async function exportPdf({ html, cssUrl, baseUrl, documentTitle = 'Export', pdfOptions = {} }) {
    const browser = await getBrowser();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      const content = `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(documentTitle)}</title>
    ${baseUrl ? `<base href="${escapeAttribute(baseUrl)}" />` : ''}
    ${cssUrl ? `<link rel="stylesheet" href="${escapeAttribute(cssUrl)}" />` : ''}
    <style>
      html, body { margin: 0; padding: 0; background: #fff; }
      body { color: #222; }
      [data-export-root] { background: #fff; }
    </style>
  </head>
  <body>
    <div data-export-root="true">${html || ''}</div>
  </body>
</html>`;

      await page.setContent(content, { waitUntil: 'networkidle' });

      return await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        ...pdfOptions
      });
    } finally {
      await context.close();
    }
  }

  exportPdf.close = async () => {
    if (browserPromise) {
      const browser = await browserPromise;
      browserPromise = null;
      await browser.close();
    }
  };

  return exportPdf;
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function escapeAttribute(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

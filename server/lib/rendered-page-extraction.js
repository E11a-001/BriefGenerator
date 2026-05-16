import { chromium } from 'playwright-core';

const DEFAULT_CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/**
 * Creates a rendered-page extractor that reuses a single browser instance.
 * Call the returned function with { url } to extract page content.
 * Call extractor.close() to shut down the browser (e.g. on process exit).
 */
export function createRenderedPageExtractor({
  chromeExecutablePath = process.env.CHROME_EXECUTABLE_PATH || DEFAULT_CHROME_PATH,
  timeoutMs = 15000
} = {}) {
  let browserPromise = null;

  function getBrowser() {
    if (!browserPromise) {
      browserPromise = chromium.launch({
        executablePath: chromeExecutablePath,
        headless: true
      }).catch(err => {
        browserPromise = null;
        throw err;
      });
    }
    return browserPromise;
  }

  async function extractRenderedPage({ url }) {
    const browser = await getBrowser();
    const context = await browser.newContext();

    try {
      const page = await context.newPage();
      await page.goto(url, { waitUntil: 'networkidle', timeout: timeoutMs });

      return await page.evaluate(() => {
        const readMeta = selectors => {
          for (const selector of selectors) {
            const node = document.querySelector(selector);
            const value = node?.getAttribute('content')?.trim();
            if (value) return value;
          }
          return '';
        };

        return {
          pageTitle: document.title || '',
          pageText: document.body?.innerText?.replace(/\s+/g, ' ').trim() || '',
          metaDescription: readMeta([
            'meta[property="og:description"]',
            'meta[name="description"]',
            'meta[name="twitter:description"]'
          ])
        };
      });
    } finally {
      await context.close();
    }
  }

  extractRenderedPage.close = async () => {
    if (browserPromise) {
      const browser = await browserPromise;
      browserPromise = null;
      await browser.close();
    }
  };

  return extractRenderedPage;
}

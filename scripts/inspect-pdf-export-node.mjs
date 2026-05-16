import { chromium } from 'playwright-core';

const BASE_URL = 'http://127.0.0.1:3000/';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext();

  try {
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const kocId = await page.evaluate(async () => {
      const response = await fetch('/api/bootstrap', { cache: 'no-store' });
      const data = await response.json();
      return data.kocs?.[0]?.id || '';
    });

    await page.evaluate(id => window.openBriefEditor(id), kocId);
    await page.waitForFunction(() => document.querySelector('#tab-brief.active #brief-preview')?.innerText?.trim().length > 200);

    const metrics = await page.evaluate(() => {
      const preview = document.getElementById('brief-preview');
      const { root, clone } = window.createPdfExportRoot(preview, {
        padding: '56px',
        background: '#fff'
      }, {
        width: '170mm'
      });

      const rootRect = root.getBoundingClientRect();
      const cloneRect = clone.getBoundingClientRect();
      const result = {
        rootRect: {
          width: rootRect.width,
          height: rootRect.height,
          x: rootRect.x,
          y: rootRect.y
        },
        cloneRect: {
          width: cloneRect.width,
          height: cloneRect.height,
          x: cloneRect.x,
          y: cloneRect.y
        },
        rootScrollHeight: root.scrollHeight,
        cloneScrollHeight: clone.scrollHeight,
        previewScrollHeight: preview.scrollHeight,
        cloneTextLength: clone.innerText.length,
        previewTextLength: preview.innerText.length,
        cloneHtmlLength: clone.innerHTML.length,
        rootZIndex: getComputedStyle(root).zIndex,
        cloneDisplay: getComputedStyle(clone).display,
        cloneVisibility: getComputedStyle(clone).visibility,
        cloneOpacity: getComputedStyle(clone).opacity
      };

      window.removePdfExportRoot(root);
      return result;
    });

    const canvasMetrics = await page.evaluate(async () => {
      const preview = document.getElementById('brief-preview');
      const { root, clone } = window.createPdfExportRoot(preview, {
        padding: '56px',
        background: '#fff'
      }, {
        width: '170mm'
      });

      const canvas = await window.html2canvas(root, {
        scale: 1,
        useCORS: true
      });

      const result = {
        width: canvas.width,
        height: canvas.height,
        dataUrlLength: canvas.toDataURL('image/png').length
      };

      window.removePdfExportRoot(root);
      return result;
    });

    console.log(JSON.stringify({ metrics, canvasMetrics }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

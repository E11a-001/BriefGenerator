import { chromium } from 'playwright-core';
import fs from 'node:fs/promises';
import path from 'node:path';

const BASE_URL = 'http://127.0.0.1:3000/';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = '/tmp/brief-generator-manual-ui';

async function main() {
  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const page = await browser.newPage();

  try {
    await fs.mkdir(OUTPUT_DIR, { recursive: true });
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.click('#btn-tab-usecases');
    await page.waitForSelector('#tab-usecases.active');
    await page.waitForSelector('#uc-source-prompt');

    const seededHow =
      'Show the profit/result chart Moclaw helped produce first, then transition into the tutorial workflow.';
    const seededOutcome =
      'Audience learns a concrete framework for evaluating any crypto token.';
    const prompt =
      'Evaluate any crypto token with clear credibility rules and a numeric output.';

    await page.fill('#uc-source-url', '');
    await page.fill('#uc-source-prompt', prompt);
    await page.fill('#uc-source-output', '');
    await page.fill('#uc-source-screenshot-note', '');
    await page.fill('#uc-new-title', '');
    await page.fill('#uc-new-desc', '');
    await page.fill('#uc-new-hook', '');
    await page.fill('#uc-new-who', '');
    await page.fill('#uc-new-problem', '');
    await page.fill('#uc-new-how', seededHow);
    await page.fill('#uc-new-outcome', seededOutcome);

    const before = await page.evaluate(() => ({
      title: document.getElementById('uc-new-title')?.value || '',
      description: document.getElementById('uc-new-desc')?.value || '',
      openingHook: document.getElementById('uc-new-hook')?.value || '',
      howToShowIt: document.getElementById('uc-new-how')?.value || '',
      expectedOutcome: document.getElementById('uc-new-outcome')?.value || '',
      generateLabel: document.getElementById('uc-generate-btn')?.textContent || ''
    }));

    await page.screenshot({ path: path.join(OUTPUT_DIR, '03-before-generate.png'), fullPage: true });

    await page.click('#uc-generate-btn');
    await page.waitForFunction(
      () => document.getElementById('uc-generate-btn')?.textContent?.trim() === 'Generate with AI',
      { timeout: 30000 }
    );
    await page.waitForFunction(
      seeded => {
        const title = document.getElementById('uc-new-title')?.value || '';
        const hook = document.getElementById('uc-new-hook')?.value || '';
        const how = document.getElementById('uc-new-how')?.value || '';
        return Boolean(title.trim()) && Boolean(hook.trim()) && how.trim() !== seeded;
      },
      seededHow,
      { timeout: 30000 }
    );

    const after = await page.evaluate(() => ({
      title: document.getElementById('uc-new-title')?.value || '',
      description: document.getElementById('uc-new-desc')?.value || '',
      openingHook: document.getElementById('uc-new-hook')?.value || '',
      howToShowIt: document.getElementById('uc-new-how')?.value || '',
      expectedOutcome: document.getElementById('uc-new-outcome')?.value || '',
      suggestedElements: Array.from(document.querySelectorAll('#uc-new-suggested-elements .chip')).map(el => el.textContent?.trim() || ''),
      toast: document.querySelector('.toast')?.textContent?.trim() || ''
    }));

    await page.screenshot({ path: path.join(OUTPUT_DIR, '04-after-generate.png'), fullPage: true });

    console.log(JSON.stringify({ before, after }, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

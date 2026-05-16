import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile as execFileCallback } from 'node:child_process';
import { promisify } from 'node:util';
import { chromium } from 'playwright-core';

const execFile = promisify(execFileCallback);

const BASE_URL = 'http://127.0.0.1:3000/';
const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUTPUT_DIR = '/tmp/brief-generator-pdf-check';

async function ensureDir(dirPath) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function readBootstrap(page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/bootstrap', { cache: 'no-store' });
    if (!response.ok) throw new Error(`bootstrap failed: ${response.status}`);
    return response.json();
  });
}

async function exportFromPage(page, trigger) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30000 }),
    trigger()
  ]);
  return download;
}

async function saveDownload(download, filePath) {
  await download.saveAs(filePath);
  const stats = await fs.stat(filePath);
  const mdls = await execFile('/usr/bin/mdls', ['-raw', '-name', 'kMDItemNumberOfPages', filePath]).catch(() => ({ stdout: 'unknown' }));

  return {
    filePath,
    bytes: stats.size,
    pages: String(mdls.stdout || '').trim()
  };
}

async function openBriefEditor(page, kocId) {
  await page.evaluate(id => window.openBriefEditor(id), kocId);
  await page.waitForFunction(() => document.querySelector('#tab-brief.active #brief-preview')?.innerText?.trim().length > 200);
}

async function openDocumentEditor(page, kocId, type) {
  await page.evaluate(({ id, type }) => window.openDocumentEditor(id, type), { id: kocId, type });
  await page.waitForFunction(expectedType => {
    const tab = document.querySelector('#tab-document.active');
    if (!tab) return false;
    const title = document.getElementById('document-editor-title')?.textContent || '';
    const preview = document.getElementById('document-preview');
    return title.toLowerCase().includes(expectedType) && (preview?.innerText || '').trim().length > 120;
  }, type);
}

async function main() {
  await ensureDir(OUTPUT_DIR);

  const browser = await chromium.launch({
    executablePath: CHROME_PATH,
    headless: true
  });

  const context = await browser.newContext({
    acceptDownloads: true
  });

  try {
    const page = await context.newPage();
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    const bootstrap = await readBootstrap(page);
    const firstKoc = bootstrap.kocs?.[0];
    if (!firstKoc?.id) throw new Error('No KOC found to verify PDF export.');

    await openBriefEditor(page, firstKoc.id);
    const briefDownload = await exportFromPage(page, () => page.click('#tab-brief .btn-export.btn-pdf'));
    const briefFile = await saveDownload(briefDownload, path.join(OUTPUT_DIR, 'brief.pdf'));

    await openDocumentEditor(page, firstKoc.id, 'agreement');
    const agreementDownload = await exportFromPage(page, () => page.click('#tab-document .btn-export.btn-pdf'));
    const agreementFile = await saveDownload(agreementDownload, path.join(OUTPUT_DIR, 'agreement.pdf'));

    await openDocumentEditor(page, firstKoc.id, 'invoice');
    const invoiceDownload = await exportFromPage(page, () => page.click('#tab-document .btn-export.btn-pdf'));
    const invoiceFile = await saveDownload(invoiceDownload, path.join(OUTPUT_DIR, 'invoice.pdf'));

    console.log(JSON.stringify({
      ok: true,
      outputDir: OUTPUT_DIR,
      files: {
        brief: briefFile,
        agreement: agreementFile,
        invoice: invoiceFile
      }
    }, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

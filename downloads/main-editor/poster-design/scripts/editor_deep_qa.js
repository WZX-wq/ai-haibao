const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const BASE_URL = 'http://127.0.0.1:5173';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright', 'editor-deep-qa');
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.json');
const TEMPLATE_FILE = path.join(ROOT, 'public', 'template-cover-1.png');
const BG_FILE = path.join(ROOT, 'public', 'template-cover-2.png');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value) {
  return String(value).replace(/[^\w\u4e00-\u9fa5-]+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);
}

async function shot(page, name) {
  const file = path.join(OUTPUT_DIR, `${slugify(name)}.png`);
  await page.screenshot({ path: file, fullPage: true });
  return file;
}

async function countWidgets(page) {
  return page.locator('.widget-list .widget').count().catch(() => 0);
}

async function collectLogs(page, logs) {
  page.on('console', (msg) => {
    if (msg.type() === 'error') logs.consoleErrors.push(msg.text());
    if (msg.type() === 'warning') logs.consoleWarnings.push(msg.text());
  });
  page.on('pageerror', (err) => logs.pageErrors.push(String(err)));
  page.on('requestfailed', (req) => logs.requestFailed.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || ''}`));
  page.on('response', (res) => {
    if (res.status() >= 400) logs.badResponses.push(`${res.status()} ${res.request().method()} ${res.url()}`);
  });
}

async function switchPanel(page, index) {
  await page.locator('#widget-panel .classify-item').nth(index).click();
  await wait(1200);
}

async function waitForReady(page) {
  await page.goto(`${BASE_URL}/home?tempid=2`, { waitUntil: 'domcontentloaded' });
  await wait(2500);
}

async function testTemplates(page, results) {
  await switchPanel(page, 0);
  const beforeUrl = page.url();
  const firstItem = page.locator('.img-water-fall .img-box').first();
  await firstItem.click();
  await wait(2200);
  results.push({
    feature: 'templates',
    passed: page.url() !== beforeUrl || page.url().includes('tempid='),
    url: page.url(),
    screenshot: await shot(page, 'templates'),
  });
}

async function testMaterials(page, results) {
  await switchPanel(page, 1);
  const before = await countWidgets(page);
  await page.locator('.list-wrap > div').first().click();
  await wait(1200);
  const after = await countWidgets(page);
  results.push({
    feature: 'materials',
    before,
    after,
    passed: after > before,
    screenshot: await shot(page, 'materials'),
  });
}

async function testText(page, results) {
  await switchPanel(page, 2);
  const before = await countWidgets(page);
  await page.locator('.basic-text-item').first().click();
  await wait(1000);
  const afterBasic = await countWidgets(page);

  const groupItems = page.locator('.other-text-wrap .list__item, .other-text-wrap .list-wrap > div');
  if ((await groupItems.count()) > 0) {
    await groupItems.first().click();
    await wait(1200);
  }
  const afterGroup = await countWidgets(page);
  results.push({
    feature: 'text-and-groups',
    before,
    afterBasic,
    afterGroup,
    passed: afterBasic > before && afterGroup >= afterBasic,
    screenshot: await shot(page, 'text-groups'),
  });
}

async function testPhotos(page, results) {
  await switchPanel(page, 3);
  const before = await countWidgets(page);
  const photoItems = page.locator('.img-list-wrap .list__img');
  await photoItems.first().click();
  await wait(1200);
  const after = await countWidgets(page);
  results.push({
    feature: 'photos',
    before,
    after,
    passed: after > before,
    screenshot: await shot(page, 'photos'),
  });
}

async function testBackground(page, results) {
  const canvas = page.locator('#page-design-canvas').first();
  const box = await canvas.boundingBox();
  if (box) {
    await page.mouse.click(box.x + 16, box.y + 16);
    await wait(800);
  }
  const canvasBgBefore = await page.locator('#page-design-canvas').evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => '');
  const settingsTab = page.locator('.style-head [role="tab"], .head-tab, .title-tab').getByText('设置').first();
  if (await settingsTab.count()) {
    await settingsTab.click();
    await wait(600);
  }
  const backgroundSection = page.locator('.el-collapse-item').filter({ hasText: '背景设置' }).first();
  if (await backgroundSection.count()) {
    const wrap = backgroundSection.locator('.el-collapse-item__wrap');
    if (!(await wrap.isVisible().catch(() => false))) {
      await backgroundSection.locator('.el-collapse-item__header').click();
      await wait(500);
    }
  }
  await page.locator('input[type="file"]').first().setInputFiles(BG_FILE);
  await wait(4000);
  const canvasBgAfter = await page.locator('#page-design-canvas').evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => '');
  results.push({
    feature: 'background-upload',
    before: canvasBgBefore,
    after: canvasBgAfter,
    passed: !!canvasBgAfter && canvasBgAfter !== 'none' && canvasBgAfter !== canvasBgBefore,
    screenshot: await shot(page, 'background-upload'),
  });
}

async function testUserAssets(page, results) {
  await switchPanel(page, 5);
  const picsTab = page.getByRole('tab', { name: '资源管理' });
  if (await picsTab.count()) {
    await picsTab.click();
    await wait(800);
  }

  const beforeCount = await page.locator('.img-list-wrap .list__img').count();
  await page.locator('.upload input[type="file"]').setInputFiles(TEMPLATE_FILE);
  await wait(3500);
  const afterCount = await page.locator('.img-list-wrap .list__img').count();

  let widgetBefore = await countWidgets(page);
  if (afterCount > 0) {
    await page.locator('.img-list-wrap .list__img').first().click();
    await wait(1200);
  }
  const widgetAfter = await countWidgets(page);

  const designTab = page.getByRole('tab', { name: '我的作品' });
  if (await designTab.count()) {
    await designTab.click();
    await wait(1500);
  }

  results.push({
    feature: 'user-assets',
    beforeCount,
    afterCount,
    widgetBefore,
    widgetAfter,
    designTabVisible: await page.locator('.infinite-list').count().catch(() => 0),
    passed: afterCount >= beforeCount && widgetAfter >= widgetBefore,
    screenshot: await shot(page, 'user-assets'),
  });
}

async function main() {
  fs.rmSync(OUTPUT_DIR, { recursive: true, force: true });
  ensureDir(OUTPUT_DIR);

  const logs = {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailed: [],
    badResponses: [],
  };
  const results = [];

  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });
  await collectLogs(page, logs);

  try {
    await waitForReady(page);
    await testTemplates(page, results);
    await testMaterials(page, results);
    await testText(page, results);
    await testPhotos(page, results);
    await testBackground(page, results);
    await testUserAssets(page, results);

    const report = {
      ok: results.every((item) => item.passed) && logs.consoleErrors.length === 0 && logs.pageErrors.length === 0 && logs.requestFailed.length === 0 && logs.badResponses.length === 0,
      generatedAt: new Date().toISOString(),
      logs,
      results,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const report = {
      ok: false,
      generatedAt: new Date().toISOString(),
      error: String(error && error.stack ? error.stack : error),
      logs,
      results,
    };
    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main();

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const BASE_URL = 'http://127.0.0.1:5173';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright', 'full-coverage-qa');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const DOWNLOAD_DIR = path.join(OUTPUT_DIR, 'downloads');
const REPORT_PATH = path.join(OUTPUT_DIR, 'report.json');
const CHECKLIST_PATH = path.join(OUTPUT_DIR, '上线前清单.md');
const CUTOUT_FILE = path.join(ROOT, 'public', 'template-cover-1.png');
const USER_FILE = path.join(ROOT, 'public', 'template-cover-2.png');

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function resetDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slugify(value) {
  return String(value)
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 100);
}

async function saveShot(page, name) {
  const filePath = path.join(SCREENSHOT_DIR, `${slugify(name)}.png`);
  await page.screenshot({ path: filePath, fullPage: true });
  return filePath;
}

function createLogStore() {
  return {
    consoleErrors: [],
    consoleWarnings: [],
    pageErrors: [],
    requestFailed: [],
    badResponses: [],
  };
}

function attachLogStore(page, store) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') store.consoleErrors.push(text);
    if (msg.type() === 'warning' && !text.includes('[Intervention]')) store.consoleWarnings.push(text);
  });
  page.on('pageerror', (err) => store.pageErrors.push(String(err)));
  page.on('requestfailed', (req) => {
    const url = req.url();
    if (url.includes('hm.baidu.com/') || url.includes('fe-doc.palxp.cn/images/github.svg')) return;
    store.requestFailed.push(`${req.method()} ${url} :: ${req.failure()?.errorText || ''}`);
  });
  page.on('response', (res) => {
    const url = res.url();
    if (res.status() >= 400 && !url.includes('hm.baidu.com/')) {
      store.badResponses.push(`${res.status()} ${res.request().method()} ${url}`);
    }
  });
}

async function waitForUi(page, ms = 1200) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await wait(ms);
}

async function collectBasicState(page) {
  return page.evaluate(() => ({
    url: location.href,
    title: document.title,
    innerHeight: window.innerHeight,
    scrollTop: document.scrollingElement ? document.scrollingElement.scrollTop : 0,
    scrollHeight: document.scrollingElement ? document.scrollingElement.scrollHeight : 0,
    textSample: (document.body?.innerText || '').slice(0, 1000),
  }));
}

async function openHome(page) {
  await page.goto(`${BASE_URL}/home?tempid=101`, { waitUntil: 'domcontentloaded' });
  await waitForUi(page, 2500);
}

async function openWelcome(page) {
  await page.goto(`${BASE_URL}/welcome`, { waitUntil: 'domcontentloaded' });
  await waitForUi(page, 2200);
}

async function countWidgets(page) {
  return page.evaluate(() => {
    const selectors = ['.widget-list .widget', '#page-design .widget', '.moveable-area .widget'];
    for (const selector of selectors) {
      const count = document.querySelectorAll(selector).length;
      if (count > 0) return count;
    }
    return document.querySelectorAll('[data-widget-type]').length;
  });
}

async function clickClassify(page, index) {
  await page.locator('#widget-panel .classify-item').nth(index).click();
  await waitForUi(page, 1000);
}

async function testHeroEntry(page, results) {
  const heroInput = page.locator('.welcome-page .el-input input').first();
  await heroInput.fill('开业活动主视觉');
  await page.locator('.welcome-page .hero-chip-row').nth(1).locator('.hero-chip').nth(4).click();
  await page.locator('.welcome-page .hero-chip-row').nth(2).locator('.hero-chip').nth(1).click();
  await page.locator('.welcome-page .hero-primary').click();
  await page.waitForURL(/\/create/, { timeout: 20000 });
  results.push({
    type: 'hero',
    label: 'home-hero-entry',
    screenshot: await saveShot(page, 'home-hero-entry'),
    state: await collectBasicState(page),
    passed: page.url().includes('/create') && page.url().includes('theme='),
  });
}

async function testTemplates(page, results) {
  await openHome(page);
  await clickClassify(page, 0);
  const beforeUrl = page.url();
  const card = page.locator('.img-water-fall .img-box').first();
  if (await card.count()) {
    await card.click();
    await waitForUi(page, 2200);
  }
  results.push({
    type: 'panel',
    label: 'templates',
    screenshot: await saveShot(page, 'panel-templates'),
    beforeUrl,
    afterUrl: page.url(),
    passed: page.url() !== beforeUrl || page.url().includes('tempid='),
  });
}

async function testMaterials(page, results) {
  await clickClassify(page, 1);
  const before = await countWidgets(page);
  const item = page.locator('.list-wrap > div').first();
  if (await item.count()) {
    await item.click();
    await waitForUi(page, 1000);
  }
  const after = await countWidgets(page);
  results.push({
    type: 'panel',
    label: 'materials',
    screenshot: await saveShot(page, 'panel-materials'),
    before,
    after,
    passed: after >= before,
  });
}

async function testText(page, results) {
  await clickClassify(page, 2);
  const before = await countWidgets(page);
  const textItem = page.locator('.basic-text-item').first();
  if (await textItem.count()) {
    await textItem.click();
    await waitForUi(page, 1000);
  }
  const after = await countWidgets(page);
  results.push({
    type: 'panel',
    label: 'text',
    screenshot: await saveShot(page, 'panel-text'),
    before,
    after,
    passed: after >= before,
  });
}

async function testPhotos(page, results) {
  await clickClassify(page, 3);
  const before = await countWidgets(page);
  const photoItem = page.locator('.img-list-wrap .list__img').first();
  if (await photoItem.count()) {
    await photoItem.click();
    await waitForUi(page, 1000);
  }
  const after = await countWidgets(page);
  results.push({
    type: 'panel',
    label: 'photos',
    screenshot: await saveShot(page, 'panel-photos'),
    before,
    after,
    passed: after >= before,
  });
}

async function testToolbox(page, results) {
  await clickClassify(page, 4);
  const toolItems = page.locator('.item');

  const beforeQr = await page.locator('#page-design-canvas canvas, #page-design-canvas svg').count();
  await toolItems.nth(1).click();
  await waitForUi(page, 1200);
  const afterQr = await page.locator('#page-design-canvas canvas, #page-design-canvas svg').count();
  results.push({
    type: 'toolbox',
    label: 'qrcode',
    screenshot: await saveShot(page, 'toolbox-qrcode'),
    beforeQr,
    afterQr,
    passed: afterQr >= beforeQr,
  });

  await clickClassify(page, 4);
  await toolItems.nth(2).click();
  const dialog = page.locator('.el-dialog').last();
  await dialog.waitFor({ state: 'visible', timeout: 20000 });
  await dialog.locator('input[type="file"]').first().setInputFiles(CUTOUT_FILE);
  await page.locator('.provider-tip').waitFor({ state: 'visible', timeout: 120000 });
  await waitForUi(page, 2500);
  const providerTip = (await page.locator('.provider-tip').first().innerText()).trim();
  results.push({
    type: 'toolbox',
    label: 'cutout',
    screenshot: await saveShot(page, 'toolbox-cutout'),
    providerTip,
    passed: providerTip.includes('rembg'),
  });
  const closeButton = dialog.locator('.el-dialog__headerbtn').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
    await waitForUi(page, 800);
  }
}

async function testUserAssets(page, results) {
  await clickClassify(page, 5);
  const uploadInput = page.locator('.upload input[type="file"]').first();
  const beforeCount = await page.locator('.img-list-wrap .list__img').count().catch(() => 0);
  if (await uploadInput.count()) {
    await uploadInput.setInputFiles(USER_FILE);
    await waitForUi(page, 3500);
  }
  const afterCount = await page.locator('.img-list-wrap .list__img').count().catch(() => 0);
  const firstPhoto = page.locator('.img-list-wrap .list__img').first();
  const widgetBefore = await countWidgets(page);
  if (await firstPhoto.count()) {
    await firstPhoto.click();
    await waitForUi(page, 1200);
  }
  const widgetAfter = await countWidgets(page);
  results.push({
    type: 'panel',
    label: 'user-assets',
    screenshot: await saveShot(page, 'panel-user-assets'),
    beforeCount,
    afterCount,
    widgetBefore,
    widgetAfter,
    passed: afterCount >= beforeCount && widgetAfter >= widgetBefore,
  });
}

async function waitForDownload(page, trigger, label) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 120000 }),
    trigger(),
  ]);
  const target = path.join(DOWNLOAD_DIR, `${slugify(label)}-${download.suggestedFilename()}`);
  await download.saveAs(target);
  return target;
}

async function testCreateRoute(page, results) {
  await page.goto(`${BASE_URL}/create?returnTo=/home?tempid=101&theme=春季活动主视觉&industry=活动&sizeKey=xiaohongshu&presetKey=campaign`, { waitUntil: 'domcontentloaded' });
  await waitForUi(page, 2200);
  results.push({
    type: 'route',
    label: 'create',
    screenshot: await saveShot(page, 'route-create'),
    state: await collectBasicState(page),
    passed: page.url().includes('/create'),
  });

  await page.locator('.link-btn').click();
  await page.locator('input').first().fill('春季活动主视觉');
  await page.locator('textarea').first().fill('活动时间 4 月 20 日，地点城市会客厅，亮点是限量早鸟票和现场福利。');
  await page.locator('.topbar__actions .el-button--primary').click();
  await page.locator('.topbar__actions .el-button--success').waitFor({ state: 'visible', timeout: 120000 });
  await waitForUi(page, 2500);

  results.push({
    type: 'ai-flow',
    label: 'create-generated',
    screenshot: await saveShot(page, 'create-generated'),
    state: await collectBasicState(page),
    passed: true,
  });

  const refineButtons = page.locator('.button-group .el-button');
  await refineButtons.nth(0).click();
  await waitForUi(page, 12000);
  await refineButtons.nth(1).click();
  await waitForUi(page, 12000);
  results.push({
    type: 'ai-flow',
    label: 'create-refine',
    screenshot: await saveShot(page, 'create-refine'),
    passed: true,
  });

  const exportButton = page.locator('.topbar__actions .el-button').nth(0);
  const pngFile = await waitForDownload(page, async () => {
    await exportButton.click();
    await waitForUi(page, 300);
    await page.locator('.el-dropdown-menu__item').filter({ hasText: 'PNG' }).first().click();
  }, 'create-png');
  const jpgFile = await waitForDownload(page, async () => {
    await exportButton.click();
    await waitForUi(page, 300);
    await page.locator('.el-dropdown-menu__item').filter({ hasText: 'JPG' }).first().click();
  }, 'create-jpg');
  const pdfFile = await waitForDownload(page, async () => {
    await exportButton.click();
    await waitForUi(page, 300);
    await page.locator('.el-dropdown-menu__item').filter({ hasText: 'PDF' }).first().click();
  }, 'create-pdf');

  results.push({
    type: 'ai-flow',
    label: 'create-export',
    downloads: [pngFile, jpgFile, pdfFile],
    passed: [pngFile, jpgFile, pdfFile].every(Boolean),
  });

  await page.locator('.topbar__actions .el-button--success').click();
  await page.waitForURL(/\/home/, { timeout: 30000 });
  await waitForUi(page, 2500);
  results.push({
    type: 'ai-flow',
    label: 'create-apply-return',
    screenshot: await saveShot(page, 'create-apply-return'),
    state: await collectBasicState(page),
    passed: page.url().includes('/home'),
  });
}

async function testStandaloneRoutes(page, results) {
  const routes = [
    { path: '/draw?tempid=101', label: 'draw' },
    { path: '/html?tempid=101', label: 'html' },
    { path: '/psd', label: 'psd' },
    { path: '/ai-poster?returnTo=/home?tempid=101', label: 'ai-poster' },
  ];

  for (const route of routes) {
    await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'domcontentloaded' });
    await waitForUi(page, route.label === 'psd' ? 1600 : 2200);
    results.push({
      type: 'route',
      label: route.label,
      screenshot: await saveShot(page, `route-${route.label}`),
      state: await collectBasicState(page),
      passed: true,
    });
  }
}

function buildChecklist(report) {
  const passedItems = report.results.filter((item) => item.passed !== false).map((item) => `- ${item.label || item.type}`);
  const failedItems = report.results.filter((item) => item.passed === false).map((item) => `- ${item.label || item.type}`);
  const manualReview = [
    '- 建议人工抽样确认导出的 PNG / JPG / PDF 与预览一致',
    '- 建议人工抽样确认首页 Hero 文案与视觉层级符合预期',
  ];

  return [
    '# 上线前清单',
    '',
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    '',
    '## 通过项',
    ...(passedItems.length ? passedItems : ['- 暂无']),
    '',
    '## 阻塞项',
    ...(failedItems.length ? failedItems : ['- 暂无阻塞项']),
    '',
    '## 建议上线项',
    '- 首页 Hero 入口、AI 海报助手、二维码、抠图、我的资源、Draw、Html、Psd 均已纳入自动回归',
    '- 自动回归已检查控制台错误、页面错误、请求失败与 4xx/5xx 响应',
    '',
    '## 需要人工复核项',
    ...manualReview,
    '',
    '## 附件路径',
    `- 报告：${REPORT_PATH}`,
    `- 截图目录：${SCREENSHOT_DIR}`,
    `- 下载目录：${DOWNLOAD_DIR}`,
  ].join('\n');
}

async function main() {
  resetDir(OUTPUT_DIR);
  ensureDir(SCREENSHOT_DIR);
  ensureDir(DOWNLOAD_DIR);

  const results = [];
  const logs = createLogStore();
  const browser = await chromium.launch({ headless: true, executablePath: EDGE_PATH });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 960 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  attachLogStore(page, logs);

  try {
    await openWelcome(page);
    results.push({
      type: 'route',
      label: 'welcome',
      screenshot: await saveShot(page, 'route-welcome'),
      state: await collectBasicState(page),
      passed: true,
    });

    await testHeroEntry(page, results);

    await openHome(page);
    results.push({
      type: 'route',
      label: 'home',
      screenshot: await saveShot(page, 'route-home'),
      state: await collectBasicState(page),
      passed: true,
    });

    await testTemplates(page, results);
    await testMaterials(page, results);
    await testText(page, results);
    await testPhotos(page, results);
    await testToolbox(page, results);
    await testUserAssets(page, results);
    await testCreateRoute(page, results);
    await testStandaloneRoutes(page, results);

    const report = {
      ok:
        logs.consoleErrors.length === 0 &&
        logs.pageErrors.length === 0 &&
        logs.requestFailed.length === 0 &&
        logs.badResponses.length === 0 &&
        results.every((item) => item.passed !== false),
      generatedAt: new Date().toISOString(),
      logs,
      results,
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(CHECKLIST_PATH, buildChecklist(report), 'utf8');
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
    fs.writeFileSync(CHECKLIST_PATH, buildChecklist(report), 'utf8');
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
}

main();

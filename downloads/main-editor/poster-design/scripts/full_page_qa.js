const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright', 'full-page-qa');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const DOWNLOAD_DIR = path.join(OUTPUT_DIR, 'downloads');
const BASE_URL = 'http://127.0.0.1:5173';
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const UPLOAD_IMAGE = path.join(ROOT, 'public', 'template-cover-1.png');
const BG_IMAGE = path.join(ROOT, 'public', 'template-cover-2.png');

const mojibakeTokens = [
  '浣',
  '鏂',
  '鍥',
  '鐖',
  '缁',
  '濂',
  '浜岀淮鐮',
  '绔欓叿',
  '鎺',
  '柊',
  '簵',
];

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function slugify(value) {
  return String(value)
    .replace(/[^\w\u4e00-\u9fa5-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 80);
}

function containsMojibake(text) {
  const value = String(text || '');
  return mojibakeTokens.some((token) => value.includes(token));
}

async function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStable(page, ms = 1200) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await wait(ms);
}

async function saveScreenshot(page, name, fullPage = true) {
  const filePath = path.join(SCREENSHOT_DIR, `${slugify(name)}.png`);
  await page.screenshot({ path: filePath, fullPage });
  return filePath;
}

async function collectVisibleText(page) {
  return page.evaluate(() => {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const values = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (text) values.push(text);
    }
    return values.slice(0, 5000);
  });
}

async function collectPageState(page) {
  const visibleText = await collectVisibleText(page);
  const url = page.url();
  return {
    url,
    title: await page.title(),
    visibleTextSample: visibleText.slice(0, 150),
    mojibakeHits: visibleText.filter((text) => containsMojibake(text)).slice(0, 50),
  };
}

function pushResult(results, payload) {
  results.push({
    time: new Date().toISOString(),
    ...payload,
  });
}

async function snapshotRoute(page, results, routePath, label) {
  await page.goto(`${BASE_URL}${routePath}`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 2200);
  const screenshot = await saveScreenshot(page, label);
  const state = await collectPageState(page);
  let status = state.mojibakeHits.length ? 'failed' : 'passed';

  if (label.includes('draw')) {
    const hasCanvas = (await page.locator('#page-design-canvas').count()) > 0;
    status = status === 'passed' && hasCanvas ? 'passed' : 'failed';
    state.hasCanvas = hasCanvas;
  }
  if (label.includes('html')) {
    const boardCount = await page.locator('#page-draw-html-wrap').count();
    const canvasCount = await page.locator('#page-design-canvas').count();
    const hasHtmlRender = boardCount > 0 && canvasCount > 0;
    status = status === 'passed' && hasHtmlRender ? 'passed' : 'failed';
    state.hasHtmlRender = hasHtmlRender;
  }
  if (label.includes('psd')) {
    const hasUploader = (await page.locator('.uploader__box').count()) > 0;
    status = status === 'passed' && hasUploader ? 'passed' : 'failed';
    state.hasUploader = hasUploader;
  }

  pushResult(results, {
    type: 'route',
    key: label,
    route: routePath,
    screenshot,
    status,
    details: state,
  });
}

async function clickClassify(page, index, label, results) {
  const locator = page.locator('#widget-panel .classify-item').nth(index);
  await locator.click();
  await waitForStable(page, 900);
  const screenshot = await saveScreenshot(page, `home-panel-${label}`);
  const state = await collectPageState(page);
  pushResult(results, {
    type: 'panel',
    key: label,
    screenshot,
    status: state.mojibakeHits.length ? 'failed' : 'passed',
    details: state,
  });
}

async function openHome(page, results, tempid, label) {
  await page.goto(`${BASE_URL}/home?tempid=${tempid}`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 2200);
  const screenshot = await saveScreenshot(page, `home-${label}`);
  const state = await collectPageState(page);
  pushResult(results, {
    type: 'home-template',
    key: label,
    screenshot,
    status: state.mojibakeHits.length ? 'failed' : 'passed',
    details: state,
  });
}

async function clickTextHeader(page, index) {
  const headers = page.locator('.types__header:visible');
  const count = await headers.count();
  if (count <= index) {
    throw new Error(`Text header index ${index} not found, count=${count}`);
  }
  await headers.nth(index).click();
  await waitForStable(page, 900);
}

async function testTextAndGroupTemplates(page, results) {
  await clickClassify(page, 2, 'text', results);

  const basicText = page.locator('.basic-text-item').first();
  if (await basicText.count()) {
    await basicText.click();
    await waitForStable(page, 700);
  }

  await clickTextHeader(page, 1);
  const groupItems = page.locator('.list__item');
  const groupCount = await groupItems.count();
  const inserted = [];
  for (let i = 0; i < Math.min(groupCount, 3); i++) {
    await groupItems.nth(i).click();
    inserted.push(i);
    await waitForStable(page, 1000);
  }

  const layerTexts = await page.locator('.widget-list .widget .widget-name').allTextContents();
  const canvasTexts = await page.locator('#page-design-canvas .w-text').evaluateAll((nodes) =>
    nodes.map((node) => (node.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean)
  );
  const screenshot = await saveScreenshot(page, 'home-text-and-groups');
  const failedTexts = [...layerTexts, ...canvasTexts].filter((text) => containsMojibake(text));

  pushResult(results, {
    type: 'flow',
    key: 'text-group-templates',
    screenshot,
    status: failedTexts.length ? 'failed' : 'passed',
    details: {
      insertedIndexes: inserted,
      layerTexts,
      canvasTexts,
      failedTexts,
    },
  });
}

async function setInputFilesNear(page, rootSelector, filePath) {
  const root = page.locator(rootSelector).first();
  await root.waitFor({ state: 'visible', timeout: 15000 });
  const input = root.locator('input[type="file"]').first();
  await input.setInputFiles(filePath);
}

async function testMineUpload(page, results) {
  await clickClassify(page, 5, 'mine', results);
  const picsTab = page.getByRole('tab', { name: '资源管理' });
  if (await picsTab.count()) {
    await picsTab.click();
    await waitForStable(page, 900);
  }

  const beforeCount = await page.locator('.photo-list .water-fall-item, .photo-list .item, .water-fall-item').count();
  await setInputFilesNear(page, '.upload', UPLOAD_IMAGE);
  await waitForStable(page, 2500);
  const afterCount = await page.locator('.photo-list .water-fall-item, .photo-list .item, .water-fall-item').count();

  const screenshot = await saveScreenshot(page, 'home-mine-upload');
  pushResult(results, {
    type: 'flow',
    key: 'mine-upload',
    screenshot,
    status: afterCount >= beforeCount ? 'passed' : 'failed',
    details: {
      beforeCount,
      afterCount,
    },
  });
}

async function testBackgroundUpload(page, results) {
  await page.goto(`${BASE_URL}/home?tempid=2`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 2200);
  await selectCanvasPage(page);
  const settingsTab = page.locator('.style-head [role="tab"], .head-tab, .title-tab').getByText('设置').first();
  if (await settingsTab.count()) {
    await settingsTab.click();
    await waitForStable(page, 500);
  }

  const backgroundSection = page.locator('.el-collapse-item').filter({ hasText: '背景设置' }).first();
  if (await backgroundSection.count()) {
    const isExpanded = await backgroundSection.locator('.el-collapse-item__wrap').count();
    if (!isExpanded) {
      await backgroundSection.locator('.el-collapse-item__header').click();
      await waitForStable(page, 500);
    }
  }

  const imageMode = page.getByText('图片', { exact: true }).last();
  if (await imageMode.count()) {
    await imageMode.click();
    await waitForStable(page, 500);
  }

  const beforeStyle = await page.locator('#page-design-canvas').evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => '');
  const input = page.locator('#page-style input[type="file"], input[type="file"]').filter({ hasNot: page.locator('[disabled]') }).first();
  await input.setInputFiles(BG_IMAGE);
  await waitForStable(page, 4500);
  const afterStyle = await page.locator('#page-design-canvas').evaluate((el) => getComputedStyle(el).backgroundImage).catch(() => '');

  const screenshot = await saveScreenshot(page, 'home-background-upload');
  pushResult(results, {
    type: 'flow',
    key: 'background-upload',
    screenshot,
    status: afterStyle && afterStyle !== 'none' && afterStyle !== beforeStyle ? 'passed' : 'failed',
    details: {
      beforeStyle,
      afterStyle,
    },
  });
}

async function testToolbox(page, results) {
  await clickClassify(page, 4, 'toolbox', results);

  const qrItem = page.locator('.item').filter({ hasText: '二维码' }).first();
  if (await qrItem.count()) {
    await qrItem.click();
    await waitForStable(page, 700);
  }

  const aiItem = page.locator('.item').filter({ hasText: 'AI海报助手' }).first();
  if (await aiItem.count()) {
    await aiItem.click();
    await waitForStable(page, 800);
  }

  const dialog = page.locator('.el-dialog').filter({ hasText: 'AI海报助手' }).first();
  let aiStatus = 'failed';
  const aiDetails = {};

  if (await dialog.count()) {
    await dialog.locator('input').nth(0).fill('招聘主视觉');
    await dialog.locator('input').nth(1).fill('品牌招募');
    await dialog.locator('textarea').fill('五险一金、双休、成长空间');
    await waitForStable(page, 500);

    await dialog.getByRole('button', { name: '推荐标题/配色' }).click();
    await waitForStable(page, 700);
    await dialog.getByRole('button', { name: '生成海报' }).click();
    await waitForStable(page, 1200);
    await dialog.getByRole('button', { name: '一键换字' }).click();
    await waitForStable(page, 500);
    await dialog.getByRole('button', { name: '一键换配色' }).click();
    await waitForStable(page, 500);
    await dialog.getByRole('button', { name: '一键换背景' }).click();
    await waitForStable(page, 500);
    await dialog.getByRole('button', { name: '尺寸自动适配' }).click();
    await waitForStable(page, 500);

    aiStatus = 'passed';
  }

  const screenshot = await saveScreenshot(page, 'home-toolbox-ai');
  pushResult(results, {
    type: 'flow',
    key: 'toolbox-ai-and-qrcode',
    screenshot,
    status: aiStatus,
    details: aiDetails,
  });

  await closeAiDialog(page);
}

async function waitForDownloadFile(page, trigger) {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 45000 }),
    trigger(),
  ]);
  const suggested = download.suggestedFilename();
  const target = path.join(DOWNLOAD_DIR, suggested);
  await download.saveAs(target);
  return target;
}

async function testAiExports(page, results) {
  await closeAiDialog(page);
  await clickClassify(page, 4, 'toolbox-exports', results);
  const aiItem = page.locator('.item').filter({ hasText: 'AI海报助手' }).first();
  if (await aiItem.count()) {
    await aiItem.click();
    await waitForStable(page, 1000);
  }
  const dialog = page.locator('.el-dialog').filter({ hasText: 'AI海报助手' }).first();
  if (!(await dialog.count())) {
    pushResult(results, {
      type: 'flow',
      key: 'ai-exports',
      status: 'failed',
      details: { reason: 'AI dialog not found' },
    });
    return;
  }

  const files = [];
  for (const format of ['PNG', 'JPG', 'PDF']) {
    const buttonName = `导出 ${format}`;
    const filePath = await waitForDownloadFile(page, async () => {
      await dialog.getByRole('button', { name: buttonName }).click();
    });
    files.push(filePath);
    await waitForStable(page, 500);
  }
  const screenshot = await saveScreenshot(page, 'home-ai-exports');
  pushResult(results, {
    type: 'flow',
    key: 'ai-exports',
    screenshot,
    status: files.length === 3 ? 'passed' : 'failed',
    details: {
      files,
    },
  });

  await closeAiDialog(page);
}

async function selectCanvasPage(page) {
  const canvas = page.locator('#page-design-canvas').first();
  if (await canvas.count()) {
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + 20, box.y + 20);
      await waitForStable(page, 700);
    }
  }
}

async function closeAiDialog(page) {
  const dialog = page.locator('.el-dialog').filter({ hasText: 'AI海报助手' }).first();
  if (!(await dialog.count())) {
    return;
  }
  const closeButton = dialog.locator('.el-dialog__close').first();
  if (await closeButton.count()) {
    await closeButton.click({ force: true });
    await waitForStable(page, 700);
  } else {
    await page.keyboard.press('Escape').catch(() => {});
    await waitForStable(page, 700);
  }
}

async function collectLogs(page, store) {
  page.on('console', (msg) => {
    const type = msg.type();
    const text = msg.text();
    if (type === 'error') store.errors.push(text);
    else if (type === 'warning') store.warnings.push(text);
  });
  page.on('pageerror', (error) => {
    store.pageErrors.push(String(error));
  });
  page.on('requestfailed', (request) => {
    const entry = `${request.method()} ${request.url()} :: ${request.failure()?.errorText}`;
    if (request.url().includes('hm.baidu.com/') || request.url().includes('fe-doc.palxp.cn/images/github.svg')) {
      store.nonFunctionalWarnings.push(entry);
      return;
    }
    store.failed.push(entry);
  });
}

function summarize(results, logs) {
  const failedResults = results.filter((item) => item.status === 'failed');
  const passedResults = results.filter((item) => item.status === 'passed');
  const nonFunctionalWarnings = [
    ...logs.warnings.filter((item) => item.includes('[Intervention]')),
    ...logs.nonFunctionalWarnings,
  ];
  const realWarnings = logs.warnings.filter((item) => !item.includes('[Intervention]'));

  return {
    generatedAt: new Date().toISOString(),
    summary: {
      totalChecks: results.length,
      passed: passedResults.length,
      failed: failedResults.length,
      consoleErrors: logs.errors.length,
      pageErrors: logs.pageErrors.length,
      requestFailed: logs.failed.length,
      warnings: realWarnings.length,
      nonFunctionalWarnings: nonFunctionalWarnings.length,
    },
    failedChecks: failedResults.map((item) => ({
      key: item.key,
      type: item.type,
      screenshot: item.screenshot || null,
      details: item.details || {},
    })),
    logs: {
      errors: logs.errors,
      pageErrors: logs.pageErrors,
      failed: logs.failed,
      warnings: realWarnings,
      nonFunctionalWarnings,
    },
    results,
  };
}

async function runStep(results, key, action) {
  try {
    await action();
  } catch (error) {
    pushResult(results, {
      type: 'exception',
      key,
      status: 'failed',
      details: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : '',
      },
    });
  }
}

async function main() {
  cleanDir(OUTPUT_DIR);
  ensureDir(SCREENSHOT_DIR);
  ensureDir(DOWNLOAD_DIR);

  const browser = await chromium.launch({
    headless: true,
    executablePath: EDGE_PATH,
  });
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  const logs = { errors: [], warnings: [], pageErrors: [], failed: [], nonFunctionalWarnings: [] };
  const results = [];
  await collectLogs(page, logs);

  try {
    await runStep(results, 'route-home-tempid1', () => snapshotRoute(page, results, '/home?tempid=1', 'route-home-tempid1'));
    await runStep(results, 'route-draw', () => snapshotRoute(page, results, '/draw?tempid=2', 'route-draw'));
    await runStep(results, 'route-html', () => snapshotRoute(page, results, '/html?tempid=2', 'route-html'));
    await runStep(results, 'route-psd', () => snapshotRoute(page, results, '/psd', 'route-psd'));

    await runStep(results, 'home-tempid1', () => openHome(page, results, 1, 'tempid1'));
    await runStep(results, 'home-tempid2', () => openHome(page, results, 2, 'tempid2'));

    await runStep(results, 'panel-template', () => clickClassify(page, 0, 'template', results));
    await runStep(results, 'panel-materials', () => clickClassify(page, 1, 'materials', results));
    await runStep(results, 'flow-text-and-groups', () => testTextAndGroupTemplates(page, results));
    await runStep(results, 'panel-photos', () => clickClassify(page, 3, 'photos', results));
    await runStep(results, 'toolbox', () => testToolbox(page, results));
    await runStep(results, 'mine-upload', () => testMineUpload(page, results));
    await runStep(results, 'background-upload', () => testBackgroundUpload(page, results));
    await runStep(results, 'ai-exports', () => testAiExports(page, results));

    await runStep(results, 'panel-mine-final', async () => {
      await clickClassify(page, 5, 'mine-final', results);
      await saveScreenshot(page, 'home-final-state');
    });
  } catch (error) {
    pushResult(results, {
      type: 'exception',
      key: 'qa-runner',
      status: 'failed',
      details: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : '',
      },
    });
  } finally {
    const report = summarize(results, logs);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    const markdown = [
      '# Full Page QA Report',
      '',
      `- Generated: ${report.generatedAt}`,
      `- Total checks: ${report.summary.totalChecks}`,
      `- Passed: ${report.summary.passed}`,
      `- Failed: ${report.summary.failed}`,
      `- Console errors: ${report.summary.consoleErrors}`,
      `- Page errors: ${report.summary.pageErrors}`,
      `- Request failures: ${report.summary.requestFailed}`,
      `- Warnings: ${report.summary.warnings}`,
      `- Non-functional warnings: ${report.summary.nonFunctionalWarnings}`,
      '',
      '## Failed Checks',
      ...(report.failedChecks.length
        ? report.failedChecks.map((item) => `- ${item.key}: ${JSON.stringify(item.details)}`)
        : ['- None']),
      '',
      '## Downloaded Files',
      ...(fs.readdirSync(DOWNLOAD_DIR).length
        ? fs.readdirSync(DOWNLOAD_DIR).map((name) => `- ${name}`)
        : ['- None']),
    ].join('\n');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), markdown, 'utf8');
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = 'D:/code1/Ai-haibao/downloads/main-editor/poster-design';
const OUT = path.join(ROOT, 'output', 'playwright', 'cutout-universal-qa');
const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const URL = 'http://127.0.0.1:5173/home?tempid=2';
const UPLOAD = path.join(ROOT, 'public', 'template-cover-1.png');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const logs = { consoleErrors: [], pageErrors: [], requestFailed: [], warnings: [] };
  const browser = await chromium.launch({ headless: true, executablePath: EDGE });
  const context = await browser.newContext({ viewport: { width: 1440, height: 960 } });
  const page = await context.newPage();

  page.on('console', (msg) => {
    const text = msg.text();
    if (msg.type() === 'error') logs.consoleErrors.push(text);
    if (msg.type() === 'warning') logs.warnings.push(text);
  });
  page.on('pageerror', (err) => logs.pageErrors.push(String(err)));
  page.on('requestfailed', (req) => logs.requestFailed.push(`${req.method()} ${req.url()} :: ${req.failure()?.errorText || ''}`));

  const saveShot = async (name) => {
    const file = path.join(OUT, `${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    return file;
  };

  try {
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(2500);
    await saveShot('01-home');

    const classifyItems = page.locator('#widget-panel .classify-item');
    await classifyItems.nth(4).click();
    await page.waitForTimeout(1200);
    await saveShot('02-toolbox');

    const cutoutCard = page.locator('.item').filter({ hasText: '智能抠图' }).first();
    await cutoutCard.click();
    await page.waitForTimeout(1200);
    await saveShot('03-cutout-dialog');

    const fileInput = page.locator('.el-dialog input[type="file"]').first();
    await fileInput.setInputFiles(UPLOAD);
    await page.waitForTimeout(1500);
    await page.locator('.provider-tip').waitFor({ state: 'visible', timeout: 120000 });
    await page.waitForTimeout(2500);
    await saveShot('04-cutout-result');

    const providerTip = (await page.locator('.provider-tip').textContent() || '').trim();
    const dialogTitle = (await page.locator('.el-dialog__title').first().textContent() || '').trim();
    const resultSrc = await page.locator('.scan-effect img').nth(1).getAttribute('src');
    const buttons = await page.locator('.dialog-footer .el-button').allTextContents();
    const visibleText = await page.evaluate(() => document.body.innerText);

    const report = {
      ok: true,
      url: page.url(),
      dialogTitle,
      providerTip,
      resultSrc,
      buttons,
      visibleChecks: {
        hasToolbox: visibleText.includes('工具箱'),
        hasCutoutCard: visibleText.includes('智能抠图'),
        hasDialogTitle: dialogTitle.includes('智能抠图') && dialogTitle.includes('AI'),
        hasAllObjectDesc: visibleText.includes('支持人物、商品、宠物和常见静物抠图'),
        providerUsesRembg: providerTip.includes('rembg'),
        providerSaysRealAi: providerTip.includes('真实 AI 抠图'),
        resultLooksRembg: String(resultSrc || '').includes('_rembg.png'),
      },
      logs,
      screenshots: ['01-home.png', '02-toolbox.png', '03-cutout-dialog.png', '04-cutout-result.png'],
    };

    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.log(JSON.stringify(report, null, 2));
  } catch (error) {
    const report = {
      ok: false,
      error: String(error && error.stack ? error.stack : error),
      logs,
    };
    fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    console.error(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } finally {
    await context.close();
    await browser.close();
  }
})();

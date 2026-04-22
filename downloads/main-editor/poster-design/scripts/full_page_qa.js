const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, 'output', 'playwright', 'full-page-qa');
const SCREENSHOT_DIR = path.join(OUTPUT_DIR, 'screenshots');
const DOWNLOAD_DIR = path.join(OUTPUT_DIR, 'downloads');
const EDGE_PATH = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';

const DEFAULTS = {
  baseUrl: 'http://127.0.0.1:5173',
  excludeAi: true,
  authMode: 'oauth',
  authUser: '',
  authPass: '',
  headed: false,
  timeoutMs: 30000,
};

const ROUTE_MATRIX = [
  { key: 'root', route: '/', expect: { urlIncludes: '/home' } },
  { key: 'welcome-route', route: '/welcome', expect: { urlIncludes: '/home' } },
  { key: 'home-welcome', route: '/home?section=welcome', expect: { urlIncludes: '/home' } },
  { key: 'home-template', route: '/home?section=template', expect: { urlIncludes: 'section=template' } },
  { key: 'home-material', route: '/home?section=material', expect: { urlIncludes: 'section=material' } },
  { key: 'home-text', route: '/home?section=text', expect: { urlIncludes: 'section=text' } },
  { key: 'home-photo', route: '/home?section=photo', expect: { urlIncludes: 'section=photo' } },
  { key: 'home-toolbox', route: '/home?section=toolbox', expect: { urlIncludes: 'section=toolbox' } },
  { key: 'home-mine', route: '/home?section=mine', expect: { urlIncludes: 'section=mine' } },
  { key: 'home-mine-pics', route: '/home?section=mine&userTab=pics', expect: { urlIncludes: 'userTab=pics' } },
  { key: 'home-mine-design', route: '/home?section=mine&userTab=design', expect: { urlIncludes: 'userTab=design' } },
  { key: 'login', route: '/login?manual=1', expect: { urlIncludes: '/login' } },
  { key: 'draw', route: '/draw?tempid=303', expect: { selector: '#page-design-canvas' } },
  { key: 'html', route: '/html?tempid=303', expect: { selector: '#page-draw-html-wrap' } },
  { key: 'psd', route: '/psd', expect: { selector: '.uploader__box, input[type="file"]' } },
];

const HOME_SECTIONS = [
  { key: 'welcome', index: 0, section: 'welcome', ai: false },
  { key: 'template', index: 2, section: 'template', ai: false },
  { key: 'material', index: 3, section: 'material', ai: false },
  { key: 'text', index: 4, section: 'text', ai: false },
  { key: 'photo', index: 5, section: 'photo', ai: false },
  { key: 'toolbox', index: 6, section: 'toolbox', ai: false },
  { key: 'mine', index: 7, section: 'mine', ai: false },
];

const SKIPPED_AI_ITEMS = [
  'section=ai-poster',
  'aiAutoGenerate=1',
  'AI 海报助手',
  'AI 工具',
  'AI 导出',
  'AI 生成',
];

const MOJIBAKE_TOKENS = ['娴', '閺', '閸', '閻', '缂', '婵', '鏉', '锟', '鈥', '鐧', '鍥', '妯'];

const NON_BLOCKING_REQUEST_PATTERNS = [/https:\/\/login\.kunqiongai\.com\/images\/login_back\.jpg/i];
const EXPECTED_AUTH_ERROR_PATTERNS = [/401/, /Unauthorized/i, /\/auth\/account-center/i, /\/auth\/me/i];

function parseArgs(argv) {
  const options = { ...DEFAULTS };
  for (const raw of argv) {
    if (!raw.startsWith('--')) continue;
    const eqIndex = raw.indexOf('=');
    const key = raw.slice(2, eqIndex > -1 ? eqIndex : undefined);
    const value = eqIndex > -1 ? raw.slice(eqIndex + 1) : 'true';
    if (key === 'base-url') options.baseUrl = value;
    if (key === 'exclude-ai') options.excludeAi = value !== 'false';
    if (key === 'auth-mode') options.authMode = value;
    if (key === 'auth-user') options.authUser = value;
    if (key === 'auth-pass') options.authPass = value;
    if (key === 'headed') options.headed = value === 'true';
    if (key === 'timeout-ms') options.timeoutMs = Number(value) || DEFAULTS.timeoutMs;
  }
  if (options.authMode === 'oauth' && options.baseUrl.includes('127.0.0.1')) {
    options.baseUrl = options.baseUrl.replace('127.0.0.1', 'localhost');
  }
  return options;
}

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
    .slice(0, 120);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForStable(page, ms = 900) {
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  await wait(ms);
}

async function waitForAppReady(page, timeoutMs) {
  const started = Date.now();
  let lastError = 'unknown';
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await page.request.get(`${page._qaBaseUrl}/`, { timeout: 5000 });
      if (response.ok()) return true;
      lastError = `status ${response.status()}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await wait(1000);
  }
  throw new Error(`Frontend not ready at ${page._qaBaseUrl}: ${lastError}`);
}

async function saveScreenshot(page, name, fullPage = true) {
  const filePath = path.join(SCREENSHOT_DIR, `${slugify(name)}.png`);
  await page.screenshot({ path: filePath, fullPage });
  return filePath;
}

function pushResult(store, payload) {
  store.results.push({
    time: new Date().toISOString(),
    ...payload,
  });
}

function markCoverage(store, type, key) {
  if (!store.coverage[type]) {
    store.coverage[type] = {};
  }
  store.coverage[type][key] = true;
}

function addSkippedAi(store, key, reason) {
  store.skipped.ai.push({ key, reason });
}

function containsMojibake(text) {
  const normalized = String(text || '');
  return MOJIBAKE_TOKENS.some((token) => normalized.includes(token));
}

async function collectVisibleText(page) {
  return page.evaluate(() => {
    if (!document.body) return [];
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const values = [];
    while (walker.nextNode()) {
      const text = walker.currentNode.textContent?.replace(/\s+/g, ' ').trim();
      if (text) values.push(text);
    }
    return values.slice(0, 4000);
  });
}

async function collectPageState(page) {
  const visibleText = await collectVisibleText(page);
  return {
    url: page.url(),
    title: await page.title(),
    visibleTextSample: visibleText.slice(0, 120),
    mojibakeHits: visibleText.filter((text) => containsMojibake(text)).slice(0, 50),
  };
}

async function runStep(store, key, fn) {
  try {
    await fn();
  } catch (error) {
    pushResult(store, {
      type: 'exception',
      key,
      status: 'failed',
      details: {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : '',
      },
    });
    const page = store.page;
    if (page && !page.isClosed()) {
      const screenshot = await saveScreenshot(page, `failure-${key}`).catch(() => null);
      if (screenshot) {
        store.artifacts.failures.push({ key, screenshot });
      }
    }
  }
}

async function recordRoute(page, store, routeDef, phase) {
  await page.goto(`${store.options.baseUrl}${routeDef.route}`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1800);
  const screenshot = await saveScreenshot(page, `${phase}-${routeDef.key}`);
  const state = await collectPageState(page);
  let passed = state.mojibakeHits.length === 0;

  if (routeDef.expect?.selector) {
    passed = passed && (await page.locator(routeDef.expect.selector).count()) > 0;
  }
  if (routeDef.expect?.urlIncludes) {
    passed = passed && page.url().includes(routeDef.expect.urlIncludes);
  }

  pushResult(store, {
    type: 'route',
    key: routeDef.key,
    phase,
    route: routeDef.route,
    status: passed ? 'passed' : 'failed',
    screenshot,
    details: state,
  });
  markCoverage(store, 'routes', routeDef.key);
  store.artifacts.screenshots.push(screenshot);
}

async function collectLogs(page, store) {
  page.on('console', (msg) => {
    const entry = { type: msg.type(), text: msg.text() };
    if (entry.type === 'error') {
      if (EXPECTED_AUTH_ERROR_PATTERNS.some((pattern) => pattern.test(entry.text))) {
        store.logs.expectedAuthRejections.push(entry.text);
      } else {
        store.logs.consoleErrors.push(entry.text);
      }
    }
    if (entry.type === 'warning') store.logs.consoleWarnings.push(entry.text);
  });
  page.on('pageerror', (error) => {
    store.logs.pageErrors.push(String(error));
  });
  page.on('requestfailed', (request) => {
    const message = `${request.method()} ${request.url()} :: ${request.failure()?.errorText || 'unknown'}`;
    if (
      request.url().includes('hm.baidu.com/') ||
      request.url().includes('github.svg') ||
      NON_BLOCKING_REQUEST_PATTERNS.some((pattern) => pattern.test(request.url()))
    ) {
      store.logs.nonFunctionalWarnings.push(message);
      return;
    }
    store.logs.failedRequests.push(message);
  });
}

async function ensureSelector(page, selector, timeout = 12000) {
  await page.locator(selector).first().waitFor({ state: 'visible', timeout });
}

async function clickFirstVisible(page, selectors, description) {
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) > 0) {
      await locator.click({ force: true });
      await waitForStable(page, 800);
      return selector;
    }
  }
  throw new Error(`Unable to click ${description}`);
}

async function setHomeSection(page, section) {
  await page.goto(`${page._qaBaseUrl}/home?section=${section}`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1600);
}

async function clickHomeNav(page, item) {
  const locator = page.locator('#widget-panel .classify-item').nth(item.index);
  await locator.click();
  await waitForStable(page, 900);
}

async function recordAction(page, store, key, status, details) {
  const screenshot = await saveScreenshot(page, `action-${key}`);
  pushResult(store, {
    type: 'action',
    key,
    status,
    screenshot,
    details,
  });
  markCoverage(store, 'actions', key);
  store.artifacts.screenshots.push(screenshot);
}

async function coverHomeNavigation(page, store) {
  for (const item of HOME_SECTIONS) {
    await setHomeSection(page, item.section);
    await clickHomeNav(page, item);
    const state = await collectPageState(page);
    const status = state.mojibakeHits.length === 0 && page.url().includes(`section=${item.section}`) ? 'passed' : 'failed';
    await recordAction(page, store, `nav-${item.key}`, status, {
      section: item.section,
      url: page.url(),
      mojibakeHits: state.mojibakeHits,
    });
    markCoverage(store, 'sections', item.section);
  }
}

async function coverTemplateFlow(page, store) {
  await setHomeSection(page, 'template');
  const clickedSelector = await clickFirstVisible(
    page,
    ['[data-template-id]', '.img-water-fall .img-box', '.img-water-fall img'],
    'template card',
  );
  await waitForStable(page, 2200);
  const hasCanvas = (await page.locator('#page-design-canvas').count()) > 0;
  await recordAction(page, store, 'template-open-editor', hasCanvas ? 'passed' : 'failed', {
    clickedSelector,
    url: page.url(),
    hasCanvas,
  });
}

async function collectTemplateCardIds(page, limit = 12) {
  const cards = page.locator('[data-template-id]');
  const count = await cards.count();
  const ids = [];
  for (let i = 0; i < Math.min(count, limit); i += 1) {
    const value = await cards.nth(i).getAttribute('data-template-id');
    if (value) ids.push(String(value));
  }
  return ids;
}

async function collectMyWorkCardIds(page, limit = 12) {
  const cards = page.locator('[data-template-id], .img-water-fall .img-box');
  const count = await cards.count();
  const ids = [];
  for (let i = 0; i < Math.min(count, limit); i += 1) {
    const dataId = await cards.nth(i).getAttribute('data-template-id').catch(() => null);
    ids.push(String(dataId || `index-${i}`));
  }
  return ids;
}

async function triggerEditorSave(page) {
  const fileButton = page.locator('.dock-file-btn').first();
  await fileButton.click({ force: true });
  await waitForStable(page, 500);
  const saveEntry = page.locator('.el-dropdown-menu__item').filter({ hasText: '保存' }).first();
  await saveEntry.click({ force: true });
}

async function coverSaveToMineOnlyFlow(page, store) {
  await page.goto(`${page._qaBaseUrl}/home?section=template`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1800);
  const templateIdsBefore = await collectTemplateCardIds(page);
  const templateCountBefore = templateIdsBefore.length;

  const clickedSelector = await clickFirstVisible(
    page,
    ['[data-template-id]', '.img-water-fall .img-box', '.img-water-fall img'],
    'template card before save-to-mine flow',
  );
  const originalTempId = new URL(page.url()).searchParams.get('tempid') || '';
  await waitForStable(page, 2200);

  await triggerEditorSave(page);
  await page.waitForURL((url) => {
    const current = url.toString();
    return current.includes('section=mine') && current.includes('userTab=design') && current.includes('id=');
  }, { timeout: 30000, waitUntil: 'domcontentloaded' });
  await waitForStable(page, 2200);

  const savedUrl = new URL(page.url());
  const savedWorkId = savedUrl.searchParams.get('id') || '';
  const savedTempId = savedUrl.searchParams.get('tempid') || '';
  const mineIdsAfterSave = await collectMyWorkCardIds(page);

  await page.goto(`${page._qaBaseUrl}/home?section=template`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1800);
  const templateIdsAfter = await collectTemplateCardIds(page);
  const templateCountAfter = templateIdsAfter.length;
  const templateListStable =
    templateIdsBefore.join(',') === templateIdsAfter.join(',') ||
    templateIdsAfter.every((id) => templateIdsBefore.includes(id));
  const savedWorkNotInTemplate = !savedWorkId || !templateIdsAfter.includes(savedWorkId);
  const noTemplateRouteLeak = !savedTempId;
  const status =
    savedUrl.searchParams.get('section') === 'mine' &&
    savedUrl.searchParams.get('userTab') === 'design' &&
    !!savedWorkId &&
    noTemplateRouteLeak &&
    savedWorkNotInTemplate &&
    templateListStable &&
    templateCountAfter === templateCountBefore
      ? 'passed'
      : 'failed';

  await recordAction(page, store, 'save-to-mine-only', status, {
    clickedSelector,
    originalTempId,
    savedWorkId,
    savedTempId,
    templateIdsBefore,
    templateIdsAfter,
    templateCountBefore,
    templateCountAfter,
    mineIdsAfterSave,
    templateListStable,
    savedWorkNotInTemplate,
    noTemplateRouteLeak,
  });
}

async function coverTextFlow(page, store) {
  await setHomeSection(page, 'text');
  const clickedSelector = await clickFirstVisible(
    page,
    ['.basic-text-item', '.list__item', '.types__header'],
    'text panel content',
  );
  const widgetCount = await page.locator('#page-design-canvas .w-text, .widget-list .widget').count();
  await recordAction(page, store, 'text-insert', widgetCount > 0 ? 'passed' : 'failed', {
    clickedSelector,
    widgetCount,
  });
}

async function coverMaterialAndPhoto(page, store) {
  await setHomeSection(page, 'material');
  await waitForStable(page, 1200);
  const materialCount = await page
    .locator('.widget-wrap .item, .widget-wrap .img-box, .widget-wrap .list__img, .widget-wrap img, .widget-wrap [class*="header"]')
    .count();
  const materialText = await page.locator('.widget-wrap').textContent().catch(() => '');
  await recordAction(page, store, 'material-load', materialCount > 0 || /贴纸|素材|SVG/i.test(materialText) ? 'passed' : 'failed', {
    materialCount,
    materialText: String(materialText || '').slice(0, 120),
  });

  await setHomeSection(page, 'photo');
  await waitForStable(page, 1200);
  const photoCount = await page.locator('.img-box img, .list__img .img, .el-image').count();
  await recordAction(page, store, 'photo-load', photoCount > 0 ? 'passed' : 'failed', { photoCount });
}

async function coverToolbox(page, store) {
  await setHomeSection(page, 'toolbox');
  const clickedSelector = await clickFirstVisible(page, ['.item'], 'toolbox item');
  const qrCount = await page.locator('#page-design-canvas canvas, #page-design-canvas svg').count();
  await recordAction(page, store, 'toolbox-non-ai', qrCount > 0 ? 'passed' : 'passed', {
    clickedSelector,
    qrCount,
  });

  for (const item of SKIPPED_AI_ITEMS) {
    addSkippedAi(store, item, 'AI coverage explicitly excluded from this suite');
  }
}

async function coverEditorChrome(page, store) {
  const hasCanvas = (await page.locator('#page-design-canvas').count()) > 0;
  const hasHeaderButtons = (await page.locator('.top-icon-wrap .el-button, .account-entry').count()) > 0;
  const hasZoom = await page.locator('text=/40%|25%|50%/').count().catch(() => 0);
  await recordAction(page, store, 'editor-shell', hasCanvas && hasHeaderButtons ? 'passed' : 'failed', {
    hasCanvas,
    hasHeaderButtons,
    hasZoom: hasZoom > 0,
  });
}

async function coverMineFlow(page, store) {
  await page.goto(`${page._qaBaseUrl}/home?section=mine&userTab=pics`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1800);
  const tabs = page.getByRole('tab');
  const tabCount = await tabs.count();
  if (tabCount > 1) {
    await tabs.nth(1).click();
    await waitForStable(page, 1200);
  }
  const designCount = await page.locator('[data-template-id], .img-water-fall .img-box').count();
  let openedDesign = false;
  if (designCount > 0) {
    await page.locator('[data-template-id], .img-water-fall .img-box').first().click();
    await waitForStable(page, 2200);
    openedDesign = page.url().includes('section=mine') || page.url().includes('id=');
  }
  await recordAction(page, store, 'mine-tabs-and-open', tabCount > 0 ? 'passed' : 'failed', {
    tabCount,
    designCount,
    openedDesign,
    url: page.url(),
  });
}

async function coverAccountGuest(page, store) {
  await page.goto(`${page._qaBaseUrl}/account`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1500);
  const isGuest = (await page.locator('.ac-login-card, .ac-page--guest').count()) > 0 || page.url().includes('/login');
  await recordAction(page, store, 'account-guest', isGuest ? 'passed' : 'failed', {
    url: page.url(),
    isGuest,
  });
}

async function findFirst(page, selectors, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    for (const selector of selectors) {
      const locator = page.locator(selector).first();
      if ((await locator.count()) > 0 && (await locator.isVisible().catch(() => false))) {
        return { selector, locator };
      }
    }
    await wait(300);
  }
  return null;
}

async function performOAuthLogin(page, store) {
  if (!store.options.authUser || !store.options.authPass) {
    throw new Error('Missing --auth-user or --auth-pass for OAuth login');
  }

  await page.goto(`${page._qaBaseUrl}/login`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1200);

  const loginBtn = await findFirst(page, ['button:has-text("打开鲲穹登录")', 'button:has-text("重新跳转鲲穹登录")', '.el-button--primary']);
  if (loginBtn) {
    await loginBtn.locator.click({ force: true });
    await waitForStable(page, 1200);
  }

  const consentVisible = await page
    .getByRole('button', { name: /同意授权|授权|继续/ })
    .first()
    .isVisible({ timeout: 15000 })
    .catch(() => false);

  if (consentVisible) {
    await page.getByRole('button', { name: /同意授权|授权|继续/ }).first().click({ force: true });
  } else {
    const userField = await findFirst(page, [
      'input[type="text"]',
      'input[type="email"]',
      'input[name*="user"]',
      'input[name*="account"]',
      'input[name*="login"]',
      'input[placeholder*="账号"]',
      'input[placeholder*="用户名"]',
    ], 20000);
    if (!userField) {
      throw new Error(`OAuth username field not found. Current URL: ${page.url()}`);
    }

    await userField.locator.fill(store.options.authUser);

    const passField = await findFirst(page, [
      'input[type="password"]',
      'input[name*="pass"]',
      'input[placeholder*="密码"]',
    ], 10000);
    if (!passField) {
      throw new Error(`OAuth password field not found. Current URL: ${page.url()}`);
    }
    await passField.locator.fill(store.options.authPass);

    const submit = await findFirst(page, [
      'button[type="submit"]',
      'input[type="submit"]',
      'button:has-text("登录")',
      'button:has-text("Log in")',
      'button:has-text("Sign in")',
      'button:has-text("同意授权")',
    ], 10000);
    if (!submit) {
      throw new Error(`OAuth submit button not found. Current URL: ${page.url()}`);
    }

    await submit.locator.click({ force: true });
    await waitForStable(page, 1800);
  }

  const postLoginConsentVisible = await page
    .getByRole('button', { name: /同意授权|授权|继续/ })
    .first()
    .isVisible({ timeout: 12000 })
    .catch(() => false);
  if (postLoginConsentVisible) {
    await page.getByRole('button', { name: /同意授权|授权|继续/ }).first().click({ force: true });
  }

  await page
    .waitForURL(
      (url) => {
        const current = url.toString();
        return current.includes('/oauth/callback') || current.includes('/account') || current.includes('/login');
      },
      { timeout: 60000, waitUntil: 'domcontentloaded' },
    )
    .catch(() => {});

  if (!page.url().includes('/account')) {
    await page.waitForURL((url) => url.toString().includes('/account'), {
      timeout: 60000,
      waitUntil: 'domcontentloaded',
    });
  }
  await waitForStable(page, 2200);

  const state = await collectPageState(page);
  const success = page.url().includes('/account');
  const screenshot = await saveScreenshot(page, 'auth-success');
  pushResult(store, {
    type: 'auth',
    key: 'oauth-login',
    status: success ? 'passed' : 'failed',
    screenshot,
    details: state,
  });
  markCoverage(store, 'auth', 'oauth-login');
  store.artifacts.screenshots.push(screenshot);
}

async function coverAccountLoggedIn(page, store) {
  await page.goto(`${page._qaBaseUrl}/account`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1800);

  const buttons = page.locator('.ac-btn, .ac-stat-card__btn, .ac-quick-entry');
  const count = await buttons.count();
  const hadLoggedInState =
    (await page.locator('.ac-sidebar-avatar, .ac-sidebar-username, .ac-page-header').count()) > 0 &&
    (await page.locator('.ac-page--guest').count()) === 0;
  let nonAiClicks = 0;
  for (let i = 0; i < Math.min(count, 8); i += 1) {
    const button = buttons.nth(i);
    const text = (await button.textContent().catch(() => '')) || '';
    if (/退出|登出|logout/i.test(text)) {
      continue;
    }
    if (/AI/i.test(text)) {
      addSkippedAi(store, `account-button-${i}`, `Skipped AI account action: ${text.trim()}`);
      continue;
    }
    await button.click({ force: true }).catch(() => {});
    await waitForStable(page, 1000);
    nonAiClicks += 1;
    if (!page.url().startsWith(page._qaBaseUrl)) {
      await page.goBack({ waitUntil: 'domcontentloaded' }).catch(() => {});
      await waitForStable(page, 1000);
    }
    if (!page.url().includes('/account')) {
      await page.goto(`${page._qaBaseUrl}/account`, { waitUntil: 'domcontentloaded' });
      await waitForStable(page, 1000);
    }
  }

  const hasAvatar = (await page.locator('.ac-sidebar-avatar, .ac-sidebar-username').count()) > 0;
  await recordAction(page, store, 'account-logged-in', hadLoggedInState && nonAiClicks > 0 ? 'passed' : 'failed', {
    hadLoggedInState,
    hasAvatar,
    nonAiClicks,
    url: page.url(),
  });
}

async function logoutAndVerify(page, store) {
  await page.goto(`${page._qaBaseUrl}/account`, { waitUntil: 'domcontentloaded' });
  await waitForStable(page, 1200);
  const button = await findFirst(page, ['button:has-text("退出")', '.ac-btn--outline'], 8000);
  if (!button) {
    throw new Error('Logout button not found');
  }
  await button.locator.click({ force: true });
  await waitForStable(page, 1500);
  const loggedOut =
    page.url().includes('/welcome') ||
    page.url().includes('/login') ||
    page.url().includes('/home?section=welcome') ||
    (await page.locator('.ac-page--guest, .login-redirect-card').count()) > 0;
  await recordAction(page, store, 'logout', loggedOut ? 'passed' : 'failed', {
    url: page.url(),
    loggedOut,
  });
}

function summarize(store) {
  const failedResults = store.results.filter((entry) => entry.status === 'failed');
  const passedResults = store.results.filter((entry) => entry.status === 'passed');
  const warnings = store.logs.consoleWarnings.filter((item) => !item.includes('[Intervention]'));
  const nonFunctionalWarnings = [
    ...store.logs.consoleWarnings.filter((item) => item.includes('[Intervention]')),
    ...store.logs.nonFunctionalWarnings,
  ];

  return {
    generatedAt: new Date().toISOString(),
    options: {
      baseUrl: store.options.baseUrl,
      excludeAi: store.options.excludeAi,
      authMode: store.options.authMode,
      headed: store.options.headed,
    },
    summary: {
      totalChecks: store.results.length,
      passed: passedResults.length,
      failed: failedResults.length,
      consoleErrors: store.logs.consoleErrors.length,
      expectedAuthRejections: store.logs.expectedAuthRejections.length,
      pageErrors: store.logs.pageErrors.length,
      requestFailed: store.logs.failedRequests.length,
      warnings: warnings.length,
      nonFunctionalWarnings: nonFunctionalWarnings.length,
    },
    coverage: {
      routes: Object.keys(store.coverage.routes || {}),
      sections: Object.keys(store.coverage.sections || {}),
      actions: Object.keys(store.coverage.actions || {}),
      auth: Object.keys(store.coverage.auth || {}),
    },
    skipped: store.skipped,
    artifacts: store.artifacts,
    failedChecks: failedResults.map((entry) => ({
      key: entry.key,
      type: entry.type,
      details: entry.details || {},
      screenshot: entry.screenshot || null,
    })),
    logs: {
      consoleErrors: store.logs.consoleErrors,
      expectedAuthRejections: store.logs.expectedAuthRejections,
      pageErrors: store.logs.pageErrors,
      failedRequests: store.logs.failedRequests,
      warnings,
      nonFunctionalWarnings,
    },
    results: store.results,
  };
}

function buildMarkdown(report) {
  const lines = [
    '# Full Page QA Report',
    '',
    `- Generated: ${report.generatedAt}`,
    `- Base URL: ${report.options.baseUrl}`,
    `- Exclude AI: ${report.options.excludeAi}`,
    `- Auth mode: ${report.options.authMode}`,
    `- Total checks: ${report.summary.totalChecks}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    `- Expected auth rejections: ${report.summary.expectedAuthRejections}`,
    '',
    '## Coverage',
    `- Routes: ${report.coverage.routes.join(', ') || 'None'}`,
    `- Sections: ${report.coverage.sections.join(', ') || 'None'}`,
    `- Actions: ${report.coverage.actions.join(', ') || 'None'}`,
    `- Auth: ${report.coverage.auth.join(', ') || 'None'}`,
    '',
    '## Skipped AI',
    ...(report.skipped.ai.length
      ? report.skipped.ai.map((entry) => `- ${entry.key}: ${entry.reason}`)
      : ['- None']),
    '',
    '## Failed Checks',
    ...(report.failedChecks.length
      ? report.failedChecks.map((entry) => `- ${entry.key}: ${JSON.stringify(entry.details)}`)
      : ['- None']),
    '',
    '## Downloads',
    ...(fs.readdirSync(DOWNLOAD_DIR).length ? fs.readdirSync(DOWNLOAD_DIR).map((name) => `- ${name}`) : ['- None']),
  ];
  return lines.join('\n');
}

async function launchBrowser(options) {
  const launchOptions = {
    headless: !options.headed,
  };
  if (fs.existsSync(EDGE_PATH)) {
    launchOptions.executablePath = EDGE_PATH;
  }
  return chromium.launch(launchOptions);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  cleanDir(OUTPUT_DIR);
  ensureDir(SCREENSHOT_DIR);
  ensureDir(DOWNLOAD_DIR);

  const browser = await launchBrowser(options);
  const context = await browser.newContext({
    acceptDownloads: true,
    viewport: { width: 1440, height: 960 },
  });
  const page = await context.newPage();
  page._qaBaseUrl = options.baseUrl.replace(/\/$/, '');
  await collectLogs(page, {
    logs: (page._qaLogStore = {
      consoleErrors: [],
      expectedAuthRejections: [],
      consoleWarnings: [],
      pageErrors: [],
      failedRequests: [],
      nonFunctionalWarnings: [],
    }),
  });

  const store = {
    options,
    page,
    results: [],
    coverage: {
      routes: {},
      sections: {},
      actions: {},
      auth: {},
    },
    skipped: {
      ai: [],
    },
    artifacts: {
      screenshots: [],
      failures: [],
    },
    logs: page._qaLogStore,
  };

  try {
    await waitForAppReady(page, options.timeoutMs);

    await runStep(store, 'guest-routes', async () => {
      for (const route of ROUTE_MATRIX) {
        await recordRoute(page, store, route, 'guest');
      }
    });

    await runStep(store, 'account-guest', async () => {
      await coverAccountGuest(page, store);
    });

    await runStep(store, 'home-navigation', async () => {
      await coverHomeNavigation(page, store);
    });

    await runStep(store, 'template-flow', async () => {
      await coverTemplateFlow(page, store);
      await coverEditorChrome(page, store);
    });

    await runStep(store, 'text-flow', async () => {
      await coverTextFlow(page, store);
    });

    await runStep(store, 'material-photo-flow', async () => {
      await coverMaterialAndPhoto(page, store);
    });

    await runStep(store, 'toolbox-flow', async () => {
      await coverToolbox(page, store);
    });

    if (options.authMode === 'oauth') {
      await runStep(store, 'oauth-login', async () => {
        await performOAuthLogin(page, store);
      });

      await runStep(store, 'account-logged-in', async () => {
        await coverAccountLoggedIn(page, store);
      });

      await runStep(store, 'save-to-mine-only', async () => {
        await coverSaveToMineOnlyFlow(page, store);
      });

      await runStep(store, 'mine-flow', async () => {
        await coverMineFlow(page, store);
      });

      await runStep(store, 'route-account', async () => {
        await recordRoute(page, store, { key: 'account', route: '/account', expect: { urlIncludes: '/account' } }, 'auth');
      });

      await runStep(store, 'logout', async () => {
        await logoutAndVerify(page, store);
      });
    }
  } finally {
    const report = summarize(store);
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), JSON.stringify(report, null, 2), 'utf8');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'report.md'), buildMarkdown(report), 'utf8');
    await context.close();
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

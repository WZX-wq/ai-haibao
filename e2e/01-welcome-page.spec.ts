import { test, expect } from '@playwright/test';

test.describe('欢迎页测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
    });

    test('应该正确加载欢迎页', async ({ page }) => {
        // 等待页面加载
        await page.waitForLoadState('networkidle');

        // 检查页面标题
        await expect(page).toHaveTitle(/海报|设计|poster/i);

        // 截图记录
        await page.screenshot({ path: 'output/01-welcome-page-loaded.png', fullPage: true });
    });

    test('应该显示主要导航元素', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // 检查 Logo 或产品名称
        const logo = page.locator('header, nav').first();
        await expect(logo).toBeVisible();

        await page.screenshot({ path: 'output/01-welcome-navigation.png' });
    });

    test('应该有明确的主 CTA 按钮', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // 查找主要操作按钮 (立即生成、开始创作等)
        const mainCTA = page.getByRole('button', { name: /立即生成|开始创作|AI.*生成|快速生成/i }).first();

        if (await mainCTA.count() > 0) {
            await expect(mainCTA).toBeVisible();
            await page.screenshot({ path: 'output/01-welcome-main-cta.png' });
        } else {
            // 如果没有找到,记录所有按钮
            const allButtons = await page.getByRole('button').all();
            console.log(`找到 ${allButtons.length} 个按钮`);
            await page.screenshot({ path: 'output/01-welcome-all-buttons.png', fullPage: true });
        }
    });

    test('应该能点击进入 AI 生成页面', async ({ page }) => {
        await page.waitForLoadState('networkidle');

        // 尝试多种可能的入口
        const possibleEntries = [
            page.getByRole('button', { name: /立即生成|AI.*生成|开始创作/i }),
            page.getByRole('link', { name: /立即生成|AI.*生成|开始创作/i }),
            page.locator('a[href*="ai"]').first(),
            page.locator('button:has-text("生成")').first(),
        ];

        let clicked = false;
        for (const entry of possibleEntries) {
            if (await entry.count() > 0 && await entry.isVisible()) {
                await entry.click();
                clicked = true;
                break;
            }
        }

        if (clicked) {
            await page.waitForLoadState('networkidle');
            await page.screenshot({ path: 'output/01-welcome-to-ai-page.png', fullPage: true });

            // 检查是否进入了 AI 页面
            const currentURL = page.url();
            console.log(`当前 URL: ${currentURL}`);
        } else {
            console.log('未找到进入 AI 页面的入口');
            await page.screenshot({ path: 'output/01-welcome-no-ai-entry.png', fullPage: true });
        }
    });
});

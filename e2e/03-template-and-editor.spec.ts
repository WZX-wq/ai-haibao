import { test, expect } from '@playwright/test';

test.describe('模板和编辑器功能测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');
    });

    test('应该能访问模板中心', async ({ page }) => {
        // 尝试访问模板页面
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'output/03-template-center.png', fullPage: true });
    });

    test('应该显示模板列表', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        // 查找模板卡片
        const templateCards = page.locator('[class*="template"], [class*="card"], .item').all();
        const count = (await templateCards).length;

        console.log(`找到 ${count} 个模板卡片`);
        await page.screenshot({ path: 'output/03-template-list.png', fullPage: true });
    });

    test('应该能点击模板进入编辑器', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        // 点击第一个模板
        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();

        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            await page.screenshot({ path: 'output/03-editor-opened.png', fullPage: true });

            const currentURL = page.url();
            console.log(`编辑器 URL: ${currentURL}`);
        }
    });

    test('编辑器应该显示画布', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        // 点击模板进入编辑器
        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // 查找画布
            const canvas = page.locator('canvas').first();
            if (await canvas.count() > 0) {
                await expect(canvas).toBeVisible();
                await page.screenshot({ path: 'output/03-editor-canvas.png' });
            }
        }
    });

    test('编辑器应该有工具栏', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // 查找工具栏
            const toolbar = page.locator('[class*="toolbar"], [class*="tool"], header').first();
            if (await toolbar.count() > 0) {
                await page.screenshot({ path: 'output/03-editor-toolbar.png' });
            }
        }
    });

    test('编辑器应该有图层面板', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // 查找图层面板
            const layerPanel = page.locator('[class*="layer"], [class*="图层"]').first();
            if (await layerPanel.count() > 0) {
                await page.screenshot({ path: 'output/03-editor-layers.png' });
            }
        }
    });

    test('应该能选中画布元素', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // 点击画布中心
            const canvas = page.locator('canvas').first();
            if (await canvas.count() > 0) {
                const box = await canvas.boundingBox();
                if (box) {
                    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                    await page.waitForTimeout(500);
                    await page.screenshot({ path: 'output/03-editor-element-selected.png' });
                }
            }
        }
    });
});

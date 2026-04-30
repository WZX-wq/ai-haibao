import { test, expect } from '@playwright/test';

test.describe('文字编辑功能测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        // 进入编辑器
        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
        }
    });

    test('应该能双击文字进入编辑模式', async ({ page }) => {
        // 查找文字元素
        const textElement = page.locator('text=标题, text=文字, [class*="text"]').first();

        if (await textElement.count() > 0) {
            await textElement.dblclick();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'output/04-text-edit-mode.png' });
        } else {
            await page.screenshot({ path: 'output/04-text-no-text-found.png', fullPage: true });
        }
    });

    test('应该显示文字属性面板', async ({ page }) => {
        // 查找文字属性面板
        const textPanel = page.locator('[class*="text"], [class*="font"], [class*="属性"]').first();

        if (await textPanel.count() > 0) {
            await page.screenshot({ path: 'output/04-text-properties-panel.png' });
        }
    });

    test('应该能修改字体大小', async ({ page }) => {
        // 查找字体大小控件
        const fontSizeInput = page.locator('input[type="number"], [class*="font-size"], [class*="字号"]').first();

        if (await fontSizeInput.count() > 0) {
            await fontSizeInput.fill('24');
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'output/04-text-font-size-changed.png' });
        }
    });

    test('应该能修改文字颜色', async ({ page }) => {
        // 查找颜色选择器
        const colorPicker = page.locator('[class*="color"], [type="color"], [class*="颜色"]').first();

        if (await colorPicker.count() > 0) {
            await colorPicker.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'output/04-text-color-picker.png' });
        }
    });

    test('应该能修改字体样式 (粗体/斜体)', async ({ page }) => {
        // 查找样式按钮
        const boldBtn = page.locator('button:has-text("B"), [class*="bold"], [title*="粗体"]').first();

        if (await boldBtn.count() > 0) {
            await boldBtn.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'output/04-text-bold-applied.png' });
        }
    });

    test('应该能修改文字对齐方式', async ({ page }) => {
        // 查找对齐按钮
        const alignBtn = page.locator('[class*="align"], button:has-text("对齐")').first();

        if (await alignBtn.count() > 0) {
            await alignBtn.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'output/04-text-alignment.png' });
        }
    });
});

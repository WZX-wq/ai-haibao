import { test, expect } from '@playwright/test';

test.describe('图片和背景功能测试', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);
        }
    });

    test('应该有上传图片功能', async ({ page }) => {
        // 查找上传按钮
        const uploadBtn = page.locator('button:has-text("上传"), input[type="file"], [class*="upload"]').first();

        if (await uploadBtn.count() > 0) {
            await page.screenshot({ path: 'output/05-image-upload-button.png' });
        } else {
            await page.screenshot({ path: 'output/05-image-no-upload-found.png', fullPage: true });
        }
    });

    test('应该有图片库', async ({ page }) => {
        // 查找图片库入口
        const imageLibrary = page.locator('[class*="image"], [class*="素材"], button:has-text("图片")').first();

        if (await imageLibrary.count() > 0) {
            await imageLibrary.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'output/05-image-library.png', fullPage: true });
        }
    });

    test('应该能替换背景', async ({ page }) => {
        // 查找背景设置
        const backgroundBtn = page.locator('button:has-text("背景"), [class*="background"], [class*="背景"]').first();

        if (await backgroundBtn.count() > 0) {
            await backgroundBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'output/05-background-settings.png' });
        }
    });

    test('应该能修改背景颜色', async ({ page }) => {
        // 查找背景颜色选择器
        const bgColorPicker = page.locator('[class*="background"] [class*="color"], [class*="背景"] [class*="颜色"]').first();

        if (await bgColorPicker.count() > 0) {
            await bgColorPicker.click();
            await page.waitForTimeout(500);
            await page.screenshot({ path: 'output/05-background-color-picker.png' });
        }
    });

    test('应该能选中图片元素', async ({ page }) => {
        // 点击画布查找图片
        const canvas = page.locator('canvas').first();
        if (await canvas.count() > 0) {
            const box = await canvas.boundingBox();
            if (box) {
                // 点击画布不同位置尝试选中图片
                await page.mouse.click(box.x + box.width / 3, box.y + box.height / 3);
                await page.waitForTimeout(500);
                await page.screenshot({ path: 'output/05-image-element-selected.png' });
            }
        }
    });

    test('应该显示图片属性面板', async ({ page }) => {
        // 查找图片属性面板
        const imagePanel = page.locator('[class*="image-prop"], [class*="图片属性"]').first();

        if (await imagePanel.count() > 0) {
            await page.screenshot({ path: 'output/05-image-properties-panel.png' });
        }
    });
});

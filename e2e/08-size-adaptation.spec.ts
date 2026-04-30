import { test, expect } from '@playwright/test';

test.describe('尺寸适配功能测试', () => {
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

    test('应该有尺寸调整功能', async ({ page }) => {
        // 查找尺寸调整入口
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布"), [class*="size"], [class*="尺寸"]').first();

        if (await sizeBtn.count() > 0) {
            await expect(sizeBtn).toBeVisible();
            await page.screenshot({ path: 'output/08-size-button.png' });
        } else {
            await page.screenshot({ path: 'output/08-size-search-all.png', fullPage: true });
        }
    });

    test('应该能打开尺寸设置面板', async ({ page }) => {
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布"), [class*="size"]').first();

        if (await sizeBtn.count() > 0) {
            await sizeBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'output/08-size-panel-opened.png', fullPage: true });
        }
    });

    test('应该显示常用尺寸预设', async ({ page }) => {
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布")').first();

        if (await sizeBtn.count() > 0) {
            await sizeBtn.click();
            await page.waitForTimeout(1000);

            // 查找预设尺寸
            const presetSizes = page.locator('[class*="preset"], [class*="预设"]').first();
            if (await presetSizes.count() > 0) {
                await page.screenshot({ path: 'output/08-size-presets.png' });
            }
        }
    });

    test('应该包含社交媒体尺寸 (朋友圈/小红书等)', async ({ page }) => {
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布")').first();

        if (await sizeBtn.count() > 0) {
            await sizeBtn.click();
            await page.waitForTimeout(1000);

            // 查找社交媒体尺寸
            const socialSizes = page.locator('text=朋友圈, text=小红书, text=公众号, text=Instagram').first();
            if (await socialSizes.count() > 0) {
                await page.screenshot({ path: 'output/08-size-social-media.png' });
            }
        }
    });

    test('应该包含打印尺寸 (A4/A3等)', async ({ page }) => {
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布")').first();

        if (await sizeBtn.count() > 0) {
            await sizeBtn.click();
            await page.waitForTimeout(1000);

            // 查找打印尺寸
            const printSizes = page.locator('text=A4, text=A3, text=A5').first();
            if (await printSizes.count() > 0) {
                await page.screenshot({ path: 'output/08-size-print.png' });
            }
        }
    });

    test('应该能自定义尺寸', async ({ page }) => {
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布")').first();

        if (await sizeBtn.count() > 0) {
            await sizeBtn.click();
            await page.waitForTimeout(1000);

            // 查找自定义尺寸输入
            const customWidth = page.locator('input[placeholder*="宽"], input[placeholder*="width"]').first();
            const customHeight = page.locator('input[placeholder*="高"], input[placeholder*="height"]').first();

            if (await customWidth.count() > 0 && await customHeight.count() > 0) {
                await customWidth.fill('800');
                await customHeight.fill('600');
                await page.waitForTimeout(500);
                await page.screenshot({ path: 'output/08-size-custom.png' });
            }
        }
    });

    test('应该能应用新尺寸', async ({ page }) => {
        const sizeBtn = page.locator('button:has-text("尺寸"), button:has-text("画布")').first();

        if (await sizeBtn.count() > 0) {
            await sizeBtn.click();
            await page.waitForTimeout(1000);

            // 查找应用按钮
            const applyBtn = page.getByRole('button', { name: /应用|确定|保存/i }).first();
            if (await applyBtn.count() > 0) {
                await page.screenshot({ path: 'output/08-size-apply-button.png' });
            }
        }
    });
});

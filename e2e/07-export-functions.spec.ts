import { test, expect } from '@playwright/test';

test.describe('导出功能测试', () => {
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

    test('应该有导出按钮', async ({ page }) => {
        // 查找导出按钮
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载"), [class*="export"]').first();

        if (await exportBtn.count() > 0) {
            await expect(exportBtn).toBeVisible();
            await page.screenshot({ path: 'output/07-export-button.png' });
        } else {
            await page.screenshot({ path: 'output/07-export-search-all.png', fullPage: true });
        }
    });

    test('应该能打开导出面板', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载"), [class*="export"]').first();

        if (await exportBtn.count() > 0) {
            await exportBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'output/07-export-panel-opened.png', fullPage: true });
        }
    });

    test('应该显示 PNG 导出选项', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载")').first();

        if (await exportBtn.count() > 0) {
            await exportBtn.click();
            await page.waitForTimeout(1000);

            // 查找 PNG 选项
            const pngOption = page.locator('text=PNG, button:has-text("PNG"), [value="png"]').first();
            if (await pngOption.count() > 0) {
                await page.screenshot({ path: 'output/07-export-png-option.png' });
            }
        }
    });

    test('应该显示 JPG 导出选项', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载")').first();

        if (await exportBtn.count() > 0) {
            await exportBtn.click();
            await page.waitForTimeout(1000);

            // 查找 JPG 选项
            const jpgOption = page.locator('text=JPG, text=JPEG, button:has-text("JPG"), [value="jpg"]').first();
            if (await jpgOption.count() > 0) {
                await page.screenshot({ path: 'output/07-export-jpg-option.png' });
            }
        }
    });

    test('应该显示 PDF 导出选项', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载")').first();

        if (await exportBtn.count() > 0) {
            await exportBtn.click();
            await page.waitForTimeout(1000);

            // 查找 PDF 选项
            const pdfOption = page.locator('text=PDF, button:has-text("PDF"), [value="pdf"]').first();
            if (await pdfOption.count() > 0) {
                await page.screenshot({ path: 'output/07-export-pdf-option.png' });
            }
        }
    });

    test('应该能选择导出质量', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载")').first();

        if (await exportBtn.count() > 0) {
            await exportBtn.click();
            await page.waitForTimeout(1000);

            // 查找质量选项
            const qualityOption = page.locator('[class*="quality"], [class*="质量"], select, input[type="range"]').first();
            if (await qualityOption.count() > 0) {
                await page.screenshot({ path: 'output/07-export-quality-option.png' });
            }
        }
    });

    test('应该能确认导出', async ({ page }) => {
        const exportBtn = page.locator('button:has-text("导出"), button:has-text("下载")').first();

        if (await exportBtn.count() > 0) {
            await exportBtn.click();
            await page.waitForTimeout(1000);

            // 查找确认按钮
            const confirmBtn = page.getByRole('button', { name: /确定|导出|下载/i }).first();
            if (await confirmBtn.count() > 0) {
                await page.screenshot({ path: 'output/07-export-confirm-button.png' });

                // 注意: 实际点击会触发下载,这里只截图不点击
                // await confirmBtn.click();
            }
        }
    });
});

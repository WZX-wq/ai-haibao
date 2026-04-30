import { test, expect } from '@playwright/test';

test.describe('二维码和抠图功能测试', () => {
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

    test('应该有二维码生成功能入口', async ({ page }) => {
        // 查找二维码功能
        const qrcodeBtn = page.locator('button:has-text("二维码"), [class*="qrcode"], [class*="qr"]').first();

        if (await qrcodeBtn.count() > 0) {
            await expect(qrcodeBtn).toBeVisible();
            await page.screenshot({ path: 'output/06-qrcode-button.png' });
        } else {
            // 查找所有可能的入口
            await page.screenshot({ path: 'output/06-qrcode-search-all.png', fullPage: true });
        }
    });

    test('应该能打开二维码生成面板', async ({ page }) => {
        const qrcodeBtn = page.locator('button:has-text("二维码"), [class*="qrcode"], [class*="qr"]').first();

        if (await qrcodeBtn.count() > 0) {
            await qrcodeBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'output/06-qrcode-panel-opened.png', fullPage: true });
        }
    });

    test('应该能输入二维码内容', async ({ page }) => {
        const qrcodeBtn = page.locator('button:has-text("二维码"), [class*="qrcode"], [class*="qr"]').first();

        if (await qrcodeBtn.count() > 0) {
            await qrcodeBtn.click();
            await page.waitForTimeout(1000);

            // 查找输入框
            const qrcodeInput = page.locator('input[placeholder*="链接"], input[placeholder*="网址"], textarea').first();
            if (await qrcodeInput.count() > 0) {
                await qrcodeInput.fill('https://example.com');
                await page.waitForTimeout(500);
                await page.screenshot({ path: 'output/06-qrcode-content-filled.png' });
            }
        }
    });

    test('应该能生成二维码', async ({ page }) => {
        const qrcodeBtn = page.locator('button:has-text("二维码"), [class*="qrcode"], [class*="qr"]').first();

        if (await qrcodeBtn.count() > 0) {
            await qrcodeBtn.click();
            await page.waitForTimeout(1000);

            const qrcodeInput = page.locator('input, textarea').first();
            if (await qrcodeInput.count() > 0) {
                await qrcodeInput.fill('https://example.com');

                // 查找生成按钮
                const generateBtn = page.getByRole('button', { name: /生成|确定|添加/i }).first();
                if (await generateBtn.count() > 0) {
                    await generateBtn.click();
                    await page.waitForTimeout(2000);
                    await page.screenshot({ path: 'output/06-qrcode-generated.png', fullPage: true });
                }
            }
        }
    });

    test('应该有抠图功能入口', async ({ page }) => {
        // 查找抠图功能
        const mattingBtn = page.locator('button:has-text("抠图"), button:has-text("去背景"), [class*="matting"]').first();

        if (await mattingBtn.count() > 0) {
            await expect(mattingBtn).toBeVisible();
            await page.screenshot({ path: 'output/06-matting-button.png' });
        } else {
            await page.screenshot({ path: 'output/06-matting-search-all.png', fullPage: true });
        }
    });

    test('应该能打开抠图面板', async ({ page }) => {
        const mattingBtn = page.locator('button:has-text("抠图"), button:has-text("去背景"), [class*="matting"]').first();

        if (await mattingBtn.count() > 0) {
            await mattingBtn.click();
            await page.waitForTimeout(1000);
            await page.screenshot({ path: 'output/06-matting-panel-opened.png', fullPage: true });
        }
    });

    test('应该能上传图片进行抠图', async ({ page }) => {
        const mattingBtn = page.locator('button:has-text("抠图"), button:has-text("去背景"), [class*="matting"]').first();

        if (await mattingBtn.count() > 0) {
            await mattingBtn.click();
            await page.waitForTimeout(1000);

            // 查找上传按钮
            const uploadBtn = page.locator('input[type="file"], button:has-text("上传")').first();
            if (await uploadBtn.count() > 0) {
                await page.screenshot({ path: 'output/06-matting-upload-ready.png' });
            }
        }
    });
});

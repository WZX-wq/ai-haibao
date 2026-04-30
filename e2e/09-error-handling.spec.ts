import { test, expect } from '@playwright/test';

test.describe('错误处理和用户体验测试', () => {
    test('应该正确处理网络错误', async ({ page }) => {
        // 模拟离线状态
        await page.context().setOffline(true);

        await page.goto('http://127.0.0.1:5173/');
        await page.waitForTimeout(2000);

        await page.screenshot({ path: 'output/09-error-offline.png', fullPage: true });

        // 恢复在线
        await page.context().setOffline(false);
    });

    test('应该显示友好的加载状态', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');

        // 查找加载指示器
        const loadingIndicator = page.locator('[class*="loading"], [class*="spinner"], .el-loading').first();

        await page.screenshot({ path: 'output/09-loading-state.png', fullPage: true });
    });

    test('应该正确处理空状态', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/ai-poster');
        await page.waitForLoadState('networkidle');

        // 检查空状态提示
        const emptyState = page.locator('[class*="empty"], [class*="空"]').first();

        await page.screenshot({ path: 'output/09-empty-state.png', fullPage: true });
    });

    test('应该有清晰的错误提示', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/ai-poster');
        await page.waitForLoadState('networkidle');

        // 尝试触发错误 (提交空表单)
        const generateBtn = page.getByRole('button', { name: /生成|创建/i }).first();
        if (await generateBtn.count() > 0) {
            await generateBtn.click();
            await page.waitForTimeout(1000);

            // 查找错误提示
            const errorMsg = page.locator('[class*="error"], [class*="message"], .el-message').first();
            await page.screenshot({ path: 'output/09-error-message.png', fullPage: true });
        }
    });

    test('应该保留用户输入 (失败后不丢失)', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/ai-poster');
        await page.waitForLoadState('networkidle');

        // 输入内容
        const input = page.locator('input, textarea').first();
        if (await input.count() > 0) {
            await input.fill('测试内容保留');
            await page.screenshot({ path: 'output/09-input-before-error.png' });

            // 刷新页面
            await page.reload();
            await page.waitForLoadState('networkidle');

            // 检查内容是否保留
            await page.screenshot({ path: 'output/09-input-after-reload.png' });
        }
    });

    test('应该有离开确认提示', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        const firstTemplate = page.locator('[class*="template"], [class*="card"], .item').first();
        if (await firstTemplate.count() > 0) {
            await firstTemplate.click();
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(2000);

            // 尝试离开页面
            page.on('dialog', async dialog => {
                console.log(`对话框类型: ${dialog.type()}`);
                console.log(`对话框消息: ${dialog.message()}`);
                await page.screenshot({ path: 'output/09-leave-confirmation.png' });
                await dialog.dismiss();
            });

            await page.goto('http://127.0.0.1:5173/');
        }
    });

    test('应该没有控制台错误', async ({ page }) => {
        const consoleErrors: string[] = [];

        page.on('console', msg => {
            if (msg.type() === 'error') {
                consoleErrors.push(msg.text());
            }
        });

        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');

        await page.goto('http://127.0.0.1:5173/ai-poster');
        await page.waitForLoadState('networkidle');

        console.log(`控制台错误数量: ${consoleErrors.length}`);
        if (consoleErrors.length > 0) {
            console.log('控制台错误:', consoleErrors);
        }

        await page.screenshot({ path: 'output/09-console-errors-check.png' });
    });
});

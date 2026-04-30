import { test, expect } from '@playwright/test';

test.describe('UI 一致性和专业感测试', () => {
    test('应该没有乱码', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        const content = await page.content();

        // 检查常见乱码模式
        const hasGarbledText = /[\uFFFD\u0000-\u001F\u007F-\u009F]/.test(content);

        if (hasGarbledText) {
            console.log('警告: 发现可能的乱码字符');
        }

        await page.screenshot({ path: 'output/10-ui-no-garbled-text.png', fullPage: true });
    });

    test('应该使用统一术语 (模板 vs 模版)', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        const content = await page.content();

        // 检查是否使用了"模版"(应该统一为"模板")
        const hasInconsistentTerm = content.includes('模版');

        if (hasInconsistentTerm) {
            console.log('警告: 发现术语不一致 - 使用了"模版"');
        }

        await page.screenshot({ path: 'output/10-ui-terminology.png', fullPage: true });
    });

    test('应该有一致的按钮样式', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        // 获取所有主要按钮
        const buttons = await page.getByRole('button').all();
        console.log(`页面按钮数量: ${buttons.length}`);

        await page.screenshot({ path: 'output/10-ui-button-consistency.png', fullPage: true });
    });

    test('应该有一致的颜色主题', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        // 检查主色调
        const primaryColor = await page.evaluate(() => {
            const style = getComputedStyle(document.documentElement);
            return style.getPropertyValue('--el-color-primary') ||
                style.getPropertyValue('--primary-color');
        });

        console.log(`主色调: ${primaryColor}`);

        await page.screenshot({ path: 'output/10-ui-color-theme.png', fullPage: true });
    });

    test('应该有统一的圆角样式', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'output/10-ui-border-radius.png', fullPage: true });
    });

    test('应该有合适的字体大小层级', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        // 检查标题和正文字体大小
        const fontSizes = await page.evaluate(() => {
            const h1 = document.querySelector('h1');
            const h2 = document.querySelector('h2');
            const p = document.querySelector('p');

            return {
                h1: h1 ? getComputedStyle(h1).fontSize : 'N/A',
                h2: h2 ? getComputedStyle(h2).fontSize : 'N/A',
                p: p ? getComputedStyle(p).fontSize : 'N/A',
            };
        });

        console.log('字体大小:', fontSizes);

        await page.screenshot({ path: 'output/10-ui-font-sizes.png', fullPage: true });
    });

    test('应该有清晰的视觉层次', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'output/10-ui-visual-hierarchy.png', fullPage: true });
    });

    test('应该有合适的间距', async ({ page }) => {
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');

        await page.screenshot({ path: 'output/10-ui-spacing.png', fullPage: true });
    });

    test('应该在不同页面保持一致性', async ({ page }) => {
        // 首页
        await page.goto('http://127.0.0.1:5173/');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'output/10-ui-consistency-home.png', fullPage: true });

        // 模板页
        await page.goto('http://127.0.0.1:5173/home');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'output/10-ui-consistency-templates.png', fullPage: true });

        // AI 页
        await page.goto('http://127.0.0.1:5173/ai-poster');
        await page.waitForLoadState('networkidle');
        await page.screenshot({ path: 'output/10-ui-consistency-ai.png', fullPage: true });
    });
});

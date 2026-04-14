import { wTextSetting } from '@/components/modules/widgets/wText/wTextSetting';
import wImageSetting from '@/components/modules/widgets/wImage/wImageSetting';
import { wQrcodeSetting } from '@/components/modules/widgets/wQrcode/wQrcodeSetting';
const defaultSizes = [
    { key: 'a4', name: 'A4 竖版', width: 2480, height: 3508 },
    { key: 'wechat-cover', name: '公众号封面', width: 900, height: 383 },
    { key: 'xiaohongshu', name: '小红书封面', width: 1242, height: 1660 },
    { key: 'moments', name: '朋友圈海报', width: 1242, height: 2208 },
    { key: 'ecommerce', name: '电商主图', width: 800, height: 800 },
    { key: 'flyer', name: '传单', width: 1125, height: 2001 },
];
export function getSizePresets() {
    return defaultSizes;
}
/** 与后端模板 seed.layout、designPlan.layoutFamily 对齐；统一映射到引擎骨架 id */
const SEED_LAYOUT_TO_ENGINE = {
    hero: 'hero-left',
    split: 'split-editorial',
    cards: 'grid-product',
    price: 'premium-offer',
    collage: 'festive-frame',
};
export const layoutFamilies = [
    'hero-center',
    'hero-left',
    'split-editorial',
    'grid-product',
    'magazine-cover',
    'festive-frame',
    'list-recruitment',
    'xiaohongshu-note',
    'clean-course',
    'premium-offer',
];
export function normalizeLayoutFamily(raw) {
    const s = String(raw || '').trim();
    if (!s)
        return '';
    if (layoutFamilies.includes(s))
        return s;
    return SEED_LAYOUT_TO_ENGINE[s] || '';
}
function resolveLayoutFamily(planFamily, width, height) {
    const n = normalizeLayoutFamily(planFamily);
    if (n)
        return n;
    return width > height ? 'split-editorial' : 'hero-left';
}
/** 横版封面 / 方图 / 竖版长图 / A4，用于比例约束（不是简单等比缩放同一套坐标） */
function getSizeProfile(width, height) {
    const r = width / Math.max(height, 1);
    if (r > 1.4)
        return 'banner';
    if (r < 0.85)
        return 'portrait';
    if (r > 0.92 && r < 1.08)
        return 'square';
    if (height > width * 1.35 && width > 2000)
        return 'a4';
    return 'portrait';
}
function clone(value) {
    return JSON.parse(JSON.stringify(value));
}
function getScale(width) {
    return Math.max(0.72, Math.min(width / 1242, 1.55));
}
function getTextFont(width, base, min = 20) {
    return Math.max(min, Math.round(base * getScale(width)));
}
function getLineHeight(fontSize) {
    if (fontSize >= 80)
        return 1.12;
    if (fontSize >= 42)
        return 1.28;
    return 1.55;
}
function getSafeText(text, fallback) {
    const value = String(text || '').trim();
    return value || fallback;
}
/** 去掉误写入画布上的「用途：引流」等参数回声或占位说明 */
export function stripInternalPromptEcho(text) {
    let s = String(text || '').trim();
    if (!s)
        return '';
    s = s.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !/^(主题|用途|行业|风格|尺寸|补充信息)[：:]/.test(l)).join('\n');
    s = s.replace(/主视觉预览图[/／、\s]*氛围图/g, '');
    s = s.replace(/(?:^|[\s\u3000；;，,])(主题|用途|行业|风格|尺寸)[：:]\s*[^\s\n\u3000；;，,。]{1,32}/g, ' ');
    s = s.replace(/\s{2,}/g, ' ').trim();
    return s;
}
function getBackgroundGradient(palette) {
    return `linear-gradient(135deg, ${palette.background} 0%, ${palette.secondary} 55%, ${palette.primary} 100%)`;
}
function makeTextWidget(name, overrides) {
    const setting = clone(wTextSetting);
    return Object.assign(setting, {
        name,
        text: '',
        width: 400,
        height: 80,
        color: '#111111ff',
        textAlign: 'left',
        textAlignLast: 'left',
        backgroundColor: '',
        parent: '-1',
        record: {
            width: 400,
            height: 80,
            minWidth: 20,
            minHeight: 20,
            dir: 'horizontal',
        },
    }, overrides);
}
function makeImageWidget(name, overrides) {
    const setting = clone(wImageSetting);
    return Object.assign(setting, {
        name,
        parent: '-1',
        record: {
            width: 0,
            height: 0,
            minWidth: 10,
            minHeight: 10,
            dir: 'all',
        },
    }, overrides);
}
function makeQrcodeWidget(name, overrides) {
    const setting = clone(wQrcodeSetting);
    return Object.assign(setting, {
        name,
        parent: '-1',
    }, overrides);
}
function estimateTextHeight(text, fontSize, width) {
    const t = getSafeText(text, '');
    if (!t.length)
        return Math.round(fontSize * getLineHeight(fontSize) + fontSize * 0.45);
    const cjkCount = (t.match(/[\u3000-\u9FFF\uFF00-\uFFEF]/g) || []).length;
    const cjkHeavy = cjkCount >= Math.max(1, t.length * 0.35);
    // 拉丁字母约 0.62em 宽；中文等全角字更接近 1em，沿用 0.62 会低估行数导致块高度过小、与下一层文案重叠
    const avgCharPx = cjkHeavy ? Math.max(fontSize * 0.98, 12) : Math.max(fontSize * 0.62, 10);
    const charsPerLine = Math.max(3, Math.floor(Math.max(1, width) / avgCharPx));
    const lines = Math.max(1, Math.ceil(t.length / charsPerLine));
    return Math.round(fontSize * getLineHeight(fontSize) * lines + fontSize * 0.72);
}
function fitTitleFont(text, width, height, baseFont) {
    let fontSize = baseFont;
    while (fontSize > 26 && estimateTextHeight(text, fontSize, width) > height) {
        fontSize -= 2;
    }
    return fontSize;
}
function splitBodyLines(body, maxLines) {
    const t = getSafeText(body, '');
    const parts = t.split(/[\n；;]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= maxLines)
        return parts.slice(0, maxLines);
    const chunk = Math.max(1, Math.ceil(t.length / maxLines));
    const out = [];
    for (let i = 0; i < maxLines; i++) {
        out.push(t.slice(i * chunk, (i + 1) * chunk) || (i === 0 ? '补充说明' : ' '));
    }
    return out;
}
function widgetTextBottom(w) {
    if (!w)
        return 0;
    const est = Math.max(Number(w.height) || 0, estimateTextHeight(String(w.text || ''), Number(w.fontSize) || 20, Number(w.width) || 400));
    return w.top + est;
}
/** 按主标题→副标题→正文→列表→CTA 顺序压实垂直间距，避免估算误差导致叠字 */
function reflowAiTextStack(widgets, pageHeight) {
    const gap = Math.round(pageHeight * 0.026);
    let cursor = null;
    const apply = (w) => {
        if (!w)
            return;
        let est = Math.max(Number(w.height) || 0, estimateTextHeight(String(w.text || ''), Number(w.fontSize) || 20, Number(w.width) || 400));
        if (w.name === 'ai_title' || w.name === 'ai_slogan')
            est = Math.ceil(est * 1.14);
        w.height = Math.round(est);
        if (w.record)
            w.record.height = Math.round(est);
        if (cursor === null) {
            cursor = w.top + est + gap;
            return;
        }
        if (w.top < cursor)
            w.top = Math.round(cursor);
        cursor = w.top + est + gap;
    };
    apply(widgets.find((x) => x.name === 'ai_title'));
    apply(widgets.find((x) => x.name === 'ai_slogan'));
    apply(widgets.find((x) => x.name === 'ai_body'));
    widgets
        .filter((x) => x.name && x.name.startsWith('ai_list_'))
        .sort((a, b) => (Number(String(a.name).split('_').pop()) || 0) - (Number(String(b.name).split('_').pop()) || 0))
        .forEach((w) => apply(w));
    const cta = widgets.find((x) => x.name === 'ai_cta');
    if (cta) {
        const cEst = Math.max(Number(cta.height) || 0, Math.round(Number(cta.fontSize) * 2.2));
        cta.height = cEst;
        if (cta.record)
            cta.record.height = cEst;
        if (cursor != null && cta.top < cursor)
            cta.top = Math.min(Math.round(cursor), pageHeight - cEst - gap * 6);
        cursor = cta.top + cEst + gap;
    }
}
function aiTextStackBottom(widgets) {
    let max = 0;
    ['ai_title', 'ai_slogan', 'ai_body'].forEach((name) => {
        const w = widgets.find((x) => x.name === name);
        if (w)
            max = Math.max(max, widgetTextBottom(w));
    });
    widgets.filter((x) => x.name && x.name.startsWith('ai_list_')).forEach((w) => {
        max = Math.max(max, widgetTextBottom(w));
    });
    const cta = widgets.find((x) => x.name === 'ai_cta');
    if (cta)
        max = Math.max(max, widgetTextBottom(cta));
    return max;
}
/** 去掉副标题里与主标题重复的开头/前缀，避免两行大字叠在同一视觉区 */
export function dedupePosterTitleSlogan(title, slogan) {
    const rawS = getSafeText(slogan, '');
    const t = getSafeText(title, '').trim();
    let s = rawS.trim();
    if (t && s) {
        if (s.startsWith(t)) {
            s = s.slice(t.length).replace(/^[\s，,。、；;:：]+/u, '').trim();
        }
        else {
            const idx = s.indexOf(t);
            if (idx >= 0 && idx <= 10) {
                s = (s.slice(0, idx) + s.slice(idx + t.length)).replace(/^[\s，,。、；;:：]+/u, '').trim();
            }
        }
        if (s.length < 4 && rawS.trim())
            s = rawS.trim();
    }
    return { title: t, slogan: s };
}
export function buildPosterLayout({ input, result }) {
    const width = result.size?.width || defaultSizes[2].width;
    const height = result.size?.height || defaultSizes[2].height;
    const palette = result.palette;
    const head = dedupePosterTitleSlogan(result.title, result.slogan);
    const layoutTitle = stripInternalPromptEcho(head.title) || getSafeText(result.title, '').trim();
    const layoutSlogan = stripInternalPromptEcho(head.slogan) || getSafeText(result.slogan, '').trim();
    const layoutBody = stripInternalPromptEcho(result.body) || getSafeText(result.body, '补充描述文案');
    const marginX = Math.round(width * 0.088);
    const marginTop = Math.round(height * 0.082);
    const safeBottom = Math.round(height * 0.088);
    const sizeProfile = getSizeProfile(width, height);
    const planFamily = result.designPlan?.layoutFamily;
    const selectedFamily = resolveLayoutFamily(planFamily, width, height);
    const isWide = width > height;
    const includeHeroLayer = Boolean(String(result.hero?.imageUrl || '').trim());
    let heroWidth = 0;
    let heroHeight = 0;
    let heroTop = 0;
    let heroLeft = 0;
    if (includeHeroLayer) {
    const heroRatioW = selectedFamily === 'split-editorial' ? 0.46 : selectedFamily === 'grid-product' ? 0.58 : selectedFamily === 'magazine-cover' ? 0.92 : isWide ? 0.36 : 0.78;
    let heroHRatio = selectedFamily === 'split-editorial' ? 0.56 : selectedFamily === 'grid-product' ? 0.28 : selectedFamily === 'magazine-cover' ? 0.52 : isWide ? 0.58 : 0.34;
    if (sizeProfile === 'banner') {
        heroHRatio = Math.min(heroHRatio, 0.62);
    }
    if (sizeProfile === 'square') {
        heroHRatio = Math.max(heroHRatio, 0.42);
    }
    heroWidth = Math.round(width * heroRatioW);
    heroHeight = Math.round(height * heroHRatio);
    heroTop = selectedFamily === 'premium-offer' ? Math.round(height * 0.18) : selectedFamily === 'magazine-cover' ? Math.round(height * 0.06) : isWide ? Math.round(height * 0.16) : Math.round(height * 0.26);
    heroLeft = selectedFamily === 'split-editorial'
        ? width - marginX - heroWidth
        : selectedFamily === 'hero-center' || selectedFamily === 'magazine-cover'
            ? Math.round((width - heroWidth) / 2)
            : isWide
                ? width - marginX - heroWidth
                : Math.round((width - heroWidth) / 2);
    if (selectedFamily === 'clean-course') {
        heroLeft = marginX + Math.round(width * 0.1);
        heroTop = Math.round(height * 0.14);
    }
    if (selectedFamily === 'list-recruitment') {
        heroLeft = Math.round((width - heroWidth) / 2);
        heroTop = Math.round(height * 0.42);
    }
    if (selectedFamily === 'xiaohongshu-note') {
        heroLeft = Math.round((width - heroWidth) / 2);
        heroTop = Math.round(height * 0.38);
    }
    if (selectedFamily === 'hero-left') {
        if (!isWide) {
            heroLeft = marginX;
            heroWidth = Math.round(width * (sizeProfile === 'square' ? 0.86 : 0.88));
            heroTop = Math.round(height * 0.08);
            heroHeight = Math.round(height * (sizeProfile === 'square' ? 0.4 : 0.32));
        }
        else {
            heroLeft = width - marginX - heroWidth;
        }
    }
    if (selectedFamily === 'split-editorial' && sizeProfile === 'banner') {
        heroWidth = Math.round(width * 0.4);
        heroHeight = Math.round(height * 0.88);
        heroTop = Math.round(height * 0.06);
        heroLeft = width - marginX - heroWidth;
    }
    if (selectedFamily === 'clean-course' && sizeProfile === 'banner') {
        heroLeft = Math.round(width * 0.36);
        heroTop = Math.round(height * 0.06);
        heroWidth = Math.round(width * 0.58);
        heroHeight = Math.round(height * 0.82);
    }
    if (selectedFamily === 'premium-offer' && sizeProfile === 'square') {
        heroWidth = Math.round(width * 0.68);
        heroHeight = Math.round(height * 0.36);
        heroLeft = Math.round((width - heroWidth) / 2);
        heroTop = Math.round(height * 0.12);
    }
    if (selectedFamily === 'list-recruitment' && sizeProfile === 'portrait') {
        heroWidth = Math.round(width * 0.74);
        heroHeight = Math.round(height * 0.24);
        heroLeft = Math.round((width - heroWidth) / 2);
        heroTop = Math.round(height * 0.6);
    }
    if (selectedFamily === 'xiaohongshu-note' && sizeProfile === 'portrait') {
        heroWidth = Math.round(width * 0.78);
        heroHeight = Math.round(height * 0.32);
        heroLeft = Math.round((width - heroWidth) / 2);
        heroTop = Math.round(height * 0.38);
    }
    if (selectedFamily === 'festive-frame' && sizeProfile === 'portrait') {
        heroWidth = Math.round(width * 0.78);
        heroHeight = Math.round(height * 0.3);
        heroLeft = Math.round((width - heroWidth) / 2);
        heroTop = Math.round(height * 0.46);
    }
    }
    let textWidth = selectedFamily === 'split-editorial' ? Math.round(width * 0.42) : selectedFamily === 'clean-course' ? Math.round(width * 0.52) : isWide ? Math.round(width * 0.44) : Math.round(width * 0.7);
    if (selectedFamily === 'split-editorial' && sizeProfile === 'banner') {
        textWidth = Math.round(width * 0.32);
    }
    if (selectedFamily === 'clean-course' && sizeProfile === 'banner') {
        textWidth = Math.round(width * 0.34);
    }
    if (selectedFamily === 'premium-offer' && sizeProfile === 'square') {
        textWidth = Math.round(width * 0.84);
    }
    let titleHeightLimit = Math.round(height * (isWide ? 0.22 : 0.16));
    if (sizeProfile === 'banner') {
        titleHeightLimit = Math.round(height * (isWide ? 0.2 : 0.14));
    }
    if (sizeProfile === 'portrait' && height > width * 1.5) {
        titleHeightLimit = Math.round(Math.min(titleHeightLimit, height * 0.12));
    }
    const titleFontMax = sizeProfile === 'banner' ? (isWide ? 52 : 72) : isWide ? 74 : 88;
    const titleFontMin = sizeProfile === 'banner' ? 22 : 30;
    const titleFont = fitTitleFont(layoutTitle, textWidth, titleHeightLimit, getTextFont(width, titleFontMax, titleFontMin));
    const titleHeight = estimateTextHeight(layoutTitle, titleFont, textWidth);
    const sloganFont = getTextFont(width, sizeProfile === 'banner' ? (isWide ? 18 : 22) : isWide ? 22 : 30, 14);
    const bodyFont = getTextFont(width, sizeProfile === 'banner' ? (isWide ? 16 : 18) : isWide ? 20 : 26, 14);
    const ctaFont = getTextFont(width, sizeProfile === 'banner' ? (isWide ? 18 : 20) : isWide ? 22 : 26, 16);
    const qrStrategy = result.designPlan?.qrStrategy;
    const wantQr = Boolean(String(input.qrUrl || '').trim());
    const qrCorner = wantQr && qrStrategy !== 'cta';
    const qrSize = qrCorner ? Math.round(Math.min(width, height) * (sizeProfile === 'banner' ? 0.12 : 0.14)) : 0;
    const ctaHeight = Math.round(ctaFont * 2.2);
    const ctaWidth = Math.round(Math.max(width * 0.22, ctaFont * Math.max(String(result.cta || '').length, 4)));
    const textLeft = selectedFamily === 'clean-course' ? marginX + Math.round(width * 0.12) : marginX;
    let titleTop = selectedFamily === 'xiaohongshu-note' ? Math.round(height * 0.06) : selectedFamily === 'magazine-cover' ? Math.round(height * 0.62) : marginTop;
    if (selectedFamily === 'list-recruitment') {
        titleTop = marginTop;
    }
    const titleToSloganGap = Math.round(height * 0.038) + Math.min(Math.round(height * 0.026), Math.round(titleFont * 0.3));
    const sloganTop = titleTop + titleHeight + titleToSloganGap;
    const sloganHeight = estimateTextHeight(layoutSlogan, sloganFont, textWidth);
    let bodyTop = sloganTop + sloganHeight + Math.round(height * 0.03);
    if (selectedFamily === 'magazine-cover') {
        bodyTop = sloganTop + sloganHeight + Math.round(height * 0.02);
    }
    if (selectedFamily === 'list-recruitment') {
        bodyTop = sloganTop + sloganHeight + Math.round(height * 0.02);
    }
    let bodyHeight = estimateTextHeight(layoutBody, bodyFont, textWidth);
    /** 竖版主图在文案下方时，正文过长会把主图压成一条「小图」，限制正文块高度为主图留出空间 */
    const portraitBigHeroFamilies = new Set(['hero-left', 'xiaohongshu-note', 'festive-frame']);
    if (includeHeroLayer && !isWide && portraitBigHeroFamilies.has(selectedFamily))
        bodyHeight = Math.min(bodyHeight, Math.round(height * 0.2));
    let ctaTop = Math.min(bodyTop + bodyHeight + Math.round(height * 0.04), height - safeBottom - ctaHeight - (qrCorner && !isWide ? qrSize + 24 : 0));
    const heroBottomLimit = Math.max(Math.round(height * 0.2), height - safeBottom - (qrCorner && !isWide ? qrSize + 20 : 0));
    const portraitStackFamilies = new Set(['hero-left', 'list-recruitment', 'xiaohongshu-note', 'festive-frame']);
    if (includeHeroLayer) {
    if (!isWide && portraitStackFamilies.has(selectedFamily)) {
        const textBottom = Math.max(bodyTop + bodyHeight, ctaTop + ctaHeight);
        const stackGap = Math.round(height * 0.029);
        heroTop = Math.max(heroTop, textBottom + stackGap);
        heroHeight = Math.min(heroHeight, heroBottomLimit - heroTop);
    }
    heroWidth = Math.min(heroWidth, width - marginX * 2);
    const heroCapByTop = Math.max(Math.round(height * 0.12), heroBottomLimit - heroTop - Math.round(height * 0.03));
    const minHeroPortrait = !isWide && portraitBigHeroFamilies.has(selectedFamily) ? Math.round(height * 0.38) : Math.round(height * 0.14);
    heroHeight = Math.min(Math.max(heroHeight, minHeroPortrait), heroCapByTop);
    heroTop = Math.max(Math.round(height * 0.04), Math.min(heroTop, heroBottomLimit - heroHeight));
    heroLeft = Math.max(marginX, Math.min(heroLeft, width - marginX - heroWidth));
    }
    let widgets = [];
    if (includeHeroLayer) {
        widgets.push(makeImageWidget('ai_hero', {
            left: heroLeft,
            top: heroTop,
            width: heroWidth,
            height: heroHeight,
            radius: Math.max(18, Math.round(Math.min(heroWidth, heroHeight) * 0.04)),
            imgUrl: result.hero?.imageUrl || '',
        }));
    }
    widgets.push(makeTextWidget('ai_title', {
            text: getSafeText(layoutTitle, 'AI 海报标题'),
            left: textLeft,
            top: titleTop,
            width: textWidth,
            height: titleHeight,
            fontSize: selectedFamily === 'magazine-cover' ? Math.min(titleFont + 8, getTextFont(width, 96, 36)) : titleFont,
            lineHeight: getLineHeight(titleFont),
            color: palette.text,
            fontWeight: 'bold',
            textAlign: selectedFamily === 'hero-center' ? 'center' : 'left',
            textAlignLast: selectedFamily === 'hero-center' ? 'center' : 'left',
            record: {
                width: textWidth,
                height: titleHeight,
                minWidth: titleFont,
                minHeight: titleFont,
                dir: 'horizontal',
            },
        }),
        makeTextWidget('ai_slogan', {
            text: getSafeText(layoutSlogan, '推荐副标题'),
            left: selectedFamily === 'hero-center' ? Math.round((width - textWidth) / 2) : textLeft,
            top: sloganTop,
            width: textWidth,
            height: sloganHeight,
            fontSize: sloganFont,
            lineHeight: getLineHeight(sloganFont),
            color: palette.muted,
            textAlign: selectedFamily === 'hero-center' ? 'center' : 'left',
            textAlignLast: selectedFamily === 'hero-center' ? 'center' : 'left',
            record: {
                width: textWidth,
                height: sloganHeight,
                minWidth: sloganFont,
                minHeight: sloganFont,
                dir: 'horizontal',
            },
        }),
        makeTextWidget('ai_body', {
            text: getSafeText(layoutBody, '补充描述文案'),
            left: selectedFamily === 'hero-center' ? Math.round((width - textWidth) / 2) : textLeft,
            top: bodyTop,
            width: textWidth,
            height: bodyHeight,
            fontSize: bodyFont,
            lineHeight: getLineHeight(bodyFont),
            color: palette.text,
            record: {
                width: textWidth,
                height: bodyHeight,
                minWidth: bodyFont,
                minHeight: bodyFont,
                dir: 'horizontal',
            },
        }),
        makeTextWidget('ai_cta', {
            text: getSafeText(result.cta, '立即了解'),
            left: selectedFamily === 'hero-center' ? Math.round((width - ctaWidth) / 2) : textLeft,
            top: ctaTop,
            width: ctaWidth,
            height: ctaHeight,
            fontSize: ctaFont,
            lineHeight: 1.5,
            color: '#ffffffff',
            backgroundColor: palette.primary,
            textAlign: 'center',
            textAlignLast: 'center',
            fontWeight: 'bold',
            record: {
                width: ctaWidth,
                height: ctaHeight,
                minWidth: ctaFont,
                minHeight: ctaFont,
                dir: 'horizontal',
            },
        }),
    );
    if (selectedFamily === 'premium-offer' && sizeProfile === 'square') {
        const tw = Math.round(width * 0.86);
        const titleW = widgets.find((w) => w.name === 'ai_title');
        const slog = widgets.find((w) => w.name === 'ai_slogan');
        const bod = widgets.find((w) => w.name === 'ai_body');
        const cta = widgets.find((w) => w.name === 'ai_cta');
        if (titleW) {
            titleW.left = Math.round((width - tw) / 2);
            titleW.width = tw;
            titleW.textAlign = 'center';
            titleW.textAlignLast = 'center';
        }
        if (slog) {
            slog.left = Math.round((width - tw) / 2);
            slog.width = tw;
            slog.textAlign = 'center';
            slog.textAlignLast = 'center';
        }
        if (bod) {
            bod.left = Math.round((width - tw) / 2);
            bod.width = tw;
            bod.textAlign = 'center';
            bod.textAlignLast = 'center';
        }
        if (cta) {
            const cw = cta.width;
            cta.left = Math.round((width - cw) / 2);
        }
    }
    if (selectedFamily === 'hero-center') {
        const titleW = widgets.find((w) => w.name === 'ai_title');
        const slog = widgets.find((w) => w.name === 'ai_slogan');
        const bod = widgets.find((w) => w.name === 'ai_body');
        const cta = widgets.find((w) => w.name === 'ai_cta');
        const tw = Math.round(width * 0.78);
        if (titleW) {
            titleW.left = Math.round((width - tw) / 2);
            titleW.width = tw;
            titleW.textAlign = 'center';
            titleW.textAlignLast = 'center';
        }
        if (slog) {
            slog.left = Math.round((width - tw) / 2);
            slog.width = tw;
        }
        if (bod) {
            bod.left = Math.round((width - tw) / 2);
            bod.width = tw;
        }
        if (cta) {
            cta.left = Math.round((width - ctaWidth) / 2);
        }
    }
    if (selectedFamily === 'grid-product') {
        const cardWidth = Math.round(width * 0.26);
        const cardHeight = Math.round(height * 0.12);
        const startLeft = Math.round(width * 0.1);
        const top = Math.round(height * (sizeProfile === 'banner' ? 0.72 : 0.62));
        const gap = Math.round(width * 0.05);
        [0, 1, 2].forEach((i) => {
            widgets.push(makeTextWidget(`ai_card_${i + 1}`, {
                text: `卖点 ${i + 1}`,
                left: startLeft + i * (cardWidth + gap),
                top,
                width: cardWidth,
                height: cardHeight,
                fontSize: getTextFont(width, 20, 14),
                lineHeight: 1.4,
                color: palette.primary,
                backgroundColor: `${palette.secondary}cc`,
                textAlign: 'center',
                textAlignLast: 'center',
                fontWeight: 'bold',
                record: {
                    width: cardWidth,
                    height: cardHeight,
                    minWidth: 14,
                    minHeight: 14,
                    dir: 'horizontal',
                },
            }));
        });
    }
    if (selectedFamily === 'list-recruitment') {
        widgets = widgets.filter((w) => w.name !== 'ai_body');
        const lines = splitBodyLines(result.body, 3);
        const lineFont = getTextFont(width, sizeProfile === 'portrait' && height > width * 1.45 ? 19 : 22, 14);
        const lh = Math.round(lineFont * 1.45);
        const listTop = sloganTop + sloganHeight + Math.round(height * 0.03);
        let listBottom = listTop;
        lines.forEach((line, i) => {
            const top = listTop + i * (lh + 10);
            listBottom = top + lh + 8;
            widgets.push(makeTextWidget(`ai_list_${i + 1}`, {
                text: `· ${line}`,
                left: marginX,
                top,
                width: Math.round(width * 0.82),
                height: lh + 8,
                fontSize: lineFont,
                lineHeight: 1.45,
                color: palette.text,
                record: {
                    width: Math.round(width * 0.82),
                    height: lh + 8,
                    minWidth: lineFont,
                    minHeight: lineFont,
                    dir: 'horizontal',
                },
            }));
        });
        const ctaW = widgets.find((w) => w.name === 'ai_cta');
        if (ctaW) {
            ctaW.top = Math.min(listBottom + Math.round(height * 0.04), height - safeBottom - ctaHeight - (qrCorner && !isWide ? qrSize + 24 : 0));
        }
    }
    if (selectedFamily === 'clean-course') {
        const barH = sizeProfile === 'banner' ? 0.62 : 0.72;
        const barTop = sizeProfile === 'banner' ? 0.08 : 0.1;
        widgets.push(makeTextWidget('ai_course_bar', {
            text: ' ',
            left: marginX,
            top: Math.round(height * barTop),
            width: Math.round(width * 0.06),
            height: Math.round(height * barH),
            fontSize: 8,
            lineHeight: 1,
            color: '#ffffff00',
            backgroundColor: palette.primary,
            record: {
                width: Math.round(width * 0.06),
                height: Math.round(height * barH),
                minWidth: 8,
                minHeight: 8,
                dir: 'horizontal',
            },
        }));
    }
    if (selectedFamily === 'festive-frame') {
        const deco = '※';
        const fs = getTextFont(width, 28, 18);
        const m = marginX * 0.5;
        [
            { left: m, top: m, name: 'ai_deco_tl' },
            { left: width - m - fs * 2, top: m, name: 'ai_deco_tr' },
            { left: m, top: height - m - fs * 2, name: 'ai_deco_bl' },
            { left: width - m - fs * 2, top: height - m - fs * 2, name: 'ai_deco_br' },
        ].forEach((box) => {
            widgets.push(makeTextWidget(box.name, {
                text: deco,
                left: box.left,
                top: box.top,
                width: fs * 2,
                height: fs * 2,
                fontSize: fs,
                lineHeight: 1,
                color: palette.primary,
                textAlign: 'center',
                record: {
                    width: fs * 2,
                    height: fs * 2,
                    minWidth: fs,
                    minHeight: fs,
                    dir: 'horizontal',
                },
            }));
        });
    }
    if (selectedFamily === 'premium-offer' || (selectedFamily === 'festive-frame' && sizeProfile !== 'banner')) {
        const priceCentered = sizeProfile === 'square' || (selectedFamily === 'festive-frame' && sizeProfile === 'portrait');
        const tagW = Math.round(width * (priceCentered ? 0.34 : 0.22));
        const numW = Math.round(width * (priceCentered ? 0.4 : 0.24));
        const tagLeft = priceCentered ? Math.round((width - tagW) / 2) : Math.round(width * 0.64);
        const numLeft = priceCentered ? Math.round((width - numW) / 2) : Math.round(width * 0.64);
        const tagTop = priceCentered
            ? Math.round(height * (selectedFamily === 'festive-frame' ? 0.26 : 0.52))
            : Math.round(height * 0.12);
        const numTop = priceCentered
            ? Math.round(height * (selectedFamily === 'festive-frame' ? 0.32 : 0.58))
            : Math.round(height * 0.18);
        widgets.push(makeTextWidget('ai_price_tag', {
            text: '限时优惠',
            left: tagLeft,
            top: tagTop,
            width: tagW,
            height: Math.round(height * (priceCentered ? 0.05 : 0.06)),
            fontSize: getTextFont(width, priceCentered ? 22 : 24, 15),
            lineHeight: 1.4,
            color: '#ffffffff',
            backgroundColor: palette.primary,
            textAlign: 'center',
            textAlignLast: 'center',
            fontWeight: 'bold',
        }), makeTextWidget('ai_price_num', {
            text: '￥99',
            left: numLeft,
            top: numTop,
            width: numW,
            height: Math.round(height * (priceCentered ? 0.07 : 0.08)),
            fontSize: getTextFont(width, priceCentered ? 52 : 64, 28),
            lineHeight: 1.05,
            color: palette.primary,
            fontWeight: 'bold',
        }));
    }
    if (qrCorner) {
        widgets.push(makeQrcodeWidget('ai_qrcode', {
            width: qrSize,
            height: qrSize,
            left: width - marginX - qrSize,
            top: height - safeBottom - qrSize,
            value: input.qrUrl,
            dotColor: palette.text,
            dotColor2: palette.text,
        }));
    }
    else if (wantQr && qrStrategy === 'cta') {
        const qrS = Math.round(Math.min(width, height) * 0.12);
        widgets.push(makeQrcodeWidget('ai_qrcode', {
            width: qrS,
            height: qrS,
            left: textLeft + ctaWidth + Math.round(width * 0.02),
            top: ctaTop + Math.round((ctaHeight - qrS) / 2),
            value: input.qrUrl,
            dotColor: palette.text,
            dotColor2: palette.text,
        }));
    }
    if (selectedFamily !== 'magazine-cover') {
        reflowAiTextStack(widgets, height);
        const hero = widgets.find((w) => w.name === 'ai_hero');
        if (hero && !isWide && portraitStackFamilies.has(selectedFamily)) {
            const textBottom = aiTextStackBottom(widgets);
            const stackGap = Math.round(height * 0.029);
            const nextTop = textBottom + stackGap;
            if (hero.top < nextTop)
                hero.top = nextTop;
            const heroBottomLimit2 = Math.max(Math.round(height * 0.18), height - safeBottom - (qrCorner && !isWide ? qrSize + 20 : 0));
            const cap2 = Math.max(Math.round(height * 0.12), heroBottomLimit2 - Number(hero.top) - Math.round(height * 0.03));
            const minH2 = portraitBigHeroFamilies.has(selectedFamily) ? Math.round(height * 0.38) : Math.round(height * 0.14);
            hero.height = Math.min(Math.max(Number(hero.height), minH2), cap2);
            hero.left = Math.max(marginX, Math.min(Number(hero.left), width - marginX - Number(hero.width)));
        }
        const qr = widgets.find((w) => w.name === 'ai_qrcode');
        const ctaW = widgets.find((w) => w.name === 'ai_cta');
        if (qr && ctaW && wantQr && qrStrategy === 'cta') {
            const qrS = Number(qr.width) || 0;
            const ch = Number(ctaW.height) || Math.round(Number(ctaW.fontSize) * 2.2);
            qr.top = ctaW.top + Math.round((ch - qrS) / 2);
            qr.left = textLeft + Number(ctaW.width) + Math.round(width * 0.02);
        }
    }
    return {
        page: {
            width,
            height,
            backgroundColor: palette.background,
            backgroundGradient: result.background?.imageUrl ? '' : getBackgroundGradient(palette),
            backgroundImage: result.background?.imageUrl || '',
        },
        widgets,
        meta: {
            layoutFamily: selectedFamily,
            sizeProfile,
        },
    };
}
export function replacePosterTexts(widgets, input, result) {
    const head = dedupePosterTitleSlogan(result.title, result.slogan);
    const layoutTitle = stripInternalPromptEcho(head.title) || getSafeText(result.title, '').trim();
    const layoutSlogan = stripInternalPromptEcho(head.slogan) || getSafeText(result.slogan, '').trim();
    const layoutBody = stripInternalPromptEcho(result.body) || getSafeText(result.body, '补充描述文案');
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const qr = widgets.find((item) => item.name === 'ai_qrcode');
    if (title)
        title.text = getSafeText(layoutTitle, 'AI 海报标题');
    if (slogan)
        slogan.text = getSafeText(layoutSlogan, '推荐副标题');
    if (body)
        body.text = getSafeText(layoutBody, input.content || '补充描述文案');
    if (cta)
        cta.text = getSafeText(stripInternalPromptEcho(result.cta), '立即了解');
    if (qr && input.qrUrl)
        qr.value = input.qrUrl;
    widgets.filter((w) => w.name && w.name.startsWith('ai_list_')).forEach((w, i) => {
        const lines = splitBodyLines(layoutBody, 3);
        if (lines[i])
            w.text = `· ${lines[i]}`;
    });
    return widgets;
}
export function applyPosterPalette(widgets, palette) {
    widgets.forEach((widget) => {
        if (widget.name === 'ai_title' || widget.name === 'ai_body' || (widget.name && widget.name.startsWith('ai_list_'))) {
            widget.color = palette.text;
        }
        if (widget.name === 'ai_slogan') {
            widget.color = palette.muted;
        }
        if (widget.name === 'ai_cta') {
            widget.color = '#ffffffff';
            widget.backgroundColor = palette.primary;
        }
        if (widget.name === 'ai_qrcode') {
            widget.dotColor = palette.text;
            widget.dotColor2 = palette.text;
        }
        if (widget.name.startsWith('ai_card_')) {
            widget.color = palette.primary;
            widget.backgroundColor = `${palette.secondary}cc`;
        }
        if (widget.name === 'ai_price_tag') {
            widget.color = '#ffffffff';
            widget.backgroundColor = palette.primary;
        }
        if (widget.name === 'ai_price_num') {
            widget.color = palette.primary;
        }
        if (widget.name === 'ai_course_bar') {
            widget.backgroundColor = palette.primary;
        }
        if (widget.name && widget.name.startsWith('ai_deco_')) {
            widget.color = palette.primary;
        }
    });
    return widgets;
}
export function replaceHeroImage(widgets, imageUrl) {
    const hero = widgets.find((item) => item.name === 'ai_hero');
    if (hero) {
        hero.imgUrl = imageUrl;
    }
    return widgets;
}
export function getPosterGradient(palette) {
    return getBackgroundGradient(palette);
}
//# sourceMappingURL=posterEngine.js.map

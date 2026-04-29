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
function resolvePosterSize(sizeKey, explicitSize) {
    if (explicitSize?.width && explicitSize?.height) {
        return {
            width: Number(explicitSize.width),
            height: Number(explicitSize.height),
        };
    }
    const matched = defaultSizes.find((item) => item.key === String(sizeKey || '').trim());
    return {
        width: Number(matched?.width || defaultSizes[2].width),
        height: Number(matched?.height || defaultSizes[2].height),
    };
}
/** 与后端模板 seed.layout、designPlan.layoutFamily 对齐；统一映射到引擎骨架 id */
const SEED_LAYOUT_TO_ENGINE = {
    hero: 'hero-left',
    split: 'split-editorial',
    cards: 'grid-product',
    price: 'premium-offer',
    collage: 'festive-frame',
    editorial: 'magazine-cover',
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
function resolveStructuredLayoutFamily(baseFamily, designPlan, copyDeck, sizeProfile, isWide, options = {}) {
    const lockedAiFamily = normalizeLayoutFamily(options?.aiPriorityFamily);
    const effectiveBaseFamily = normalizeLayoutFamily(baseFamily) || lockedAiFamily || '';
    const contentPattern = String(designPlan?.contentPattern || '').trim();
    const factCount = Array.isArray(copyDeck?.factCards) ? copyDeck.factCards.filter((item) => String(item?.value || item?.hint || '').trim()).length : 0;
    const hasPriceBlock = Boolean(String(copyDeck?.priceBlock?.value || '').trim());
    const sceneText = `${options?.input?.presetKey || ''} ${options?.input?.industry || ''} ${options?.input?.theme || ''} ${options?.input?.purpose || ''} ${options?.input?.style || ''} ${options?.input?.content || ''} ${contentPattern}`.trim();
    const explicitNotePoster = isExplicitNotePosterContext(sceneText);
    const lightFoodPoster = !isWide && isLightFoodPosterContext(sceneText, designPlan, options?.palette || {});
    if (explicitNotePoster && !isWide && (String(options?.input?.presetKey || '').trim() === 'note' || /小红书|笔记|种草|探店|攻略|合集|分享/.test(sceneText))) {
        return 'xiaohongshu-note';
    }
    if (!isWide && contentPattern === 'immersive-hero' && /节日|礼盒|端午|中秋|春节|庆典/.test(sceneText)) {
        return 'festive-frame';
    }
    if (!isWide && contentPattern === 'immersive-hero' && /活动|露营|音乐节|市集|发布|快闪|生活节/.test(sceneText)) {
        return 'magazine-cover';
    }
    if (options?.lockAiFamily && lockedAiFamily) {
        return lockedAiFamily;
    }
    if (!explicitNotePoster && effectiveBaseFamily === 'xiaohongshu-note' && (lightFoodPoster || hasPriceBlock || factCount >= 2 || /电商|零售|商品|促销|抢购|餐饮|美食|咖啡|茶饮|上新/.test(sceneText))) {
        return hasPriceBlock ? 'premium-offer' : lightFoodPoster ? 'hero-center' : factCount >= 3 ? 'grid-product' : 'magazine-cover';
    }
    if (contentPattern === 'price-first')
        return 'premium-offer';
    if (contentPattern === 'list-info')
        return 'list-recruitment';
    if (contentPattern === 'cover-story')
        return 'magazine-cover';
    if (contentPattern === 'immersive-hero')
        return isWide ? 'split-editorial' : 'hero-center';
    if (contentPattern === 'info-cards') {
        if (lightFoodPoster && sizeProfile !== 'square')
            return 'hero-center';
        if (hasPriceBlock && !isWide)
            return 'premium-offer';
        if (factCount >= 3)
            return 'grid-product';
    }
    if (lightFoodPoster && sizeProfile !== 'square' && (effectiveBaseFamily === 'premium-offer' || effectiveBaseFamily === 'grid-product')) {
        return contentPattern === 'cover-story' ? 'magazine-cover' : 'hero-center';
    }
    if (!lightFoodPoster && !isWide && (effectiveBaseFamily === 'split-editorial' || effectiveBaseFamily === 'hero-left') && hasPriceBlock && factCount >= 2 && sizeProfile !== 'banner') {
        return 'premium-offer';
    }
    return effectiveBaseFamily || baseFamily;
}
function resolvePresetLayoutFamily(presetKey, sizeProfile) {
    const key = String(presetKey || '').trim();
    const mapping = {
        campaign: sizeProfile === 'banner' ? 'split-editorial' : 'festive-frame',
        commerce: sizeProfile === 'square' ? 'premium-offer' : 'grid-product',
        course: 'clean-course',
        fitness: 'magazine-cover',
        food: sizeProfile === 'banner' ? 'split-editorial' : 'hero-center',
        festival: 'festive-frame',
        note: 'xiaohongshu-note',
        xiaohongshu: 'xiaohongshu-note',
    };
    return mapping[key] || '';
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
        return 1.2;
    if (fontSize >= 60)
        return 1.18;
    if (fontSize >= 42)
        return 1.26;
    return 1.46;
}
function getSafeText(text, fallback) {
    const value = String(text || '').trim();
    return value || fallback;
}
function normalizePosterHeadline(text) {
    return String(text || '')
        .replace(/\r?\n/g, '')
        .replace(/[|｜]/g, '')
        .replace(/\s+/g, '')
        .trim();
}
function normalizePosterSubline(text) {
    return String(text || '')
        .replace(/\r?\n/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}
function isExplicitNotePosterContext(text) {
    return /小红书|种草|笔记|教程|攻略|合集|开箱|测评|打卡|探店|vlog|分享/.test(String(text || ''));
}
function canonicalPosterText(text) {
    return String(text || '')
        .replace(/\r?\n/g, '')
        .replace(/[·•|｜\-—_~～,，。；;:：!！?？（）()\[\]【】《》"“”'‘’\s]/g, '')
        .trim()
        .toLowerCase();
}
function isSamePosterText(a, b) {
    const x = canonicalPosterText(a);
    const y = canonicalPosterText(b);
    if (!x || !y)
        return false;
    return x === y || x.includes(y) || y.includes(x);
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
function parseHexColor(input, fallback = '#111111') {
    const raw = String(input || '').trim();
    const hex = raw.startsWith('#') ? raw.slice(1) : raw;
    const safe = /^[0-9a-fA-F]{3,8}$/.test(hex) ? hex : String(fallback).replace('#', '');
    let r = 17, g = 17, b = 17;
    if (safe.length === 3 || safe.length === 4) {
        r = parseInt(safe[0] + safe[0], 16);
        g = parseInt(safe[1] + safe[1], 16);
        b = parseInt(safe[2] + safe[2], 16);
    }
    else if (safe.length >= 6) {
        r = parseInt(safe.slice(0, 2), 16);
        g = parseInt(safe.slice(2, 4), 16);
        b = parseInt(safe.slice(4, 6), 16);
    }
    return { r, g, b };
}
function toHex({ r, g, b }) {
    const c = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    return `#${c(r)}${c(g)}${c(b)}`;
}
function relativeLuminance(color) {
    const { r, g, b } = parseHexColor(color);
    const transform = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    };
    const R = transform(r);
    const G = transform(g);
    const B = transform(b);
    return 0.2126 * R + 0.7152 * G + 0.0722 * B;
}
function contrastRatio(a, b) {
    const l1 = relativeLuminance(a);
    const l2 = relativeLuminance(b);
    const high = Math.max(l1, l2);
    const low = Math.min(l1, l2);
    return (high + 0.05) / (low + 0.05);
}
function blendColor(a, b, weight = 0.5) {
    const c1 = parseHexColor(a);
    const c2 = parseHexColor(b);
    const w = Math.max(0, Math.min(1, weight));
    return toHex({
        r: c1.r * (1 - w) + c2.r * w,
        g: c1.g * (1 - w) + c2.g * w,
        b: c1.b * (1 - w) + c2.b * w,
    });
}
function chooseReadableColor(candidates, backgrounds, minContrast = 4.5) {
    const bgList = backgrounds.filter(Boolean);
    const safeCandidates = candidates.filter(Boolean);
    if (!bgList.length || !safeCandidates.length)
        return safeCandidates[0] || '#111111';
    let best = safeCandidates[0];
    let bestScore = -1;
    for (const c of safeCandidates) {
        const score = Math.min(...bgList.map((bg) => contrastRatio(c, bg)));
        if (score > bestScore) {
            bestScore = score;
            best = c;
        }
    }
    if (bestScore >= minContrast)
        return best;
    const fallback = ['#0f172a', '#111111', '#ffffff'];
    for (const c of fallback) {
        const score = Math.min(...bgList.map((bg) => contrastRatio(c, bg)));
        if (score >= minContrast)
            return c;
    }
    return best;
}
function isPosterLightPalette(palette = {}) {
    const bg = String(palette.background || palette.surface || '#ffffff').trim() || '#ffffff';
    const surface = String(palette.surface || bg).trim() || bg;
    return Math.max(relativeLuminance(bg), relativeLuminance(surface)) >= 0.58;
}
function isWarmFoodPosterScene(sceneText) {
    return /餐饮|美食|茶饮|咖啡|食品|轻食|甜品|面|粉|锅|烧烤|小吃|沙拉|能量碗|果蔬/.test(String(sceneText || '').trim());
}
function isLightFoodPosterContext(sceneText, designPlan = {}, palette = {}) {
    if (!isWarmFoodPosterScene(sceneText))
        return false;
    const backgroundTone = String(designPlan?.backgroundTone || '').trim();
    return backgroundTone !== 'dark' || isPosterLightPalette(palette);
}
function resolveReadablePalette(palette) {
    const baseBg = palette.background || '#ffffff';
    const secondary = palette.secondary || baseBg;
    const primary = palette.primary || '#2563eb';
    const surface = palette.surface || '#ffffff';
    const textBase = chooseReadableColor([palette.text, '#0f172a', '#111111', '#ffffff'], [baseBg, secondary, surface], 4.5);
    const mutedBase = chooseReadableColor([palette.muted, blendColor(textBase, baseBg, 0.45), blendColor(textBase, '#ffffff', 0.4)], [baseBg, secondary, surface], 3.2);
    const ctaText = chooseReadableColor(['#ffffff', '#0f172a', '#111111', textBase], [primary], 4.5);
    const qrDot = chooseReadableColor([textBase, palette.text, '#0f172a', '#111111', '#ffffff'], [baseBg, secondary], 5.2);
    return {
        text: textBase,
        muted: mutedBase,
        ctaText,
        qrDot,
    };
}
function normalizeStructuredCtaStyle(rawStyle = {}) {
    const fallback = {
        variant: 'solid',
        emphasis: 'balanced',
        shape: 'rounded',
        placement: 'inline',
        tone: 'premium',
        iconHint: 'none',
        widthMode: 'content',
    };
    return {
        variant: ['solid', 'outline', 'ghost', 'pill', 'bar', 'sticker', 'underline'].includes(String(rawStyle.variant || '').trim()) ? String(rawStyle.variant).trim() : fallback.variant,
        emphasis: ['soft', 'balanced', 'strong'].includes(String(rawStyle.emphasis || '').trim()) ? String(rawStyle.emphasis).trim() : fallback.emphasis,
        shape: ['rounded', 'square', 'capsule'].includes(String(rawStyle.shape || '').trim()) ? String(rawStyle.shape).trim() : fallback.shape,
        placement: ['inline', 'bottom-bar', 'floating', 'with-price'].includes(String(rawStyle.placement || '').trim()) ? String(rawStyle.placement).trim() : fallback.placement,
        tone: ['urgent', 'premium', 'friendly', 'editorial', 'utility'].includes(String(rawStyle.tone || '').trim()) ? String(rawStyle.tone).trim() : fallback.tone,
        iconHint: ['none', 'arrow', 'plus', 'spark', 'chevron'].includes(String(rawStyle.iconHint || '').trim()) ? String(rawStyle.iconHint).trim() : fallback.iconHint,
        widthMode: ['content', 'wide', 'full'].includes(String(rawStyle.widthMode || '').trim()) ? String(rawStyle.widthMode).trim() : fallback.widthMode,
    };
}
function deriveFallbackCtaStyle(input, designPlan = {}, copyDeck = {}) {
    const sceneText = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''}`.trim();
    const contentPattern = String(designPlan.contentPattern || '').trim();
    const scene = /(招聘|招募)/.test(sceneText) ? 'recruitment'
        : /(课程|培训|讲座)/.test(sceneText) ? 'course'
            : /(健身|训练|瑜伽|普拉提)/.test(sceneText) ? 'fitness'
                : /(餐饮|美食|咖啡|茶饮|轻食)/.test(sceneText) ? 'food'
                    : /(节日|庆典|市集|年会|露营|音乐节)/.test(sceneText) ? 'festival'
                        : /(电商|促销|折扣|上新|零售)/.test(sceneText) ? 'commerce'
                            : 'event';
    const hasPrice = Boolean(String(copyDeck === null || copyDeck === void 0 ? void 0 : copyDeck.priceBlock?.value || '').trim());
    if (hasPrice || contentPattern === 'price-first') {
        return { variant: 'pill', emphasis: 'strong', shape: 'capsule', placement: 'with-price', tone: 'urgent', iconHint: 'arrow', widthMode: 'content' };
    }
    if (scene === 'recruitment') {
        return { variant: 'bar', emphasis: 'strong', shape: 'square', placement: 'bottom-bar', tone: 'utility', iconHint: 'chevron', widthMode: 'wide' };
    }
    if (scene === 'course' || scene === 'fitness') {
        return { variant: 'outline', emphasis: 'balanced', shape: 'rounded', placement: 'inline', tone: 'friendly', iconHint: 'plus', widthMode: 'content' };
    }
    if (scene === 'festival') {
        return { variant: 'sticker', emphasis: 'balanced', shape: 'rounded', placement: 'floating', tone: 'friendly', iconHint: 'spark', widthMode: 'content' };
    }
    if (/高级|杂志|轻奢|时尚|封面/.test(sceneText) || contentPattern === 'cover-story') {
        return { variant: 'underline', emphasis: 'soft', shape: 'square', placement: 'inline', tone: 'editorial', iconHint: 'none', widthMode: 'content' };
    }
    return { variant: 'solid', emphasis: /(促销|抢购|报名|投递|预约)/.test(sceneText) ? 'strong' : 'balanced', shape: 'rounded', placement: contentPattern === 'immersive-hero' ? 'floating' : 'inline', tone: /(促销|抢购|报名|投递|预约)/.test(sceneText) ? 'urgent' : 'premium', iconHint: 'arrow', widthMode: /(招聘|课程|活动)/.test(sceneText) ? 'wide' : 'content' };
}
function pickStructuredCtaText(copyDeck = {}, style) {
    const primary = compactDeckLine(copyDeck.cta, 8);
    const candidates = normalizeCtaAlternatives(copyDeck.ctaAlternatives, 4);
    if (!candidates.length)
        return primary;
    if (primary && !/^(立即了解|扫码咨询)$/.test(primary))
        return primary;
    const preferred = style.tone === 'utility'
        ? candidates.find((item) => /投递|报名|咨询|预约/.test(item))
        : style.tone === 'friendly'
            ? candidates.find((item) => /尝鲜|体验|参与|领取/.test(item))
            : style.tone === 'editorial'
                ? candidates.find((item) => /查看|阅读|了解/.test(item))
                : candidates.find((item) => /抢购|下单|领券|预约|报名/.test(item));
    return preferred || candidates[0] || primary;
}
function decorateStructuredCtaText(text, style) {
    const safe = compactDeckLine(text, 10) || '立即了解';
    if (/[>+]$/.test(safe))
        return safe;
    if (style.iconHint === 'plus')
        return `${safe} +`;
    if (style.iconHint === 'arrow' || style.iconHint === 'chevron')
        return `${safe} >`;
    return safe;
}
function applyStructuredCtaStyle(widgets, pageWidth, pageHeight, palette, readability, options = {}) {
    const ctaWidget = widgets.find((item) => item.name === 'ai_cta');
    if (!ctaWidget || isCollapsedWidget(ctaWidget))
        return;
    const copyDeck = options.copyDeck || {};
    const designPlan = options.designPlan || {};
    const style = normalizeStructuredCtaStyle(designPlan.ctaStyle || deriveFallbackCtaStyle(options.input || {}, designPlan, copyDeck));
    const baseText = pickStructuredCtaText(copyDeck, style) || compactDeckLine(ctaWidget.text, 8) || '立即了解';
    ctaWidget.text = decorateStructuredCtaText(baseText, style);
    const titleWidget = widgets.find((item) => item.name === 'ai_title');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const qrWidget = widgets.find((item) => item.name === 'ai_qrcode');
    const hasPrice = !isCollapsedWidget(priceTag) && !isCollapsedWidget(priceNum);
    const textLen = Math.max(String(ctaWidget.text || '').trim().length, 4);
    const widthMap = {
        content: Math.round(Math.max(pageWidth * 0.2, Number(ctaWidget.fontSize || 18) * (textLen + 2.8))),
        wide: Math.round(pageWidth * 0.34),
        full: Math.round(pageWidth * 0.52),
    };
    const targetHeight = Math.max(Number(ctaWidget.height || 0), Math.round(pageHeight * (style.emphasis === 'strong' ? 0.062 : style.variant === 'underline' ? 0.042 : 0.054)));
    const targetWidth = Math.max(Number(ctaWidget.width || 0), widthMap[style.widthMode] || widthMap.content);
    const radius = style.shape === 'capsule' ? Math.round(targetHeight / 2)
        : style.shape === 'square' ? Math.max(4, Math.round(pageWidth * 0.006))
            : Math.max(10, Math.round(pageWidth * 0.018));
    const isLightTone = style.tone === 'premium' || style.tone === 'friendly' || style.tone === 'editorial';
    const accent = style.tone === 'urgent' ? chooseReadableColor([palette.primary, '#e11d48', '#f97316', '#dc2626'], [palette.background, palette.surface], 3.4)
        : style.tone === 'utility' ? chooseReadableColor([palette.text, '#1f2937', '#0f172a', palette.primary], [palette.background, palette.surface], 4.5)
            : chooseReadableColor([palette.primary, palette.secondary, '#8b5cf6', '#2563eb'], [palette.background, palette.surface], 3.6);
    const softBg = style.tone === 'editorial' ? '#00000000'
        : style.tone === 'friendly' ? withAlpha(blendColor('#ffffff', accent, 0.1), 'f0')
            : style.tone === 'premium' ? withAlpha(blendColor('#fff7ed', accent, 0.08), 'f2')
                : withAlpha(blendColor(accent, '#ffffff', 0.18), 'f4');
    const placementLocked = Boolean(ctaWidget.aiPlacementLock);
    let left = Number(ctaWidget.left || 0);
    let top = Number(ctaWidget.top || 0);
    let width = targetWidth;
    if (placementLocked) {
        width = Math.max(Number(ctaWidget.aiPreferredWidth || ctaWidget.width || 0), Math.min(targetWidth, Math.round(pageWidth * 0.42)));
        left = Number.isFinite(Number(ctaWidget.aiPreferredLeft)) ? Number(ctaWidget.aiPreferredLeft) : left;
        top = Number.isFinite(Number(ctaWidget.aiMinTop)) ? Number(ctaWidget.aiMinTop) : top;
    }
    else if (style.placement === 'bottom-bar') {
        width = Math.max(targetWidth, Math.round(pageWidth * 0.42));
        left = Math.max(Math.round(pageWidth * 0.08), left);
        top = Math.min(pageHeight - Math.round(pageHeight * 0.08) - targetHeight, Math.max(top, aiTextStackBottom(widgets) + Math.round(pageHeight * 0.018)));
    }
    else if (style.placement === 'floating') {
        width = Math.max(targetWidth, Math.round(pageWidth * 0.26));
        left = Math.round((pageWidth - width) / 2);
        top = Math.min(pageHeight - Math.round(pageHeight * 0.08) - targetHeight, Math.max(top, aiTextStackBottom(widgets) + Math.round(pageHeight * 0.022)));
    }
    else if (style.placement === 'with-price' && hasPrice) {
        const priceBottom = Math.max(widgetTextBottom(priceTag), widgetTextBottom(priceNum));
        left = Math.max(Number(priceTag.left || 0), Math.round(pageWidth * 0.08));
        top = Math.min(pageHeight - Math.round(pageHeight * 0.08) - targetHeight, priceBottom + Math.round(pageHeight * 0.016));
        width = Math.max(width, Math.round(pageWidth * 0.24));
    }
    else {
        top = Math.min(pageHeight - Math.round(pageHeight * 0.08) - targetHeight, Math.max(top, titleWidget && !isCollapsedWidget(titleWidget) ? aiTextStackBottom(widgets) + Math.round(pageHeight * 0.018) : top));
    }
    applyWidgetRect(ctaWidget, {
        left,
        top,
        width,
        height: targetHeight,
    });
    if (placementLocked) {
        if (Number.isFinite(Number(ctaWidget.aiPreferredLeft)))
            ctaWidget.left = Math.round(Number(ctaWidget.aiPreferredLeft));
        if (Number.isFinite(Number(ctaWidget.aiPreferredWidth)))
            ctaWidget.width = Math.round(Number(ctaWidget.aiPreferredWidth));
        if (Number.isFinite(Number(ctaWidget.aiMinTop)))
            ctaWidget.top = Math.round(Number(ctaWidget.aiMinTop));
    }
    ctaWidget.radius = radius;
    ctaWidget.borderWidth = style.variant === 'outline' ? 2 : style.variant === 'underline' ? 0 : style.variant === 'ghost' ? 1 : style.variant === 'sticker' ? 2 : 0;
    ctaWidget.borderColor = style.variant === 'outline' || style.variant === 'ghost' || style.variant === 'sticker'
        ? withAlpha(accent, style.variant === 'ghost' ? '66' : 'bb')
        : '';
    ctaWidget.backgroundColor = style.variant === 'outline' || style.variant === 'underline'
        ? '#00000000'
        : style.variant === 'ghost'
            ? withAlpha(accent, '18')
            : style.variant === 'sticker'
                ? withAlpha(blendColor(accent, '#ffffff', 0.18), 'f2')
                : style.variant === 'bar'
                    ? accent
                    : style.variant === 'pill'
                        ? accent
                        : style.variant === 'solid'
                            ? accent
                            : softBg;
    ctaWidget.color = style.variant === 'outline' || style.variant === 'underline'
        ? accent
        : chooseReadableColor(['#ffffff', '#0f172a', '#111111', accent], [ctaWidget.backgroundColor || accent, softBg, palette.background], isLightTone ? 3.8 : 4.8);
    ctaWidget.fontWeight = style.emphasis === 'soft' ? '500' : 'bold';
    ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, style.emphasis === 'strong' ? 22 : 19, 14));
    ctaWidget.lineHeight = 1.2;
    setWidgetAlign(ctaWidget, style.placement === 'bottom-bar' ? 'center' : 'center');
    ctaWidget.textEffects = [];
    if (style.variant === 'underline') {
        ctaWidget.backgroundColor = '#00000000';
        ctaWidget.borderColor = '';
        ctaWidget.borderWidth = 0;
    }
    if (qrWidget && !isCollapsedWidget(qrWidget) && String(designPlan.qrStrategy || '') === 'cta') {
        const qrSize = Number(qrWidget.width || 0);
        qrWidget.top = Number(ctaWidget.top || 0) + Math.round((targetHeight - qrSize) / 2);
        qrWidget.left = Math.min(pageWidth - qrSize - Math.round(pageWidth * 0.08), Number(ctaWidget.left || 0) + Number(ctaWidget.width || 0) + Math.round(pageWidth * 0.02));
    }
}
function makeTextWidget(name, overrides) {
    const setting = clone(wTextSetting);
    return Object.assign(setting, {
        name,
        editable: true,
        lock: false,
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
function finalizeAiWidgetEditability(widgets) {
    widgets.forEach((widget) => {
        if (!widget || widget.type !== 'w-text')
            return;
        const name = String(widget.name || '');
        const decorative = name === 'ai_text_panel'
            || name === 'ai_course_bar'
            || name.startsWith('ai_deco_');
        widget.editable = !decorative;
        widget.lock = false;
    });
    return widgets;
}
function isPosterPriceLikeText(text) {
    const value = String(text || '').trim();
    if (!value || value === ' ')
        return false;
    const promoOfferPattern = /(?:买一送一|第二件半价|第[二2]件半价|满\d{2,4}减\d{1,3}|加购立减|下单立减|立减\s*\d{1,4}\s*元?|直降\s*\d{1,4}\s*元?|省\s*\d{1,4}\s*元?|限时优惠|限量发售|福利加码|新人专享|包邮|赠(?:品|礼|试用装|旅行装)|第[二2]件\d+折)/;
    return /(?:￥|¥)\s*\d{1,4}(?:\.\d{1,2})?(?:起|元)?/.test(value)
        || /(?<!\d)\d{1,4}(?:\.\d{1,2})?\s*元(?:起)?/.test(value)
        || /(?<!\d)\d(?:\.\d)?\s*折/.test(value)
        || promoOfferPattern.test(value);
}
function getPosterPriceDisplay(priceBlock = {}, fallbackText = '') {
    const merged = `${String(priceBlock?.value || '').trim()}${String(priceBlock?.suffix || '').trim()}`.trim();
    if (isPosterPriceLikeText(merged))
        return merged;
    return isPosterPriceLikeText(fallbackText) ? String(fallbackText || '').trim() : '';
}
function hidePosterPriceWidgets(widgets) {
    ['ai_price_tag', 'ai_price_num'].forEach((name) => {
        const widget = widgets.find((item) => item.name === name);
        if (widget)
            hideWidgetBlock(widget);
    });
}
function compactPosterActionZone(widgets, family, pageWidth, pageHeight) {
    const cta = widgets.find((item) => item.name === 'ai_cta');
    if (!cta || isCollapsedWidget(cta))
        return;
    if (!['split-editorial', 'list-recruitment', 'hero-left', 'clean-course'].includes(String(family || '').trim()))
        return;
    const contentWidgets = widgets.filter((item) => item && !isCollapsedWidget(item) && item.name !== 'ai_cta' && (['ai_badge', 'ai_title', 'ai_slogan', 'ai_body', 'ai_price_tag', 'ai_price_num'].includes(String(item.name || '')) || String(item.name || '').startsWith('ai_list_') || String(item.name || '').startsWith('ai_recruit_card_') || String(item.name || '').startsWith('ai_chip_') || String(item.name || '').startsWith('ai_meta_')));
    if (!contentWidgets.length)
        return;
    const contentBottom = Math.max(...contentWidgets.map((item) => Number(item.top || 0) + Number(item.height || 0)));
    const currentTop = Number(cta.top || 0);
    const maxGap = family === 'list-recruitment' ? Math.round(pageHeight * 0.08) : Math.round(pageHeight * 0.12);
    if (currentTop - contentBottom <= maxGap)
        return;
    const targetTop = Math.min(Math.round(pageHeight * 0.86), contentBottom + Math.round(pageHeight * 0.045));
    applyWidgetRect(cta, { top: targetTop });
}
function tightenPosterInfoPanel(widgets, family, pageWidth, pageHeight) {
    const panel = widgets.find((item) => item.name === 'ai_text_panel');
    if (!panel || isCollapsedWidget(panel))
        return;
    if (!['hero-left', 'hero-center', 'split-editorial', 'clean-course', 'list-recruitment'].includes(String(family || '').trim()))
        return;
    const trackedNames = ['ai_badge', 'ai_title', 'ai_slogan', 'ai_body', 'ai_cta', 'ai_price_tag', 'ai_price_num'];
    const tracked = widgets.filter((item) => item && !isCollapsedWidget(item) && (trackedNames.includes(String(item.name || '')) || String(item.name || '').startsWith('ai_chip_') || String(item.name || '').startsWith('ai_meta_') || String(item.name || '').startsWith('ai_recruit_card_')));
    if (!tracked.length)
        return;
    const minLeft = Math.min(...tracked.map((item) => Number(item.left || 0)));
    const minTop = Math.min(...tracked.map((item) => Number(item.top || 0)));
    const maxRight = Math.max(...tracked.map((item) => Number(item.left || 0) + Number(item.width || 0)));
    const maxBottom = Math.max(...tracked.map((item) => Number(item.top || 0) + Number(item.height || 0)));
    const padX = Math.round(pageWidth * 0.035);
    const padTop = Math.round(pageHeight * 0.028);
    const padBottom = Math.round(pageHeight * 0.05);
    let left = Math.max(Math.round(pageWidth * 0.05), minLeft - padX);
    let top = Math.max(Math.round(pageHeight * 0.04), minTop - padTop);
    let width = Math.min(pageWidth - left - Math.round(pageWidth * 0.05), maxRight - left + padX);
    let height = Math.min(pageHeight - top - Math.round(pageHeight * 0.04), maxBottom - top + padBottom);
    if (family === 'split-editorial' || family === 'hero-left' || family === 'list-recruitment') {
        width = Math.min(width, Math.round(pageWidth * 0.47));
    }
    if (family === 'hero-center') {
        const targetWidth = Math.min(Math.round(pageWidth * 0.86), Math.max(width, Math.round(pageWidth * 0.66)));
        left = Math.round((pageWidth - targetWidth) / 2);
        width = targetWidth;
    }
    if (family === 'clean-course') {
        width = Math.min(Math.round(pageWidth * 0.84), Math.max(width, Math.round(pageWidth * 0.72)));
    }
    applyWidgetRect(panel, {
        left,
        top,
        width,
        height: Math.max(height, Math.round(pageHeight * 0.16)),
    });
}
function fitPanelTextStack(widgets, family, pageWidth) {
    const panel = widgets.find((item) => item.name === 'ai_text_panel');
    if (!panel || isCollapsedWidget(panel))
        return;
    if (!['split-editorial', 'list-recruitment', 'hero-left', 'clean-course', 'hero-center'].includes(String(family || '').trim()))
        return;
    const innerLeft = Number(panel.left || 0) + Math.round(pageWidth * 0.03);
    const maxWidth = Math.max(120, Number(panel.width || 0) - Math.round(pageWidth * 0.06));
    ['ai_title', 'ai_slogan', 'ai_body'].forEach((name) => {
        const widget = widgets.find((item) => item.name === name);
        if (!widget || isCollapsedWidget(widget))
            return;
        applyWidgetRect(widget, {
            left: Math.max(innerLeft, Number(widget.left || 0)),
            width: Math.min(Number(widget.width || 0), maxWidth),
        });
    });
}
function applyMinimumReadablePosterTypography(widgets, pageWidth, pageHeight) {
    const portrait = pageHeight >= pageWidth * 1.08;
    const minBadgeFont = getTextFont(pageWidth, portrait ? 26 : 24, 18);
    const minChipFont = getTextFont(pageWidth, portrait ? 22 : 20, 16);
    const minMetaFont = getTextFont(pageWidth, portrait ? 18 : 16, 14);
    const minBodyFont = getTextFont(pageWidth, portrait ? 26 : 23, 18);
    const minSloganFont = getTextFont(pageWidth, portrait ? 34 : 29, 22);
    const minTitleFont = getTextFont(pageWidth, portrait ? 72 : 60, portrait ? 46 : 38);
    const minCtaFont = getTextFont(pageWidth, portrait ? 22 : 20, 16);
    const minPriceFont = getTextFont(pageWidth, portrait ? 64 : 58, 42);
    widgets.forEach((widget) => {
        const name = String(widget?.name || '');
        if (!name || isCollapsedWidget(widget))
            return;
        if (name === 'ai_title') {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minTitleFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.lineHeight = Math.max(Number(widget.lineHeight || 0), 1.04);
            widget.height = Math.max(Number(widget.height || 0), estimateTextHeight(String(widget.text || ''), Number(widget.fontSize || minTitleFont), Number(widget.width || pageWidth * 0.7)));
            if (widget.record)
                widget.record.height = Math.round(Number(widget.height || 0));
        }
        else if (name === 'ai_slogan') {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minSloganFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.lineHeight = Math.max(Number(widget.lineHeight || 0), 1.18);
            widget.height = Math.max(Number(widget.height || 0), estimateTextHeight(String(widget.text || ''), Number(widget.fontSize || minSloganFont), Number(widget.width || pageWidth * 0.66)));
            if (widget.record)
                widget.record.height = Math.round(Number(widget.height || 0));
        }
        else if (name === 'ai_body' || name.startsWith('ai_list_') || name.startsWith('ai_card_') || name.startsWith('ai_recruit_card_')) {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minBodyFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.lineHeight = Math.max(Number(widget.lineHeight || 0), 1.24);
            widget.height = Math.max(Number(widget.height || 0), estimateTextHeight(String(widget.text || ''), Number(widget.fontSize || minBodyFont), Number(widget.width || pageWidth * 0.6)));
            if (widget.record)
                widget.record.height = Math.round(Number(widget.height || 0));
        }
        else if (name === 'ai_cta') {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minCtaFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.height = Math.max(Number(widget.height || 0), Math.round(pageHeight * 0.048));
            if (widget.record)
                widget.record.height = Math.round(Number(widget.height || 0));
        }
        else if (name === 'ai_badge' || name === 'ai_price_tag') {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minBadgeFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.height = Math.max(Number(widget.height || 0), Math.round(pageHeight * 0.04));
            widget.width = Math.max(Number(widget.width || 0), Math.round(pageWidth * 0.2));
            if (widget.record) {
                widget.record.height = Math.round(Number(widget.height || 0));
                widget.record.width = Math.round(Number(widget.width || 0));
            }
        }
        else if (name === 'ai_price_num') {
            widget.fontSize = Math.max(Number(widget.fontSize || 0), minPriceFont);
            widget.lineHeight = Math.max(Number(widget.lineHeight || 0), 1.02);
        }
        else if (name.startsWith('ai_chip_')) {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minChipFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.height = Math.max(Number(widget.height || 0), Math.round(pageHeight * 0.036));
            if (widget.record) {
                widget.record.height = Math.round(Number(widget.height || 0));
            }
        }
        else if (name.startsWith('ai_meta_')) {
            const minFont = Number.isFinite(Number(widget.aiReadableMinFont)) ? Number(widget.aiReadableMinFont) : minMetaFont;
            const maxFont = Number.isFinite(Number(widget.aiReadableMaxFont)) ? Number(widget.aiReadableMaxFont) : Infinity;
            widget.fontSize = Math.min(maxFont, Math.max(Number(widget.fontSize || 0), minFont));
            widget.height = Math.max(Number(widget.height || 0), Math.round(pageHeight * 0.032));
            if (widget.record) {
                widget.record.height = Math.round(Number(widget.height || 0));
            }
        }
    });
}
function fitAiHeroToPage(hero, pageWidth, pageHeight) {
    if (!hero || hero.name !== 'ai_hero')
        return hero;
    hero.opacity = 1;
    const fullBleed = hero.fullBleed === true;
    if (fullBleed) {
        hero.left = 0;
        hero.top = 0;
        hero.width = Math.max(1, Math.round(pageWidth || hero.width || 1));
        hero.height = Math.max(1, Math.round(pageHeight || hero.height || 1));
        hero.radius = 0;
    }
    else {
        hero.left = Math.round(Number(hero.left || 0));
        hero.top = Math.round(Number(hero.top || 0));
        hero.width = Math.max(1, Math.round(Number(hero.width || pageWidth || 1)));
        hero.height = Math.max(1, Math.round(Number(hero.height || pageHeight || 1)));
    }
    if (hero.record) {
        hero.record.width = hero.width;
        hero.record.height = hero.height;
    }
    return hero;
}
function isPosterMockAsset(url) {
    const source = String(url || '').toLowerCase();
    if (!source)
        return false;
    return /(?:-poster-)|(?:template-\d+)|(?:homepage\/(?:ecom|course|event|food|recruit|fitness|holiday)-\d)|(?:dist\/assets\/(?:ecom|course|event|food|recruit|fitness|holiday)-\d)|(?:fixes\/(?:ecom|course|food|fitness|holiday|recruit).*-poster)|(?:social-poster-)/.test(source);
}
function applyHeroCardRect(hero, rect, radius = 28) {
    if (!hero)
        return;
    hero.fullBleed = false;
    hero.opacity = 1;
    hero.left = Math.round(Number(rect.left || 0));
    hero.top = Math.round(Number(rect.top || 0));
    hero.width = Math.max(1, Math.round(Number(rect.width || hero.width || 1)));
    hero.height = Math.max(1, Math.round(Number(rect.height || hero.height || 1)));
    hero.radius = Math.max(0, Math.round(radius));
    if (hero.record) {
        hero.record.width = hero.width;
        hero.record.height = hero.height;
    }
}
function createPosterBackdropDataUrl(palette, family) {
    const primary = palette?.primary || '#2563eb';
    const secondary = palette?.secondary || '#7c3aed';
    const background = palette?.background || '#0f172a';
    const surface = palette?.surface || '#f8fafc';
    const accent = blendColor(primary, surface, 0.16);
    const accent2 = blendColor(secondary, surface, 0.12);
    const overlay = withAlpha(blendColor(background, '#ffffff', 0.05), 'ff');
    const circles = family === 'premium-offer'
        ? `
      <circle cx="84%" cy="24%" r="18%" fill="${withAlpha(accent2, '5c')}" />
      <circle cx="24%" cy="78%" r="22%" fill="${withAlpha(primary, '30')}" />
    `
        : family === 'clean-course'
            ? `
      <circle cx="82%" cy="20%" r="24%" fill="${withAlpha(accent2, '55')}" />
      <circle cx="66%" cy="78%" r="12%" fill="${withAlpha(primary, '36')}" />
    `
            : family === 'festive-frame'
                ? `
      <circle cx="50%" cy="28%" r="24%" fill="${withAlpha(accent2, '50')}" />
      <circle cx="18%" cy="70%" r="20%" fill="${withAlpha(primary, '24')}" />
      <circle cx="82%" cy="72%" r="18%" fill="${withAlpha(surface, '12')}" />
    `
                : `
      <circle cx="76%" cy="22%" r="20%" fill="${withAlpha(accent2, '54')}" />
      <circle cx="22%" cy="76%" r="18%" fill="${withAlpha(primary, '28')}" />
    `;
    const lines = family === 'magazine-cover'
        ? `
      <rect x="8%" y="8%" width="20%" height="2" fill="${withAlpha(surface, '55')}" />
      <rect x="72%" y="8%" width="12%" height="2" fill="${withAlpha(surface, '35')}" />
      <rect x="8%" y="90%" width="28%" height="2" fill="${withAlpha(surface, '25')}" />
    `
        : `
      <rect x="8%" y="10%" width="18%" height="2" fill="${withAlpha(surface, '2a')}" />
      <rect x="74%" y="88%" width="10%" height="2" fill="${withAlpha(surface, '20')}" />
    `;
    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="1600" viewBox="0 0 1600 1600" preserveAspectRatio="none">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${background}" />
      <stop offset="55%" stop-color="${secondary}" />
      <stop offset="100%" stop-color="${primary}" />
    </linearGradient>
    <linearGradient id="wash" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${withAlpha(overlay, '00')}" />
      <stop offset="100%" stop-color="${withAlpha(background, '55')}" />
    </linearGradient>
  </defs>
  <rect width="1600" height="1600" fill="url(#bg)" />
  <rect width="1600" height="1600" fill="url(#wash)" />
  ${circles}
  ${lines}
</svg>`.trim();
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}
function withAlpha(color, alpha = 'e8') {
    const raw = String(color || '').trim();
    if (!raw)
        return '';
    if (/^#[0-9a-fA-F]{6}$/.test(raw))
        return `${raw}${alpha}`;
    if (/^#[0-9a-fA-F]{8}$/.test(raw))
        return `${raw.slice(0, 7)}${alpha}`;
    return raw;
}
function isCollapsedWidget(widget) {
    if (!widget)
        return true;
    const text = String(widget.text || '').trim();
    const height = Number(widget.height || widget.record?.height || 0);
    return (!text || text === '') && height <= 4;
}
function clampUnit(value, fallback = 0) {
    const safe = Number.isFinite(Number(value)) ? Number(value) : fallback;
    return Math.max(0, Math.min(1, safe));
}
function normalizeMultimodalRect(rect, fallback = { x: 0, y: 0, w: 0.3, h: 0.1 }) {
    const x = clampUnit(rect?.x, fallback.x);
    const y = clampUnit(rect?.y, fallback.y);
    const maxW = Math.max(0.06, 1 - x);
    const maxH = Math.max(0.06, 1 - y);
    return {
        x,
        y,
        w: Math.max(0.06, Math.min(maxW, clampUnit(rect?.w, fallback.w))),
        h: Math.max(0.06, Math.min(maxH, clampUnit(rect?.h, fallback.h))),
    };
}
function getPosterMultimodalHints(result) {
    const raw = result?.multimodalLayoutHints;
    if (!raw || typeof raw !== 'object')
        return null;
    return {
        safeZones: Array.isArray(raw.safeZones) ? raw.safeZones : [],
        avoidZones: Array.isArray(raw.avoidZones) ? raw.avoidZones : [],
        suggestedPlacement: Array.isArray(raw.suggestedPlacement) ? raw.suggestedPlacement : [],
        textStyleHints: Array.isArray(raw.textStyleHints) ? raw.textStyleHints : [],
        visualAnalysis: raw.visualAnalysis || {},
        layoutDecision: raw.layoutDecision || {},
    };
}
function getPosterTemplateFamilyRecommendation(result, input = {}) {
    const sceneText = `${input?.presetKey || ''} ${input?.industry || ''} ${input?.theme || ''} ${input?.purpose || ''} ${input?.style || ''} ${input?.content || ''}`.trim();
    const candidates = [];
    if (Array.isArray(result?.recommendedTemplates)) {
        result.recommendedTemplates.forEach((item, index) => {
            candidates.push({
                family: normalizeLayoutFamily(item?.layoutFamily),
                score: Number(item?.score || 0),
                tone: String(item?.tone || '').trim(),
                reason: String(item?.reason || '').trim(),
                rank: index,
            });
        });
    }
    if (result?.recommendedTemplate) {
        candidates.push({
            family: normalizeLayoutFamily(result.recommendedTemplate?.layoutFamily),
            score: Number(result.recommendedTemplate?.score || 0.96),
            tone: String(result.recommendedTemplate?.tone || '').trim(),
            reason: 'top-template',
            rank: -1,
        });
    }
    const filtered = candidates.filter((item) => item.family);
    if (!filtered.length)
        return null;
    const suitabilityScore = (family) => {
        if (/招聘|招募/.test(sceneText)) {
            if (family === 'list-recruitment')
                return 0.32;
            if (family === 'split-editorial')
                return 0.18;
            if (family === 'hero-left')
                return 0.12;
            if (family === 'magazine-cover')
                return -0.12;
            if (family === 'festive-frame' || family === 'premium-offer')
                return -0.18;
        }
        if (/课程|教育|培训|报名/.test(sceneText)) {
            if (family === 'clean-course')
                return 0.32;
            if (family === 'split-editorial')
                return 0.18;
            if (family === 'hero-left')
                return 0.1;
            if (family === 'magazine-cover')
                return -0.05;
        }
        if (/电商|零售|商品|上新|促销|抢购|家清|套组/.test(sceneText)) {
            if (family === 'premium-offer')
                return 0.26;
            if (family === 'grid-product')
                return 0.18;
            if (family === 'hero-center')
                return 0.14;
            if (family === 'magazine-cover')
                return -0.04;
        }
        if (/餐饮|美食|咖啡|茶饮|轻食|沙拉|甜品/.test(sceneText)) {
            if (family === 'hero-center')
                return 0.2;
            if (family === 'magazine-cover')
                return 0.12;
            if (family === 'split-editorial')
                return 0.08;
        }
        return 0;
    };
    const sceneBoost = (family) => {
        if (!family)
            return -1;
        if (/活动|露营|音乐节|市集|快闪|生活节|派对|演出/.test(sceneText)) {
            return family === 'magazine-cover' ? 0.22 : family === 'festive-frame' ? 0.18 : family === 'split-editorial' ? 0.14 : family === 'hero-left' ? 0.1 : 0;
        }
        if (/节日|礼盒|端午|中秋|春节|庆典/.test(sceneText)) {
            return family === 'festive-frame' ? 0.22 : family === 'magazine-cover' ? 0.16 : family === 'hero-left' ? 0.1 : 0;
        }
        if (/餐饮|美食|咖啡|茶饮|轻食|沙拉|甜品/.test(sceneText)) {
            return family === 'hero-center' ? 0.18 : family === 'magazine-cover' ? 0.16 : family === 'split-editorial' ? 0.14 : family === 'premium-offer' ? 0.08 : 0;
        }
        if (/招聘|招募/.test(sceneText)) {
            return family === 'list-recruitment' ? 0.24 : family === 'split-editorial' ? 0.12 : family === 'hero-left' ? 0.08 : 0;
        }
        if (/课程|教育|培训|报名/.test(sceneText)) {
            return family === 'clean-course' ? 0.24 : family === 'split-editorial' ? 0.12 : family === 'hero-left' ? 0.08 : 0;
        }
        return 0;
    };
    filtered.sort((a, b) => {
        const scoreA = a.score + sceneBoost(a.family) + suitabilityScore(a.family) - Math.max(0, a.rank) * 0.002;
        const scoreB = b.score + sceneBoost(b.family) + suitabilityScore(b.family) - Math.max(0, b.rank) * 0.002;
        return scoreB - scoreA;
    });
    return filtered[0] || null;
}
function getMultimodalPlacement(hints, role) {
    if (!hints)
        return null;
    const placement = (hints.suggestedPlacement || []).find((item) => String(item?.role || '') === role);
    return placement ? normalizeMultimodalRect(placement) : null;
}
function getMultimodalTextStyle(hints, role) {
    if (!hints)
        return null;
    return (hints.textStyleHints || []).find((item) => String(item?.role || '') === role) || null;
}
function applyPlacementToWidget(widget, placement, pageWidth, pageHeight, options = {}) {
    if (!widget || !placement)
        return;
    const safe = normalizeMultimodalRect(placement);
    const role = String(options.role || '');
    const portrait = pageHeight >= pageWidth * 1.1;
    const textLength = String(widget.text || '').replace(/\s+/g, '').length;
    const minWidthRatio = role === 'heroHeadline'
        ? portrait
            ? (textLength >= 12 ? 0.48 : 0.42)
            : 0.3
        : role === 'supportLine'
            ? (portrait ? 0.34 : 0.24)
            : role === 'body'
                ? (portrait ? 0.4 : 0.28)
                : role === 'cta'
                    ? 0.22
                    : 0.14;
    const width = Math.max(Math.round(pageWidth * minWidthRatio), Math.max(24, Math.round(pageWidth * safe.w)));
    const left = Math.max(Math.round(pageWidth * 0.04), Math.min(Math.round(pageWidth * safe.x), Math.max(Math.round(pageWidth * 0.04), pageWidth - width - Math.round(pageWidth * 0.04))));
    const top = Math.round(pageHeight * safe.y);
    const height = Math.max(18, Math.round(pageHeight * safe.h));
    widget.left = left;
    widget.top = top;
    widget.width = width;
    widget.height = height;
    if (widget.record) {
        widget.record.width = width;
        widget.record.height = height;
    }
    if (placement.align) {
        widget.textAlign = placement.align;
        widget.textAlignLast = placement.align;
    }
    const fontScale = Number(options.fontScale || 0.52);
    const minFont = Number(options.minFont || 18);
    const maxFont = Number(options.maxFont || 120);
    if (widget.type === 'w-text' && !options.keepFontSize) {
        widget.fontSize = Math.max(minFont, Math.min(maxFont, Math.round(height * fontScale)));
    }
}
function applyMultimodalTextStyle(widget, style, fallbackColor) {
    if (!widget || !style)
        return;
    if (style.fill)
        widget.color = style.fill;
    else if (fallbackColor)
        widget.color = fallbackColor;
    if (style.weight === 'bold')
        widget.fontWeight = 'bold';
    else if (style.weight === 'medium')
        widget.fontWeight = '500';
}
function applyMultimodalLayoutHints(widgets, result, pageWidth, pageHeight, palette, layoutFamily) {
    const hints = getPosterMultimodalHints(result);
    if (!hints)
        return { family: layoutFamily };
    const panelWidget = widgets.find((item) => item.name === 'ai_text_panel');
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const badge = widgets.find((item) => item.name === 'ai_badge');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const placementMap = [
        { role: 'heroHeadline', widget: title, fontScale: 0.56, minFont: 32, maxFont: 112 },
        { role: 'supportLine', widget: slogan, fontScale: 0.38, minFont: 18, maxFont: 44 },
        { role: 'body', widget: body, fontScale: 0.28, minFont: 16, maxFont: 32 },
        { role: 'cta', widget: cta, fontScale: 0.34, minFont: 18, maxFont: 32 },
        { role: 'badge', widget: badge, fontScale: 0.34, minFont: 12, maxFont: 20 },
    ];
    placementMap.forEach((item) => {
        const placement = getMultimodalPlacement(hints, item.role);
        if (placement && item.widget) {
            applyPlacementToWidget(item.widget, placement, pageWidth, pageHeight, item);
        }
    });
    const pricePlacement = getMultimodalPlacement(hints, 'priceBlock');
    if (pricePlacement) {
        if (priceTag)
            applyPlacementToWidget(priceTag, pricePlacement, pageWidth, pageHeight, { fontScale: 0.24, minFont: 14, maxFont: 24 });
        if (priceNum) {
            const numPlacement = {
                x: pricePlacement.x,
                y: Math.min(0.92, pricePlacement.y + pricePlacement.h * 0.28),
                w: pricePlacement.w,
                h: Math.max(0.06, pricePlacement.h * 0.72),
                align: pricePlacement.align || 'left',
            };
            applyPlacementToWidget(priceNum, numPlacement, pageWidth, pageHeight, { fontScale: 0.52, minFont: 24, maxFont: 68 });
        }
    }
    const titleStyle = getMultimodalTextStyle(hints, 'heroHeadline');
    const sloganStyle = getMultimodalTextStyle(hints, 'supportLine');
    const bodyStyle = getMultimodalTextStyle(hints, 'body');
    const ctaStyle = getMultimodalTextStyle(hints, 'cta');
    const badgeStyle = getMultimodalTextStyle(hints, 'badge');
    const priceStyle = getMultimodalTextStyle(hints, 'priceBlock');
    applyMultimodalTextStyle(title, titleStyle, palette.text);
    applyMultimodalTextStyle(slogan, sloganStyle, palette.muted || palette.text);
    applyMultimodalTextStyle(body, bodyStyle, palette.text);
    applyMultimodalTextStyle(cta, ctaStyle, '#ffffff');
    applyMultimodalTextStyle(badge, badgeStyle, '#ffffff');
    applyMultimodalTextStyle(priceTag, priceStyle, palette.primary);
    applyMultimodalTextStyle(priceNum, priceStyle, palette.primary);
    const needsPanel = Boolean(hints.visualAnalysis?.needsPanel || titleStyle?.treatment === 'panel' || sloganStyle?.treatment === 'panel' || bodyStyle?.treatment === 'panel');
    const primaryPanelColor = titleStyle?.panel || bodyStyle?.panel || sloganStyle?.panel || '';
    if (panelWidget) {
        if (shouldUseLargeTextPanel(layoutFamily, hints, primaryPanelColor)) {
            const placements = [getMultimodalPlacement(hints, 'heroHeadline'), getMultimodalPlacement(hints, 'supportLine'), getMultimodalPlacement(hints, 'body'), getMultimodalPlacement(hints, 'cta')].filter(Boolean);
            const minX = Math.min(...placements.map((item) => item.x));
            const minY = Math.min(...placements.map((item) => item.y));
            const maxX = Math.max(...placements.map((item) => item.x + item.w));
            const maxY = Math.max(...placements.map((item) => item.y + item.h));
            applyPlacementToWidget(panelWidget, {
                x: Math.max(0.02, minX - 0.025),
                y: Math.max(0.02, minY - 0.03),
                w: Math.min(0.96, maxX - minX + 0.05),
                h: Math.min(0.94, maxY - minY + 0.06),
            }, pageWidth, pageHeight, { keepFontSize: true });
            panelWidget.backgroundColor = withAlpha(primaryPanelColor, layoutFamily === 'hero-center' || layoutFamily === 'magazine-cover' ? '9a' : 'bc');
            panelWidget.borderWidth = 1;
            panelWidget.borderColor = withAlpha(getMultimodalTextStyle(hints, 'heroHeadline')?.stroke || blendColor(primaryPanelColor, '#ffffff', 0.2), '58');
        }
        else if (!needsPanel && !new Set(['grid-product', 'premium-offer', 'clean-course', 'list-recruitment']).has(layoutFamily)) {
            panelWidget.backgroundColor = '#ffffff00';
            panelWidget.borderWidth = 0;
            panelWidget.borderColor = '#ffffff00';
            panelWidget.height = 2;
            if (panelWidget.record)
                panelWidget.record.height = 2;
        }
    }
    return {
        family: String(hints.layoutDecision?.recommendedFamily || '').trim() || layoutFamily,
        confidence: Number(hints.layoutDecision?.confidence || 0),
    };
}
const HERO_BELOW_TEXT_FAMILIES = new Set(['hero-left', 'list-recruitment', 'xiaohongshu-note', 'festive-frame']);
function clampHeroIntoBounds(hero, bounds) {
    if (!hero || !bounds)
        return;
    const minLeft = Number(bounds.left ?? 0);
    const minTop = Number(bounds.top ?? 0);
    const maxRight = Number(bounds.right ?? (minLeft + Number(hero.width || 0)));
    const maxBottom = Number(bounds.bottom ?? (minTop + Number(hero.height || 0)));
    const minWidth = Math.max(1, Number((bounds.minWidth ?? Math.round(Number(hero.width || 1) * 0.7)) || 1));
    const minHeight = Math.max(1, Number((bounds.minHeight ?? Math.round(Number(hero.height || 1) * 0.6)) || 1));
    hero.width = Math.max(minWidth, Math.min(Number(hero.width || 1), maxRight - minLeft));
    hero.height = Math.max(minHeight, Math.min(Number(hero.height || 1), maxBottom - minTop));
    hero.left = Math.max(minLeft, Math.min(Number(hero.left || 0), maxRight - Number(hero.width || 0)));
    hero.top = Math.max(minTop, Math.min(Number(hero.top || 0), maxBottom - Number(hero.height || 0)));
    if (hero.record) {
        hero.record.width = Math.round(Number(hero.width || 0));
        hero.record.height = Math.round(Number(hero.height || 0));
    }
}
function getReadablePanelStyle(palette, readability) {
    const prefersDarkPanel = contrastRatio(readability.text, palette.background || '#ffffff') < 5;
    const panelBase = chooseReadableColor(prefersDarkPanel
        ? [
            blendColor('#0f172a', palette.primary || '#2563eb', 0.12),
            '#16202f',
            '#1e293b',
        ]
        : [
            blendColor(palette.surface || '#ffffff', '#ffffff', 0.18),
            blendColor(palette.background || '#f8fafc', '#ffffff', 0.28),
            '#fffaf0',
            '#f8fafc',
        ], [palette.background || '#ffffff', palette.secondary || '#f8fafc'], 2.4);
    const borderColor = blendColor(panelBase, readability.text, prefersDarkPanel ? 0.22 : 0.14);
    return {
        panelBackground: withAlpha(panelBase, prefersDarkPanel ? 'd6' : 'ef'),
        panelBorder: withAlpha(borderColor, prefersDarkPanel ? '96' : '88'),
    };
}
function shouldUseLargeTextPanel(layoutFamily, hints, panelColor) {
    const family = String(layoutFamily || '').trim();
    if (new Set(['grid-product', 'clean-course']).has(family))
        return true;
    if (!String(panelColor || '').trim())
        return false;
    const tone = String(hints?.visualAnalysis?.dominantTone || '').trim();
    const texture = String(hints?.visualAnalysis?.texture || '').trim();
    const needsPanel = Boolean(hints?.visualAnalysis?.needsPanel);
    if (family === 'list-recruitment')
        return needsPanel || tone === 'dark' || texture === 'detailed';
    return needsPanel || tone === 'dark' || texture === 'detailed';
}
function hidePanelSurface(panelWidget) {
    if (!panelWidget)
        return;
    panelWidget.backgroundColor = '#ffffff00';
    panelWidget.borderColor = '#ffffff00';
    panelWidget.borderWidth = 0;
    panelWidget.radius = 0;
    panelWidget.height = 2;
    panelWidget.opacity = 0;
    if (panelWidget.record)
        panelWidget.record.height = 2;
}
function collectProtocolPosterFacts(copyDeck, limit = 4, lineLimit = 18) {
    const factRows = [];
    const pushFact = (value) => {
        const next = compactDeckLine(String(value || '').trim(), lineLimit);
        if (!next)
            return;
        if (factRows.some((item) => isSamePosterText(item, next)))
            return;
        factRows.push(next);
    };
    (Array.isArray(copyDeck?.factCards) ? copyDeck.factCards : []).forEach((item) => {
        pushFact(item?.value || '');
        pushFact(item?.hint || '');
    });
    (Array.isArray(copyDeck?.proofPoints) ? copyDeck.proofPoints : []).forEach((item) => pushFact(item));
    pushFact(copyDeck?.offerLine);
    pushFact(copyDeck?.urgencyLine);
    pushFact(copyDeck?.actionReason);
    pushFact(copyDeck?.trustLine);
    return factRows.slice(0, limit);
}
function styleProtocolFloatingCard(widget, rect, options = {}) {
    if (!widget)
        return;
    applyWidgetRect(widget, rect);
    widget.backgroundColor = options.backgroundColor || '#fffffff0';
    widget.borderColor = options.borderColor || '#ffffff99';
    widget.borderWidth = Number.isFinite(Number(options.borderWidth)) ? Number(options.borderWidth) : 1;
    widget.radius = Math.max(14, Math.round((rect.width || 0) * 0.045));
    widget.color = options.color || '#111827';
    widget.fontSize = Math.max(Number(widget.fontSize || 0), Number(options.fontSize || 16));
    widget.lineHeight = Number(options.lineHeight || 1.16);
    widget.textEffects = [];
    setWidgetAlign(widget, options.align || 'left');
    widget.opacity = 1;
}
function getPrimarySafeZone(hints, fallback = null) {
    const safe = Array.isArray(hints?.safeZones) ? hints.safeZones.find((item) => String(item?.kind || 'safe') === 'safe') : null;
    return safe ? normalizeMultimodalRect(safe, fallback || { x: 0.06, y: 0.08, w: 0.32, h: 0.22 }) : fallback;
}
function getPrimaryAvoidZones(hints, limit = 3) {
    return Array.isArray(hints?.avoidZones)
        ? hints.avoidZones
            .map((item) => normalizeMultimodalRect(item, { x: 0.3, y: 0.3, w: 0.2, h: 0.2 }))
            .slice(0, limit)
        : [];
}
function rectOverlapsNormalizedArea(rectPx, area, pageWidth, pageHeight, threshold = 0.1) {
    if (!rectPx || !area || pageWidth <= 0 || pageHeight <= 0)
        return false;
    const ax = area.x * pageWidth;
    const ay = area.y * pageHeight;
    const aw = area.w * pageWidth;
    const ah = area.h * pageHeight;
    const rx = Number(rectPx.left || 0);
    const ry = Number(rectPx.top || 0);
    const rw = Number(rectPx.width || 0);
    const rh = Number(rectPx.height || 0);
    const ix = Math.max(rx, ax);
    const iy = Math.max(ry, ay);
    const ir = Math.min(rx + rw, ax + aw);
    const ib = Math.min(ry + rh, ay + ah);
    if (ir <= ix || ib <= iy)
        return false;
    const intersection = (ir - ix) * (ib - iy);
    const rectArea = Math.max(1, rw * rh);
    return intersection / rectArea >= threshold;
}
function nudgeWidgetOutOfAvoidZones(widget, avoidZones, pageWidth, pageHeight, options = {}) {
    if (!widget || !Array.isArray(avoidZones) || !avoidZones.length)
        return;
    const preferLeft = options.preferLeft !== false;
    const preferUp = options.preferUp !== false;
    const marginX = Math.round(pageWidth * 0.02);
    const marginY = Math.round(pageHeight * 0.02);
    let tries = 0;
    while (tries < 6 && avoidZones.some((zone) => rectOverlapsNormalizedArea(widget, zone, pageWidth, pageHeight, options.threshold || 0.08))) {
        const overlapping = avoidZones.find((zone) => rectOverlapsNormalizedArea(widget, zone, pageWidth, pageHeight, options.threshold || 0.08));
        if (!overlapping)
            break;
        const zoneLeft = overlapping.x * pageWidth;
        const zoneTop = overlapping.y * pageHeight;
        const zoneRight = zoneLeft + overlapping.w * pageWidth;
        const zoneBottom = zoneTop + overlapping.h * pageHeight;
        const moveLeft = zoneLeft - Number(widget.width || 0) - marginX;
        const moveRight = zoneRight + marginX;
        const moveUp = zoneTop - Number(widget.height || 0) - marginY;
        const moveDown = zoneBottom + marginY;
        if (preferLeft && moveLeft >= marginX) {
            widget.left = moveLeft;
        }
        else if (preferUp && moveUp >= marginY) {
            widget.top = moveUp;
        }
        else if (moveRight + Number(widget.width || 0) <= pageWidth - marginX) {
            widget.left = moveRight;
        }
        else if (moveDown + Number(widget.height || 0) <= pageHeight - marginY) {
            widget.top = moveDown;
        }
        else {
            break;
        }
        if (widget.record) {
            widget.record.width = Math.round(Number(widget.width || 0));
            widget.record.height = Math.round(Number(widget.height || 0));
        }
        tries += 1;
    }
}
function applyProtocolDrivenPosterFinish(widgets, family, pageWidth, pageHeight, options = {}) {
    const hints = getPosterMultimodalHints(options?.result);
    if (!hints)
        return false;
    const palette = options?.palette || {};
    const copyDeck = options?.copyDeck || {};
    const panel = widgets.find((item) => item.name === 'ai_text_panel');
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const badge = widgets.find((item) => item.name === 'ai_badge');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const hero = widgets.find((item) => item.name === 'ai_hero');
    const metaWidgets = widgets.filter((item) => /^ai_meta_/.test(String(item?.name || '')));
    const recruitCards = widgets.filter((item) => /^ai_recruit_card_/.test(String(item?.name || '')));
    const listRows = widgets.filter((item) => /^ai_list_/.test(String(item?.name || '')));
    const chips = widgets.filter((item) => /^ai_chip(_detail)?_/.test(String(item?.name || '')));
    const needsPanel = Boolean(hints.visualAnalysis?.needsPanel);
    const dominantTone = String(hints.visualAnalysis?.dominantTone || '').trim();
    const texture = String(hints.visualAnalysis?.texture || '').trim();
    const cleanPreferred = !needsPanel
        && texture !== 'detailed';
    const lightCleanScene = dominantTone !== 'dark' && texture === 'clean';
    const primarySafeZone = getPrimarySafeZone(hints, { x: 0.06, y: 0.08, w: 0.32, h: 0.24 });
    const avoidZones = getPrimaryAvoidZones(hints, 3);
    const accent = String(palette.primary || '#2563eb').trim() || '#2563eb';
    const strongText = chooseReadableColor([palette.text, '#111827', '#ffffff'], [palette.background || '#ffffff', '#ffffff'], 4.8);
    const mutedText = chooseReadableColor([palette.muted, '#475569', '#e2e8f0', '#ffffff'], [palette.background || '#ffffff', '#0f172a'], 3.6);
    if (family === 'list-recruitment' && (cleanPreferred || lightCleanScene)) {
        if (panel && needsPanel) {
            applyWidgetRect(panel, {
                left: Math.round(pageWidth * 0.055),
                top: Math.round(pageHeight * 0.075),
                width: Math.round(pageWidth * 0.42),
                height: Math.round(pageHeight * 0.78),
            });
            panel.backgroundColor = '#ffffffe4';
            panel.borderColor = '#ffffff99';
            panel.borderWidth = 1;
            panel.radius = Math.max(20, Math.round(pageWidth * 0.02));
            panel.opacity = 1;
        }
        else {
            hidePanelSurface(panel);
        }
        if (hero) {
            hero.fullBleed = true;
            hero.opacity = 1;
        }
        if (badge && !isCollapsedWidget(badge)) {
            const placement = getMultimodalPlacement(hints, 'badge') || {
                x: primarySafeZone?.x || 0.08,
                y: Math.max(0.04, (primarySafeZone?.y || 0.08) - 0.015),
                w: 0.18,
                h: 0.05,
                align: 'center',
            };
            applyPlacementToWidget(badge, placement, pageWidth, pageHeight, { fontScale: 0.34, minFont: 16, maxFont: 24 });
            badge.text = compactDeckLine(String(badge.text || '').replace(/[·•｜|].*$/, ''), 6) || '门店热招';
            badge.backgroundColor = '#1f2937';
            badge.borderColor = '#1f2937';
            badge.borderWidth = 0;
            badge.color = '#ffffff';
            badge.radius = Math.max(16, Math.round(pageWidth * 0.016));
            badge.textEffects = [];
            setWidgetAlign(badge, 'center');
            badge.opacity = 1;
        }
        if (title) {
            const placement = getMultimodalPlacement(hints, 'heroHeadline') || {
                x: primarySafeZone?.x || 0.08,
                y: primarySafeZone?.y || 0.12,
                w: Math.min(0.34, primarySafeZone?.w || 0.34),
                h: 0.12,
                align: 'left',
            };
            applyPlacementToWidget(title, placement, pageWidth, pageHeight, { fontScale: 0.58, minFont: 34, maxFont: 60 });
            title.color = '#fffaf4';
            title.lineHeight = 1.02;
            title.textEffects = [{
                    type: 'shadow',
                    color: 'rgba(0,0,0,0.42)',
                    offsetX: 0,
                    offsetY: 4,
                    blur: 12,
            }];
            setWidgetAlign(title, placement.align || 'left');
            title.opacity = 1;
            nudgeWidgetOutOfAvoidZones(title, avoidZones, pageWidth, pageHeight, { preferLeft: true, preferUp: true, threshold: 0.05 });
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            const placement = getMultimodalPlacement(hints, 'supportLine') || {
                x: primarySafeZone?.x || 0.08,
                y: Math.min(0.42, (primarySafeZone?.y || 0.12) + 0.12),
                w: Math.min(0.34, primarySafeZone?.w || 0.34),
                h: 0.07,
                align: 'left',
            };
            applyPlacementToWidget(slogan, placement, pageWidth, pageHeight, { fontScale: 0.34, minFont: 18, maxFont: 24 });
            slogan.color = '#f3f4f6';
            slogan.backgroundColor = '#ffffff00';
            slogan.borderColor = '#ffffff00';
            slogan.borderWidth = 0;
            slogan.textEffects = [{
                    type: 'shadow',
                    color: 'rgba(0,0,0,0.28)',
                    offsetX: 0,
                    offsetY: 3,
                    blur: 10,
                }];
            slogan.opacity = 1;
            nudgeWidgetOutOfAvoidZones(slogan, avoidZones, pageWidth, pageHeight, { preferLeft: true, preferUp: true, threshold: 0.05 });
        }
        if (body) {
            hideWidgetBlock(body);
        }
        const recruitFacts = collectProtocolPosterFacts(copyDeck, 5, 16)
            .filter((item) => !isPosterEchoText(item, String(title?.text || '').trim()));
        recruitCards.forEach((card, index) => {
            const text = recruitFacts[index] || '';
            if (index > 2 || !text) {
                hideWidgetBlock(card);
                return;
            }
            showWidgetBlock(card);
            card.text = text;
            const cardLeft = Math.round(pageWidth * ((primarySafeZone?.x || 0.06) + 0.01));
            const cardWidth = Math.round(pageWidth * Math.min(0.28, Math.max(0.22, (primarySafeZone?.w || 0.32) - 0.03)));
            styleProtocolFloatingCard(card, {
                left: cardLeft,
                top: Math.round(pageHeight * 0.48) + index * Math.round(pageHeight * 0.073),
                width: cardWidth,
                height: Math.round(pageHeight * 0.05),
            }, {
                backgroundColor: '#fffffff0',
                borderColor: '#ffffffaa',
                color: '#111827',
                fontSize: getTextFont(pageWidth, 18, 15),
            });
            nudgeWidgetOutOfAvoidZones(card, avoidZones, pageWidth, pageHeight, { preferLeft: true, preferUp: false, threshold: 0.08 });
        });
        listRows.forEach((row) => hideWidgetBlock(row));
        if (cta && !isCollapsedWidget(cta)) {
            const placement = getMultimodalPlacement(hints, 'cta') || {
                x: primarySafeZone?.x || 0.08,
                y: 0.9,
                w: Math.min(0.26, primarySafeZone?.w || 0.28),
                h: 0.06,
                align: 'center',
            };
            applyPlacementToWidget(cta, placement, pageWidth, pageHeight, { fontScale: 0.34, minFont: 18, maxFont: 24 });
            cta.backgroundColor = '#111827';
            cta.borderColor = '#111827';
            cta.borderWidth = 0;
            cta.color = '#ffffff';
            cta.radius = Math.max(18, Math.round(pageWidth * 0.018));
            cta.textEffects = [];
            setWidgetAlign(cta, 'center');
            cta.opacity = 1;
            nudgeWidgetOutOfAvoidZones(cta, avoidZones, pageWidth, pageHeight, { preferLeft: true, preferUp: true, threshold: 0.05 });
        }
        metaWidgets.forEach((meta) => hideWidgetBlock(meta));
        return true;
    }
    if (new Set(['premium-offer', 'hero-center']).has(family) && (cleanPreferred || lightCleanScene)) {
        if (hero) {
            hero.fullBleed = true;
            applyWidgetRect(hero, {
                left: 0,
                top: 0,
                width: pageWidth,
                height: pageHeight,
            });
            hero.left = 0;
            hero.top = 0;
            hero.width = pageWidth;
            hero.height = pageHeight;
            if (hero.record) {
                hero.record.width = pageWidth;
                hero.record.height = pageHeight;
            }
            fitAiHeroToPage(hero, pageWidth, pageHeight);
            hero.opacity = 1;
        }
        hidePanelSurface(panel);
        if (badge && !isCollapsedWidget(badge)) {
            const badgePlacement = getMultimodalPlacement(hints, 'badge');
            if (badgePlacement) {
                applyPlacementToWidget(badge, badgePlacement, pageWidth, pageHeight, { fontScale: 0.34, minFont: 16, maxFont: 24 });
            }
            const priceValueText = compactDeckLine(String(priceNum?.text || '').trim(), 14);
            const nextBadge = compactDeckLine(String(copyDeck.badge || badge.text || '').trim(), 6) || '限时优惠';
            badge.text = priceValueText && isPosterEchoText(nextBadge, priceValueText) ? '限时优惠' : nextBadge;
            badge.backgroundColor = accent;
            badge.borderColor = accent;
            badge.borderWidth = 0;
            badge.color = '#111111';
            badge.radius = Math.max(16, Math.round(pageWidth * 0.016));
            badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 21, 17));
            badge.opacity = 1;
        }
        if (title) {
            const placement = getMultimodalPlacement(hints, 'heroHeadline');
            if (placement) {
                applyPlacementToWidget(title, placement, pageWidth, pageHeight, { fontScale: 0.58, minFont: 38, maxFont: 74 });
            }
            title.color = strongText;
            title.lineHeight = 0.98;
            title.textEffects = [{
                    type: 'shadow',
                    color: 'rgba(255,255,255,0.35)',
                    offsetX: 0,
                    offsetY: 4,
                    blur: 12,
                }];
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            const placement = getMultimodalPlacement(hints, 'supportLine');
            if (placement) {
                applyPlacementToWidget(slogan, placement, pageWidth, pageHeight, { fontScale: 0.34, minFont: 18, maxFont: 26 });
            }
            slogan.color = mutedText;
            slogan.backgroundColor = '#ffffff00';
            slogan.borderColor = '#ffffff00';
            slogan.borderWidth = 0;
            slogan.textEffects = [];
        }
        if (body && !isCollapsedWidget(body)) {
            const bodyText = compactDeckLine(copyDeck.offerLine || copyDeck.actionReason || String(body.text || '').trim(), 18);
            const priceValueText = String(priceNum?.text || '').trim();
            if (!bodyText
                || isPosterEchoText(bodyText, String(title?.text || '').trim())
                || (priceValueText && isPosterEchoText(bodyText, priceValueText))
                || isPosterEchoText(bodyText, String(badge?.text || '').trim())) {
                hideWidgetBlock(body);
            }
            else {
                body.text = bodyText;
                const placement = getMultimodalPlacement(hints, 'body') || { x: 0.08, y: 0.37, w: 0.4, h: 0.06, align: 'left' };
                applyPlacementToWidget(body, placement, pageWidth, pageHeight, { fontScale: 0.3, minFont: 16, maxFont: 22 });
                body.backgroundColor = '#ffffffd8';
                body.borderColor = '#ffffffa6';
                body.borderWidth = 1;
                body.radius = Math.max(14, Math.round(pageWidth * 0.014));
                body.color = '#334155';
                body.textEffects = [];
            }
        }
        const priceValue = String(priceNum?.text || '').trim();
        const phraseOfferPrice = Boolean(priceValue) && !isNumericPriceDisplay(priceValue);
        const pricePlacement = getMultimodalPlacement(hints, 'priceBlock') || { x: 0.08, y: 0.58, w: 0.28, h: 0.08, align: 'left' };
        if (priceNum && !isCollapsedWidget(priceNum) && priceValue) {
            if (phraseOfferPrice) {
                if (priceTag)
                    hideWidgetBlock(priceTag);
                showWidgetBlock(priceNum);
                applyPlacementToWidget(priceNum, {
                    x: 0.60,
                    y: 0.86,
                    w: 0.30,
                    h: 0.055,
                    align: 'center',
                }, pageWidth, pageHeight, { fontScale: 0.28, minFont: 26, maxFont: 40 });
                priceNum.backgroundColor = accent;
                priceNum.borderColor = accent;
                priceNum.borderWidth = 0;
                priceNum.radius = Math.max(18, Math.round(pageWidth * 0.018));
                priceNum.color = '#111111';
                priceNum.lineHeight = 1.06;
                priceNum.textEffects = [];
                setWidgetAlign(priceNum, 'center');
            }
            else {
                if (priceTag && !isCollapsedWidget(priceTag)) {
                    showWidgetBlock(priceTag);
                    applyPlacementToWidget(priceTag, {
                        x: pricePlacement.x,
                        y: pricePlacement.y,
                        w: pricePlacement.w,
                        h: Math.max(0.035, pricePlacement.h * 0.34),
                        align: 'center',
                    }, pageWidth, pageHeight, { fontScale: 0.24, minFont: 14, maxFont: 20 });
                    priceTag.backgroundColor = accent;
                    priceTag.borderColor = accent;
                    priceTag.borderWidth = 0;
                    priceTag.color = '#ffffff';
                    priceTag.textEffects = [];
                    setWidgetAlign(priceTag, 'center');
                }
                showWidgetBlock(priceNum);
                applyPlacementToWidget(priceNum, {
                    x: pricePlacement.x,
                    y: Math.min(0.92, pricePlacement.y + Math.max(0.038, pricePlacement.h * 0.3)),
                    w: pricePlacement.w,
                    h: Math.max(0.06, pricePlacement.h * 0.66),
                    align: 'left',
                }, pageWidth, pageHeight, { fontScale: 0.48, minFont: 28, maxFont: 58 });
                priceNum.backgroundColor = '#ffffff00';
                priceNum.borderColor = '#ffffff00';
                priceNum.borderWidth = 0;
                priceNum.color = accent;
                priceNum.textEffects = [];
                setWidgetAlign(priceNum, 'left');
            }
        }
        const floatingFacts = collectProtocolPosterFacts(copyDeck, 3, 14)
            .filter((item) => ![String(title?.text || ''), String(slogan?.text || ''), String(body?.text || ''), priceValue].some((candidate) => isPosterEchoText(item, candidate)));
        chips.forEach((chip, index) => {
            if (phraseOfferPrice) {
                hideWidgetBlock(chip);
                return;
            }
            const text = floatingFacts[index] || '';
            if (index > 1 || !text) {
                hideWidgetBlock(chip);
                return;
            }
            showWidgetBlock(chip);
            chip.text = text;
            styleProtocolFloatingCard(chip, {
                left: Math.round(pageWidth * 0.08) + index * Math.round(pageWidth * 0.22),
                top: Math.round(pageHeight * 0.68),
                width: Math.round(pageWidth * 0.18),
                height: Math.round(pageHeight * 0.04),
            }, {
                backgroundColor: index === 0 ? `${accent}ef` : '#ffffffde',
                borderColor: index === 0 ? `${accent}ef` : '#ffffffaa',
                color: index === 0 ? '#ffffff' : '#111827',
                fontSize: getTextFont(pageWidth, 17, 13),
                align: 'center',
            });
        });
        metaWidgets.forEach((meta, index) => {
            if (phraseOfferPrice) {
                hideWidgetBlock(meta);
                return;
            }
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            const text = compactDeckLine(copyDeck.urgencyLine || copyDeck.trustLine || String(meta.text || '').trim(), 14);
            if (!text || isPosterEchoText(text, String(title?.text || '').trim())) {
                hideWidgetBlock(meta);
                return;
            }
            showWidgetBlock(meta);
            meta.text = text;
            styleProtocolFloatingCard(meta, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.765),
                width: Math.round(pageWidth * 0.28),
                height: Math.round(pageHeight * 0.034),
            }, {
                backgroundColor: '#ffffff00',
                borderColor: '#ffffff00',
                borderWidth: 0,
                color: mutedText,
                fontSize: getTextFont(pageWidth, 15, 12),
            });
        });
        if (cta && !isCollapsedWidget(cta)) {
            const placement = phraseOfferPrice
                ? { x: 0.18, y: 0.86, w: 0.28, h: 0.055, align: 'center' }
                : (getMultimodalPlacement(hints, 'cta') || { x: 0.08, y: 0.84, w: 0.28, h: 0.055, align: 'center' });
            applyPlacementToWidget(cta, placement, pageWidth, pageHeight, { fontScale: 0.34, minFont: 18, maxFont: 24 });
            cta.backgroundColor = accent;
            cta.borderColor = accent;
            cta.borderWidth = 0;
            cta.color = '#111111';
            cta.radius = Math.max(18, Math.round(pageWidth * 0.018));
            cta.textEffects = [];
            setWidgetAlign(cta, 'center');
        }
        if (phraseOfferPrice) {
            const bottomBandTop = Math.round(pageHeight * 0.84);
            const bottomBandHeight = Math.round(pageHeight * 0.095);
            const groupGap = Math.round(pageWidth * 0.02);
            if (title) {
                applyWidgetRect(title, {
                    left: Math.round(pageWidth * 0.08),
                    top: Math.round(pageHeight * 0.17),
                    width: Math.round(pageWidth * 0.42),
                    height: Math.round(pageHeight * 0.12),
                });
            }
            if (badge) {
                applyWidgetRect(badge, {
                    left: Math.round(pageWidth * 0.08),
                    top: Math.round(pageHeight * 0.08),
                    width: Math.round(pageWidth * 0.22),
                    height: Math.round(pageHeight * 0.055),
                });
            }
            if (cta) {
                applyWidgetRect(cta, {
                    left: Math.round(pageWidth * 0.18),
                    top: bottomBandTop,
                    width: Math.round(pageWidth * 0.28),
                    height: bottomBandHeight,
                });
                cta.radius = Math.max(18, Math.round(pageWidth * 0.018));
            }
            if (priceNum && !isCollapsedWidget(priceNum)) {
                applyWidgetRect(priceNum, {
                    left: Math.round(pageWidth * 0.18) + Math.round(pageWidth * 0.28) + groupGap,
                    top: bottomBandTop,
                    width: Math.round(pageWidth * 0.28),
                    height: bottomBandHeight,
                });
                priceNum.radius = Math.max(18, Math.round(pageWidth * 0.018));
                priceNum.fontSize = Math.min(Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 30, 24)), getTextFont(pageWidth, 40, 30));
            }
        }
        return true;
    }
    return false;
}
function isNumericPriceDisplay(text) {
    const value = String(text || '').trim();
    if (!value)
        return false;
    return /(?:￥|¥)\s*\d/.test(value)
        || /(?<!\d)\d{1,4}(?:\.\d{1,2})?\s*元(?:起)?/.test(value)
        || /(?<!\d)\d(?:\.\d)?\s*折/.test(value);
}
function isEffectivelyTransparentColor(color) {
    const safe = String(color || '').trim().toLowerCase();
    if (!safe || safe === 'transparent')
        return true;
    if (/^#[0-9a-f]{8}$/.test(safe) && safe.endsWith('00'))
        return true;
    if (/^rgba?\(/.test(safe) && /,\s*0(?:\.0+)?\s*\)$/.test(safe))
        return true;
    return false;
}
function ensureWidgetTextContrast(widget, backgrounds, minContrast = 4.5, candidates = []) {
    if (!widget)
        return;
    const bgList = (Array.isArray(backgrounds) ? backgrounds : [backgrounds]).filter((item) => item && !isEffectivelyTransparentColor(item));
    if (!bgList.length)
        return;
    widget.color = chooseReadableColor([
        widget.color,
        ...candidates,
        '#ffffff',
        '#f8fafc',
        '#111111',
        '#0f172a',
        '#1f2937',
    ].filter(Boolean), bgList, minContrast);
}
function enforcePosterContrast(widgets, palette, designPlan = {}) {
    const readability = resolveReadablePalette(palette);
    const textStrategy = String(designPlan.textStrategy || '').trim();
    const backgroundTone = String(designPlan.backgroundTone || '').trim();
    const panelWidget = widgets.find((item) => item.name === 'ai_text_panel');
    const panelBg = String(panelWidget?.backgroundColor || '').trim();
    const panelDriven = !isEffectivelyTransparentColor(panelBg)
        && Number(panelWidget?.opacity ?? 1) > 0.02
        && Number(panelWidget?.height || 0) > 6
        && (textStrategy === 'panel' || backgroundTone === 'dark' || Number(panelWidget?.width || 0) > 0);
    widgets.forEach((widget) => {
        if (!widget || widget.type !== 'w-text')
            return;
        const name = String(widget.name || '');
        const ownBg = String(widget.backgroundColor || '').trim();
        const backgrounds = ownBg
            ? [ownBg]
            : panelDriven && /^(ai_title|ai_slogan|ai_body|ai_list_|ai_meta_|ai_chip_)/.test(name)
                ? [panelBg]
                : [];
        if (!backgrounds.length)
            return;
        if (name === 'ai_cta' || name === 'ai_badge' || name === 'ai_price_tag') {
            ensureWidgetTextContrast(widget, backgrounds, 5.1, [readability.ctaText, palette.text, palette.primary]);
            return;
        }
        if (name === 'ai_title' || name === 'ai_price_num') {
            ensureWidgetTextContrast(widget, backgrounds, 6.4, [readability.text, '#ffffff', '#111111']);
            return;
        }
        if (name === 'ai_slogan' || name === 'ai_body' || name.startsWith('ai_list_')) {
            ensureWidgetTextContrast(widget, backgrounds, 5.6, [readability.muted, readability.text, '#e2e8f0', '#334155']);
            return;
        }
        if (name.startsWith('ai_meta_') || name.startsWith('ai_chip_') || name.startsWith('ai_card_') || name.startsWith('ai_recruit_card_')) {
            ensureWidgetTextContrast(widget, backgrounds, 4.9, [readability.text, '#ffffff', '#111111']);
        }
    });
}
function buildPosterTextEffects(role, textColor, palette, options = {}) {
    const textStrategy = String(options.textStrategy || '').trim();
    const backgroundTone = String(options.backgroundTone || '').trim();
    const safeColor = textColor || palette.text || '#111111';
    const darkText = contrastRatio(safeColor, '#111111') < contrastRatio(safeColor, '#ffffff');
    if (role === 'chip' || role === 'body') {
        return [];
    }
    if (textStrategy === 'clean' || textStrategy === 'panel' || backgroundTone === 'light') {
        return [];
    }
    const shouldUseOutline = textStrategy === 'outline' && backgroundTone === 'dark';
    const shouldUseShadow = backgroundTone === 'dark' || backgroundTone === 'mixed';
    if (!shouldUseOutline && !shouldUseShadow) {
        return [];
    }
    return [
        {
            filling: { enable: true, type: 0, color: safeColor },
            stroke: {
                enable: shouldUseOutline && role === 'title',
                width: role === 'title' ? 0.9 : 0.6,
                color: darkText ? '#ffffff66' : '#0b122099',
            },
            shadow: {
                enable: shouldUseShadow,
                offsetX: 0,
                offsetY: role === 'title' ? 2 : 1,
                blur: role === 'title' ? (backgroundTone === 'dark' ? 8 : 5) : 3,
                color: darkText ? '#ffffff24' : (backgroundTone === 'dark' ? '#02061766' : '#02061740'),
            },
            offset: { enable: false, x: 0, y: 0 },
        },
    ];
}
function applyPosterReadabilityEffects(widgets, palette, designPlan) {
    widgets.forEach((widget) => {
        if (!widget || widget.type !== 'w-text')
            return;
        if (widget.name === 'ai_title') {
            widget.textEffects = buildPosterTextEffects('title', widget.color || palette.text || '#111111', palette, designPlan);
        }
        else if (widget.name === 'ai_slogan') {
            widget.textEffects = buildPosterTextEffects('slogan', widget.color || palette.muted || palette.text || '#111111', palette, designPlan);
        }
        else if (widget.name === 'ai_body' || (widget.name && widget.name.startsWith('ai_list_'))) {
            widget.textEffects = buildPosterTextEffects('body', widget.color || palette.text || '#111111', palette, designPlan);
        }
        else if (widget.name && widget.name.startsWith('ai_chip_')) {
            widget.textEffects = buildPosterTextEffects('chip', widget.color || palette.text || '#111111', palette, designPlan);
        }
        else if (widget.name === 'ai_price_num') {
            widget.textEffects = buildPosterTextEffects('title', widget.color || palette.primary || '#111111', palette, designPlan);
        }
    });
    return widgets;
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
    while (fontSize > 30 && estimateTextHeight(text, fontSize, width) > height) {
        fontSize -= 2;
    }
    return fontSize;
}
function splitBodyLines(body, maxLines) {
    const t = getSafeText(body, '');
    const parts = t.split(/[\n｜|/；;•·]/).map((s) => s.trim()).filter(Boolean);
    if (parts.length >= maxLines)
        return parts.slice(0, maxLines);
    const chunk = Math.max(1, Math.ceil(t.length / maxLines));
    const out = [];
    for (let i = 0; i < maxLines; i++) {
        out.push(t.slice(i * chunk, (i + 1) * chunk) || (i === 0 ? '补充说明' : ' '));
    }
    return out;
}
function normalizePosterInfoLine(text, max = 16) {
    const cleaned = String(text || '')
        .replace(/^[·•\-\s]+/, '')
        .replace(/\s+/g, '')
        .trim();
    if (!cleaned)
        return '';
    return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}
function getPosterContentProfile(layoutFamily, density = 'balanced', sizeProfile = 'portrait') {
    const dense = density === 'dense';
    const compact = sizeProfile === 'banner';
    switch (layoutFamily) {
        case 'magazine-cover':
            return { maxBodyLines: 2, maxBodyChars: 18, maxChips: 4, maxCards: 0, maxDetails: 4 };
        case 'premium-offer':
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
        case 'hero-center':
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
        case 'hero-left':
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
        case 'xiaohongshu-note':
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
        case 'festive-frame':
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
        case 'split-editorial':
            return { maxBodyLines: dense ? 2 : 3, maxBodyChars: compact ? 14 : 16, maxChips: 5, maxCards: 0, maxDetails: 4 };
        case 'clean-course':
            return { maxBodyLines: 3, maxBodyChars: compact ? 14 : 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
        case 'list-recruitment':
            return { maxBodyLines: 2, maxBodyChars: 18, maxChips: 4, maxCards: 0, maxDetails: 4 };
        case 'grid-product':
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 3, maxDetails: 5 };
        default:
            return { maxBodyLines: 3, maxBodyChars: 16, maxChips: 5, maxCards: 0, maxDetails: 5 };
    }
}
function derivePosterBadge(input, result) {
    const preferred = compactPosterSnippet(result === null || result === void 0 ? void 0 : result.badge, 10);
    if (preferred)
        return preferred;
    const theme = getSafeText(input.theme, '').replace(/[，,。；;：:\s]/g, '');
    const purpose = getSafeText(input.purpose, '').replace(/[，,。；;：:\s]/g, '');
    const industry = getSafeText(input.industry, '').replace(/[，,。；;：:\s]/g, '');
    const combined = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''}`.trim();
    const slogan = getSafeText(result.slogan, '').replace(/[，,。；;：:]/g, ' ').trim();
    const factText = [input.content, result.body, result.slogan].filter(Boolean).join(' ');
    const timeTag = factText.match(/(?:限时|限量|限前\d+名|今日|本周|周末|新品首发|火热报名)/)?.[0];
    const priceTag = factText.match(/(?:买一送一|第二件半价|立减\s*\d+元?|直降\s*\d+元?|新人专享|包邮|福利加码)/)?.[0];
    const placeTag = factText.match(/(?:到店|到场|线上|线下|直播间|会场|校区|门店)[^\n，。,；;|｜/]{0,6}/)?.[0];
    if (timeTag)
        return timeTag;
    if (priceTag)
        return priceTag;
    if (placeTag)
        return placeTag;
    if (/宠物|萌宠|猫|狗/.test(combined))
        return '萌宠企划';
    if (/招聘|招募/.test(purpose))
        return '岗位开放';
    if (/报名|课程/.test(`${purpose}${industry}`))
        return '报名通道';
    if (/促销|抢购|优惠|上新/.test(`${purpose}${theme}`))
        return '限时上新';
    if (/活动|节日|庆典/.test(`${purpose}${industry}`))
        return '现场企划';
    if (purpose && purpose.length <= 6)
        return purpose;
    if (theme && theme.length <= 6)
        return theme;
    if (slogan && slogan.length <= 8)
        return slogan;
    return '';
}
function compactPosterSnippet(text, max = 14) {
    const cleaned = String(text || '')
        .replace(/^[·•\-\s]+/, '')
        .replace(/^(时间|地点|地址|福利|对象|人群|亮点|卖点|价格|费用|课程|岗位|活动)[：:]/, '')
        .replace(/\s+/g, '')
        .trim();
    if (!cleaned)
        return '';
    return cleaned.length > max ? cleaned.slice(0, max) : cleaned;
}
function collectPosterSegments(texts) {
    const all = [];
    texts.filter(Boolean).forEach((text) => {
        String(text || '')
            .split(/[\n｜|/；;•·,，。]/)
            .map((item) => compactPosterSnippet(item, 18))
            .filter(Boolean)
            .forEach((item) => all.push(item));
    });
    return all;
}
function collectPosterProofPoints(result, maxCount = 5) {
    const lines = Array.isArray(result === null || result === void 0 ? void 0 : result.copyDeck?.proofPoints)
        ? result.copyDeck.proofPoints
        : Array.isArray(result === null || result === void 0 ? void 0 : result.proofPoints)
            ? result.proofPoints
        : [];
    const merged = [];
    lines.forEach((item) => {
        const safe = compactPosterSnippet(item, 16);
        if (!safe)
            return;
        if (merged.some((current) => isSamePosterText(current, safe)))
            return;
        merged.push(safe);
    });
    return merged.slice(0, Math.max(1, maxCount));
}
function compactDeckLine(value, max = 18) {
    return compactPosterSnippet(String(value || '').trim(), max);
}
function normalizeCtaAlternatives(values, maxCount = 4) {
    const source = Array.isArray(values) ? values : String(values || '').split(/[\n｜|/；;,]/);
    const result = [];
    source.forEach((item) => {
        const safe = compactDeckLine(item, 8);
        if (!safe)
            return;
        if (result.includes(safe))
            return;
        result.push(safe);
    });
    return result.slice(0, Math.max(1, maxCount));
}
export function getPosterCopyDeck(input, result) {
    const existing = result === null || result === void 0 ? void 0 : result.copyDeck;
    if (existing && typeof existing === 'object') {
        return {
            heroHeadline: compactDeckLine(existing.heroHeadline || result.title, 18),
            supportLine: compactDeckLine(existing.supportLine || result.slogan || existing.offerLine, 26),
            offerLine: compactDeckLine(existing.offerLine || result.offerLine, 18),
            urgencyLine: compactDeckLine(existing.urgencyLine || result.urgencyLine, 16),
            actionReason: compactDeckLine(existing.actionReason, 18),
            cta: compactDeckLine(existing.cta || result.cta, 8),
            ctaAlternatives: normalizeCtaAlternatives(existing.ctaAlternatives, 4),
            badge: compactDeckLine(existing.badge || result.badge, 6),
            proofPoints: Array.isArray(existing.proofPoints) ? existing.proofPoints.map((item) => compactDeckLine(item, 16)).filter(Boolean).slice(0, 5) : collectPosterProofPoints(result, 5),
            factCards: Array.isArray(existing.factCards) ? existing.factCards
                .map((item) => ({
                label: compactDeckLine(item === null || item === void 0 ? void 0 : item.label, 6),
                value: compactDeckLine(item === null || item === void 0 ? void 0 : item.value, 14),
                hint: compactDeckLine(item === null || item === void 0 ? void 0 : item.hint, 12),
            }))
                .filter((item) => item.value)
                .slice(0, 4) : [],
            priceBlock: existing.priceBlock && (existing.priceBlock.value || existing.priceBlock.note) ? {
                tag: compactDeckLine(existing.priceBlock.tag, 6),
                value: compactDeckLine(existing.priceBlock.value, 12),
                suffix: compactDeckLine(existing.priceBlock.suffix, 4),
                note: compactDeckLine(existing.priceBlock.note, 16),
            } : null,
            audienceLine: compactDeckLine(existing.audienceLine, 18),
            trustLine: compactDeckLine(existing.trustLine, 18),
        };
    }
    const proofPoints = collectPosterProofPoints(result, 5);
    const infoLines = collectPosterSegments([input.content, result.body, result.offerLine, result.urgencyLine]).map((item) => compactDeckLine(item, 16)).filter(Boolean);
    const merged = Array.from(new Set([...proofPoints, ...infoLines].filter(Boolean)));
    return {
        heroHeadline: compactDeckLine(result.title, 18),
        supportLine: compactDeckLine(result.slogan || result.offerLine, 26),
        offerLine: compactDeckLine(result.offerLine || merged[0], 18),
        urgencyLine: compactDeckLine(result.urgencyLine || merged[1], 16),
        actionReason: compactDeckLine(merged[2], 18),
        cta: compactDeckLine(result.cta, 8),
        ctaAlternatives: normalizeCtaAlternatives(result === null || result === void 0 ? void 0 : result.ctaAlternatives, 4),
        badge: compactDeckLine(result.badge, 6),
        proofPoints: merged.slice(0, 5),
        factCards: [],
        priceBlock: null,
        audienceLine: '',
        trustLine: '',
    };
}
function derivePosterInfoChips(input, result, bodyLines, maxCount = 3) {
    const joined = [input.content, result.body, result.slogan, result.title, result.offerLine, result.urgencyLine].filter(Boolean).join(' ');
    const recruitmentMode = String(input.presetKey || '').trim() === 'recruitment' || /招聘|招募/.test(`${input.purpose || ''}${input.industry || ''}${input.theme || ''}`);
    const chips = [];
    const append = (value) => {
        const text = compactPosterSnippet(value, 14);
        if (!text)
            return;
        if (chips.includes(text))
            return;
        if (text === compactPosterSnippet(result.title, 14))
            return;
        chips.push(text);
    };
    collectPosterProofPoints(result, maxCount + 2).forEach((item) => append(item));
    append(result.offerLine || '');
    append(result.urgencyLine || '');
    const matches = [
        joined.match(/(?:\d{1,2}月\d{1,2}日(?:\s*[-~至到]\s*\d{1,2}月\d{1,2}日)?)/),
        joined.match(/(?:\d{1,2}[:：]\d{2}(?:\s*[-~至到]\s*\d{1,2}[:：]\d{2})?)/),
        joined.match(/(?:￥|¥)\s*\d{1,4}(?:\.\d{1,2})?(?:起|元)?/),
        joined.match(/(?<!\d)\d{1,4}(?:\.\d{1,2})?\s*元(?:起)?/),
        joined.match(/(?:到店|到场|线上|线下|直播间|会场|校区|门店|展位|地址)[^\n，。,；;|｜/]{0,10}/),
        joined.match(/(?:买一送一|第二件半价|赠品|礼包|福利|包邮|免预约|新人专享|火热报名|限时优惠|限量发售)/),
        joined.match(/(?:双休|五险一金|包吃住|可兼职|免费试听|小班教学|教练带练|新品首发|人气招牌|当天发货)/),
        joined.match(/(?:适合|针对|面向)[^\n，。,；;|｜/]{0,10}/),
    ];
    matches.forEach((match) => append(match?.[0] || ''));
    if (recruitmentMode) {
        [
            joined.match(/(?:产品经理|设计师|视觉设计师|平面设计师|前端开发|后端开发|运营|策划|销售|招商主管|课程顾问|主播|剪辑师|HR|人事|行政|实习生|管培生|店长|导购|客服)/),
            joined.match(/(?:五险一金|双休|年终奖|弹性办公|带薪年假|节日福利|下午茶|住房补贴|餐补|绩效奖金|导师带教|晋升通道|核心项目)/),
            joined.match(/(?:总部|北京|上海|广州|深圳|杭州|成都|武汉|西安|苏州|南京|厦门|青岛|长沙|线上面试|到场面试|现场直聘)[^\n，。,；;|｜/]{0,8}/),
        ].forEach((match) => append(match?.[0] || ''));
    }
    bodyLines.forEach((line) => append(line));
    collectPosterSegments([input.content, result.body, result.slogan]).forEach((line) => append(line));
    return chips.slice(0, Math.max(1, maxCount));
}
function derivePosterDetailLines(input, result, bodyLines, infoChips, maxCount = 2) {
    const items = [];
    const append = (value) => {
        const text = compactPosterSnippet(value, 16);
        if (!text)
            return;
        if (items.some((item) => isSamePosterText(item, text)))
            return;
        if ((bodyLines || []).some((line) => isSamePosterText(line, text)))
            return;
        if ((infoChips || []).some((chip) => isSamePosterText(chip, text)))
            return;
        items.push(text);
    };
    collectPosterProofPoints(result, maxCount + 3).forEach((line) => append(line));
    append(result.offerLine || '');
    append(result.urgencyLine || '');
    collectPosterSegments([input.content, result.body, result.slogan, result.offerLine, result.urgencyLine]).forEach((line) => append(line));
    const joined = [input.content, result.body, result.slogan, result.title, result.offerLine, result.urgencyLine].filter(Boolean).join(' ');
    [
        joined.match(/(?:限时|限量|限名额|限前\d+|今日|本周|周末|新品首发|人气主推)[^\n，。,；;|｜/]{0,8}/),
        joined.match(/(?:适合|面向|针对)[^\n，。,；;|｜/]{0,10}/),
        joined.match(/(?:到店|到场|线上|线下|直播间|会场|校区|门店|展位|地址)[^\n，。,；;|｜/]{0,10}/),
        joined.match(/(?:五险一金|双休|包吃住|免费试听|小班教学|当天发货|包邮|新人专享)/),
    ].forEach((match) => append(match === null || match === void 0 ? void 0 : match[0]));
    return items.slice(0, Math.max(0, maxCount));
}
function extractPriceInfo(texts) {
    const joined = texts.filter(Boolean).join(' ');
    const direct = joined.match(/(?:￥|¥)\s*\d{1,4}(?:\.\d{1,2})?(?:起|元|\/[^\s，。,；;|｜/]*)?/);
    if (direct)
        return { tag: '限时优惠', value: direct[0].replace(/\s+/g, '') };
    const yuan = joined.match(/(?<!\d)(\d{1,4}(?:\.\d{1,2})?)\s*元(?:起|\/[^\s，。,；;|｜/]*)?/);
    if (yuan)
        return { tag: '限时优惠', value: `￥${yuan[1]}` };
    const reduce = joined.match(/(?:立减|直降|省)\s*\d{1,4}\s*元?/);
    if (reduce)
        return { tag: '活动福利', value: reduce[0].replace(/\s+/g, '') };
    return null;
}
function extractPosterStructuredFacts(input, result) {
    const joined = [input.theme, input.content, result.title, result.slogan, result.body, result.offerLine, result.urgencyLine]
        .filter(Boolean)
        .join(' ');
    const clean = (value, max = 18) => compactPosterSnippet(String(value || ''), max);
    const cityOrSite = joined.match(/(?:北京|上海|深圳|广州|杭州|成都|武汉|苏州|南京|西安|长沙|重庆|厦门|青岛|天津|郑州|合肥|宁波|福州|无锡|东莞|佛山|珠海|中山|南昌|昆明|贵阳|南宁|太原|沈阳|大连|长春|哈尔滨|济南|泉州|温州|嘉兴|南通|常州|扬州|烟台|威海|金华|义乌|望京总部|总部|门店|校区|园区|办公区|远程办公|线上面试)[^\n，。,；;|｜/]{0,10}/);
    const salary = joined.match(/(?:月薪|年薪|薪资|综合薪资)[^\n，。,；;|｜/]{0,14}|(?:\d{1,2}(?:\.\d+)?[kK](?:\s*[-~至到]\s*\d{1,2}(?:\.\d+)?[kK])?)/);
    const jobs = Array.from(new Set((joined.match(/(?:产品经理|产品运营|活动运营|用户运营|新媒体运营|社群运营|内容运营|视觉设计师|平面设计师|UI设计师|交互设计师|品牌设计师|前端开发|后端开发|全栈开发|Java开发|测试工程师|算法工程师|招商主管|招商主管理|销售顾问|招商主管|招商主管|门店店长|课程顾问|讲师|教练|摄影师|剪辑师|主播|客服|人事专员|招聘专员|招商主管|招商主管助理|招商主管经理|招商主管专员|招商主管顾问|招商主管负责人)[^\n，。,；;|｜/]{0,8}/g) || [])
        .map((item) => compactPosterSnippet(item, 10))
        .filter(Boolean)));
    return {
        time: clean(joined.match(/(?:\d{1,2}月\d{1,2}日(?:\s*[-~至到]\s*\d{1,2}月\d{1,2}日)?|\d{1,2}[:：]\d{2}(?:\s*[-~至到]\s*\d{1,2}[:：]\d{2})?|今日|本周|周末|限时|限量|火热报名|新品首发)/)?.[0] || '', 14),
        place: clean((cityOrSite?.[0] || joined.match(/(?:到店|到场|线上|线下|直播间|会场|校区|门店|展位|地址)[^\n，。,；;|｜/]{0,14}/)?.[0] || ''), 18),
        audience: clean(joined.match(/(?:适合|面向|针对)[^\n，。,；;|｜/]{0,14}/)?.[0] || '', 18),
        benefit: clean(joined.match(/(?:五险一金|双休|包吃住|免费试听|小班教学|教练带练|当天发货|包邮|新人专享|福利加码|买一送一|第二件半价)/)?.[0] || '', 16),
        salary: clean(salary?.[0] || '', 16),
        jobs: jobs.slice(0, 3).join(' / '),
        jobList: jobs.slice(0, 3),
    };
}
function deriveRecruitmentFactCards(input, result, highlights, maxCount = 3) {
    const structuredFacts = highlights?.structuredFacts || extractPosterStructuredFacts(input, result);
    const joined = [input.theme, input.content, result.title, result.slogan, result.body]
        .filter(Boolean)
        .join(' ');
    const clean = (value, max = 24) => compactPosterSnippet(String(value || ''), max);
    const jobKeywordPattern = /产品经理|产品运营|活动运营|用户运营|新媒体运营|社群运营|内容运营|视觉设计师|视觉设计|平面设计师|平面设计|UI设计师|UI设计|交互设计师|交互设计|品牌设计师|品牌设计|前端开发|前端工程师|后端开发|后端工程师|全栈开发|Java开发|测试工程师|算法工程师|销售顾问|课程顾问|讲师|教练|摄影师|剪辑师|主播|客服|人事专员|招聘专员/g;
    const compressJobs = (value) => {
        const list = Array.isArray(value)
            ? value
            : String(value || '')
            .split(/[\\/｜|,，\s]+/)
            .map((item) => item.trim())
            .filter(Boolean)
            .map((item) => item
            .replace(/设计师/g, '设计')
            .replace(/开发工程师/g, '开发')
            .replace(/工程师/g, '')
            .replace(/经理/g, '经理'));
        const unique = Array.from(new Set(list));
        if (!unique.length)
            return '';
        const brief = unique.slice(0, 3).join(' / ');
        if (brief.length <= 22)
            return brief;
        if (unique.length >= 3) {
            return `${unique.slice(0, 2).join(' / ')}\n${unique[2]}`;
        }
        return unique.slice(0, 2).join(' / ');
    };
    const clauseJobList = [input.content, result.body, result.slogan]
        .filter(Boolean)
        .flatMap((text) => String(text)
        .split(/[｜|]/)
        .filter((clause) => /经理|设计|开发|运营|顾问|讲师|教练|摄影|剪辑|主播|客服|人事|招聘/.test(clause))
        .flatMap((clause) => Array.from(clause.matchAll(jobKeywordPattern)).map((item) => item[0])));
    const rawJobs = clauseJobList.length
        ? clauseJobList
        : structuredFacts.jobList?.length
        ? structuredFacts.jobList
        : (structuredFacts.jobs || clean(joined.match(/(?:岗位|职位|招聘方向)[:：]?\s*([^\n，。；;|｜]{2,24})/)?.[1] || '', 22));
    const jobValue = compressJobs(rawJobs) || compressJobs(clean(result.body.split('｜').find((item) => /经理|设计|运营|开发|销售|顾问|讲师|教练|主播|摄影|剪辑|客服|人事/.test(item)) || '', 22));
    const timeValue = structuredFacts.time || clean(joined.match(/(?:本周|本月|即刻|今日|明日|4月|5月|春招|社招|校招)[^\n，。；;|｜]{0,10}/)?.[0] || '', 18);
    const placeValue = structuredFacts.place || clean(joined.match(/(?:北京|上海|深圳|广州|杭州|成都|武汉|南京|西安|长沙|重庆|厦门|青岛|望京总部|总部|门店|校区|远程办公|线上面试)[^\n，。；;|｜]{0,12}/)?.[0] || '', 18);
    const benefitValue = structuredFacts.benefit || clean(joined.match(/(?:五险一金|双休|弹性办公|年终奖|节日福利|带薪年假|团队氛围好|晋升空间大|成长空间|核心项目|餐补|房补)[^\n，。；;|｜]{0,10}/)?.[0] || '', 20);
    const salaryValue = structuredFacts.salary || clean(joined.match(/(?:月薪|年薪|薪资|综合薪资)[^\n，。；;|｜]{0,14}|(?:\d{1,2}(?:\.\d+)?[kK](?:\s*[-~至到]\s*\d{1,2}(?:\.\d+)?[kK])?)/)?.[0] || '', 18);
    const proofSegments = collectPosterProofPoints(result, 6)
        .concat(collectPosterSegments([input.content, result.body, result.slogan]))
        .map((item) => clean(item, 20))
        .filter(Boolean)
        .filter((item) => !isSamePosterText(item, result.title) && !isSamePosterText(item, result.slogan));
    const cards = [
        ...proofSegments,
        salaryValue || benefitValue,
        placeValue,
        jobValue,
        timeValue,
    ]
        .map((item) => clean(item, 22))
        .filter(Boolean)
        .filter((item, index, arr) => arr.findIndex((current) => isSamePosterText(current, item)) === index)
        .slice(0, maxCount);
    return cards;
}
function deriveCommerceFactCards(input, result, highlights, maxCount = 3) {
    const joined = [
        input.theme,
        input.content,
        result.title,
        result.slogan,
        result.body,
        result.offerLine,
        result.urgencyLine,
    ]
        .filter(Boolean)
        .join(' ');
    const clean = (value, max = 18) => compactPosterSnippet(String(value || ''), max);
    const cards = [];
    const append = (value) => {
        const text = clean(value, 18);
        if (!text)
            return;
        if (cards.some((item) => isSamePosterText(item, text)))
            return;
        if (isSamePosterText(text, result.title) || isSamePosterText(text, result.slogan))
            return;
        cards.push(text);
    };
    const rawProductTags = Array.from(new Set((joined.match(/洁面|精华|防晒|面膜|乳液|面霜|爽肤水|水乳|次抛|安瓶|喷雾|眼霜|身体乳|香氛|香水|精油|洗发|护发|沐浴|口红|粉底|气垫|套组|礼盒|组合|三件套|耳机|音箱|手表|鞋款|外套|T恤|卫衣/g) || [])
        .map((item) => clean(item, 6))
        .filter(Boolean)));
    const productTags = rawProductTags.filter((item) => !/套组|礼盒|组合|三件套/.test(item) || rawProductTags.length === 1);
    if (productTags.length) {
        append(productTags.slice(0, 3).join(' / '));
    }
    append(result.offerLine || '');
    const audienceMatch = joined.match(/(?:敏感肌|油皮|干皮|混油|通勤党|学生党|旅行党|熬夜肌|春夏|秋冬|日常通勤)/)?.[0] || '';
    [
        joined.match(/(?:满\d{2,4}减\d{1,3}|加购立减|第[二2]件半价|买一送一|赠旅行装|赠试用装|赠好礼|赠品加码|下单立减|包邮|次日发货)/)?.[0] || '',
        joined.match(/(?:适合|针对)[^\d\n，。,；;|｜/]{0,8}/)?.[0] || '',
        audienceMatch ? `${audienceMatch}适用` : '',
    ].forEach((item) => append(item));
    collectPosterProofPoints(result, maxCount + 2).forEach((item) => append(item));
    append(result.urgencyLine || '');
    return cards.slice(0, Math.max(1, maxCount));
}
function deriveFestivalFactCards(input, result, highlights, maxCount = 3) {
    const joined = [
        input.theme,
        input.content,
        result.title,
        result.slogan,
        result.body,
        result.offerLine,
        result.urgencyLine,
    ]
        .filter(Boolean)
        .join(' ');
    const cards = [];
    const append = (value) => {
        const text = compactPosterSnippet(value, 18);
        if (!text)
            return;
        if (cards.some((item) => isSamePosterText(item, text)))
            return;
        cards.push(text);
    };
    append(result.offerLine || '');
    [
        joined.match(/(?:礼盒|团购|定制|企业采购|到店自提|同城配送|节日限定|限定礼盒)/)?.[0] || '',
        joined.match(/(?:满\d{2,4}减\d{1,3}|买一送一|第二件半价|赠礼|赠品|立减\d{1,3})/)?.[0] || '',
        joined.match(/(?:本周|本月|节前|今日|限时|最后一周|最后三天)[^\n，。,；;|｜/]{0,8}/)?.[0] || '',
    ].forEach((item) => append(item));
    collectPosterProofPoints(result, maxCount + 2).forEach((item) => append(item));
    return cards.slice(0, Math.max(1, maxCount));
}
function inferRecruitmentPosterMode(input, result) {
    const scene = `${input.theme || ''} ${input.style || ''} ${input.content || ''} ${input.industry || ''} ${result.title || ''} ${result.slogan || ''}`.toLowerCase();
    if (/复古|怀旧|旧纸|牛皮纸|宣传画|年代感|红蓝|国营|招贴|复刻/.test(scene))
        return 'retro';
    if (/黑金|鎏金|暗黑|夜场|奢感|高级黑|金融|典藏|尊享/.test(scene))
        return 'black-gold';
    if (/红色|热烈|极简|品牌招募|高燃|冲击|醒目|大字报|国潮/.test(scene))
        return 'bold-red';
    if (/公告|通知|告示|张贴|门店|校区|校招|社区|工厂|园区|栏/.test(scene))
        return 'notice';
    return 'notice';
}
function getRecruitmentDecoCopy(mode) {
    switch (mode) {
        case 'retro':
            return { main: '招', side: '热招中', footer: '扫码投递' };
        case 'bold-red':
            return { main: '聘', side: 'JOIN US', footer: '立即了解' };
        case 'black-gold':
        return { main: '招\n聘', side: '高能岗位', footer: '扫码预约' };
        default:
            return { main: '招募', side: '岗位信息', footer: '扫码咨询' };
    }
}
function chooseRecruitmentLayoutFamily({ input, result, sizeProfile, currentFamily, isWide }) {
    const scene = `${input.theme || ''} ${input.style || ''} ${input.content || ''} ${input.industry || ''} ${input.purpose || ''} ${result.title || ''} ${result.slogan || ''}`;
    const structuredInfoCount = (String(input.content || '').match(/[|｜\n；;、]/g) || []).length;
    const denseSignal = String(input.content || '').length > 70
        || structuredInfoCount >= 4
        || /薪资|待遇|福利|地点|地址|时间|流程|投递|面试|岗位|职责|要求|双休|五险一金/.test(scene);
    const editorialSignal = /黑金|高级|轻奢|封面|大片|lookbook|campaign|极简|品牌招募/i.test(scene);
    const posterSignal = /复古|招贴|旧纸|怀旧|海报感|宣传画|大字报|红色|高燃|冲击/.test(scene);
    const noticeSignal = /公告|通知|告示|张贴|门店|校区|校招|社区|工厂|园区|栏|直聘/.test(scene);
    if (isWide)
        return denseSignal ? 'split-editorial' : 'hero-left';
    if (noticeSignal && denseSignal)
        return 'list-recruitment';
    if (editorialSignal && !denseSignal)
        return sizeProfile === 'square' ? 'hero-center' : 'magazine-cover';
    if (posterSignal && !denseSignal)
        return 'hero-left';
    if (denseSignal)
        return currentFamily === 'clean-course' ? 'clean-course' : 'list-recruitment';
    return sizeProfile === 'square' ? 'hero-center' : 'hero-left';
}
function uniquePosterItems(values, maxCount = 6, maxLen = 18) {
    const result = [];
    (Array.isArray(values) ? values : [values]).forEach((item) => {
        const safe = compactDeckLine(item, maxLen);
        if (!safe)
            return;
        if (result.some((existing) => isSamePosterText(existing, safe)))
            return;
        result.push(safe);
    });
    return result.slice(0, Math.max(1, maxCount));
}
function choosePreferredCta(deck, matcher, fallback = '') {
    const candidates = [deck.cta, ...(Array.isArray(deck.ctaAlternatives) ? deck.ctaAlternatives : [])]
        .map((item) => compactDeckLine(item, 8))
        .filter(Boolean);
    return candidates.find((item) => matcher.test(String(item || ''))) || candidates[0] || fallback;
}
function inferRecruitmentCompText(deck, input, result) {
    const pool = [
        ...(String(input?.content || '').split(/[，,、；;｜|]/)),
        ...(Array.isArray(deck.factCards) ? deck.factCards.flatMap((item) => [item?.value, item?.hint]) : []),
        deck.offerLine,
        deck.actionReason,
        deck.trustLine,
        ...(Array.isArray(deck.proofPoints) ? deck.proofPoints : []),
        input?.content,
        result?.body,
    ];
    const hit = pool.find((item) => !isWeakGeneratedPosterLine(item) && /薪资|底薪|高薪|面议|提成|奖金|补贴|社保|五险|公积金|餐补|住宿|年假|双休|排班|培训|晋升/.test(String(item || '')));
    return compactDeckLine(hit || (/咖啡|轻食|餐饮|门店/.test(`${input?.theme || ''} ${input?.content || ''}`) ? '薪资面议 / 提成激励' : '薪资福利可谈 / 支持沟通'), 16);
}
function isWeakGeneratedPosterLine(text) {
    return /^(本周|周末|今日|限时|到手|到手更划算|主卖点一眼能懂|适用场景更好代入|快速判断是否适合|学习结果先说人话|适合人群容易对号|课次节奏更有把握|岗位方向直接说清|成长空间更有想象|城市场景别再含糊|福利制度给足判断|招牌风味先勾食欲|焦点主题|重点推荐|人才|机会窗口已打开|试听与名额同步释放|现在下单更值)$/.test(String(text || '').trim());
}
function deriveInputContentFacts(input, maxLen = 18, maxCount = 8) {
    return uniquePosterItems(String(input?.content || '')
        .split(/[，,、；;｜|]/)
        .map((item) => compactDeckLine(item, maxLen))
        .filter(Boolean), maxCount, maxLen)
        .filter((item) => !isWeakGeneratedPosterLine(item));
}
function inferPosterScene(input, result) {
    const text = `${input?.industry || ''} ${input?.purpose || ''} ${input?.theme || ''} ${input?.content || ''}`;
    let inputScene = '';
    if (/招聘|招募/.test(text))
        inputScene = 'recruitment';
    else if (/课程|教育|培训|报名/.test(text))
        inputScene = 'course';
    else if (/节日|礼盒|端午|中秋|春节|庆典/.test(text))
        inputScene = 'festival';
    else if (/活动|发布|展会|露营|音乐节|市集/.test(text))
        inputScene = 'event';
    else if (/餐饮|美食|咖啡|茶饮|轻食/.test(text))
        inputScene = 'food';
    else if (/健身|运动|瑜伽|训练/.test(text))
        inputScene = 'fitness';
    else if (/电商|零售|商品|上新|促销|抢购/.test(text))
        inputScene = 'commerce';
    const scene = String(result?.posterIntent?.scene || result?.copyDeck?.posterIntent?.scene || '').trim();
    if (inputScene && scene && scene !== inputScene) {
        return inputScene;
    }
    if (scene)
        return scene;
    if (inputScene)
        return inputScene;
    return 'generic';
}
function buildFamilySpecializedCopyDeck(deck, family, input, result) {
    const next = {
        ...deck,
        ctaAlternatives: Array.isArray(deck.ctaAlternatives) ? [...deck.ctaAlternatives] : [],
        proofPoints: Array.isArray(deck.proofPoints) ? [...deck.proofPoints] : [],
        factCards: Array.isArray(deck.factCards) ? deck.factCards.map((item) => ({ ...item })) : [],
        priceBlock: deck.priceBlock ? { ...deck.priceBlock } : null,
    };
    const scene = inferPosterScene(input, result);
    const contentPattern = String(result?.designPlan?.contentPattern || '').trim();
    const themeHeadline = compactDeckLine(String(input?.theme || '').trim(), 18);
    const contentFacts = deriveInputContentFacts(input, 18, 8);
    if ((scene === 'event' || scene === 'festival') && /就想吃|闭眼入|到手更划算|马上开抢|抢到就是赚/.test(String(next.heroHeadline || ''))) {
        next.heroHeadline = themeHeadline || compactDeckLine(String(next.heroHeadline || '').replace(/现在就想吃|现在闭眼入|到手更划算|马上开抢|抢到就是赚/g, ''), 18);
    }
    if (scene === 'food' && themeHeadline) {
        if (/现在就想吃|闭眼入|马上开抢|抢到就是赚/.test(String(next.heroHeadline || ''))) {
            next.heroHeadline = themeHeadline;
        }
        else if (!isSamePosterText(next.heroHeadline, input?.theme)) {
            next.heroHeadline = compactDeckLine(next.heroHeadline || themeHeadline, 18) || themeHeadline;
        }
    }
    const fallbackContentFacts = uniquePosterItems(String(input?.content || '')
        .split(/[，,、；;｜|]/)
        .map((item) => compactDeckLine(item, 18))
        .filter(Boolean), 6, 18);
    const weakCopyLine = (text) => /^(本周|周末|今日|限时|到手|到手更划算|主卖点一眼能懂|适用场景更好代入|快速判断是否适合)$/.test(String(text || '').trim());
    const mergedFactValues = uniquePosterItems([
        ...next.factCards.flatMap((item) => [item?.value, item?.hint]),
        next.offerLine,
        next.urgencyLine,
        next.actionReason,
        ...next.proofPoints,
    ], 8, 18);
    if (family === 'premium-offer') {
        if (scene === 'commerce') {
            next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '限时大促';
            next.supportLine = compactDeckLine(contentFacts.slice(0, 3).join(' / ') || next.supportLine || next.offerLine, 26);
            next.offerLine = compactDeckLine(contentFacts.find((item) => /半价|满减|折|赠/.test(String(item || ''))) || next.offerLine, 18);
            next.urgencyLine = compactDeckLine(contentFacts.find((item) => /今晚|截止|限时|今日/.test(String(item || ''))) || next.urgencyLine || '今晚截止', 16);
            next.actionReason = compactDeckLine(contentFacts.find((item) => /囤货|省心|组合装|家庭/.test(String(item || ''))) || next.actionReason || '家庭囤货更省心', 16);
            next.trustLine = compactDeckLine(contentFacts.find((item) => /家清|洗衣|厨房|清洁|家庭|组合/.test(String(item || ''))) || next.trustLine || '家庭清洁一步配齐', 18);
            next.badge = compactDeckLine(next.offerLine || next.badge || '限时特惠', 6) || '限时特惠';
        }
        if (!next.priceBlock) {
            const pseudoPrice = compactDeckLine(contentFacts.find((item) => /半价|满减|立减|买一送一|第[二2]件|加购/.test(String(item || ''))) || next.offerLine, 12);
            if (pseudoPrice) {
                next.priceBlock = {
                    tag: compactDeckLine(next.badge || '活动价', 6) || '活动价',
                    value: pseudoPrice,
                    suffix: '',
                    note: compactDeckLine(next.urgencyLine || next.actionReason, 16),
                };
            }
        }
        next.badge = compactDeckLine(next.badge || next.priceBlock?.tag || '限时礼遇', 6) || '限时礼遇';
        next.cta = choosePreferredCta(next, /抢|领|下单|购买|加购|锁定/, '立即抢购');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, '领取优惠', '锁定名额'], 4, 8);
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, next.trustLine, ...contentFacts, ...next.proofPoints], 6, 16)
            .filter((item) => !isWeakGeneratedPosterLine(item));
        next.factCards = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, next.trustLine, ...contentFacts, ...mergedFactValues], 4, 18)
            .filter((item) => !isWeakGeneratedPosterLine(item)).map((value, index) => ({
            label: ['亮点', '权益', '说明', '适合'][index] || '亮点',
            value,
            hint: compactDeckLine(index === 0 ? next.urgencyLine : index === 1 ? next.actionReason : next.trustLine, 12),
        }));
    }
    else if (family === 'grid-product') {
        next.badge = compactDeckLine(next.badge || '重点信息', 6) || '重点信息';
        next.cta = choosePreferredCta(next, /了解|咨询|选购|下单|查看/, next.cta || '查看详情');
        next.factCards = uniquePosterItems([
            ...next.factCards.map((item) => [item?.label, item?.value].filter(Boolean).join(' · ')),
            ...mergedFactValues,
        ], 4, 18).map((value, index) => ({
            label: ['卖点', '适合', '福利', '说明'][index] || '信息',
            value,
            hint: compactDeckLine(index === 0 ? next.offerLine : next.actionReason, 12),
        }));
        next.proofPoints = uniquePosterItems([...next.proofPoints, next.offerLine, next.urgencyLine], 4, 16);
    }
    else if (family === 'list-recruitment') {
        const rolePool = contentFacts.filter((item) => /招聘|店长|咖啡师|运营|助理|岗位|门店|人才|应届/.test(String(item || '')));
        const roleValue = compactDeckLine(rolePool.slice(0, 3).join(' / ') || rolePool[0] || next.factCards.find((item) => /岗位|方向|职位/.test(String(item?.label || '')))?.value || next.audienceLine || next.heroHeadline, 18);
        const compValue = inferRecruitmentCompText(next, input, result);
        const audienceValue = compactDeckLine(contentFacts.find((item) => /应届|有经验|门店人才|兼职|全职|候选/.test(String(item || ''))) || next.audienceLine || next.trustLine || next.actionReason, 16);
        const growthValue = compactDeckLine(contentFacts.find((item) => /培训|晋升|成长|排班|带教/.test(String(item || ''))) || next.actionReason || '带教培训 / 晋升路径清晰', 16);
        next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '招聘中';
        next.supportLine = compactDeckLine(rolePool.slice(0, 3).join(' / ') || next.supportLine || roleValue, 26);
        next.offerLine = compactDeckLine(contentFacts.find((item) => /底薪|提成|薪|排班|培训|晋升|社保|补贴/.test(String(item || ''))) || next.offerLine || compValue, 18);
        next.urgencyLine = compactDeckLine(contentFacts.find((item) => /应届|有经验|立即|优先|尽快/.test(String(item || ''))) || next.urgencyLine || '尽快投递优先沟通', 16);
        next.actionReason = growthValue;
        next.trustLine = compactDeckLine(contentFacts.find((item) => /门店直招|总部|直营|培训|晋升/.test(String(item || ''))) || next.trustLine || '门店直招 / 支持培训带教', 18);
        next.badge = compactDeckLine(!isWeakGeneratedPosterLine(next.badge) ? next.badge : '门店直招', 6) || '门店直招';
        next.cta = choosePreferredCta(next, /投递|简历/, '') || choosePreferredCta(next, /报名|沟通|面谈/, '') || '立即投递';
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, '咨询岗位', '预约面谈'], 4, 8);
        next.factCards = [
            roleValue ? { label: '岗位', value: roleValue, hint: compactDeckLine(next.supportLine, 12) } : null,
            compValue ? { label: /薪|底薪|提成|面议/.test(compValue) ? '薪酬' : '待遇', value: compValue, hint: compactDeckLine(next.actionReason || next.cta, 12) } : null,
            audienceValue ? { label: '对象', value: audienceValue, hint: compactDeckLine(next.trustLine || next.offerLine, 12) } : null,
            growthValue ? { label: '成长', value: growthValue, hint: compactDeckLine(next.cta, 12) } : null,
        ].filter(Boolean);
        next.proofPoints = uniquePosterItems([next.offerLine, compValue, next.actionReason, next.trustLine, next.urgencyLine, ...contentFacts, ...next.proofPoints], 6, 16)
            .filter((item) => !isWeakGeneratedPosterLine(item));
    }
    else if (family === 'clean-course') {
        next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '课程报名';
        const courseFactPool = uniquePosterItems([
            ...contentFacts,
            ...(Array.isArray(next.factCards) ? next.factCards.flatMap((item) => [item?.value, item?.hint]) : []),
            ...(Array.isArray(next.proofPoints) ? next.proofPoints : []),
        ], 8, 18).filter((item) => !isWeakGeneratedPosterLine(item));
        next.supportLine = compactDeckLine(courseFactPool.slice(0, 3).join(' / ') || next.supportLine || next.offerLine, 26);
        next.offerLine = compactDeckLine(contentFacts.find((item) => /赠|试听|诊断|陪跑|训练营|作业/.test(String(item || ''))) || next.offerLine, 18);
        next.actionReason = compactDeckLine(contentFacts.find((item) => /零基础|副业|起号|转化/.test(String(item || ''))) || next.audienceLine || next.actionReason, 18);
        next.urgencyLine = compactDeckLine(contentFacts.find((item) => /前100名|限量|今晚|本周/.test(String(item || ''))) || next.urgencyLine || '限量开放名额', 16);
        next.trustLine = compactDeckLine(courseFactPool.find((item) => /诊断|直播|剪辑|脚本|转化|陪跑/.test(String(item || ''))) || next.trustLine || '作业点评 / 直播答疑同步安排', 18);
        next.badge = compactDeckLine(!isWeakGeneratedPosterLine(next.badge) ? next.badge : '限量招募', 6) || '限量招募';
        next.cta = choosePreferredCta(next, /报名|试听|领取|咨询|开课/, '立即报名');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, '领取课表', '预约试听'], 4, 8);
        next.factCards = uniquePosterItems([
            next.actionReason,
            next.offerLine,
            next.trustLine,
            ...courseFactPool,
            ...next.proofPoints,
        ], 4, 18).map((value, index) => ({
            label: ['适合谁', '你能学', '报名礼', '加餐项'][index] || '信息',
            value,
            hint: compactDeckLine(index === 0 ? next.supportLine : index === 2 ? next.urgencyLine || next.cta : next.trustLine || next.cta, 12),
        }));
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, next.trustLine, ...courseFactPool, ...next.proofPoints], 6, 16)
            .filter((item) => !isWeakGeneratedPosterLine(item));
    }
    else if (family === 'festive-frame') {
        next.badge = compactDeckLine(!/^(本周|周末|今日|限时|到手)$/.test(String(next.badge || '').trim()) ? next.badge : '', 6) || '限时礼遇';
        if (weakCopyLine(next.offerLine) && fallbackContentFacts[0])
            next.offerLine = fallbackContentFacts[0];
        if (weakCopyLine(next.urgencyLine))
            next.urgencyLine = fallbackContentFacts.find((item) => /预定|赠|限时|团购|配送/.test(String(item || ''))) || fallbackContentFacts[1] || next.urgencyLine;
        if (weakCopyLine(next.actionReason))
            next.actionReason = fallbackContentFacts.find((item) => /礼盒|限定|包装|团购|配送/.test(String(item || ''))) || fallbackContentFacts[2] || next.actionReason;
        next.cta = choosePreferredCta(next, /抢|预定|锁定|领取|参与/, next.cta || '立即锁定');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, '抢先预定', '领取礼遇'], 4, 8);
        next.proofPoints = uniquePosterItems([next.offerLine, next.urgencyLine, next.actionReason, ...fallbackContentFacts, ...next.proofPoints], 5, 16)
            .filter((item) => !weakCopyLine(item));
        next.factCards = uniquePosterItems([
            next.offerLine,
            next.urgencyLine,
            next.actionReason,
            ...fallbackContentFacts,
            ...next.factCards.map((item) => item?.value || item?.hint),
        ], 3, 18).filter((item) => !weakCopyLine(item)).map((value, index) => ({
            label: ['礼遇', '提醒', '补充'][index] || '亮点',
            value,
            hint: compactDeckLine(index === 0 ? next.urgencyLine : next.actionReason, 12),
        }));
    }
    else if (family === 'hero-center') {
        const heroFactValues = uniquePosterItems([
            next.offerLine,
            next.actionReason,
            next.urgencyLine,
            ...next.factCards.map((item) => item?.value || item?.hint),
            ...next.proofPoints,
        ], 5, 18);
        next.badge = compactDeckLine(!isWeakGeneratedPosterLine(next.badge) ? next.badge : (scene === 'food' ? '今日主推' : scene === 'commerce' ? '限时精选' : scene === 'festival' ? '节日限定' : '本期推荐'), 6) || '本期推荐';
        next.cta = choosePreferredCta(next, scene === 'food' ? /到店|下单|预定|尝鲜/ : /抢|报名|领取|了解|锁定|参与/, next.cta || '立即了解');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, scene === 'food' ? '到店尝鲜' : '查看详情', scene === 'course' ? '领取课表' : '立即咨询'], 4, 8);
        if (scene === 'food') {
            next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '餐饮上新';
            next.supportLine = compactDeckLine(contentFacts.slice(0, 3).join('、') || next.supportLine || heroFactValues[0], 26);
            next.offerLine = compactDeckLine(contentFacts.find((item) => /低卡|高蛋白|风味|招牌/.test(String(item || ''))) || next.offerLine, 18);
            next.actionReason = compactDeckLine(contentFacts.find((item) => /健身|上班族|通勤|午餐/.test(String(item || ''))) || next.actionReason, 16);
            next.urgencyLine = compactDeckLine(contentFacts.find((item) => /29\\.9|尝鲜|限时/.test(String(item || ''))) || next.urgencyLine, 16);
        }
        next.supportLine = compactDeckLine(next.supportLine || heroFactValues[0], 26);
        if (scene === 'food' || scene === 'commerce' || contentPattern === 'immersive-hero') {
            next.factCards = uniquePosterItems([...contentFacts, ...heroFactValues], 3, 18).filter((item) => !isWeakGeneratedPosterLine(item)).slice(0, 3).map((value, index) => ({
                label: ['主卖点', '现在冲', '补充'][index] || '亮点',
                value,
                hint: compactDeckLine(index === 0 ? next.urgencyLine : next.actionReason, 12),
            }));
        }
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, ...contentFacts, ...next.proofPoints], 5, 16)
            .filter((item) => !isWeakGeneratedPosterLine(item));
    }
    else if (family === 'magazine-cover') {
        const isEventCover = scene === 'event' || /活动|露营|音乐节|市集|快闪|派对|演出|出游|周末/.test(`${input?.theme || ''} ${input?.purpose || ''} ${input?.content || ''}`);
        next.badge = compactDeckLine(!/^(本周|周末|今日|限时|到手)$/.test(String(next.badge || '').trim()) ? next.badge : '', 6) || (scene === 'fitness' ? '本周开练' : isEventCover ? '限时开票' : '焦点主题');
        if (scene === 'food') {
            next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '餐饮上新';
            next.badge = compactDeckLine(!isWeakGeneratedPosterLine(next.badge) ? next.badge : '轻负担上新', 6) || '轻负担上新';
            next.supportLine = compactDeckLine(contentFacts.slice(0, 3).join('、') || next.supportLine || next.offerLine, 26);
            next.offerLine = compactDeckLine(contentFacts.find((item) => /低卡|高蛋白|招牌|风味/.test(String(item || ''))) || next.offerLine, 18);
            next.actionReason = compactDeckLine(contentFacts.find((item) => /健身|上班族|通勤|午餐/.test(String(item || ''))) || next.actionReason, 16);
            next.urgencyLine = compactDeckLine(contentFacts.find((item) => /29\\.9|尝鲜|限时/.test(String(item || ''))) || next.urgencyLine, 16);
        }
        if (scene === 'commerce') {
            next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '电商促销';
            next.badge = compactDeckLine(!isWeakGeneratedPosterLine(next.badge) ? next.badge : (compactDeckLine(next.priceBlock?.value || next.offerLine, 6) || '限时特惠'), 6) || '限时特惠';
            next.supportLine = compactDeckLine(contentFacts.slice(0, 2).join(' / ') || next.supportLine || next.offerLine, 26);
            next.offerLine = compactDeckLine(contentFacts.find((item) => /半价|满减|折|赠/.test(String(item || ''))) || next.offerLine, 18);
            next.urgencyLine = compactDeckLine(contentFacts.find((item) => /今晚|截止|限时|今日/.test(String(item || ''))) || next.urgencyLine || '限时下单', 16);
            next.actionReason = compactDeckLine(contentFacts.find((item) => /囤货|省心|组合装|家庭/.test(String(item || ''))) || next.actionReason, 16);
            next.trustLine = compactDeckLine(contentFacts.find((item) => /洗衣|厨房|清洁|组合/.test(String(item || ''))) || next.trustLine, 16);
        }
        if (scene === 'recruitment') {
            next.heroHeadline = themeHeadline || compactDeckLine(next.heroHeadline, 18) || '招聘中';
            next.badge = compactDeckLine(!isWeakGeneratedPosterLine(next.badge) ? next.badge : '门店直招', 6) || '门店直招';
            next.supportLine = compactDeckLine(contentFacts.slice(0, 2).join(' / ') || next.supportLine || next.offerLine, 26);
            next.offerLine = compactDeckLine(contentFacts.find((item) => /底薪|提成|培训|排班/.test(String(item || ''))) || next.offerLine, 18);
            next.actionReason = compactDeckLine(contentFacts.find((item) => /应届|有经验|门店人才/.test(String(item || ''))) || next.actionReason, 16);
            next.urgencyLine = compactDeckLine(contentFacts.find((item) => /优先|尽快|招聘/.test(String(item || ''))) || next.urgencyLine || '尽快投递优先沟通', 16);
        }
        next.cta = choosePreferredCta(next, isEventCover ? /抢票|购票|组队|报名|参与|加入|预约/ : /立即|报名|参与|加入|查看|解锁/, next.cta || (isEventCover ? '马上组队' : '立即查看'));
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, isEventCover ? '抢先锁票' : '解锁亮点', isEventCover ? '立即赴约' : '马上加入'], 4, 8);
        next.supportLine = compactDeckLine(next.supportLine || next.offerLine || next.actionReason || next.trustLine, isEventCover ? 28 : 24);
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, ...contentFacts, ...next.proofPoints], isEventCover ? 5 : 4, 16)
            .filter((item) => !isWeakGeneratedPosterLine(item));
        const coverFactValues = uniquePosterItems([
            next.offerLine,
            next.urgencyLine,
            next.actionReason,
            next.trustLine,
            ...contentFacts,
            ...next.factCards.map((item) => item?.value || item?.hint),
        ], isEventCover ? 4 : 3, 18).filter((value) => !/^(周末|今日|本周|限时|活动|露营生活节|立即了解|封面推荐|焦点主题)$/.test(String(value || '').trim()) && !isWeakGeneratedPosterLine(value));
        next.factCards = coverFactValues.slice(0, 2).map((value, index) => ({
            label: isEventCover ? ['亮点', '权益'][index] || '焦点' : ['焦点', '亮点'][index] || '焦点',
            value,
            hint: compactDeckLine(next.supportLine, 12),
        }));
    }
    else if (family === 'hero-left') {
        next.badge = compactDeckLine(next.badge || (scene === 'course' ? '实战陪跑' : scene === 'event' ? '活动导览' : '重点推荐'), 6) || '重点推荐';
        next.cta = choosePreferredCta(next, /报名|查看|预约|参与|咨询|了解/, next.cta || '立即了解');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, scene === 'course' ? '预约试听' : '查看详情', '马上咨询'], 4, 8);
        next.supportLine = compactDeckLine(next.supportLine || next.offerLine || next.actionReason, 26);
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.audienceLine, ...next.proofPoints], 5, 16);
        if (scene === 'course' || scene === 'event') {
            next.factCards = uniquePosterItems([
                next.audienceLine,
                next.actionReason,
                next.urgencyLine,
                ...next.factCards.map((item) => item?.value || item?.hint),
            ], 3, 18).map((value, index) => ({
                label: ['适合', '收获', '提醒'][index] || '信息',
                value,
                hint: compactDeckLine(index === 0 ? next.supportLine : next.cta, 12),
            }));
        }
    }
    else if (family === 'split-editorial') {
        next.badge = compactDeckLine(next.badge || '信息整理', 6) || '信息整理';
        next.cta = choosePreferredCta(next, /查看|报名|预约|领取|咨询|参与/, next.cta || '查看详情');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, '获取详情', '马上咨询'], 4, 8);
        next.supportLine = compactDeckLine(next.supportLine || next.offerLine || next.actionReason, 24);
        next.factCards = uniquePosterItems([
            ...next.factCards.map((item) => [item?.label, item?.value].filter(Boolean).join(' · ')),
            next.offerLine,
            next.actionReason,
            next.urgencyLine,
            next.audienceLine,
        ], 4, 18).map((value, index) => ({
            label: ['信息一', '信息二', '信息三', '信息四'][index] || '信息',
            value,
            hint: compactDeckLine(index < 2 ? next.supportLine : next.cta, 12),
        }));
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, next.trustLine, ...next.proofPoints], 5, 16);
    }
    else if (family === 'xiaohongshu-note') {
        next.badge = compactDeckLine(next.badge || (scene === 'food' ? '探店实拍' : scene === 'course' ? '亲测整理' : '精选分享'), 6) || '精选分享';
        next.cta = choosePreferredCta(next, /收藏|查看|抄作业|了解|报名|冲|保存/, next.cta || '先收藏');
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives, '抄作业去', '点开看看', '顺手保存'], 4, 8);
        next.supportLine = compactDeckLine(next.supportLine || next.offerLine || next.actionReason, 24);
        if (scene === 'social' || isExplicitNotePosterContext(`${input?.theme || ''} ${input?.purpose || ''} ${input?.content || ''}`)) {
            next.heroHeadline = compactDeckLine(next.heroHeadline || input?.theme || '这篇先收藏', 18);
            next.supportLine = compactDeckLine(next.supportLine || next.offerLine || next.actionReason, 24);
        }
        next.factCards = uniquePosterItems([
            next.offerLine,
            next.actionReason,
            next.audienceLine,
            next.urgencyLine,
            ...next.proofPoints,
        ], 3, 18).filter((value) => !/立即抢购|马上下单|锁定名额/.test(String(value || '').trim())).map((value, index) => ({
            label: ['亮点', '适合', '提醒'][index] || '重点',
            value,
            hint: compactDeckLine(index === 0 ? next.supportLine : next.cta, 12),
        }));
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, next.urgencyLine, ...next.proofPoints], 5, 16)
            .filter((item) => !/抢购|下单|立减|加购/.test(String(item || '')));
    }
    else if (family === 'hero-center' || family === 'magazine-cover' || family === 'hero-left' || family === 'split-editorial' || family === 'xiaohongshu-note') {
        next.ctaAlternatives = uniquePosterItems([next.cta, ...next.ctaAlternatives], 4, 8);
        next.proofPoints = uniquePosterItems([next.offerLine, next.actionReason, ...next.proofPoints], 5, 16);
    }
    return next;
}
function derivePosterHighlights(input, result, profile = {}) {
    let copyDeck = getPosterCopyDeck(input, result);
    const maxBodyLines = Number.isFinite(profile.maxBodyLines) ? Number(profile.maxBodyLines) : 3;
    const maxBodyChars = Number.isFinite(profile.maxBodyChars) ? Number(profile.maxBodyChars) : 16;
    const splitLimit = Math.max(1, maxBodyLines || 1);
    const proofPoints = collectPosterProofPoints(result, Math.max(splitLimit + 2, 5));
    const clauses = splitBodyLines(result.body, splitLimit)
        .map((item) => String(item || '').replace(/^[·•\-\s]+/, '').trim())
        .filter(Boolean);
    const fallbackPool = splitBodyLines(getSafeText(input.content, ''), splitLimit)
        .map((item) => String(item || '').replace(/^[·•\-\s]+/, '').trim())
        .filter(Boolean);
    const bodySeed = proofPoints.length ? proofPoints : (clauses.length ? clauses : fallbackPool);
    const bodyLines = bodySeed
        .slice(0, maxBodyLines)
        .map((line) => normalizePosterInfoLine(line, maxBodyChars))
        .filter(Boolean);
    const badge = copyDeck.badge || derivePosterBadge(input, result);
    const price = copyDeck.priceBlock ? { tag: copyDeck.priceBlock.tag || '限时礼遇', value: `${copyDeck.priceBlock.value || ''}${copyDeck.priceBlock.suffix || ''}`.trim() } : extractPriceInfo([input.content, result.offerLine, result.slogan, result.body, result.title]);
    const infoChips = derivePosterInfoChips(input, result, bodyLines, Number.isFinite(profile.maxChips) ? Number(profile.maxChips) : 3);
    const detailLines = [copyDeck.actionReason, copyDeck.audienceLine, copyDeck.trustLine]
        .filter(Boolean)
        .concat(derivePosterDetailLines(input, result, bodyLines, infoChips, Number.isFinite(profile.maxDetails) ? Number(profile.maxDetails) : 2))
        .filter((line, index, arr) => arr.findIndex((item) => isSamePosterText(item, line)) === index)
        .slice(0, Math.max(0, Number.isFinite(profile.maxDetails) ? Number(profile.maxDetails) : 2));
    const normalizedBodyLines = bodyLines;
    return {
        badge,
        bodyLines: normalizedBodyLines,
        infoChips,
        detailLines,
        priceTag: price ? price.tag : '',
        priceValue: price ? price.value : '',
        structuredFacts: extractPosterStructuredFacts(input, result),
        copyDeck,
    };
}
function widgetTextBottom(w) {
    if (!w)
        return 0;
    const base = estimateTextHeight(String(w.text || ''), Number(w.fontSize) || 20, Number(w.width) || 400);
    const est = w.name === 'ai_badge'
        ? Math.max(base, Math.round((Number(w.fontSize) || 14) * 2.05))
        : base;
    return w.top + est;
}
/** 按主标题→副标题→正文→列表→CTA 顺序压实垂直间距，避免估算误差导致叠字 */
function reflowAiTextStack(widgets, pageHeight) {
    const gap = Math.round(pageHeight * 0.026);
    let cursor = null;
    const apply = (w) => {
        if (!w || isCollapsedWidget(w))
            return;
        let est = estimateTextHeight(String(w.text || ''), Number(w.fontSize) || 20, Number(w.width) || 400);
        if (w.name === 'ai_badge')
            est = Math.max(est, Math.round((Number(w.fontSize) || 14) * 2.05));
        if (w.name === 'ai_title')
            est = Math.ceil(est * 1.08);
        else if (w.name === 'ai_slogan')
            est = Math.ceil(est * 1.06);
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
    apply(widgets.find((x) => x.name === 'ai_badge'));
    apply(widgets.find((x) => x.name === 'ai_title'));
    apply(widgets.find((x) => x.name === 'ai_slogan'));
    apply(widgets.find((x) => x.name === 'ai_body'));
    widgets
        .filter((x) => x.name && x.name.startsWith('ai_list_') && !isCollapsedWidget(x))
        .sort((a, b) => (Number(String(a.name).split('_').pop()) || 0) - (Number(String(b.name).split('_').pop()) || 0))
        .forEach((w) => apply(w));
    const cta = widgets.find((x) => x.name === 'ai_cta');
    if (cta && !isCollapsedWidget(cta)) {
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
    const badge = widgets.find((x) => x.name === 'ai_badge');
    if (badge && !isCollapsedWidget(badge))
        max = Math.max(max, widgetTextBottom(badge));
    ['ai_title', 'ai_slogan', 'ai_body'].forEach((name) => {
        const w = widgets.find((x) => x.name === name);
        if (w && !isCollapsedWidget(w))
            max = Math.max(max, widgetTextBottom(w));
    });
    widgets.filter((x) => x.name && x.name.startsWith('ai_list_') && !isCollapsedWidget(x)).forEach((w) => {
        max = Math.max(max, widgetTextBottom(w));
    });
    const cta = widgets.find((x) => x.name === 'ai_cta');
    if (cta && !isCollapsedWidget(cta))
        max = Math.max(max, widgetTextBottom(cta));
    return max;
}
function getTextWidget(widgets, name) {
    return widgets.find((item) => item.name === name);
}
function resizeTextWidget(widget, nextFontSize) {
    if (!widget)
        return false;
    const current = Number(widget.fontSize) || 0;
    const target = Math.max(10, Math.round(nextFontSize));
    if (!current || target >= current)
        return false;
    widget.fontSize = target;
    if (widget.name === 'ai_title') {
        widget.lineHeight = getLineHeight(target);
    }
    else if (widget.name === 'ai_slogan' || widget.name === 'ai_body') {
        widget.lineHeight = getLineHeight(target);
    }
    else if (widget.name === 'ai_badge') {
        widget.lineHeight = 1.35;
        const nextHeight = Math.round(target * 2.05);
        const nextWidth = Math.round(Math.max((Number(widget.width) || 0) * 0.82, target * Math.max(String(widget.text || '').length, 4) + 28));
        widget.height = nextHeight;
        widget.width = nextWidth;
        if (widget.record) {
            widget.record.height = nextHeight;
            widget.record.width = nextWidth;
        }
    }
    return true;
}
function hideTextWidget(widget) {
    if (!widget)
        return false;
    const alreadyHidden = !String(widget.text || '').trim();
    widget.text = ' ';
    widget.height = 2;
    widget.backgroundColor = '';
    widget.borderColor = '';
    widget.textEffects = [];
    if (widget.record)
        widget.record.height = 2;
    return !alreadyHidden;
}
function hideWidgetBlock(widget) {
    if (!widget)
        return false;
    widget.hidden = true;
    widget.text = ' ';
    widget.height = 2;
    widget.width = Math.min(Number(widget.width) || 2, 2);
    widget.backgroundColor = '';
    widget.borderColor = '';
    widget.textEffects = [];
    if (widget.record) {
        widget.record.height = 2;
        widget.record.width = Math.min(Number(widget.record.width) || 2, 2);
    }
    return true;
}
function showWidgetBlock(widget) {
    if (!widget)
        return false;
    widget.hidden = false;
    if (!Number.isFinite(Number(widget.opacity)) || Number(widget.opacity) <= 0)
        widget.opacity = 1;
    const nextWidth = Math.max(Number(widget.width || 0), Number(widget.record?.width || 0), 24);
    const nextHeight = Math.max(Number(widget.height || 0), Number(widget.record?.height || 0), 24);
    widget.width = nextWidth;
    widget.height = nextHeight;
    if (!widget.record)
        widget.record = {};
    widget.record.width = nextWidth;
    widget.record.height = nextHeight;
    return true;
}
function removeDuplicatePosterNamedWidgets(widgets) {
    if (!Array.isArray(widgets) || widgets.length <= 1)
        return widgets;
    const bestIndexByName = new Map();
    const getWidgetScore = (widget, index) => {
        const text = String(widget?.text || '').trim();
        const area = Math.max(0, Number(widget?.width || 0)) * Math.max(0, Number(widget?.height || 0));
        const visibleScore = widget?.hidden ? 0 : 1000000;
        const textScore = text && text !== '' ? 100000 : 0;
        return visibleScore + textScore + area + index * 0.001;
    };
    widgets.forEach((widget, index) => {
        const name = String(widget?.name || '').trim();
        if (!name || !name.startsWith('ai_'))
            return;
        const currentBest = bestIndexByName.get(name);
        if (currentBest == null) {
            bestIndexByName.set(name, index);
            return;
        }
        const bestScore = getWidgetScore(widgets[currentBest], currentBest);
        const nextScore = getWidgetScore(widget, index);
        if (nextScore >= bestScore) {
            bestIndexByName.set(name, index);
        }
    });
    for (let index = widgets.length - 1; index >= 0; index -= 1) {
        const name = String(widgets[index]?.name || '').trim();
        if (!name || !name.startsWith('ai_'))
            continue;
        if (bestIndexByName.get(name) !== index) {
            widgets.splice(index, 1);
        }
    }
    return widgets;
}
function cleanupWeakPosterWidgets(widgets, family, pageWidth, pageHeight) {
    if (!Array.isArray(widgets) || !widgets.length)
        return widgets;
    widgets.forEach((widget) => {
        const name = String(widget?.name || '').trim();
        const text = String(widget?.text || '').trim();
        if (/^ai_recruit_card_/.test(name) && (!text || text.length < 4 || /^(人才|岗位|福利|适合|加码|地点)$/.test(text))) {
            hideWidgetBlock(widget);
        }
        if (family === 'clean-course' && name === 'ai_body') {
            const tooNarrow = Number(widget?.width || 0) > 0 && Number(widget?.width || 0) <= 32;
            const outOfPage = Number(widget?.top || 0) >= pageHeight - Math.round(pageHeight * 0.08);
            if (!text || tooNarrow || outOfPage) {
                hideWidgetBlock(widget);
            }
        }
    });
    return widgets;
}
function pruneDuplicatePosterWidgets(widgets, options = {}) {
    const family = String(options.family || '').trim();
    const contentPattern = String(options.designPlan?.contentPattern || '').trim();
    const title = getTextWidget(widgets, 'ai_title');
    const slogan = getTextWidget(widgets, 'ai_slogan');
    const body = getTextWidget(widgets, 'ai_body');
    const badge = getTextWidget(widgets, 'ai_badge');
    const priceTag = getTextWidget(widgets, 'ai_price_tag');
    const priceNum = getTextWidget(widgets, 'ai_price_num');
    const titleText = String(title?.text || '').trim();
    const sloganText = String(slogan?.text || '').trim();
    const bodyText = String(body?.text || '').trim();
    const priceText = `${String(priceTag?.text || '').trim()} ${String(priceNum?.text || '').trim()}`.trim();
    const structuredCommerceMode = ['hero-center', 'premium-offer'].includes(family)
        && ['info-cards', 'price-first', 'immersive-hero'].includes(contentPattern)
        && Boolean(priceText);
    const chipCompareTexts = structuredCommerceMode ? [titleText, sloganText] : [titleText, sloganText, bodyText];
    const metaCompareTexts = structuredCommerceMode ? [titleText, sloganText] : [titleText, sloganText, bodyText];
    if (!sloganText || isSamePosterText(titleText, sloganText)) {
        hideWidgetBlock(slogan);
    }
    if (!bodyText || isSamePosterText(bodyText, titleText) || isSamePosterText(bodyText, sloganText)) {
        hideWidgetBlock(body);
    }
    if (!String(badge?.text || '').trim() || isSamePosterText(badge?.text, titleText) || isSamePosterText(badge?.text, sloganText)) {
        hideWidgetBlock(badge);
    }
    widgets
        .filter((item) => item.name && item.name.startsWith('ai_chip_'))
        .forEach((chip) => {
        const chipText = String(chip.text || '').trim();
        if (!chipText || chipCompareTexts.some((candidate) => isSamePosterText(chipText, candidate))) {
            hideWidgetBlock(chip);
        }
    });
    widgets
        .filter((item) => item.name && item.name.startsWith('ai_list_'))
        .forEach((line) => {
        const lineText = String(line.text || '').replace(/^[·•\-\s]+/, '').trim();
        if (!lineText || isSamePosterText(lineText, titleText) || isSamePosterText(lineText, sloganText)) {
            hideWidgetBlock(line);
        }
    });
    widgets
        .filter((item) => item.name && item.name.startsWith('ai_meta_'))
        .forEach((line) => {
        const lineText = String(line.text || '').replace(/^[·•\-\s]+/, '').trim();
        if (!lineText || metaCompareTexts.some((candidate) => isSamePosterText(lineText, candidate))) {
            hideWidgetBlock(line);
        }
    });
    if (!String(priceTag?.text || '').trim())
        hideWidgetBlock(priceTag);
    if (!String(priceNum?.text || '').trim())
        hideWidgetBlock(priceNum);
    return widgets;
}
function collapseEmptyPosterWidgets(widgets, family) {
    widgets.forEach((widget) => {
        const name = String(widget?.name || '');
        if (!name)
            return;
        if (name.startsWith('ai_chip_') || name.startsWith('ai_meta_') || name === 'ai_price_tag' || name === 'ai_price_num') {
            if (!String(widget.text || '').trim())
                hideWidgetBlock(widget);
        }
    });
    return widgets;
}
function isPosterEchoText(a, b) {
    const left = canonicalPosterText(a);
    const right = canonicalPosterText(b);
    if (!left || !right)
        return false;
    if (left === right)
        return true;
    if (left.length >= 5 && right.includes(left))
        return true;
    if (right.length >= 5 && left.includes(right))
        return true;
    return false;
}
function dedupeWidgetGroupByText(widgets, selector, keepCount = Infinity, compareTexts = []) {
    const group = widgets
        .filter((item) => selector(String(item?.name || ''), item) && !isCollapsedWidget(item));
    const seen = [];
    group.forEach((widget, index) => {
        const text = String(widget?.text || '').replace(/^[·•\-\s]+/, '').trim();
        if (!text) {
            hideWidgetBlock(widget);
            return;
        }
        if (index >= keepCount) {
            hideWidgetBlock(widget);
            return;
        }
        if (compareTexts.some((candidate) => isPosterEchoText(text, candidate))) {
            hideWidgetBlock(widget);
            return;
        }
        if (seen.some((candidate) => isPosterEchoText(text, candidate))) {
            hideWidgetBlock(widget);
            return;
        }
        seen.push(text);
    });
}
function applyPosterDensityGuard(widgets, family, pageWidth, pageHeight, options = {}) {
    const designPlan = options.designPlan || {};
    const contentPattern = String(designPlan.contentPattern || '').trim();
    const title = getTextWidget(widgets, 'ai_title');
    const slogan = getTextWidget(widgets, 'ai_slogan');
    const body = getTextWidget(widgets, 'ai_body');
    const cta = getTextWidget(widgets, 'ai_cta');
    const priceTag = getTextWidget(widgets, 'ai_price_tag');
    const priceNum = getTextWidget(widgets, 'ai_price_num');
    const titleText = String(title?.text || '').trim();
    const sloganText = String(slogan?.text || '').trim();
    const bodyText = String(body?.text || '').trim();
    const hasPrice = !isCollapsedWidget(priceTag) && !isCollapsedWidget(priceNum);
    const chips = widgets.filter((item) => String(item?.name || '').startsWith('ai_chip_'));
    const metas = widgets.filter((item) => String(item?.name || '').startsWith('ai_meta_'));
    const festiveCards = widgets.filter((item) => String(item?.name || '').startsWith('ai_festive_card_'));
    const listRows = widgets.filter((item) => String(item?.name || '').startsWith('ai_list_'));
    const recruitCards = widgets.filter((item) => String(item?.name || '').startsWith('ai_recruit_card_'));
    const heroCenterCommerceMode = family === 'hero-center' && hasPrice && contentPattern === 'info-cards';
    const compareTexts = heroCenterCommerceMode ? [titleText, sloganText].filter(Boolean) : [titleText, sloganText, bodyText].filter(Boolean);
    dedupeWidgetGroupByText(widgets, (name) => name.startsWith('ai_chip_'), heroCenterCommerceMode ? 3 : family === 'premium-offer' ? 1 : 2, compareTexts);
    dedupeWidgetGroupByText(widgets, (name) => name.startsWith('ai_meta_'), heroCenterCommerceMode ? 1 : family === 'premium-offer' || family === 'festive-frame' ? 0 : 2, compareTexts);
    dedupeWidgetGroupByText(widgets, (name) => name.startsWith('ai_festive_card_'), hasPrice ? 0 : 2, compareTexts);
    dedupeWidgetGroupByText(widgets, (name) => name.startsWith('ai_list_'), 2, compareTexts);
    dedupeWidgetGroupByText(widgets, (name) => name.startsWith('ai_recruit_card_'), 2, compareTexts);
    if (family === 'festive-frame') {
        metas.forEach((widget) => hideWidgetBlock(widget));
        if (bodyText && (isPosterEchoText(bodyText, sloganText) || isPosterEchoText(bodyText, titleText) || bodyText.length > 18)) {
            hideWidgetBlock(body);
        }
        if (sloganText && (isPosterEchoText(sloganText, titleText) || sloganText.length > 18)) {
            slogan.fontSize = Math.min(Number(slogan.fontSize || 22), getTextFont(pageWidth, 20, 16));
        }
        if (hasPrice) {
            festiveCards.forEach((widget) => hideWidgetBlock(widget));
            chips.forEach((widget) => hideWidgetBlock(widget));
        }
        else {
            chips.slice(1).forEach((widget) => hideWidgetBlock(widget));
            festiveCards.slice(2).forEach((widget) => hideWidgetBlock(widget));
        }
    }
    if (family === 'premium-offer') {
        if (bodyText && (hasPrice || bodyText.length > 16 || isPosterEchoText(bodyText, titleText) || isPosterEchoText(bodyText, sloganText))) {
            hideWidgetBlock(body);
        }
        if (sloganText && (isPosterEchoText(sloganText, titleText) || sloganText.length > 22)) {
            slogan.fontSize = Math.min(Number(slogan.fontSize || 20), getTextFont(pageWidth, 19, 16));
        }
        metas.forEach((widget) => hideWidgetBlock(widget));
        chips.slice(1).forEach((widget) => hideWidgetBlock(widget));
    }
    if (heroCenterCommerceMode) {
        if (sloganText && (isPosterEchoText(sloganText, titleText) || sloganText.length > 20)) {
            hideWidgetBlock(slogan);
        }
        if (bodyText && bodyText.length > 24) {
            body.fontSize = Math.min(Number(body.fontSize || 22), getTextFont(pageWidth, 20, 16));
        }
        metas.slice(1).forEach((widget) => hideWidgetBlock(widget));
        chips.slice(3).forEach((widget) => hideWidgetBlock(widget));
    }
    if (family === 'list-recruitment') {
        metas.forEach((widget) => hideWidgetBlock(widget));
        listRows.slice(2).forEach((widget) => hideWidgetBlock(widget));
        recruitCards.slice(2).forEach((widget) => hideWidgetBlock(widget));
        const visibleRecruitTexts = recruitCards
            .filter((widget) => !isCollapsedWidget(widget))
            .map((widget) => String(widget.text || '').trim())
            .filter(Boolean);
        listRows.forEach((widget) => {
            const text = String(widget.text || '').replace(/^[·•]\s*/, '').trim();
            if (!text)
                return;
            if (visibleRecruitTexts.some((candidate) => isPosterEchoText(text, candidate))) {
                hideWidgetBlock(widget);
            }
        });
        if (sloganText && sloganText.length > 20) {
            slogan.fontSize = Math.min(Number(slogan.fontSize || 24), getTextFont(pageWidth, 22, 18));
        }
        if (titleText && titleText.length > 12 && title) {
            title.fontSize = Math.min(Number(title.fontSize || 0) || getTextFont(pageWidth, 48, 34), getTextFont(pageWidth, 48, 34));
            title.lineHeight = 1.02;
        }
        if (titleText && titleText.length > 14 && slogan && !isCollapsedWidget(slogan)) {
            const compactSlogan = compactDeckLine(String(slogan.text || '').trim(), 18);
            if (!compactSlogan || isPosterEchoText(compactSlogan, titleText)) {
                hideWidgetBlock(slogan);
            }
            else {
                slogan.text = compactSlogan;
            }
        }
    }
    const safeBottom = Math.round(pageHeight * 0.08);
    compressHeaderStack(widgets, {
        height: pageHeight,
        safeBottom,
        fallbackLimit: Math.round(pageHeight * (family === 'list-recruitment' ? 0.74 : family === 'premium-offer' ? 0.64 : 0.68)),
        family,
        isWide: pageWidth > pageHeight,
    });
    const finalBottom = aiTextStackBottom(widgets);
    const emergencyLimit = Math.round(pageHeight * (family === 'list-recruitment' ? 0.8 : 0.74));
    if (finalBottom > emergencyLimit) {
        if (!isCollapsedWidget(body))
            hideWidgetBlock(body);
        else if (!isCollapsedWidget(slogan) && family !== 'list-recruitment')
            hideWidgetBlock(slogan);
        chips.forEach((widget, index) => {
            if (index > 0)
                hideWidgetBlock(widget);
        });
        metas.forEach((widget) => hideWidgetBlock(widget));
        compressHeaderStack(widgets, {
            height: pageHeight,
            safeBottom,
            fallbackLimit: Math.round(pageHeight * 0.66),
            family,
            isWide: pageWidth > pageHeight,
        });
    }
    if (cta && !isCollapsedWidget(cta)) {
        const minTop = Math.min(Number(cta.top || 0), Math.round(pageHeight * 0.9));
        cta.top = Math.max(minTop, aiTextStackBottom(widgets) + Math.round(pageHeight * 0.02));
        if (Number.isFinite(Number(cta.aiMinTop)))
            cta.top = Math.max(Number(cta.top || 0), Math.round(Number(cta.aiMinTop)));
        if (Number.isFinite(Number(cta.aiMaxTop)))
            cta.top = Math.min(Number(cta.top || 0), Math.round(Number(cta.aiMaxTop)));
    }
    enforceLockedCtaAndCommerceSpacing(widgets, family, pageWidth, pageHeight);
}
function deriveAdaptiveFinishProfile(family, options = {}, heroMockupLike = false) {
    const input = options.input || {};
    const designPlan = options.designPlan || {};
    const sceneText = `${input.theme || ''} ${input.purpose || ''} ${input.industry || ''} ${input.style || ''} ${designPlan.contentPattern || ''}`.trim();
    const density = String(designPlan.density || 'balanced');
    const textStrategy = String(designPlan.textStrategy || '');
    const backgroundTone = String(designPlan.backgroundTone || '');
    const contentPattern = String(designPlan.contentPattern || '');
    const celebratoryScene = /活动|节日|年会|周年庆|庆典|盛典|发布会|峰会/.test(sceneText);
    const illustrativeScene = /手绘|涂鸦|插画|漫画|贴纸|年轻|活力/.test(sceneText);
    const warmCommerceScene = /餐饮|美食|咖啡|茶饮|食品|新品|爆汁|香酥|电商|零售|上新/.test(sceneText);
    const denseInfo = density === 'dense' || /price-first|info-cards|list-info/.test(contentPattern);
    const airyMode = !heroMockupLike
        && !denseInfo
        && backgroundTone !== 'dark'
        && textStrategy !== 'panel'
        && (celebratoryScene || illustrativeScene)
        && (family === 'hero-center' || family === 'magazine-cover' || family === 'festive-frame' || family === 'clean-course');
    const warmEditorialPanel = !heroMockupLike
        && !denseInfo
        && backgroundTone !== 'dark'
        && warmCommerceScene
        && (family === 'hero-center' || family === 'hero-left' || family === 'magazine-cover');
    return {
        sceneText,
        denseInfo,
        airyMode,
        warmEditorialPanel,
        lightPanelBg: warmEditorialPanel ? '#fff8f3ee' : '#fff8f0d9',
        lightPanelBorder: warmEditorialPanel ? '#f1dcc8dc' : '#fff2e2c8',
        lightTitle: '#2f190f',
        lightSub: '#6a4636',
        lightMetaBg: warmEditorialPanel ? '#fffaf6f0' : '#fffaf4e4',
        lightMetaBorder: warmEditorialPanel ? '#e8ccb0d8' : '#f0d8c2d0',
    };
}
function refinePosterTemplateFinish(widgets, family, pageWidth, pageHeight, options = {}) {
    const palette = options?.palette || {};
    const panelWidget = widgets.find((item) => item.name === 'ai_text_panel');
    const titleWidget = widgets.find((item) => item.name === 'ai_title');
    const sloganWidget = widgets.find((item) => item.name === 'ai_slogan');
    const bodyWidget = widgets.find((item) => item.name === 'ai_body');
    const ctaWidget = widgets.find((item) => item.name === 'ai_cta');
    const badgeWidget = widgets.find((item) => item.name === 'ai_badge');
    const qrWidget = widgets.find((item) => item.name === 'ai_qrcode');
    const heroWidget = widgets.find((item) => item.name === 'ai_hero');
    const focusHeroWidget = widgets.find((item) => item.name === 'ai_hero_focus');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const courseBar = widgets.find((item) => item.name === 'ai_course_bar');
    const chipWidgets = widgets.filter((item) => String(item?.name || '').startsWith('ai_chip_') && !isCollapsedWidget(item));
    const metaWidgets = widgets.filter((item) => String(item?.name || '').startsWith('ai_meta_') && !isCollapsedWidget(item));
    const festiveCardWidgets = widgets.filter((item) => String(item?.name || '').startsWith('ai_festive_card_') && !isCollapsedWidget(item));
    const priceAccent = String(priceTag?.backgroundColor || badgeWidget?.backgroundColor || priceNum?.color || '#9a3412').trim() || '#9a3412';
    const warmCardBg = '#fff8f0f2';
    const warmCardBorder = '#fff4dfc4';
    const strongDarkText = '#2f190f';
    const mutedDarkText = '#6a4636';
    const heroMockupLike = Boolean(focusHeroWidget) || isPosterMockAsset(heroWidget?.imgUrl || '');
    const heroCardWidget = focusHeroWidget || (heroMockupLike ? heroWidget : null);
    const finishProfile = deriveAdaptiveFinishProfile(family, options, heroMockupLike);
    const finishSceneText = `${options?.input?.theme || ''} ${options?.input?.purpose || ''} ${options?.input?.industry || ''} ${options?.input?.style || ''} ${options?.designPlan?.contentPattern || ''}`.trim();
    const lightFoodPoster = isLightFoodPosterContext(finishSceneText, options?.designPlan || {}, options?.palette || {});
    const airyEventFrame = family === 'festive-frame'
        && /活动|音乐节|露营|市集|节日|庆典/.test(finishSceneText)
        && !/price-first|list-info/.test(String(options?.designPlan?.contentPattern || ''));
    const compactOfferMode = family === 'premium-offer'
        && !heroMockupLike
        && pageWidth <= pageHeight * 1.08;
    const detailChipWidgets = widgets.filter((item) => /^ai_chip_detail_/.test(String(item?.name || '')));
    const visibleInfoWidgets = [
        badgeWidget,
        titleWidget,
        sloganWidget,
        bodyWidget,
        ...widgets.filter((item) => {
            const name = String(item?.name || '');
            return (name.startsWith('ai_meta_') || name.startsWith('ai_list_') || name.startsWith('ai_chip_')) && !isCollapsedWidget(item);
        }),
    ].filter((item) => item && !isCollapsedWidget(item));
    const topAnchor = visibleInfoWidgets.length
        ? Math.min(...visibleInfoWidgets.map((item) => Number(item.top || 0)))
        : 0;
    const contentBottom = [
        ...visibleInfoWidgets.map((item) => widgetTextBottom(item)),
        ctaWidget && !isCollapsedWidget(ctaWidget) ? Number(ctaWidget.top || 0) + Math.max(Number(ctaWidget.height || 0), Math.round(Number(ctaWidget.fontSize || 18) * 2)) : 0,
    ].reduce((max, value) => Math.max(max, Number(value || 0)), 0);
    const stackGap = Math.round(pageHeight * (pageWidth > pageHeight ? 0.018 : 0.024));
    if (ctaWidget && !isCollapsedWidget(ctaWidget) && ctaWidget.top < contentBottom - Math.max(Number(ctaWidget.height || 0), Math.round(Number(ctaWidget.fontSize || 18) * 2))) {
        ctaWidget.top = Math.round(contentBottom + stackGap);
    }
    if (panelWidget && (family === 'festive-frame' || family === 'hero-center' || family === 'magazine-cover' || family === 'clean-course' || family === 'premium-offer')) {
        const minPanelHeight = family === 'clean-course' && pageWidth > pageHeight
            ? Math.round(pageHeight * 0.42)
            : Math.round(pageHeight * (family === 'premium-offer' ? 0.22 : 0.18));
        const maxPanelHeight = Math.round(pageHeight * (family === 'magazine-cover' ? 0.38 : pageWidth > pageHeight ? 0.72 : 0.46));
        const desiredHeight = Math.max(minPanelHeight, Math.min(maxPanelHeight, Math.round((Math.max(contentBottom, topAnchor) - topAnchor) + stackGap * 2.2)));
        applyWidgetRect(panelWidget, {
            top: Math.max(0, topAnchor - Math.round(stackGap * 0.9)),
            height: desiredHeight,
        });
    }
    if (family === 'magazine-cover' && panelWidget) {
        const lightEditorial = finishProfile.airyMode;
        detailChipWidgets.forEach((chip) => hideWidgetBlock(chip));
        if (!widgets.find((item) => item.name === 'ai_deco_issue')) {
            widgets.push(makeTextWidget('ai_deco_issue', {
                text: 'SPECIAL ISSUE',
                left: Math.round(pageWidth * 0.62),
                top: Math.round(pageHeight * 0.094),
                width: Math.round(pageWidth * 0.2),
                height: Math.round(pageHeight * 0.026),
                fontSize: getTextFont(pageWidth, 13, 11),
                lineHeight: 1.1,
                color: '#2e1d14cc',
                textAlign: 'right',
                textAlignLast: 'right',
            }));
        }
        if (!widgets.find((item) => item.name === 'ai_deco_volume')) {
            widgets.push(makeTextWidget('ai_deco_volume', {
                text: 'VOL. 04',
                left: Math.round(pageWidth * 0.75),
                top: Math.round(pageHeight * 0.84),
                width: Math.round(pageWidth * 0.12),
                height: Math.round(pageHeight * 0.024),
                fontSize: getTextFont(pageWidth, 12, 10),
                lineHeight: 1.1,
                color: '#f4efe8b8',
                textAlign: 'right',
                textAlignLast: 'right',
            }));
        }
        if (heroMockupLike && heroCardWidget) {
            applyHeroCardRect(heroCardWidget, {
                left: Math.round(pageWidth * 0.19),
                top: Math.round(pageHeight * 0.105),
                width: Math.round(pageWidth * 0.6),
                height: Math.round(pageHeight * 0.47),
            }, Math.round(pageWidth * 0.02));
        }
        applyWidgetRect(panelWidget, {
            left: Math.round(pageWidth * 0.08),
            width: Math.round(pageWidth * 0.84),
            top: heroMockupLike ? Math.round(pageHeight * 0.61) : Math.round(pageHeight * 0.64),
            height: heroMockupLike ? Math.round(pageHeight * 0.24) : Math.round(pageHeight * 0.22),
        });
        panelWidget.backgroundColor = lightEditorial ? finishProfile.lightPanelBg : '#09111de8';
        panelWidget.borderColor = lightEditorial ? finishProfile.lightPanelBorder : '#ffffff20';
        panelWidget.borderWidth = 1;
        panelWidget.radius = Math.max(26, Math.round(pageWidth * 0.04));
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            applyWidgetRect(badgeWidget, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.08),
                width: Math.round(pageWidth * 0.14),
                height: Math.round(pageHeight * 0.03),
            });
            badgeWidget.backgroundColor = lightEditorial ? '#fff7ebf2' : '#201813f4';
            badgeWidget.color = lightEditorial ? priceAccent : '#ffffff';
            badgeWidget.fontSize = Math.max(Number(badgeWidget.fontSize || 0), getTextFont(pageWidth, 14, 12));
            badgeWidget.textEffects = [];
        }
        if (titleWidget) {
            applyWidgetRect(titleWidget, {
                left: Math.round(pageWidth * 0.11),
                top: heroMockupLike ? Math.round(pageHeight * 0.655) : Math.round(pageHeight * 0.69),
                width: Math.round(pageWidth * 0.48),
                height: Math.round(pageHeight * 0.072),
            });
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(pageWidth, 50, 36));
            titleWidget.color = lightEditorial ? finishProfile.lightTitle : '#ffffff';
            setWidgetAlign(titleWidget, 'left');
            titleWidget.textEffects = [];
        }
        if (sloganWidget) {
            if (!String(sloganWidget.text || '').trim()) {
                hideWidgetBlock(sloganWidget);
            }
            else {
                applyWidgetRect(sloganWidget, {
                    left: Math.round(pageWidth * 0.11),
                    top: heroMockupLike ? Math.round(pageHeight * 0.745) : Math.round(pageHeight * 0.772),
                    width: Math.round(pageWidth * 0.46),
                    height: Math.round(pageHeight * 0.04),
                });
                sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(pageWidth, 22, 18));
                sloganWidget.color = lightEditorial ? finishProfile.lightSub : '#dde7f5';
                setWidgetAlign(sloganWidget, 'left');
                sloganWidget.textEffects = [];
            }
        }
        if (bodyWidget) {
            if (!String(bodyWidget.text || '').trim()) {
                hideWidgetBlock(bodyWidget);
            }
            else {
                applyWidgetRect(bodyWidget, {
                    left: Math.round(pageWidth * 0.65),
                    top: Math.round(pageHeight * 0.665),
                    width: Math.round(pageWidth * 0.2),
                    height: Math.round(pageHeight * 0.11),
                });
                bodyWidget.fontSize = Math.max(Number(bodyWidget.fontSize || 0), getTextFont(pageWidth, 16, 13));
                bodyWidget.color = lightEditorial ? finishProfile.lightSub : '#f3f6fb';
                setWidgetAlign(bodyWidget, 'left');
                bodyWidget.textEffects = [];
            }
        }
        metaWidgets.slice(0, 2).forEach((meta, index) => {
            applyWidgetRect(meta, {
                left: Math.round(pageWidth * (index === 0 ? 0.11 : 0.29)),
                top: heroMockupLike ? Math.round(pageHeight * 0.835) : Math.round(pageHeight * 0.845),
                width: Math.round(pageWidth * 0.15),
                height: Math.round(pageHeight * 0.032),
            });
            meta.backgroundColor = lightEditorial ? finishProfile.lightMetaBg : '#ffffff10';
            meta.borderColor = lightEditorial ? finishProfile.lightMetaBorder : '#ffffff18';
            meta.color = lightEditorial ? finishProfile.lightTitle : '#ecf2fb';
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 14, 12));
            setWidgetAlign(meta, 'center');
            meta.textEffects = [];
        });
        chipWidgets.slice(0, 2).forEach((chip, index) => {
            applyWidgetRect(chip, {
                left: Math.round(pageWidth * (index === 0 ? 0.62 : 0.77)),
                top: Math.round(pageHeight * 0.08),
                width: Math.round(pageWidth * 0.13),
                height: Math.round(pageHeight * 0.032),
            });
            chip.backgroundColor = lightEditorial ? '#fffdf8f0' : '#fff8efeb';
            chip.borderColor = lightEditorial ? '#efd7c0d0' : '#fff3dfc8';
            chip.color = '#342117';
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 13, 11));
            chip.textEffects = [];
            setWidgetAlign(chip, 'center');
        });
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, {
                left: Math.round(pageWidth * 0.11),
                top: heroMockupLike ? Math.round(pageHeight * 0.81) : Math.round(pageHeight * 0.822),
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.04),
            });
            ctaWidget.backgroundColor = lightEditorial ? priceAccent : '#2a211b';
            ctaWidget.color = '#ffffff';
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, 17, 14));
            setWidgetAlign(ctaWidget, 'center');
            ctaWidget.textEffects = [];
        }
        if (qrWidget)
            applyWidgetRect(qrWidget, {
                left: Math.round(pageWidth * 0.82),
                top: Math.round(pageHeight * 0.79),
                width: Math.round(pageWidth * 0.09),
                height: Math.round(pageWidth * 0.09),
            });
    }
    if (family === 'hero-center' && panelWidget) {
        const lightHeroPanel = finishProfile.airyMode || finishProfile.warmEditorialPanel;
        detailChipWidgets.forEach((chip) => hideWidgetBlock(chip));
        if (heroWidget)
            heroWidget.opacity = 1;
        if (heroMockupLike && heroCardWidget) {
            applyHeroCardRect(heroCardWidget, {
                left: Math.round(pageWidth * 0.53),
                top: Math.round(pageHeight * 0.11),
                width: Math.round(pageWidth * 0.31),
                height: Math.round(pageHeight * 0.5),
            }, Math.round(pageWidth * 0.022));
        }
        applyWidgetRect(panelWidget, lightHeroPanel
            ? {
                left: Math.round(pageWidth * 0.08),
                width: Math.round(pageWidth * 0.84),
                top: Math.round(pageHeight * 0.62),
                height: Math.round(pageHeight * 0.25),
            }
            : {
                left: Math.round(pageWidth * 0.08),
                width: heroMockupLike ? Math.round(pageWidth * 0.39) : Math.round(pageWidth * 0.44),
                top: Math.round(pageHeight * 0.12),
                height: Math.round(pageHeight * 0.58),
            });
        panelWidget.backgroundColor = lightHeroPanel ? finishProfile.lightPanelBg : '#07111df2';
        panelWidget.borderColor = lightHeroPanel ? finishProfile.lightPanelBorder : '#ffffff2e';
        panelWidget.borderWidth = 1;
        panelWidget.radius = Math.max(28, Math.round(pageWidth * 0.03));
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            applyWidgetRect(badgeWidget, {
                left: Math.round(pageWidth * 0.12),
                top: Math.round(pageHeight * 0.13),
                width: Math.round(pageWidth * 0.14),
                height: Math.round(pageHeight * 0.028),
            });
            badgeWidget.backgroundColor = '#fff7ebf2';
            badgeWidget.color = priceAccent;
            badgeWidget.fontSize = Math.max(Number(badgeWidget.fontSize || 0), getTextFont(pageWidth, 14, 12));
            badgeWidget.textEffects = [];
        }
        if (titleWidget) {
            applyWidgetRect(titleWidget, lightHeroPanel
                ? {
                    left: Math.round(pageWidth * 0.12),
                    top: Math.round(pageHeight * 0.665),
                    width: Math.round(pageWidth * 0.52),
                    height: Math.round(pageHeight * 0.105),
                }
                : {
                    left: Math.round(pageWidth * 0.12),
                    top: Math.round(pageHeight * 0.19),
                    width: Math.round(pageWidth * 0.3),
                    height: Math.round(pageHeight * 0.13),
                });
            titleWidget.color = lightHeroPanel ? finishProfile.lightTitle : '#ffffff';
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(pageWidth, String(titleWidget.text || '').trim().length >= 8 ? 54 : 58, 34));
            titleWidget.lineHeight = 1.06;
            setWidgetAlign(titleWidget, 'left');
            titleWidget.textEffects = [];
        }
        if (sloganWidget && !isCollapsedWidget(sloganWidget)) {
            applyWidgetRect(sloganWidget, lightHeroPanel
                ? {
                    left: Math.round(pageWidth * 0.12),
                    top: Math.round(pageHeight * 0.785),
                    width: Math.round(pageWidth * 0.42),
                    height: Math.round(pageHeight * 0.05),
                }
                : {
                    left: Math.round(pageWidth * 0.12),
                    top: Math.round(pageHeight * 0.33),
                    width: Math.round(pageWidth * 0.3),
                    height: Math.round(pageHeight * 0.05),
                });
            sloganWidget.color = lightHeroPanel ? finishProfile.lightSub : '#dbe7f7';
            sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(pageWidth, 22, 18));
            setWidgetAlign(sloganWidget, 'left');
            sloganWidget.textEffects = [];
        }
        if (bodyWidget && !isCollapsedWidget(bodyWidget)) {
            const bodyText = String(bodyWidget.text || '').trim();
            if (!bodyText || /^限时$/.test(bodyText)) {
                hideWidgetBlock(bodyWidget);
            }
            else {
            applyWidgetRect(bodyWidget, lightHeroPanel
                ? {
                    left: Math.round(pageWidth * 0.62),
                    top: Math.round(pageHeight * 0.685),
                    width: Math.round(pageWidth * 0.2),
                    height: Math.round(pageHeight * 0.07),
                }
                : {
                    left: Math.round(pageWidth * 0.12),
                    top: Math.round(pageHeight * 0.42),
                    width: Math.round(pageWidth * 0.28),
                    height: Math.round(pageHeight * 0.08),
                });
            bodyWidget.color = lightHeroPanel ? finishProfile.lightSub : '#f0f4fb';
            bodyWidget.fontSize = Math.max(Number(bodyWidget.fontSize || 0), getTextFont(pageWidth, 17, 14));
            setWidgetAlign(bodyWidget, 'left');
            bodyWidget.textEffects = [];
            }
        }
        if (priceTag && !isCollapsedWidget(priceTag)) {
            applyWidgetRect(priceTag, {
                left: Math.round(pageWidth * 0.12),
                top: Math.round(pageHeight * 0.635),
                width: Math.round(pageWidth * 0.16),
                height: Math.round(pageHeight * 0.03),
            });
            priceTag.backgroundColor = priceAccent;
            priceTag.color = '#ffffff';
            setWidgetAlign(priceTag, 'center');
            priceTag.textEffects = [];
        }
        if (priceNum && !isCollapsedWidget(priceNum)) {
            applyWidgetRect(priceNum, {
                left: Math.round(pageWidth * 0.12),
                top: Math.round(pageHeight * 0.69),
                width: Math.round(pageWidth * 0.24),
                height: Math.round(pageHeight * 0.06),
            });
            priceNum.color = '#fff6ee';
            priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 38, 26));
            setWidgetAlign(priceNum, 'left');
            priceNum.textEffects = [];
        }
        chipWidgets.slice(0, 2).forEach((chip, index) => {
            applyWidgetRect(chip, {
                left: Math.round(pageWidth * (lightHeroPanel ? 0.62 : 0.12) + index * pageWidth * (lightHeroPanel ? 0.12 : 0.165)),
                top: Math.round(pageHeight * (lightHeroPanel ? 0.79 : 0.61)),
                width: Math.round(pageWidth * 0.16),
                height: Math.round(pageHeight * 0.036),
            });
            chip.backgroundColor = lightHeroPanel ? '#fffdf8f4' : index === 0 ? '#ffffff22' : withAlpha(priceAccent, index === 1 ? '30' : '24');
            chip.borderColor = lightHeroPanel ? '#efd7c0d8' : '#ffffff24';
            chip.color = lightHeroPanel ? finishProfile.lightTitle : '#ffffff';
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 15, 12));
            setWidgetAlign(chip, 'center');
            chip.textEffects = [];
        });
        metaWidgets.slice(0, 2).forEach((meta, index) => {
            const metaText = compactDeckLine(String(meta.text || '').replace(/^(时间|地点|对象|权益|理由|背书)[｜:：]/, '').trim(), 14);
            if (!metaText || /^限时$/.test(metaText)) {
                hideWidgetBlock(meta);
                return;
            }
            meta.text = metaText;
            applyWidgetRect(meta, {
                left: Math.round(pageWidth * (lightHeroPanel ? (index === 0 ? 0.64 : 0.78) : (index === 0 ? 0.54 : 0.69))),
                top: Math.round(pageHeight * (lightHeroPanel ? 0.84 : 0.66)),
                width: Math.round(pageWidth * 0.13),
                height: Math.round(pageHeight * 0.036),
            });
            meta.backgroundColor = lightHeroPanel ? finishProfile.lightMetaBg : '#ffffff1c';
            meta.borderColor = lightHeroPanel ? finishProfile.lightMetaBorder : '#ffffff26';
            meta.color = lightHeroPanel ? finishProfile.lightTitle : '#e8eef8';
            setWidgetAlign(meta, 'center');
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 13, 11));
            meta.textEffects = [];
        });
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, lightHeroPanel
                ? {
                    left: Math.round(pageWidth * 0.62),
                    top: Math.round(pageHeight * 0.765),
                    width: Math.round(pageWidth * 0.2),
                    height: Math.round(pageHeight * 0.04),
                }
                : {
                    left: Math.round(pageWidth * 0.12),
                    top: Math.round(pageHeight * 0.73),
                    width: Math.round(pageWidth * 0.22),
                    height: Math.round(pageHeight * 0.042),
                });
            ctaWidget.backgroundColor = priceAccent;
            ctaWidget.color = chooseReadableColor(['#ffffff', '#111111', '#0f172a'], [priceAccent], 5.2);
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, 18, 15));
            setWidgetAlign(ctaWidget, 'center');
            ctaWidget.textEffects = [];
        }
        if (qrWidget && !isCollapsedWidget(qrWidget)) {
            applyWidgetRect(qrWidget, {
                left: Math.round(pageWidth * 0.78),
                top: Math.round(pageHeight * 0.84),
                width: Math.round(pageWidth * 0.085),
                height: Math.round(pageWidth * 0.085),
            });
        }
    }
    if (family === 'festive-frame' && panelWidget) {
        detailChipWidgets.forEach((chip) => hideWidgetBlock(chip));
        if (heroWidget)
            heroWidget.opacity = 1;
        if (heroMockupLike && heroCardWidget) {
            applyHeroCardRect(heroCardWidget, {
                left: Math.round(pageWidth * 0.12),
                top: Math.round(pageHeight * 0.08),
                width: Math.round(pageWidth * 0.76),
                height: Math.round(pageHeight * 0.46),
            }, Math.round(pageWidth * 0.02));
        }
        applyWidgetRect(panelWidget, {
            left: Math.round(pageWidth * 0.08),
            width: Math.round(pageWidth * 0.84),
            top: airyEventFrame ? Math.round(pageHeight * 0.64) : (heroMockupLike ? Math.round(pageHeight * 0.58) : Math.round(pageHeight * 0.6)),
            height: airyEventFrame ? Math.round(pageHeight * 0.18) : (heroMockupLike ? Math.round(pageHeight * 0.26) : Math.round(pageHeight * 0.24)),
        });
        panelWidget.backgroundColor = airyEventFrame ? '#fff8f4ef' : '#fff8f0d9';
        panelWidget.borderColor = airyEventFrame ? '#f1dcc8dc' : '#fff5e3b4';
        panelWidget.borderWidth = 1;
        panelWidget.radius = Math.max(32, Math.round(pageWidth * 0.055));
        metaWidgets.forEach((meta) => hideWidgetBlock(meta));
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            applyWidgetRect(badgeWidget, { left: Math.round(pageWidth * 0.17), top: Math.round(pageHeight * 0.565), width: Math.round(pageWidth * 0.22), height: Math.round(pageHeight * 0.03) });
            badgeWidget.backgroundColor = priceAccent;
            badgeWidget.color = '#ffffff';
            badgeWidget.fontSize = Math.max(Number(badgeWidget.fontSize || 0), getTextFont(pageWidth, 16, 13));
        }
        if (titleWidget) {
            applyWidgetRect(titleWidget, { left: Math.round(pageWidth * 0.14), top: airyEventFrame ? Math.round(pageHeight * 0.668) : Math.round(pageHeight * 0.63), width: Math.round(pageWidth * 0.72), height: airyEventFrame ? Math.round(pageHeight * 0.052) : Math.round(pageHeight * 0.06) });
            setWidgetAlign(titleWidget, 'center');
            titleWidget.color = strongDarkText;
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(pageWidth, 44, 30));
            titleWidget.textEffects = [];
        }
        if (sloganWidget && !isCollapsedWidget(sloganWidget)) {
            applyWidgetRect(sloganWidget, { left: Math.round(pageWidth * 0.16), top: airyEventFrame ? Math.round(pageHeight * 0.726) : Math.round(pageHeight * 0.695), width: Math.round(pageWidth * 0.64), height: Math.round(pageHeight * 0.036) });
            setWidgetAlign(sloganWidget, 'center');
            sloganWidget.color = mutedDarkText;
            sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(pageWidth, 22, 18));
            sloganWidget.textEffects = [];
        }
        if (bodyWidget && !isCollapsedWidget(bodyWidget)) {
            if (airyEventFrame || /礼遇|上线|加码/.test(String(bodyWidget.text || ''))) {
                hideWidgetBlock(bodyWidget);
            }
            else {
                applyWidgetRect(bodyWidget, { left: Math.round(pageWidth * 0.16), top: Math.round(pageHeight * 0.82), width: Math.round(pageWidth * 0.68), height: Math.round(pageHeight * 0.03) });
                setWidgetAlign(bodyWidget, 'center');
                bodyWidget.color = mutedDarkText;
                bodyWidget.fontSize = Math.max(Number(bodyWidget.fontSize || 0), getTextFont(pageWidth, 16, 13));
                bodyWidget.textEffects = [];
            }
        }
        festiveCardWidgets.slice(0, 3).forEach((card, index) => {
            applyWidgetRect(card, {
                left: Math.round(pageWidth * (0.15 + index * 0.24)),
                top: airyEventFrame ? Math.round(pageHeight * 0.772) : Math.round(pageHeight * 0.752),
                width: Math.round(pageWidth * 0.2),
                height: airyEventFrame ? Math.round(pageHeight * 0.042) : Math.round(pageHeight * 0.05),
            });
            card.backgroundColor = '#fffdf6e8';
            card.borderColor = `${priceAccent}36`;
            card.color = strongDarkText;
            card.fontSize = Math.max(Number(card.fontSize || 0), getTextFont(pageWidth, 15, 12));
            setWidgetAlign(card, 'center');
            card.textEffects = [];
        });
        chipWidgets.slice(0, 2).forEach((chip, index) => {
            applyWidgetRect(chip, {
                left: Math.round(pageWidth * (index === 0 ? 0.22 : 0.52)),
                top: Math.round(pageHeight * 0.75),
                width: Math.round(pageWidth * 0.18),
                height: Math.round(pageHeight * 0.03),
            });
            chip.backgroundColor = `${priceAccent}14`;
            chip.borderColor = `${priceAccent}30`;
            chip.color = strongDarkText;
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 14, 12));
            setWidgetAlign(chip, 'center');
            chip.textEffects = [];
        });
        if (priceTag && !isCollapsedWidget(priceTag)) {
            applyWidgetRect(priceTag, { left: Math.round(pageWidth * 0.34), top: Math.round(pageHeight * 0.745), width: Math.round(pageWidth * 0.32), height: Math.round(pageHeight * 0.028) });
            priceTag.backgroundColor = priceAccent;
            priceTag.color = '#ffffff';
            setWidgetAlign(priceTag, 'center');
        }
        if (priceNum && !isCollapsedWidget(priceNum)) {
            applyWidgetRect(priceNum, { left: Math.round(pageWidth * 0.28), top: Math.round(pageHeight * 0.772), width: Math.round(pageWidth * 0.44), height: Math.round(pageHeight * 0.045) });
            priceNum.color = priceAccent;
            priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 34, 24));
            setWidgetAlign(priceNum, 'center');
            priceNum.textEffects = [];
        }
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, { left: Math.round(pageWidth * 0.31), top: airyEventFrame ? Math.round(pageHeight * 0.846) : Math.round(pageHeight * 0.858), width: Math.round(pageWidth * 0.38), height: Math.round(pageHeight * 0.04) });
            ctaWidget.backgroundColor = priceAccent;
            ctaWidget.color = '#ffffff';
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, 19, 15));
            setWidgetAlign(ctaWidget, 'center');
            ctaWidget.textEffects = [];
        }
        if (qrWidget && !isCollapsedWidget(qrWidget)) {
            applyWidgetRect(qrWidget, { left: Math.round(pageWidth * 0.77), top: Math.round(pageHeight * 0.83), width: Math.round(pageWidth * 0.09), height: Math.round(pageWidth * 0.09) });
        }
    }
    if (family === 'clean-course' && pageWidth <= pageHeight && panelWidget) {
        detailChipWidgets.forEach((chip) => hideWidgetBlock(chip));
        const lightPanelBg = '#fffaf6e8';
        const lightPanelBorder = '#f0dcc8c8';
        applyWidgetRect(panelWidget, {
            left: Math.round(pageWidth * 0.08),
            top: Math.round(pageHeight * 0.58),
            width: Math.round(pageWidth * 0.84),
            height: Math.round(pageHeight * 0.27),
        });
        panelWidget.backgroundColor = lightPanelBg;
        panelWidget.borderColor = lightPanelBorder;
        panelWidget.borderWidth = 1;
        panelWidget.radius = Math.max(34, Math.round(pageWidth * 0.05));
        if (courseBar) {
            applyWidgetRect(courseBar, {
                left: Math.round(pageWidth * 0.11),
                top: Math.round(pageHeight * 0.64),
                width: Math.max(16, Math.round(pageWidth * 0.016)),
                height: Math.round(pageHeight * 0.14),
            });
            courseBar.backgroundColor = palette.primary;
        }
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            applyWidgetRect(badgeWidget, {
                left: Math.round(pageWidth * 0.14),
                top: Math.round(pageHeight * 0.535),
                width: Math.round(pageWidth * 0.26),
                height: Math.round(pageHeight * 0.036),
            });
            badgeWidget.fontSize = Math.max(Number(badgeWidget.fontSize || 0), getTextFont(pageWidth, 20, 16));
            badgeWidget.backgroundColor = palette.primary;
            badgeWidget.color = '#ffffff';
            setWidgetAlign(badgeWidget, 'center');
            badgeWidget.textEffects = [];
        }
        if (titleWidget) {
            applyWidgetRect(titleWidget, {
                left: Math.round(pageWidth * 0.15),
                top: Math.round(pageHeight * 0.635),
                width: Math.round(pageWidth * 0.68),
                height: Math.round(pageHeight * 0.118),
            });
            titleWidget.color = strongDarkText;
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(pageWidth, 56, 40));
            titleWidget.lineHeight = 1.08;
            setWidgetAlign(titleWidget, 'left');
            titleWidget.textEffects = [];
        }
        if (sloganWidget && !isCollapsedWidget(sloganWidget)) {
            applyWidgetRect(sloganWidget, {
                left: Math.round(pageWidth * 0.15),
                top: Math.round(pageHeight * 0.765),
                width: Math.round(pageWidth * 0.68),
                height: Math.round(pageHeight * 0.05),
            });
            sloganWidget.color = mutedDarkText;
            sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(pageWidth, 24, 19));
            setWidgetAlign(sloganWidget, 'left');
            sloganWidget.textEffects = [];
        }
        if (bodyWidget && !isCollapsedWidget(bodyWidget)) {
            applyWidgetRect(bodyWidget, {
                left: Math.round(pageWidth * 0.15),
                top: Math.round(pageHeight * 0.818),
                width: Math.round(pageWidth * 0.48),
                height: Math.round(pageHeight * 0.046),
            });
            bodyWidget.color = mutedDarkText;
            bodyWidget.fontSize = Math.max(Number(bodyWidget.fontSize || 0), getTextFont(pageWidth, 21, 16));
            setWidgetAlign(bodyWidget, 'left');
            bodyWidget.textEffects = [];
        }
        chipWidgets.slice(0, 2).forEach((chip, index) => {
            applyWidgetRect(chip, {
                left: Math.round(pageWidth * (index === 0 ? 0.15 : 0.39)),
                top: Math.round(pageHeight * 0.875),
                width: Math.round(pageWidth * 0.2),
                height: Math.round(pageHeight * 0.034),
            });
            chip.backgroundColor = index === 0 ? '#fffdf7f2' : '#f6ecffef';
            chip.borderColor = index === 0 ? '#efd7c0d8' : '#dcc9ffda';
            chip.color = strongDarkText;
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 15, 12));
            setWidgetAlign(chip, 'center');
            chip.textEffects = [];
        });
        metaWidgets.slice(0, 2).forEach((meta, index) => {
            applyWidgetRect(meta, {
                left: Math.round(pageWidth * (index === 0 ? 0.65 : 0.78)),
                top: Math.round(pageHeight * 0.875),
                width: Math.round(pageWidth * 0.1),
                height: Math.round(pageHeight * 0.034),
            });
            meta.backgroundColor = '#ffffffea';
            meta.borderColor = '#d9c8f3d0';
            meta.color = mutedDarkText;
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 13, 11));
            setWidgetAlign(meta, 'center');
            meta.textEffects = [];
        });
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, {
                left: Math.round(pageWidth * 0.62),
                top: Math.round(pageHeight * 0.805),
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.052),
            });
            ctaWidget.backgroundColor = palette.primary;
            ctaWidget.color = '#ffffff';
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, 18, 15));
            ctaWidget.borderWidth = 0;
            setWidgetAlign(ctaWidget, 'center');
            ctaWidget.textEffects = [];
        }
        if (qrWidget && !isCollapsedWidget(qrWidget)) {
            applyWidgetRect(qrWidget, {
                left: Math.round(pageWidth * 0.76),
                top: Math.round(pageHeight * 0.73),
                width: Math.round(pageWidth * 0.1),
                height: Math.round(pageWidth * 0.1),
            });
        }
    }
    if (family === 'clean-course' && pageWidth > pageHeight) {
        detailChipWidgets.forEach((chip) => hideWidgetBlock(chip));
        if (!widgets.find((item) => item.name === 'ai_deco_course_note')) {
            widgets.push(makeTextWidget('ai_deco_course_note', {
                text: '项目实训 / 作业点评 / 增长打法',
                left: Math.round(pageWidth * 0.1),
                top: Math.round(pageHeight * 0.705),
                width: Math.round(pageWidth * 0.3),
                height: Math.round(pageHeight * 0.03),
                fontSize: getTextFont(pageWidth, 12, 10),
                lineHeight: 1.1,
                color: '#dce7f9aa',
                textAlign: 'left',
                textAlignLast: 'left',
            }));
        }
        if (!widgets.find((item) => item.name === 'ai_deco_course_batch')) {
            widgets.push(makeTextWidget('ai_deco_course_batch', {
                text: 'SPRING INTAKE',
                left: Math.round(pageWidth * 0.56),
                top: Math.round(pageHeight * 0.12),
                width: Math.round(pageWidth * 0.15),
                height: Math.round(pageHeight * 0.024),
                fontSize: getTextFont(pageWidth, 11, 10),
                lineHeight: 1.1,
                color: '#eef4ffb8',
                textAlign: 'left',
                textAlignLast: 'left',
            }));
        }
        const panelLeft = Math.round(pageWidth * 0.055);
        const panelTop = Math.round(pageHeight * 0.08);
        const panelWidth = heroMockupLike ? Math.round(pageWidth * 0.42) : Math.round(pageWidth * 0.44);
        const panelHeight = Math.round(pageHeight * 0.76);
        const textLeft = panelLeft + Math.round(pageWidth * 0.075);
        const textWidth = heroMockupLike ? Math.round(pageWidth * 0.285) : Math.round(pageWidth * 0.31);
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => applyWidgetRect(widget, { left: textLeft, width: textWidth }));
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            applyWidgetRect(badgeWidget, { left: textLeft, top: Math.round(pageHeight * 0.12), width: Math.round(pageWidth * 0.12), height: Math.round(pageHeight * 0.04) });
        }
        if (titleWidget) {
            const rawCourseTitle = String(titleWidget.text || '').trim();
            if (rawCourseTitle && !rawCourseTitle.includes('\n') && rawCourseTitle.length >= 8) {
                const cutIndex = Math.max(2, Math.min(rawCourseTitle.length - 2, Math.ceil(rawCourseTitle.length * 0.56)));
                titleWidget.text = `${rawCourseTitle.slice(0, cutIndex)}\n${rawCourseTitle.slice(cutIndex)}`;
            }
            applyWidgetRect(titleWidget, { top: Math.round(pageHeight * 0.22), height: Math.round(pageHeight * 0.2) });
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(pageWidth, 28, 19));
            titleWidget.lineHeight = 1.05;
            titleWidget.textEffects = [];
        }
        if (sloganWidget) {
            applyWidgetRect(sloganWidget, { top: Math.round(pageHeight * 0.49), height: Math.round(pageHeight * 0.08) });
            sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(pageWidth, 20, 14));
            sloganWidget.lineHeight = getLineHeight(Number(sloganWidget.fontSize || 18));
            sloganWidget.textEffects = [];
        }
        if (bodyWidget && !String(bodyWidget.text || '').trim()) {
            hideWidgetBlock(bodyWidget);
        }
        else if (bodyWidget) {
            applyWidgetRect(bodyWidget, { top: Math.round(pageHeight * 0.61), height: Math.round(pageHeight * 0.07) });
            bodyWidget.fontSize = Math.max(Number(bodyWidget.fontSize || 0), getTextFont(pageWidth, 16, 12));
            bodyWidget.textEffects = [];
        }
        metaWidgets.slice(0, 2).forEach((meta, index) => {
            applyWidgetRect(meta, {
                left: textLeft + index * Math.round(pageWidth * 0.165),
                top: Math.round(pageHeight * 0.72),
                width: Math.round(pageWidth * 0.15),
                height: Math.round(pageHeight * 0.04),
            });
            meta.backgroundColor = withAlpha('#ffffff', '2e');
            meta.borderColor = withAlpha('#ffffff', '24');
            meta.color = '#f4f7fd';
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 14, 11));
            meta.textEffects = [];
            setWidgetAlign(meta, 'center');
        });
        chipWidgets.slice(0, 2).forEach((chip, index) => {
            applyWidgetRect(chip, {
                left: textLeft + index * Math.round(pageWidth * 0.165),
                top: Math.round(pageHeight * 0.79),
                width: Math.round(pageWidth * 0.145),
                height: Math.round(pageHeight * 0.04),
            });
            chip.backgroundColor = withAlpha('#ffffff', index === 0 ? '2a' : '18');
            chip.borderColor = withAlpha('#ffffff', '18');
            chip.color = '#ffffff';
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 13, 11));
            chip.textEffects = [];
            setWidgetAlign(chip, 'center');
        });
        if (ctaWidget) {
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, 22, 16));
            applyWidgetRect(ctaWidget, { left: textLeft, top: Math.round(pageHeight * 0.87), width: Math.round(pageWidth * 0.18), height: Math.round(pageHeight * 0.06) });
            ctaWidget.textEffects = [];
        }
        if (panelWidget) {
            applyWidgetRect(panelWidget, { left: panelLeft, top: panelTop, width: panelWidth, height: panelHeight });
            panelWidget.backgroundColor = finishProfile.airyMode ? finishProfile.lightPanelBg : '#08111dd4';
            panelWidget.borderColor = finishProfile.airyMode ? finishProfile.lightPanelBorder : '#ffffff18';
            panelWidget.borderWidth = 1;
            panelWidget.radius = Math.max(30, Math.round(pageWidth * 0.02));
        }
        if (courseBar)
            applyWidgetRect(courseBar, { left: Math.round(pageWidth * 0.05), top: Math.round(pageHeight * 0.08), width: Math.round(pageWidth * 0.045), height: Math.round(pageHeight * 0.76) });
        if (heroMockupLike && heroCardWidget) {
            applyHeroCardRect(heroCardWidget, {
                left: Math.round(pageWidth * 0.54),
                top: Math.round(pageHeight * 0.14),
                width: Math.round(pageWidth * 0.29),
                height: Math.round(pageHeight * 0.58),
            }, Math.round(pageWidth * 0.018));
        }
        if (qrWidget)
            applyWidgetRect(qrWidget, {
                left: heroMockupLike ? Math.round(pageWidth * 0.31) : Math.round(pageWidth * 0.29),
                top: Math.round(pageHeight * 0.86),
                width: Math.round(pageHeight * 0.08),
                height: Math.round(pageHeight * 0.08),
            });
    }
    if (family === 'premium-offer' && panelWidget && pageWidth <= pageHeight * 1.08) {
        detailChipWidgets.forEach((chip) => hideWidgetBlock(chip));
        const panelTop = compactOfferMode ? Math.round(pageHeight * 0.57) : (heroMockupLike ? Math.round(pageHeight * 0.27) : Math.round(pageHeight * 0.24));
        if (heroWidget)
            heroWidget.opacity = 1;
        if (heroMockupLike && heroCardWidget) {
            applyHeroCardRect(heroCardWidget, {
                left: Math.round(pageWidth * 0.58),
                top: Math.round(pageHeight * 0.08),
                width: Math.round(pageWidth * 0.24),
                height: Math.round(pageHeight * 0.24),
            }, Math.round(pageWidth * 0.026));
        }
        applyWidgetRect(panelWidget, {
            left: Math.round(pageWidth * 0.06),
            width: Math.round(pageWidth * 0.88),
            top: lightFoodPoster ? Math.round(pageHeight * 0.73) : panelTop,
            height: lightFoodPoster ? Math.round(pageHeight * 0.13) : compactOfferMode ? Math.round(pageHeight * 0.27) : (heroMockupLike ? Math.round(pageHeight * 0.58) : Math.round(pageHeight * 0.62)),
        });
        panelWidget.backgroundColor = lightFoodPoster ? '#fff9f2bb' : compactOfferMode ? '#fff8f4ef' : '#fff8f2df';
        panelWidget.borderColor = lightFoodPoster ? '#f1dcc87a' : compactOfferMode ? '#f1dcc8dc' : '#fff3e1b2';
        panelWidget.borderWidth = lightFoodPoster ? 0 : 1;
        panelWidget.radius = Math.max(30, Math.round(pageWidth * 0.055));
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            applyWidgetRect(badgeWidget, {
                left: Math.round(pageWidth * 0.12),
                top: lightFoodPoster ? Math.round(pageHeight * 0.54) : Math.round(pageHeight * 0.155),
                width: Math.round(pageWidth * 0.18),
                height: Math.round(pageHeight * 0.032),
            });
            badgeWidget.backgroundColor = priceAccent;
            badgeWidget.color = '#ffffff';
            badgeWidget.fontSize = Math.max(Number(badgeWidget.fontSize || 0), getTextFont(pageWidth, 16, 13));
        }
        if (priceTag) {
            applyWidgetRect(priceTag, {
                left: compactOfferMode ? Math.round(pageWidth * 0.62) : Math.round(pageWidth * 0.58),
                top: lightFoodPoster ? Math.round(pageHeight * 0.745) : compactOfferMode ? Math.round(pageHeight * 0.605) : Math.round(pageHeight * 0.36),
                width: Math.round(pageWidth * 0.18),
                height: Math.round(pageHeight * 0.03),
            });
            setWidgetAlign(priceTag, 'center');
            priceTag.backgroundColor = priceAccent;
            priceTag.color = '#ffffff';
            priceTag.textEffects = [];
        }
        if (priceNum) {
            applyWidgetRect(priceNum, {
                left: compactOfferMode ? Math.round(pageWidth * 0.56) : Math.round(pageWidth * 0.54),
                top: lightFoodPoster ? Math.round(pageHeight * 0.778) : compactOfferMode ? Math.round(pageHeight * 0.64) : Math.round(pageHeight * 0.405),
                width: Math.round(pageWidth * 0.28),
                height: compactOfferMode ? Math.round(pageHeight * 0.06) : Math.round(pageHeight * 0.08),
            });
            setWidgetAlign(priceNum, 'right');
            priceNum.color = priceAccent;
            priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 48, 32));
            priceNum.textEffects = [];
        }
        if (titleWidget) {
            applyWidgetRect(titleWidget, {
                top: lightFoodPoster ? Math.round(pageHeight * 0.59) : compactOfferMode ? Math.round(pageHeight * 0.605) : Math.round(pageHeight * 0.37),
                width: lightFoodPoster ? Math.round(pageWidth * 0.62) : compactOfferMode ? Math.round(pageWidth * 0.42) : Math.round(pageWidth * 0.36),
                left: Math.round(pageWidth * 0.12),
                height: lightFoodPoster ? Math.round(pageHeight * 0.09) : compactOfferMode ? Math.round(pageHeight * 0.07) : Math.round(pageHeight * 0.1),
            });
            setWidgetAlign(titleWidget, 'left');
            titleWidget.color = strongDarkText;
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(pageWidth, lightFoodPoster ? 54 : 42, lightFoodPoster ? 34 : 28));
            titleWidget.lineHeight = 1.08;
            titleWidget.textEffects = [];
        }
        if (sloganWidget) {
            if (!String(sloganWidget.text || '').trim()) {
                hideWidgetBlock(sloganWidget);
            }
            else {
                applyWidgetRect(sloganWidget, {
                    left: Math.round(pageWidth * 0.12),
                    top: lightFoodPoster ? Math.round(pageHeight * 0.665) : compactOfferMode ? Math.round(pageHeight * 0.67) : Math.round(pageHeight * 0.51),
                    width: lightFoodPoster ? Math.round(pageWidth * 0.52) : compactOfferMode ? Math.round(pageWidth * 0.42) : Math.round(pageWidth * 0.35),
                    height: Math.round(pageHeight * 0.04),
                });
                setWidgetAlign(sloganWidget, 'left');
                sloganWidget.color = mutedDarkText;
                sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(pageWidth, lightFoodPoster ? 20 : 18, lightFoodPoster ? 16 : 14));
                sloganWidget.textEffects = [];
            }
        }
        if (bodyWidget) {
            if (!String(bodyWidget.text || '').trim() || lightFoodPoster) {
                hideWidgetBlock(bodyWidget);
            }
            else {
                applyWidgetRect(bodyWidget, {
                    left: compactOfferMode ? Math.round(pageWidth * 0.12) : Math.round(pageWidth * 0.58),
                    top: compactOfferMode ? Math.round(pageHeight * 0.722) : Math.round(pageHeight * 0.56),
                    width: compactOfferMode ? Math.round(pageWidth * 0.7) : Math.round(pageWidth * 0.24),
                    height: compactOfferMode ? Math.round(pageHeight * 0.035) : Math.round(pageHeight * 0.06),
                });
                setWidgetAlign(bodyWidget, 'left');
                bodyWidget.color = mutedDarkText;
                bodyWidget.fontSize = Math.max(Number(bodyWidget.fontSize || 0), getTextFont(pageWidth, 16, 13));
                bodyWidget.textEffects = [];
            }
        }
        chipWidgets.slice(0, 3).forEach((chip, index) => {
            applyWidgetRect(chip, {
                left: Math.round(pageWidth * (0.12 + index * 0.21)),
                top: lightFoodPoster ? Math.round(pageHeight * 0.865) : compactOfferMode ? Math.round(pageHeight * 0.77) : Math.round(pageHeight * 0.68),
                width: Math.round(pageWidth * 0.17),
                height: Math.round(pageHeight * 0.032),
            });
            chip.backgroundColor = `${priceAccent}18`;
            chip.borderColor = `${priceAccent}44`;
            chip.color = strongDarkText;
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 16, 13));
            setWidgetAlign(chip, 'center');
            chip.textEffects = [];
        });
        metaWidgets.slice(0, 2).forEach((meta, index) => {
            applyWidgetRect(meta, {
                left: Math.round(pageWidth * (index === 0 ? 0.12 : 0.35)),
                top: Math.round(pageHeight * 0.74),
                width: Math.round(pageWidth * 0.2),
                height: Math.round(pageHeight * 0.03),
            });
            meta.backgroundColor = '#ffffff2a';
            meta.borderColor = '#ffffff24';
            meta.color = mutedDarkText;
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 13, 11));
            setWidgetAlign(meta, 'center');
            meta.textEffects = [];
        });
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, {
                top: lightFoodPoster ? Math.round(pageHeight * 0.848) : Math.round(pageHeight * 0.82),
                left: Math.round(pageWidth * 0.12),
                width: lightFoodPoster ? Math.round(pageWidth * 0.32) : Math.round(pageWidth * 0.28),
                height: Math.round(pageHeight * 0.046),
            });
            ctaWidget.backgroundColor = priceAccent;
            ctaWidget.color = '#ffffff';
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(pageWidth, 20, 16));
            setWidgetAlign(ctaWidget, 'center');
            ctaWidget.textEffects = [];
        }
        if (qrWidget) {
            applyWidgetRect(qrWidget, {
                left: Math.round(pageWidth * 0.74),
                top: Math.round(pageHeight * 0.8),
                width: Math.round(pageWidth * 0.1),
                height: Math.round(pageWidth * 0.1),
            });
        }
    }
    applyPortraitCommerceZoneLock(widgets, family, pageWidth, pageHeight, options);
    if (qrWidget && ctaWidget && panelWidget && !isCollapsedWidget(ctaWidget)) {
        const ctaBottom = Number(ctaWidget.top || 0) + Math.max(Number(ctaWidget.height || 0), Math.round(Number(ctaWidget.fontSize || 18) * 2));
        const panelBottom = Number(panelWidget.top || 0) + Number(panelWidget.height || 0);
        if (pageWidth > pageHeight) {
            qrWidget.left = Math.min(pageWidth - Number(qrWidget.width || 0) - Math.round(pageWidth * 0.06), Number(panelWidget.left || 0) + Number(panelWidget.width || 0) + Math.round(pageWidth * 0.03));
            qrWidget.top = Math.min(pageHeight - Number(qrWidget.height || 0) - Math.round(pageHeight * 0.06), Math.max(Math.round(pageHeight * 0.08), ctaBottom - Number(qrWidget.height || 0)));
        }
        else if (qrWidget.top < ctaBottom + stackGap && panelBottom > ctaBottom + stackGap) {
            qrWidget.top = Math.min(pageHeight - Number(qrWidget.height || 0) - Math.round(pageHeight * 0.06), ctaBottom + stackGap);
        }
    }
    if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
        badgeWidget.fontSize = Math.max(Number(badgeWidget.fontSize || 0), getTextFont(pageWidth, 15, 13));
        badgeWidget.height = Math.max(Number(badgeWidget.height || 0), Math.round(pageHeight * 0.026));
        if (badgeWidget.record)
            badgeWidget.record.height = Math.round(Number(badgeWidget.height || 0));
    }
    enforceLockedCtaAndCommerceSpacing(widgets, family, pageWidth, pageHeight);
    enforcePosterContrast(widgets, options.palette || {}, options.designPlan || {});
}
function getHeaderBottomLimit(widgets, height, safeBottom, fallbackLimit) {
    const candidates = [fallbackLimit];
    ['ai_hero', 'ai_price_tag', 'ai_price_num', 'ai_qrcode'].forEach((name) => {
        const widget = getTextWidget(widgets, name);
        if (isCollapsedWidget(widget))
            return;
        const top = Number(widget?.top);
        if (Number.isFinite(top) && top > Math.round(height * 0.08)) {
            candidates.push(top - Math.round(height * 0.024));
        }
    });
    candidates.push(height - safeBottom - Math.round(height * 0.16));
    return Math.max(Math.round(height * 0.16), Math.min(...candidates));
}
function compressHeaderStack(widgets, options) {
    const { height, safeBottom, fallbackLimit, family, isWide } = options;
    const title = getTextWidget(widgets, 'ai_title');
    const slogan = getTextWidget(widgets, 'ai_slogan');
    const body = getTextWidget(widgets, 'ai_body');
    const badge = getTextWidget(widgets, 'ai_badge');
    const cta = getTextWidget(widgets, 'ai_cta');
    const titleMin = family === 'premium-offer' && !isWide ? 40 : family === 'hero-center' && !isWide ? 42 : 40;
    const sloganMin = 24;
    const badgeMin = 15;
    let safety = 0;
    while (safety < 18) {
        reflowAiTextStack(widgets, height);
        const limit = getHeaderBottomLimit(widgets, height, safeBottom, fallbackLimit);
        const currentBottom = aiTextStackBottom(widgets);
        if (currentBottom <= limit)
            break;
        let changed = false;
        const visibleChips = widgets.filter((item) => String(item?.name || '').startsWith('ai_chip_') && !isCollapsedWidget(item));
        const visibleMetas = widgets.filter((item) => String(item?.name || '').startsWith('ai_meta_') && !isCollapsedWidget(item));
        const visibleLists = widgets.filter((item) => String(item?.name || '').startsWith('ai_list_') && !isCollapsedWidget(item));
        if (body && String(body.text || '').trim()) {
            changed = hideTextWidget(body) || changed;
        }
        if (!changed && visibleChips.length > 1) {
            changed = hideTextWidget(visibleChips[visibleChips.length - 1]) || changed;
        }
        if (!changed && visibleMetas.length > 0) {
            changed = hideTextWidget(visibleMetas[visibleMetas.length - 1]) || changed;
        }
        if (!changed && visibleLists.length > 2) {
            changed = hideTextWidget(visibleLists[visibleLists.length - 1]) || changed;
        }
        if (!changed && slogan && String(slogan.text || '').trim() && family === 'festive-frame') {
            changed = hideTextWidget(slogan) || changed;
        }
        if (!changed && slogan && String(slogan.text || '').trim() && Number(slogan.fontSize) > sloganMin) {
            changed = resizeTextWidget(slogan, Number(slogan.fontSize) - 2) || changed;
        }
        if (!changed && title && Number(title.fontSize) > titleMin) {
            changed = resizeTextWidget(title, Number(title.fontSize) - (family === 'premium-offer' && !isWide ? 4 : 3)) || changed;
        }
        if (!changed && badge && Number(badge.fontSize) > badgeMin) {
            changed = resizeTextWidget(badge, Number(badge.fontSize) - 1) || changed;
        }
        if (!changed && cta) {
            const fallbackTop = Math.min(Number(cta.top) || 0, limit + Math.round(height * 0.024));
            cta.top = Math.round(Math.max(fallbackTop, limit + Math.round(height * 0.018)));
            changed = true;
        }
        if (!changed)
            break;
        safety += 1;
    }
    reflowAiTextStack(widgets, height);
}
function stabilizeFloatingWidgets(widgets, options) {
    const { width, height, safeBottom, family } = options;
    const chips = widgets.filter((item) => item.name && item.name.startsWith('ai_chip_'));
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const hero = widgets.find((item) => item.name === 'ai_hero');
    const textBottom = aiTextStackBottom(widgets);
    const gap = Math.round(height * 0.022);
    const chipRowLimit = cta ? Number(cta.top || 0) - gap : height - safeBottom - Math.round(height * 0.08);
    chips.forEach((chip, index) => {
        if (isCollapsedWidget(chip))
            return;
        const nextTop = Math.max(Number(chip.top || 0), textBottom + gap + index * Math.round((Number(chip.height) || 0) * 0.86));
        const overflow = nextTop + Number(chip.height || 0) > chipRowLimit;
        if (overflow && family !== 'grid-product' && family !== 'clean-course') {
            chip.text = ' ';
            chip.height = 2;
            if (chip.record)
                chip.record.height = 2;
            return;
        }
        chip.top = Math.round(nextTop);
        chip.left = Math.max(Math.round(width * 0.06), Math.min(Number(chip.left || 0), width - Math.round(width * 0.06) - Number(chip.width || 0)));
    });
    if (priceTag && priceNum && !isCollapsedWidget(priceTag) && !isCollapsedWidget(priceNum)) {
        const priceTop = Math.max(Number(priceTag.top || 0), textBottom + gap);
        if (priceTop < textBottom + gap * 1.2 && family !== 'premium-offer' && family !== 'grid-product') {
            hideTextWidget(priceTag);
            hideTextWidget(priceNum);
        }
    }
    if (hero && hero.fullBleed !== true && cta && HERO_BELOW_TEXT_FAMILIES.has(family)) {
        const ctaBottom = Number(cta.top || 0) + Number(cta.height || 0);
        const minHeroTop = ctaBottom + Math.round(height * 0.026);
        if (Number(hero.top || 0) < minHeroTop && Number(hero.height || 0) > Math.round(height * 0.2)) {
            hero.top = minHeroTop;
            const heroBottom = height - safeBottom - Math.round(height * 0.03);
            hero.height = Math.max(Math.round(height * 0.24), Math.min(Number(hero.height || 0), heroBottom - hero.top));
            if (hero.record)
                hero.record.height = hero.height;
        }
    }
}
function applyWidgetRect(widget, rect) {
    if (!widget || !rect)
        return;
    if (rect.left !== undefined)
        widget.left = Math.round(rect.left);
    if (rect.top !== undefined)
        widget.top = Math.round(rect.top);
    if (rect.width !== undefined) {
        widget.width = Math.round(rect.width);
        if (widget.record)
            widget.record.width = Math.round(rect.width);
    }
    if (rect.height !== undefined) {
        widget.height = Math.round(rect.height);
        if (widget.record)
            widget.record.height = Math.round(rect.height);
    }
}
function centerWidgetHorizontally(widget, pageWidth) {
    if (!widget)
        return;
    widget.left = Math.round((pageWidth - Number(widget.width || 0)) / 2);
}
function setWidgetAlign(widget, align) {
    if (!widget)
        return;
    widget.textAlign = align;
    widget.textAlignLast = align;
}
function clampWidgetInside(widget, pageWidth, pageHeight, paddingX, paddingY) {
    if (!widget)
        return;
    const width = Math.max(Number(widget.width || 0), 0);
    const height = Math.max(Number(widget.height || 0), 0);
    widget.left = Math.round(Math.max(paddingX, Math.min(Number(widget.left || 0), pageWidth - paddingX - width)));
    widget.top = Math.round(Math.max(paddingY, Math.min(Number(widget.top || 0), pageHeight - paddingY - height)));
}
function applyPortraitCommerceZoneLock(widgets, family, pageWidth, pageHeight, options = {}) {
    const sceneText = `${options?.input?.theme || ''} ${options?.input?.purpose || ''} ${options?.input?.industry || ''} ${options?.input?.style || ''} ${options?.designPlan?.contentPattern || ''}`.trim();
    const isPortrait = pageWidth <= pageHeight * 1.08;
    const commerceLike = /餐饮|美食|茶饮|咖啡|食品|新品|电商|零售|促销|上新|团购|套餐/.test(sceneText);
    const warmFoodLike = isWarmFoodPosterScene(sceneText);
    if (!isPortrait || !commerceLike || !new Set(['premium-offer', 'hero-center']).has(family))
        return false;
    const panel = widgets.find((item) => item.name === 'ai_text_panel');
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const badge = widgets.find((item) => item.name === 'ai_badge');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const qr = widgets.find((item) => item.name === 'ai_qrcode');
    const hero = widgets.find((item) => item.name === 'ai_hero');
    const chips = widgets.filter((item) => /^ai_chip(_detail)?_/.test(String(item?.name || '')) && !isCollapsedWidget(item));
    const designPlan = options.designPlan || {};
    const backgroundTone = String(designPlan.backgroundTone || '').trim();
    const palette = options.palette || {};
    const finishProfile = deriveAdaptiveFinishProfile(family, options, false);
    const darkPanel = backgroundTone === 'dark' && !warmFoodLike;
    const compactLightBand = isLightFoodPosterContext(sceneText, designPlan, palette);
    const hasPrice = !isCollapsedWidget(priceTag) && !isCollapsedWidget(priceNum);
    const outerX = Math.round(pageWidth * 0.07);
    const panelTop = Math.round(pageHeight * (compactLightBand ? 0.68 : family === 'premium-offer' ? 0.56 : 0.58));
    const panelHeight = Math.round(pageHeight * (compactLightBand ? 0.17 : family === 'premium-offer' ? 0.31 : 0.285));
    const panelWidth = pageWidth - outerX * 2;
    const padX = Math.round(pageWidth * 0.05);
    const padTop = Math.round(pageHeight * 0.038);
    const padBottom = Math.round(pageHeight * 0.03);
    const panelBottom = panelTop + panelHeight;
    const contentLeft = outerX + padX;
    const contentRight = outerX + panelWidth - padX;
    const contentWidth = contentRight - contentLeft;
    const priceZoneWidth = hasPrice ? Math.round(pageWidth * 0.23) : 0;
    const titleWidth = hasPrice ? Math.round(contentWidth * 0.62) : contentWidth;
    const gapY = Math.round(pageHeight * 0.012);
    const ctaHeight = Math.round(pageHeight * 0.056);
    const ctaWidth = Math.round(hasPrice ? pageWidth * 0.28 : pageWidth * 0.34);
    const ctaTop = panelBottom - padBottom - ctaHeight;
    const ctaLeft = contentLeft;
    const infoLimitBottom = ctaTop - gapY;
    if (hero)
        hero.opacity = 1;
    if (panel) {
        applyWidgetRect(panel, { left: outerX, top: panelTop, width: panelWidth, height: panelHeight });
        panel.backgroundColor = compactLightBand ? '#fff9f2c2' : darkPanel ? '#08111de6' : finishProfile.lightPanelBg;
        panel.borderColor = compactLightBand ? '#f1dcc88f' : darkPanel ? withAlpha(blendColor('#08111d', palette.primary || '#f59e0b', 0.16), '7f') : finishProfile.lightPanelBorder;
        panel.borderWidth = compactLightBand ? 0 : 1;
        panel.radius = Math.max(compactLightBand ? 22 : 28, Math.round(pageWidth * 0.045));
    }
    if (badge && !isCollapsedWidget(badge)) {
        applyWidgetRect(badge, {
            left: contentLeft,
            top: Math.max(Math.round(pageHeight * 0.085), panelTop - Math.round(pageHeight * 0.032)),
            width: Math.max(Number(badge.width || 0), Math.round(pageWidth * 0.18)),
            height: Math.round(pageHeight * 0.032),
        });
        badge.backgroundColor = darkPanel ? '#fff5e9f4' : '#fffdf9f0';
        badge.color = darkPanel ? (palette.primary || '#8a4b25') : '#8a4b25';
        badge.textEffects = [];
        badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 15, 12));
    }
    const titleTop = panelTop + padTop;
    if (title) {
        applyWidgetRect(title, {
            left: contentLeft,
            top: titleTop,
            width: titleWidth,
            height: Math.round(pageHeight * 0.085),
        });
        title.fontSize = Math.max(Number(title.fontSize || 0), getTextFont(pageWidth, hasPrice ? 64 : 68, 40));
        title.lineHeight = 1.06;
        title.color = darkPanel ? '#f8fafc' : '#2f190f';
        setWidgetAlign(title, 'left');
        title.textEffects = [];
    }
    const sloganTop = titleTop + Math.round(pageHeight * 0.088);
    if (slogan) {
        if (!String(slogan.text || '').trim()) {
            hideWidgetBlock(slogan);
        }
        else {
            applyWidgetRect(slogan, {
                left: contentLeft,
                top: sloganTop,
                width: hasPrice ? Math.round(contentWidth * 0.58) : contentWidth,
                height: Math.round(pageHeight * 0.048),
            });
            slogan.fontSize = Math.max(Number(slogan.fontSize || 0), getTextFont(pageWidth, 24, 18));
            slogan.lineHeight = 1.24;
            slogan.color = darkPanel ? '#e8eef8' : '#6a4636';
            setWidgetAlign(slogan, 'left');
            slogan.textEffects = [];
        }
    }
    if (hasPrice) {
        const priceLeft = contentRight - priceZoneWidth;
        if (priceTag) {
            applyWidgetRect(priceTag, {
                left: priceLeft,
                top: titleTop + Math.round(pageHeight * 0.006),
                width: Math.round(pageWidth * 0.2),
                height: Math.round(pageHeight * 0.03),
            });
            priceTag.backgroundColor = palette.primary || '#9a3412';
            priceTag.color = '#ffffff';
            priceTag.textEffects = [];
            setWidgetAlign(priceTag, 'center');
        }
        if (priceNum) {
            applyWidgetRect(priceNum, {
                left: priceLeft - Math.round(pageWidth * 0.005),
                top: titleTop + Math.round(pageHeight * 0.044),
                width: priceZoneWidth + Math.round(pageWidth * 0.005),
                height: Math.round(pageHeight * 0.064),
            });
            priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 48, 32));
            priceNum.lineHeight = 1.02;
            priceNum.color = darkPanel ? '#fff3e0' : (palette.primary || '#9a3412');
            setWidgetAlign(priceNum, 'right');
            priceNum.textEffects = [];
        }
    }
    let infoTop = slogan && !isCollapsedWidget(slogan)
        ? Number(slogan.top || 0) + Number(slogan.height || 0) + gapY
        : titleTop + Math.round(pageHeight * 0.1);
    if (body && !String(body.text || '').trim()) {
        hideWidgetBlock(body);
    }
    const visibleChips = chips.filter((item) => String(item.text || '').trim()).slice(0, hasPrice ? 2 : 3);
    visibleChips.slice(hasPrice ? 2 : 3).forEach((item) => hideWidgetBlock(item));
    const chipWidth = hasPrice ? Math.round(pageWidth * 0.26) : Math.round(pageWidth * 0.23);
    const chipHeight = Math.round(pageHeight * 0.034);
    visibleChips.forEach((chip, index) => {
        const left = contentLeft + index * (chipWidth + Math.round(pageWidth * 0.018));
        applyWidgetRect(chip, {
            left,
            top: infoTop,
            width: chipWidth,
            height: chipHeight,
        });
        chip.backgroundColor = darkPanel ? '#ffffff12' : '#fffaf6f0';
        chip.borderColor = darkPanel ? '#ffffff18' : '#e8ccb0d0';
        chip.color = darkPanel ? '#f8fafc' : '#533526';
        chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 15, 12));
        chip.textEffects = [];
        setWidgetAlign(chip, 'center');
    });
    if (visibleChips.length)
        infoTop += chipHeight + gapY;
    const bodyMinHeight = Math.round(pageHeight * 0.04);
    const bodyMaxHeight = Math.round(pageHeight * 0.055);
    if (body && !isCollapsedWidget(body)) {
        const bodyBottom = infoTop + bodyMaxHeight;
        if (bodyBottom > infoLimitBottom) {
            hideWidgetBlock(body);
        }
        else {
            applyWidgetRect(body, {
                left: contentLeft,
                top: infoTop,
                width: hasPrice ? Math.round(contentWidth * 0.76) : contentWidth,
                height: bodyMinHeight,
            });
            body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 17, 14));
            body.lineHeight = 1.3;
            body.color = darkPanel ? '#f3f6fb' : '#6a4636';
            setWidgetAlign(body, 'left');
            body.textEffects = [];
        }
    }
    if (cta && !isCollapsedWidget(cta)) {
        applyWidgetRect(cta, {
            left: ctaLeft,
            top: ctaTop,
            width: ctaWidth,
            height: ctaHeight,
        });
        cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 20, 16));
        cta.backgroundColor = palette.primary || '#8a4b25';
        cta.color = '#ffffff';
        cta.textEffects = [];
        setWidgetAlign(cta, 'center');
        cta.aiPlacementLock = true;
        cta.aiMinTop = ctaTop;
        cta.aiMaxTop = ctaTop;
        cta.aiPreferredLeft = ctaLeft;
        cta.aiPreferredWidth = ctaWidth;
    }
    if (qr && !isCollapsedWidget(qr)) {
        const qrSize = Math.round(pageWidth * 0.1);
        applyWidgetRect(qr, {
            left: contentRight - qrSize,
            top: panelBottom - padBottom - qrSize,
            width: qrSize,
            height: qrSize,
        });
    }
    [title, slogan, body, cta, priceTag, priceNum, badge, qr, ...visibleChips].forEach((widget) => clampWidgetInside(widget, pageWidth, pageHeight, Math.round(pageWidth * 0.04), Math.round(pageHeight * 0.04)));
    return true;
}
function applyLateStageLightFoodPosterPolish(widgets, family, pageWidth, pageHeight, options = {}) {
    const sceneText = `${options?.input?.theme || ''} ${options?.input?.purpose || ''} ${options?.input?.industry || ''} ${options?.input?.style || ''} ${options?.input?.content || ''} ${options?.designPlan?.contentPattern || ''}`.trim();
    if (pageWidth > pageHeight * 1.08 || !isLightFoodPosterContext(sceneText, options?.designPlan || {}, options?.palette || {}))
        return false;
    if (!new Set(['premium-offer', 'hero-center', 'magazine-cover', 'grid-product']).has(family))
        return false;
    const palette = options?.palette || {};
    const copyDeck = options?.copyDeck || {};
    const hero = widgets.find((item) => item.name === 'ai_hero');
    const panel = widgets.find((item) => item.name === 'ai_text_panel');
    const badge = widgets.find((item) => item.name === 'ai_badge');
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    let priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    let priceNum = widgets.find((item) => item.name === 'ai_price_num');
    let metaWidgets = widgets.filter((item) => String(item?.name || '').startsWith('ai_meta_'));
    const qr = widgets.find((item) => item.name === 'ai_qrcode');
    const priceMatch = `${copyDeck?.priceBlock?.value || ''} ${options?.input?.content || ''}`.match(/(?:￥|¥)\s*\d{1,4}(?:\.\d{1,2})?(?:起|元)?|(?<!\d)\d{1,4}(?:\.\d{1,2})?\s*元(?:起)?|(?<!\d)\d{1,4}(?:\.\d{1,2})?\s*起/);
    const derivedPrice = priceMatch ? String(priceMatch[0]).replace(/\s+/g, '') : '';
    const contentSegments = String(options?.input?.content || '')
        .split(/[\n|｜；;，,。]/)
        .map((item) => String(item || '').trim())
        .filter(Boolean)
        .slice(0, 6);
    const readableSegment = (value) => {
        const text = stripInternalPromptEcho(value).trim();
        if (!text)
            return '';
        if (/^(￥|¥)?\d+(?:\.\d+)?(?:起|元)?$/.test(text))
            return '';
        if (/^(限时|现做现出|到店咨询|立即下单|立即抢购)$/.test(text))
            return '';
        return text;
    };
    const derivedSlogan = readableSegment(copyDeck.supportLine)
        || readableSegment(contentSegments[0])
        || readableSegment(contentSegments[1])
        || '招牌轻食现做现出，低负担也能吃得满足';
    const lightFoodChipTexts = [
        copyDeck.offerLine,
        ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints : []),
        copyDeck.actionReason,
        copyDeck.audienceLine,
        copyDeck.trustLine,
        ...contentSegments,
    ].map((item) => readableSegment(item)).filter(Boolean);
    const normalizedChipTexts = Array.from(new Set(lightFoodChipTexts
        .map((item) => compactDeckLine(item, 14))
        .filter(Boolean)));
    const supportStrip = stripInternalPromptEcho(copyDeck.offerLine || copyDeck.trustLine || copyDeck.actionReason || copyDeck.audienceLine || contentSegments[2] || '');
    const canonicalSupportStrip = canonicalPosterText(supportStrip);
    const filteredChipTexts = normalizedChipTexts.filter((item) => !canonicalSupportStrip || canonicalPosterText(item) !== canonicalSupportStrip);
    const priceNote = stripInternalPromptEcho(copyDeck.priceBlock?.note || copyDeck.urgencyLine || copyDeck.actionReason || '');
    const designPlan = options?.designPlan || {};
    let chips = widgets
        .filter((item) => /^ai_chip(_detail)?_/.test(String(item?.name || '')) && !isCollapsedWidget(item))
        .slice(0, 3);
    const targetChipCount = filteredChipTexts.length >= 2 ? 2 : Math.min(2, filteredChipTexts.length);
    while (chips.length < targetChipCount) {
        const chip = makeTextWidget(`ai_chip_detail_${chips.length + 1}`, {
            text: filteredChipTexts[chips.length] || '',
            left: 0,
            top: 0,
            width: Math.round(pageWidth * 0.28),
            height: Math.round(pageHeight * 0.04),
            fontSize: getTextFont(pageWidth, 18, 15),
            lineHeight: 1.16,
            color: '#2f190f',
            backgroundColor: '#fff6edf2',
            textAlign: 'center',
            textAlignLast: 'center',
            borderWidth: 1,
            borderColor: '#efd8bfba',
            radius: Math.max(14, Math.round(pageWidth * 0.018)),
        });
        widgets.push(chip);
        chips.push(chip);
    }
    const priceValueText = String(copyDeck.priceBlock?.value || derivedPrice || '').trim();
    const priceSuffixText = String(copyDeck.priceBlock?.suffix || '').trim();
    const desiredPriceText = priceValueText
        ? (priceSuffixText && !priceValueText.endsWith(priceSuffixText) ? `${priceValueText}${priceSuffixText}` : priceValueText)
        : '';
    const desiredPriceTagText = getSafeText(copyDeck.priceBlock?.tag, derivedPrice ? '轻享价' : '限时');
    const needsPriceWidgets = Boolean(desiredPriceText)
        && (!priceTag || !priceNum || isCollapsedWidget(priceTag) || isCollapsedWidget(priceNum) || !String(priceTag.text || '').trim() || !String(priceNum.text || '').trim());
    if (needsPriceWidgets) {
        if (!priceTag) {
            priceTag = makeTextWidget('ai_price_tag', {
                text: desiredPriceTagText,
                left: 0,
                top: 0,
                width: Math.round(pageWidth * 0.18),
                height: Math.round(pageHeight * 0.028),
                fontSize: getTextFont(pageWidth, 16, 12),
                lineHeight: 1.1,
                color: '#ffffff',
                backgroundColor: String(palette.primary || '#d97706').trim() || '#d97706',
                textAlign: 'center',
                textAlignLast: 'center',
                fontWeight: 'bold',
            });
            widgets.push(priceTag);
        }
        else {
            showWidgetBlock(priceTag);
            priceTag.text = desiredPriceTagText || '限时价';
        }
        if (!priceNum) {
            priceNum = makeTextWidget('ai_price_num', {
                text: desiredPriceText,
                left: 0,
                top: 0,
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.05),
                fontSize: getTextFont(pageWidth, 54, 36),
                lineHeight: 1.02,
                color: String(palette.primary || '#d97706').trim() || '#d97706',
                textAlign: 'right',
                textAlignLast: 'right',
                fontWeight: 'bold',
            });
            widgets.push(priceNum);
        }
        else {
            showWidgetBlock(priceNum);
            priceNum.text = desiredPriceText || ' ';
        }
    }
    const shouldShowSupportStrip = Boolean(supportStrip);
    if (body && shouldShowSupportStrip && (isCollapsedWidget(body) || !String(body.text || '').trim())) {
        showWidgetBlock(body);
        body.text = supportStrip;
    }
    const hasPrice = priceTag && priceNum && !isCollapsedWidget(priceTag) && !isCollapsedWidget(priceNum);
    const outerX = Math.round(pageWidth * 0.065);
    const titleLeft = Math.round(pageWidth * 0.08);
    const titleTop = Math.round(pageHeight * 0.085);
    const titleWidth = Math.round(pageWidth * (hasPrice ? 0.56 : 0.72));
    const sloganTop = titleTop + Math.round(pageHeight * 0.108);
    const bodyTop = sloganTop + Math.round(pageHeight * 0.07);
    const bandTop = Math.round(pageHeight * (hasPrice ? 0.655 : 0.705));
    const bandHeight = Math.round(pageHeight * (hasPrice ? 0.21 : 0.155));
    const bandWidth = pageWidth - outerX * 2;
    const contentLeft = outerX + Math.round(pageWidth * 0.04);
    const contentBottom = bandTop + bandHeight;
    const priceZoneWidth = hasPrice ? Math.round(pageWidth * 0.3) : 0;
    const leftBandWidth = hasPrice ? bandWidth - priceZoneWidth - Math.round(pageWidth * 0.03) : bandWidth - Math.round(pageWidth * 0.08);
    const accent = String(palette.primary || '#d97706').trim() || '#d97706';
    const warmText = '#2f190f';
    const subText = '#6a4636';
    if (hero) {
        hero.opacity = 1;
        hero.fullBleed = true;
    }
    if (panel) {
        applyWidgetRect(panel, {
            left: outerX,
            top: bandTop,
            width: bandWidth,
            height: bandHeight,
        });
        panel.backgroundColor = '#fffaf4dc';
        panel.borderColor = '#edd8c290';
        panel.borderWidth = 1;
        panel.radius = Math.max(18, Math.round(pageWidth * 0.035));
    }
    if (badge && !isCollapsedWidget(badge)) {
        applyWidgetRect(badge, {
            left: titleLeft,
            top: Math.round(pageHeight * 0.045),
            width: Math.max(Number(badge.width || 0), Math.round(pageWidth * 0.28)),
            height: Math.max(Number(badge.height || 0), Math.round(pageHeight * 0.046)),
        });
        badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 26, 20));
        badge.backgroundColor = '#fff7ebf7';
        badge.borderColor = '#f1d5b4b0';
        badge.color = accent;
        badge.textEffects = [];
        setWidgetAlign(badge, 'center');
    }
    if (title) {
        applyWidgetRect(title, {
            left: titleLeft,
            top: titleTop,
            width: titleWidth,
            height: Math.round(pageHeight * 0.105),
        });
        title.fontSize = Math.max(Number(title.fontSize || 0), getTextFont(pageWidth, 78, 50));
        title.lineHeight = 1.04;
        title.color = warmText;
        title.textEffects = [];
        setWidgetAlign(title, 'left');
    }
    if (slogan) {
        slogan.text = derivedSlogan;
        applyWidgetRect(slogan, {
            left: titleLeft,
            top: sloganTop,
            width: Math.round(pageWidth * (hasPrice ? 0.62 : 0.74)),
            height: Math.round(pageHeight * 0.068),
        });
        slogan.fontSize = Math.max(Number(slogan.fontSize || 0), getTextFont(pageWidth, 30, 22));
        slogan.lineHeight = 1.24;
        slogan.color = subText;
        slogan.textEffects = [];
        setWidgetAlign(slogan, 'left');
    }
    if (body && !isCollapsedWidget(body)) {
        if (shouldShowSupportStrip) {
            body.text = supportStrip;
            applyWidgetRect(body, {
                left: titleLeft,
                top: bodyTop,
                width: Math.round(pageWidth * (hasPrice ? 0.6 : 0.72)),
                height: Math.round(pageHeight * 0.05),
            });
            body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 20, 17));
            body.lineHeight = 1.18;
            body.color = subText;
            body.backgroundColor = '#fffaf1e6';
            body.borderColor = '#efd8bf88';
            body.borderWidth = 1;
            body.radius = Math.max(14, Math.round(pageWidth * 0.02));
            body.textEffects = [];
            setWidgetAlign(body, 'left');
        }
        else {
            hideWidgetBlock(body);
        }
    }
    chips.forEach((chip, index) => {
        const nextText = filteredChipTexts[index] || String(chip.text || '').trim();
        chip.text = nextText || ' ';
    });
    chips.slice(targetChipCount).forEach((chip) => hideWidgetBlock(chip));
    const chipTop = bandTop + Math.round(pageHeight * 0.024);
    const chipGap = Math.round(pageWidth * 0.018);
    const chipCount = Math.max(1, Math.min(targetChipCount || chips.length, 2));
    const chipWidth = chipCount > 1
        ? Math.round((leftBandWidth - chipGap) / 2)
        : Math.round(leftBandWidth);
    chips.forEach((chip, index) => {
        applyWidgetRect(chip, {
            left: contentLeft + index * (chipWidth + chipGap),
            top: chipTop,
            width: chipWidth,
            height: Math.round(pageHeight * 0.047),
        });
        chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 21, 16));
        chip.backgroundColor = '#fff8eef9';
        chip.borderColor = '#e8cfaebf';
        chip.color = warmText;
        chip.textEffects = [];
        setWidgetAlign(chip, 'center');
    });
    if (hasPrice) {
        const resolvedPriceTag = compactDeckLine(copyDeck.priceBlock?.tag || (derivedPrice ? '轻享价' : '限时价'), 6);
        const resolvedPriceValue = desiredPriceText;
        priceTag.text = resolvedPriceTag || '限时价';
        priceNum.text = resolvedPriceValue || ' ';
        const priceLeft = pageWidth - outerX - priceZoneWidth;
        applyWidgetRect(priceTag, {
            left: priceLeft,
            top: bandTop + Math.round(pageHeight * 0.022),
            width: priceZoneWidth,
            height: Math.round(pageHeight * 0.034),
        });
        priceTag.fontSize = Math.max(Number(priceTag.fontSize || 0), getTextFont(pageWidth, 19, 15));
        priceTag.backgroundColor = accent;
        priceTag.color = '#ffffff';
        priceTag.textEffects = [];
        setWidgetAlign(priceTag, 'center');
        applyWidgetRect(priceNum, {
            left: priceLeft,
            top: bandTop + Math.round(pageHeight * 0.062),
            width: priceZoneWidth,
            height: Math.round(pageHeight * 0.074),
        });
        priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 68, 48));
        priceNum.lineHeight = 1.02;
        priceNum.color = accent;
        priceNum.textEffects = [];
        setWidgetAlign(priceNum, 'right');
        if (!metaWidgets.length && priceNote) {
            const meta = makeTextWidget('ai_meta_1', {
                text: priceNote,
                left: 0,
                top: 0,
                width: priceZoneWidth,
                height: Math.round(pageHeight * 0.036),
                fontSize: getTextFont(pageWidth, 15, 12),
                lineHeight: 1.16,
                color: subText,
                backgroundColor: '#fff7eef0',
                textAlign: 'center',
                textAlignLast: 'center',
                borderWidth: 1,
                borderColor: '#edd8c294',
                radius: Math.max(12, Math.round(pageWidth * 0.016)),
            });
            widgets.push(meta);
            metaWidgets = [meta];
        }
    }
    if (metaWidgets.length) {
        metaWidgets.forEach((meta, index) => {
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            if (!priceNote) {
                hideWidgetBlock(meta);
                return;
            }
            meta.text = compactDeckLine(priceNote, 16) || ' ';
            applyWidgetRect(meta, {
                left: hasPrice ? pageWidth - outerX - priceZoneWidth : contentLeft,
                top: bandTop + Math.round(pageHeight * 0.145),
                width: hasPrice ? priceZoneWidth : Math.round(leftBandWidth),
                height: Math.round(pageHeight * 0.038),
            });
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 15, 12));
            meta.lineHeight = 1.18;
            meta.backgroundColor = '#fff7eef0';
            meta.borderColor = '#edd8c294';
            meta.borderWidth = 1;
            meta.radius = Math.max(12, Math.round(pageWidth * 0.016));
            meta.color = subText;
            meta.textEffects = [];
            setWidgetAlign(meta, 'center');
        });
    }
    if (cta && !isCollapsedWidget(cta)) {
        applyWidgetRect(cta, {
            left: contentLeft,
            top: contentBottom - Math.round(pageHeight * 0.06),
            width: Math.max(Math.round(pageWidth * 0.34), Number(cta.width || 0)),
            height: Math.round(pageHeight * 0.052),
        });
        cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 23, 18));
        cta.backgroundColor = accent;
        cta.color = '#ffffff';
        cta.textEffects = [];
        setWidgetAlign(cta, 'center');
    }
    if (qr && !isCollapsedWidget(qr)) {
        if (String(designPlan.qrStrategy || '').trim() === 'none') {
            hideWidgetBlock(qr);
        }
        else {
            const qrSize = Math.round(pageWidth * (hasPrice ? 0.094 : 0.115));
            applyWidgetRect(qr, {
                left: pageWidth - outerX - qrSize,
                top: contentBottom - qrSize - Math.round(pageHeight * 0.004),
                width: qrSize,
                height: qrSize,
            });
        }
    }
    return true;
}
function applyLateStageCommercialPosterPolish(widgets, family, pageWidth, pageHeight, options = {}) {
    const designPlan = options?.designPlan || {};
    const copyDeck = options?.copyDeck || {};
    const contentPattern = String(designPlan.contentPattern || '').trim();
    const sceneText = `${options?.input?.theme || ''} ${options?.input?.purpose || ''} ${options?.input?.industry || ''} ${options?.input?.style || ''} ${options?.input?.content || ''} ${contentPattern}`.trim();
    const eventLikeCommercialCover = /活动|露营|音乐节|市集|快闪|生活节|演出|周末|派对|camp|event/i.test(sceneText);
    if (!eventLikeCommercialCover && isLightFoodPosterContext(sceneText, designPlan, options?.palette || {}))
        return false;
    const supportedFamilies = new Set(['premium-offer', 'grid-product', 'magazine-cover', 'festive-frame', 'clean-course', 'list-recruitment', 'hero-center', 'split-editorial', 'hero-left']);
    if (!supportedFamilies.has(family))
        return false;
    const palette = options?.palette || {};
    const accent = String(palette.primary || '#2563eb').trim() || '#2563eb';
    const strongText = chooseReadableColor([palette.text, '#111827', '#ffffff'], [palette.background || '#ffffff', palette.surface || '#ffffff'], 4.5);
    const subText = chooseReadableColor([palette.muted, blendColor(strongText, palette.background || '#ffffff', 0.4), '#475569', '#ffffff'], [palette.background || '#ffffff', palette.surface || '#ffffff'], 3.2);
    const panel = widgets.find((item) => item.name === 'ai_text_panel');
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const badge = widgets.find((item) => item.name === 'ai_badge');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const qr = widgets.find((item) => item.name === 'ai_qrcode');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const metaWidgets = widgets.filter((item) => String(item?.name || '').startsWith('ai_meta_'));
    const chips = widgets.filter((item) => /^ai_chip(_detail)?_/.test(String(item?.name || '')));
    const festiveCards = widgets.filter((item) => /^ai_festive_card_/.test(String(item?.name || '')));
    const recruitCards = widgets.filter((item) => /^ai_recruit_card_/.test(String(item?.name || '')));
    const cardWidgets = widgets.filter((item) => /^ai_card_/.test(String(item?.name || '')));
    const weakCommercialFact = (text) => /^(周末|本周|今日|限时|到手|现在|礼遇|推荐|福利|抢购|促销|活动)$/.test(String(text || '').trim());
    const supportLine = stripInternalPromptEcho(copyDeck.offerLine || copyDeck.actionReason || copyDeck.trustLine || copyDeck.audienceLine || '');
    const compareTexts = [
        String(title?.text || '').trim(),
        String(slogan?.text || '').trim(),
        supportLine,
        String(body?.text || '').trim(),
    ].filter(Boolean);
    if (badge && !isCollapsedWidget(badge)) {
        if (!String(badge.text || '').trim()) {
            hideWidgetBlock(badge);
        }
        else {
            badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, family === 'festive-frame' ? 22 : 18, 14));
            badge.height = Math.max(Number(badge.height || 0), Math.round(pageHeight * 0.028));
            badge.textEffects = [];
        }
    }
    if (title) {
        title.color = strongText;
        title.textEffects = [];
    }
    if (slogan && !isCollapsedWidget(slogan)) {
        slogan.color = subText;
        slogan.textEffects = [];
    }
    if (body) {
        const bodyText = String(body.text || '').trim();
        if ((!bodyText || isPosterEchoText(bodyText, String(slogan?.text || '').trim()) || isPosterEchoText(bodyText, String(title?.text || '').trim())) && supportLine) {
            showWidgetBlock(body);
            body.text = supportLine;
        }
        if (!isCollapsedWidget(body) && Number(body.width || 0) <= Math.max(28, Math.round(Number(body.fontSize || 0) * 1.6)) && bodyText.length >= 4) {
            body.width = Math.round(pageWidth * 0.36);
            body.height = Math.max(Math.round(pageHeight * 0.034), Math.round(Number(body.fontSize || 0) * 1.8));
        }
        if (!isCollapsedWidget(body)) {
            body.color = subText;
            body.textEffects = [];
        }
    }
    if (cta && !isCollapsedWidget(cta)) {
        cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, family === 'list-recruitment' ? 21 : 20, 16));
        cta.color = '#ffffff';
        cta.textEffects = [];
    }
    if (priceTag && !isCollapsedWidget(priceTag) && priceNum && !isCollapsedWidget(priceNum)) {
        const priceValueText = String(copyDeck.priceBlock?.value || priceNum.text || '').trim();
        const priceSuffixText = String(copyDeck.priceBlock?.suffix || '').trim();
        priceNum.text = priceValueText
            ? (priceSuffixText && !priceValueText.endsWith(priceSuffixText) ? `${priceValueText}${priceSuffixText}` : priceValueText)
            : String(priceNum.text || '').trim();
        priceTag.text = compactDeckLine(copyDeck.priceBlock?.tag || String(priceTag.text || '').trim(), 6) || String(priceTag.text || '').trim();
        priceTag.backgroundColor = priceTag.backgroundColor || accent;
        priceTag.color = '#ffffff';
        priceNum.color = accent;
        priceNum.textEffects = [];
    }
    chips.forEach((chip) => {
        if (isCollapsedWidget(chip))
            return;
        const chipText = String(chip.text || '').trim();
        if (!chipText || compareTexts.some((candidate) => isPosterEchoText(chipText, candidate))) {
            hideWidgetBlock(chip);
            return;
        }
        chip.textEffects = [];
        chip.color = chip.color || strongText;
    });
    metaWidgets.forEach((meta) => {
        if (isCollapsedWidget(meta))
            return;
        const metaText = String(meta.text || '').trim();
        if (!metaText || compareTexts.some((candidate) => isPosterEchoText(metaText, candidate))) {
            hideWidgetBlock(meta);
            return;
        }
        meta.textEffects = [];
        if (['premium-offer', 'hero-center', 'clean-course'].includes(family)) {
            const normalizedMeta = metaText.replace(/^(时间|地点|对象|权益|理由|背书)[｜:：]/, '').trim();
            if (/^(限时|本周|周末|今日)$/.test(normalizedMeta)) {
                hideWidgetBlock(meta);
            }
        }
    });
    if (qr && !isCollapsedWidget(qr) && String(designPlan.qrStrategy || '').trim() === 'none') {
        hideWidgetBlock(qr);
    }
    if (family === 'premium-offer') {
        chips.slice(2).forEach((chip) => hideWidgetBlock(chip));
        metaWidgets.slice(1).forEach((meta) => hideWidgetBlock(meta));
        if (priceNum && !isCollapsedWidget(priceNum))
            priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 54, 36));
        if (body && !isCollapsedWidget(body)) {
            const compactBody = compactDeckLine(copyDeck.actionReason || copyDeck.trustLine || copyDeck.offerLine || String(body.text || '').trim(), 20);
            if (!compactBody || isPosterEchoText(compactBody, String(title?.text || '').trim()) || isPosterEchoText(compactBody, String(priceNum?.text || '').trim())) {
                hideWidgetBlock(body);
            }
            else {
                showWidgetBlock(body);
                body.text = compactBody;
                body.width = Math.max(Number(body.width || 0), Math.round(pageWidth * 0.46));
                body.height = Math.max(Number(body.height || 0), Math.round(pageHeight * 0.04));
            }
        }
        if (chips[0] && !isCollapsedWidget(chips[0]) && !String(chips[0].text || '').trim()) {
            const chipText = compactDeckLine(copyDeck.proofPoints?.[0] || copyDeck.trustLine || '', 14);
            if (chipText)
                chips[0].text = chipText;
        }
        if (chips[1] && !isCollapsedWidget(chips[1]) && !String(chips[1].text || '').trim()) {
            const chipText = compactDeckLine(copyDeck.urgencyLine || copyDeck.proofPoints?.[1] || '', 14);
            if (chipText)
                chips[1].text = chipText;
        }
    }
    if (family === 'grid-product') {
        const gridSource = [
            ...(Array.isArray(copyDeck.factCards)
                ? copyDeck.factCards.flatMap((item) => [
                    compactDeckLine([item?.label, item?.value].filter(Boolean).join(' · '), 16),
                    compactDeckLine(item?.value || item?.hint || '', 16),
                    compactDeckLine(item?.hint || '', 14),
                ])
                : []),
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints.map((item) => compactDeckLine(item, 16)) : []),
            compactDeckLine(copyDeck.offerLine, 16),
            compactDeckLine(copyDeck.actionReason, 16),
            compactDeckLine(copyDeck.urgencyLine, 14),
        ].filter((item, index, arr) => item && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
        cardWidgets.slice(0, 4).forEach((card, index) => {
            const currentText = String(card.text || '').trim();
            const fallbackText = gridSource[index] || gridSource.find((item) => !compareTexts.some((candidate) => isPosterEchoText(item, candidate))) || '';
            const text = !currentText
                || currentText.length <= 3
                || /^(喷雾|人才|福利|权益|地点|岗位|适合|加码)$/.test(currentText)
                ? fallbackText
                : currentText;
            if (!text || compareTexts.some((candidate) => isPosterEchoText(text, candidate))) {
                hideWidgetBlock(card);
                return;
            }
            card.text = text;
            card.fontSize = Math.max(Number(card.fontSize || 0), getTextFont(pageWidth, 17, 14));
            card.textEffects = [];
            if (index > 3)
                hideWidgetBlock(card);
        });
    }
    if (family === 'clean-course') {
        const courseFacts = [
            compactDeckLine(copyDeck.offerLine, 18),
            compactDeckLine(copyDeck.actionReason, 16),
            compactDeckLine(copyDeck.urgencyLine, 14),
            compactDeckLine(copyDeck.trustLine, 16),
            ...(Array.isArray(copyDeck.factCards)
                ? copyDeck.factCards.flatMap((item) => [
                    compactDeckLine(item?.value || '', 14),
                    compactDeckLine(item?.hint || '', 12),
                ])
                : []),
        ].filter((item, index, arr) => item && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
        chips.forEach((chip, index) => {
            if (index > 1) {
                hideWidgetBlock(chip);
                return;
            }
            const chipText = compactDeckLine(courseFacts[index + 1] || String(chip.text || '').trim(), 14);
            if (!chipText) {
                hideWidgetBlock(chip);
                return;
            }
            showWidgetBlock(chip);
            chip.text = chipText;
            applyWidgetRect(chip, {
                left: Math.round(pageWidth * (index === 0 ? 0.15 : 0.4)),
                top: Math.round(pageHeight * 0.865),
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.038),
            });
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 16, 13));
            chip.backgroundColor = '#fffdf7f2';
            chip.borderColor = '#efd7c0d8';
            chip.color = strongText;
            chip.textEffects = [];
            setWidgetAlign(chip, 'center');
        });
        metaWidgets.forEach((meta, index) => {
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            const metaText = compactDeckLine(copyDeck.trustLine || copyDeck.urgencyLine || String(meta.text || '').trim(), 14) || String(meta.text || '').trim();
            if (!metaText) {
                hideWidgetBlock(meta);
                return;
            }
            showWidgetBlock(meta);
            meta.text = metaText;
            applyWidgetRect(meta, {
                left: Math.round(pageWidth * 0.65),
                top: Math.round(pageHeight * 0.865),
                width: Math.round(pageWidth * 0.2),
                height: Math.round(pageHeight * 0.038),
            });
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 15, 12));
            meta.backgroundColor = '#ffffffea';
            meta.borderColor = '#d9c8f3d0';
            meta.color = subText;
            meta.textEffects = [];
            setWidgetAlign(meta, 'center');
        });
        if (body && !isCollapsedWidget(body)) {
            body.text = compactDeckLine(courseFacts[0] || copyDeck.offerLine || copyDeck.actionReason || String(body.text || '').trim(), 24) || String(body.text || '').trim();
            applyWidgetRect(body, {
                left: Math.round(pageWidth * 0.15),
                top: Math.round(pageHeight * 0.805),
                width: Math.round(pageWidth * 0.68),
                height: Math.round(pageHeight * 0.05),
            });
            body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 21, 17));
            body.lineHeight = 1.18;
            body.color = subText;
            body.backgroundColor = '#fffaf6e0';
            body.borderColor = '#eadcf7aa';
            body.borderWidth = 1;
            body.radius = Math.max(12, Math.round(pageWidth * 0.016));
            body.textEffects = [];
            setWidgetAlign(body, 'left');
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            applyWidgetRect(slogan, {
                left: Math.round(pageWidth * 0.15),
                top: Math.round(pageHeight * 0.745),
                width: Math.round(pageWidth * 0.68),
                height: Math.round(pageHeight * 0.052),
            });
        }
        if (cta && !isCollapsedWidget(cta)) {
            applyWidgetRect(cta, {
                left: Math.round(pageWidth * 0.6),
                top: Math.round(pageHeight * 0.915),
                width: Math.round(pageWidth * 0.28),
                height: Math.round(pageHeight * 0.054),
            });
            cta.backgroundColor = accent;
            cta.borderColor = accent;
            cta.borderWidth = 0;
            cta.color = '#ffffff';
            cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 24, 18));
            cta.textEffects = [];
            setWidgetAlign(cta, 'center');
        }
    }
    if (family === 'magazine-cover') {
        const eventHeadline = chooseReadableColor(['#fffaf2', '#ffffff', '#fef3c7'], ['#0f172a', '#111827', '#1e1b4b'], 7);
        const eventSubline = chooseReadableColor(['#fde68a', '#f8fafc', '#ffd7aa'], ['#0f172a', '#1f2937'], 4.6);
        const eventMuted = chooseReadableColor(['#f6e9d4', '#e5e7eb', '#fed7aa'], ['#111827', '#1f2937'], 3.6);
        const glassBg = 'rgba(15,23,42,0.66)';
        const glassBorder = 'rgba(255,255,255,0.14)';
        const footerTop = Math.round(pageHeight * 0.74);
        const footerHeight = Math.round(pageHeight * 0.16);
        const footerLeft = Math.round(pageWidth * 0.065);
        const footerWidth = Math.round(pageWidth * 0.87);
        const footerInnerLeft = footerLeft + Math.round(pageWidth * 0.03);
        const footerInnerRight = footerLeft + footerWidth - Math.round(pageWidth * 0.03);
        const priceColWidth = Math.round(pageWidth * 0.22);
        const ctaWidth = Math.round(pageWidth * 0.34);
        if (title) {
            title.color = eventHeadline;
            title.fontSize = Math.max(Number(title.fontSize || 0), getTextFont(pageWidth, 88, 56));
            title.lineHeight = 0.96;
            title.letterSpacing = 0;
            title.textEffects = [{
                    type: 'shadow',
                    color: 'rgba(10,12,18,0.34)',
                    offsetX: 0,
                    offsetY: 10,
                    blur: 18,
                }];
            applyWidgetRect(title, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.12),
                width: Math.round(pageWidth * 0.66),
                height: Math.round(pageHeight * 0.14),
            });
            setWidgetAlign(title, 'left');
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            showWidgetBlock(slogan);
            slogan.color = eventSubline;
            slogan.fontSize = Math.max(Number(slogan.fontSize || 0), getTextFont(pageWidth, 28, 20));
            slogan.lineHeight = 1.2;
            slogan.textEffects = [];
            applyWidgetRect(slogan, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.29),
                width: Math.round(pageWidth * 0.72),
                height: Math.round(pageHeight * 0.06),
            });
            setWidgetAlign(slogan, 'left');
        }
        if (badge && !isCollapsedWidget(badge)) {
            badge.backgroundColor = accent;
            badge.borderColor = accent;
            badge.borderWidth = 0;
            badge.color = '#fffaf4';
            badge.radius = Math.max(18, Math.round(pageWidth * 0.018));
            badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 22, 18));
            badge.textEffects = [];
            applyWidgetRect(badge, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.055),
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.046),
            });
            setWidgetAlign(badge, 'center');
        }
        if (body && !isCollapsedWidget(body)) {
            const eventBody = compactDeckLine(copyDeck.offerLine || copyDeck.actionReason || copyDeck.urgencyLine || supportLine || String(body.text || '').trim(), 24);
            if (eventBody && !compareTexts.some((candidate) => candidate !== String(body.text || '').trim() && isPosterEchoText(eventBody, candidate))) {
                body.text = eventBody;
                body.color = eventMuted;
                body.backgroundColor = '#00000000';
                body.borderColor = '#00000000';
                body.borderWidth = 0;
                body.radius = 0;
                body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 22, 17));
                body.lineHeight = 1.16;
                body.textEffects = [];
                applyWidgetRect(body, {
                    left: Math.round(pageWidth * 0.08),
                    top: Math.round(pageHeight * 0.36),
                    width: Math.round(pageWidth * 0.6),
                    height: Math.round(pageHeight * 0.05),
                });
                setWidgetAlign(body, 'left');
            }
            else {
                hideWidgetBlock(body);
            }
        }
        if (panel) {
            applyWidgetRect(panel, {
                left: footerLeft,
                top: footerTop,
                width: footerWidth,
                height: footerHeight,
            });
            panel.backgroundColor = glassBg;
            panel.borderColor = glassBorder;
            panel.borderWidth = 1;
            panel.radius = Math.max(28, Math.round(pageWidth * 0.03));
        }
        const coverFacts = uniquePosterItems([
            ...(Array.isArray(copyDeck.factCards) ? copyDeck.factCards.flatMap((item) => [item?.value, item?.hint]) : []),
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints : []),
            copyDeck.offerLine,
            copyDeck.urgencyLine,
            copyDeck.actionReason,
        ], 4, 18)
            .filter((item) => item && !weakCommercialFact(item) && !compareTexts.some((candidate) => isPosterEchoText(item, candidate)))
            .slice(0, 2);
        chips.forEach((chip, index) => {
            const text = coverFacts[index] || '';
            if (!text) {
                hideWidgetBlock(chip);
                return;
            }
            showWidgetBlock(chip);
            chip.text = text;
            chip.color = '#fffaf3';
            chip.backgroundColor = index === 0 ? `${accent}ee` : 'rgba(255,255,255,0.12)';
            chip.borderColor = index === 0 ? `${accent}ee` : 'rgba(255,255,255,0.16)';
            chip.borderWidth = 1;
            chip.radius = Math.max(16, Math.round(pageWidth * 0.016));
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 18, 14));
            chip.lineHeight = 1.14;
            chip.textEffects = [];
            applyWidgetRect(chip, {
                left: footerInnerLeft + index * Math.round(pageWidth * 0.24),
                top: footerTop + Math.round(pageHeight * 0.022),
                width: Math.round(pageWidth * 0.21),
                height: Math.round(pageHeight * 0.038),
            });
            setWidgetAlign(chip, 'center');
        });
        chips.slice(2).forEach((chip) => hideWidgetBlock(chip));
        metaWidgets.forEach((meta, index) => {
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            const metaText = compactDeckLine(copyDeck.urgencyLine || copyDeck.trustLine || String(meta.text || '').trim(), 18);
            if (!metaText || weakCommercialFact(metaText) || compareTexts.some((candidate) => isPosterEchoText(metaText, candidate))) {
                hideWidgetBlock(meta);
                return;
            }
            showWidgetBlock(meta);
            meta.text = metaText;
            meta.color = eventMuted;
            meta.backgroundColor = '#00000000';
            meta.borderColor = '#00000000';
            meta.borderWidth = 0;
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 16, 12));
            meta.textEffects = [];
            applyWidgetRect(meta, {
                left: footerInnerLeft,
                top: footerTop + Math.round(pageHeight * 0.072),
                width: Math.round(pageWidth * 0.3),
                height: Math.round(pageHeight * 0.03),
            });
            setWidgetAlign(meta, 'left');
        });
        if (cta && !isCollapsedWidget(cta)) {
            applyWidgetRect(cta, {
                left: footerInnerLeft,
                top: footerTop + footerHeight - Math.round(pageHeight * 0.06),
                width: ctaWidth,
                height: Math.round(pageHeight * 0.046),
            });
            cta.backgroundColor = accent;
            cta.borderColor = accent;
            cta.borderWidth = 0;
            cta.radius = Math.max(18, Math.round(pageWidth * 0.018));
            cta.color = '#fffaf4';
            cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 26, 20));
            cta.textEffects = [];
            setWidgetAlign(cta, 'center');
        }
        if (priceTag && !isCollapsedWidget(priceTag) && priceNum && !isCollapsedWidget(priceNum)) {
            applyWidgetRect(priceTag, {
                left: footerInnerRight - priceColWidth,
                top: footerTop + Math.round(pageHeight * 0.024),
                width: priceColWidth,
                height: Math.round(pageHeight * 0.038),
            });
            priceTag.backgroundColor = accent;
            priceTag.borderColor = accent;
            priceTag.borderWidth = 0;
            priceTag.radius = Math.max(14, Math.round(pageWidth * 0.014));
            priceTag.color = '#fffaf4';
            priceTag.fontSize = Math.max(Number(priceTag.fontSize || 0), getTextFont(pageWidth, 18, 14));
            priceTag.textEffects = [];
            setWidgetAlign(priceTag, 'center');
            applyWidgetRect(priceNum, {
                left: footerInnerRight - priceColWidth,
                top: footerTop + Math.round(pageHeight * 0.068),
                width: priceColWidth,
                height: Math.round(pageHeight * 0.06),
            });
            priceNum.backgroundColor = '#00000000';
            priceNum.borderColor = '#00000000';
            priceNum.borderWidth = 0;
            priceNum.color = '#fff6ed';
            priceNum.fontSize = Math.max(Number(priceNum.fontSize || 0), getTextFont(pageWidth, 70, 44));
            priceNum.lineHeight = 0.95;
            priceNum.textEffects = [];
            setWidgetAlign(priceNum, 'right');
        }
        if (qr && !isCollapsedWidget(qr)) {
            applyWidgetRect(qr, {
                left: footerInnerRight - Math.round(pageWidth * 0.075),
                top: footerTop + footerHeight - Math.round(pageWidth * 0.075) - Math.round(pageHeight * 0.02),
                width: Math.round(pageWidth * 0.075),
                height: Math.round(pageWidth * 0.075),
            });
        }
    }
    if (family === 'festive-frame') {
        const festiveSource = [
            copyDeck.offerLine,
            copyDeck.urgencyLine,
            ...(Array.isArray(copyDeck.factCards) ? copyDeck.factCards.map((item) => item?.value || item?.hint || '') : []),
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints : []),
        ].map((item) => compactDeckLine(item, 14)).filter((item, index, arr) => item && !weakCommercialFact(item) && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
        const festiveHeadline = chooseReadableColor(['#fff8ef', '#ffffff', '#fef3c7'], ['#7c2d12', '#111827', '#4c0519'], 6.8);
        const festiveSubline = chooseReadableColor(['#fff1d6', '#fde68a', '#f8fafc'], ['#7c2d12', '#111827', '#4c0519'], 4.4);
        const festiveMuted = chooseReadableColor(['#fef3e2', '#fde7cc', '#e5e7eb'], ['#7c2d12', '#111827', '#4c0519'], 3.6);
        const warmGlass = 'rgba(34,22,16,0.48)';
        const warmGlassBorder = 'rgba(255,244,232,0.18)';
        const footerTop = Math.round(pageHeight * 0.77);
        const footerHeight = Math.round(pageHeight * 0.13);
        const footerLeft = Math.round(pageWidth * 0.08);
        const footerWidth = Math.round(pageWidth * 0.84);
        const footerInnerLeft = footerLeft + Math.round(pageWidth * 0.03);
        const footerInnerWidth = footerWidth - Math.round(pageWidth * 0.06);
        widgets.filter((item) => /^ai_deco_(tl|tr|bl|br)$/.test(String(item?.name || ''))).forEach((item) => hideWidgetBlock(item));
        if (title) {
            title.color = festiveHeadline;
            title.fontSize = Math.max(Number(title.fontSize || 0), getTextFont(pageWidth, 82, 52));
            title.lineHeight = 0.98;
            title.textEffects = [{
                    type: 'shadow',
                    color: 'rgba(18,12,10,0.28)',
                    offsetX: 0,
                    offsetY: 8,
                    blur: 16,
                }];
            applyWidgetRect(title, {
                left: Math.round(pageWidth * 0.11),
                top: Math.round(pageHeight * 0.13),
                width: Math.round(pageWidth * 0.78),
                height: Math.round(pageHeight * 0.14),
            });
            setWidgetAlign(title, 'center');
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            showWidgetBlock(slogan);
            slogan.color = festiveSubline;
            slogan.fontSize = Math.max(Number(slogan.fontSize || 0), getTextFont(pageWidth, 26, 18));
            slogan.lineHeight = 1.18;
            slogan.textEffects = [];
            applyWidgetRect(slogan, {
                left: Math.round(pageWidth * 0.14),
                top: Math.round(pageHeight * 0.29),
                width: Math.round(pageWidth * 0.72),
                height: Math.round(pageHeight * 0.052),
            });
            setWidgetAlign(slogan, 'center');
        }
        if (badge && !isCollapsedWidget(badge)) {
            badge.backgroundColor = accent;
            badge.borderColor = accent;
            badge.borderWidth = 0;
            badge.color = '#fffaf4';
            badge.radius = Math.max(18, Math.round(pageWidth * 0.018));
            badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 22, 17));
            badge.textEffects = [];
            applyWidgetRect(badge, {
                left: Math.round((pageWidth - Math.round(pageWidth * 0.24)) / 2),
                top: Math.round(pageHeight * 0.06),
                width: Math.round(pageWidth * 0.24),
                height: Math.round(pageHeight * 0.042),
            });
            setWidgetAlign(badge, 'center');
        }
        const needsHorizontalBody = body && !isCollapsedWidget(body);
        if (needsHorizontalBody) {
            const festiveBody = compactDeckLine(copyDeck.offerLine || copyDeck.actionReason || String(body.text || '').trim(), 18);
            if (festiveBody && !compareTexts.some((candidate) => isPosterEchoText(festiveBody, candidate))) {
                body.text = festiveBody;
                applyWidgetRect(body, {
                    left: Math.round(pageWidth * 0.14),
                    top: Math.round(pageHeight * 0.69),
                    width: Math.round(pageWidth * 0.72),
                    height: Math.round(pageHeight * 0.046),
                });
                body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 21, 16));
                body.lineHeight = 1.16;
                body.backgroundColor = 'rgba(255,250,244,0.14)';
                body.borderColor = 'rgba(255,246,236,0.16)';
                body.borderWidth = 1;
                body.radius = Math.max(18, Math.round(pageWidth * 0.018));
                body.color = festiveMuted;
                body.textEffects = [];
                setWidgetAlign(body, 'center');
            }
            else {
                hideWidgetBlock(body);
            }
        }
        if (panel) {
            applyWidgetRect(panel, {
                left: footerLeft,
                top: footerTop,
                width: footerWidth,
                height: footerHeight,
            });
            panel.backgroundColor = warmGlass;
            panel.borderColor = warmGlassBorder;
            panel.borderWidth = 1;
            panel.radius = Math.max(26, Math.round(pageWidth * 0.028));
        }
        festiveCards.forEach((card, index) => {
            const nextText = festiveSource[index] || String(card.text || '').trim();
            if (index > 1 || !nextText || compareTexts.some((candidate) => isPosterEchoText(nextText, candidate))) {
                hideWidgetBlock(card);
                return;
            }
            showWidgetBlock(card);
            card.text = nextText;
            card.fontSize = Math.max(Number(card.fontSize || 0), getTextFont(pageWidth, 18, 14));
            card.backgroundColor = index === 0 ? `${accent}eb` : 'rgba(255,255,255,0.12)';
            card.borderColor = index === 0 ? `${accent}eb` : 'rgba(255,255,255,0.16)';
            card.borderWidth = 1;
            card.radius = Math.max(16, Math.round(pageWidth * 0.016));
            card.color = '#fffaf3';
            card.textEffects = [];
            applyWidgetRect(card, {
                left: footerInnerLeft + index * Math.round(pageWidth * 0.28),
                top: footerTop + Math.round(pageHeight * 0.024),
                width: Math.round(pageWidth * 0.24),
                height: Math.round(pageHeight * 0.038),
            });
            setWidgetAlign(card, 'center');
        });
        chips.forEach((chip, index) => {
            if (index > 0) {
                hideWidgetBlock(chip);
                return;
            }
            const chipText = festiveSource[2] || compactDeckLine(copyDeck.actionReason || copyDeck.trustLine || String(chip.text || '').trim(), 14);
            if (!chipText || weakCommercialFact(chipText) || compareTexts.some((candidate) => isPosterEchoText(chipText, candidate))) {
                hideWidgetBlock(chip);
                return;
            }
            showWidgetBlock(chip);
            chip.text = chipText;
            chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 17, 13));
            chip.backgroundColor = 'rgba(255,255,255,0.1)';
            chip.borderColor = 'rgba(255,255,255,0.14)';
            chip.borderWidth = 1;
            chip.radius = Math.max(14, Math.round(pageWidth * 0.015));
            chip.color = '#fff8ef';
            chip.textEffects = [];
            applyWidgetRect(chip, {
                left: footerInnerLeft,
                top: footerTop + Math.round(pageHeight * 0.074),
                width: Math.round(pageWidth * 0.34),
                height: Math.round(pageHeight * 0.034),
            });
            setWidgetAlign(chip, 'center');
        });
        metaWidgets.forEach((meta, index) => {
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            const metaText = compactDeckLine(copyDeck.urgencyLine || copyDeck.trustLine || String(meta.text || '').trim(), 18);
            if (!metaText || weakCommercialFact(metaText) || compareTexts.some((candidate) => isPosterEchoText(metaText, candidate))) {
                hideWidgetBlock(meta);
                return;
            }
            showWidgetBlock(meta);
            meta.text = metaText;
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 16, 12));
            meta.backgroundColor = '#00000000';
            meta.borderColor = '#00000000';
            meta.borderWidth = 0;
            meta.color = festiveMuted;
            meta.textEffects = [];
            applyWidgetRect(meta, {
                left: footerInnerLeft + Math.round(pageWidth * 0.37),
                top: footerTop + Math.round(pageHeight * 0.074),
                width: Math.round(pageWidth * 0.23),
                height: Math.round(pageHeight * 0.03),
            });
            setWidgetAlign(meta, 'left');
        });
        if (cta && !isCollapsedWidget(cta)) {
            applyWidgetRect(cta, {
                left: footerLeft + footerWidth - Math.round(pageWidth * 0.27) - Math.round(pageWidth * 0.03),
                top: footerTop + footerHeight - Math.round(pageHeight * 0.053),
                width: Math.round(pageWidth * 0.27),
                height: Math.round(pageHeight * 0.042),
            });
            cta.backgroundColor = accent;
            cta.borderColor = accent;
            cta.borderWidth = 0;
            cta.radius = Math.max(16, Math.round(pageWidth * 0.016));
            cta.color = '#fffaf4';
            cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 21, 16));
            cta.textEffects = [];
            setWidgetAlign(cta, 'center');
        }
    }
    if (family === 'hero-center') {
        const priceTagWidgets = widgets.filter((widget) => widget.name === 'ai_price_tag');
        const priceNumWidgets = widgets.filter((widget) => widget.name === 'ai_price_num');
        const livePriceTag = priceTagWidgets[priceTagWidgets.length - 1] || priceTag;
        const livePriceNum = priceNumWidgets[priceNumWidgets.length - 1] || priceNum;
        priceTagWidgets.slice(0, -1).forEach((widget) => hideWidgetBlock(widget));
        priceNumWidgets.slice(0, -1).forEach((widget) => hideWidgetBlock(widget));
        const heroFacts = [
            ...(Array.isArray(copyDeck.factCards) ? copyDeck.factCards.map((item) => item?.value || item?.hint || '') : []),
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints : []),
            copyDeck.offerLine,
            copyDeck.urgencyLine,
        ].map((item) => compactDeckLine(item, 14)).filter((item, index, arr) => item && !weakCommercialFact(item) && arr.findIndex((cur) => isSamePosterText(cur, item)) === index).slice(0, 3);
        const desiredHeroChips = heroFacts
            .filter((text) => text && !compareTexts.some((candidate) => isPosterEchoText(text, candidate)))
            .slice(0, 1);
        const ensureHeroChip = (name, text) => {
            let chip = widgets.find((widget) => widget.name === name);
            if (!chip) {
                chip = makeTextWidget(name, {
                    text: text || '',
                    left: 0,
                    top: 0,
                    width: Math.round(pageWidth * 0.24),
                    height: Math.round(pageHeight * 0.042),
                    fontSize: getTextFont(pageWidth, 18, 14),
                    lineHeight: 1.18,
                    color: strongText,
                    backgroundColor: '#fffaf3ee',
                    textAlign: 'center',
                    textAlignLast: 'center',
                    borderWidth: 1,
                    borderColor: `${accent}38`,
                    radius: Math.max(14, Math.round(pageWidth * 0.018)),
                    fontWeight: 'bold',
                });
                widgets.push(chip);
            }
            return chip;
        };
        const heroChipWidgets = desiredHeroChips.map((text, index) => ensureHeroChip(`ai_chip_${index + 1}`, text));
        ['ai_chip_3', 'ai_chip_4', 'ai_chip_detail_2', 'ai_chip_detail_3'].forEach((name) => {
            const chip = widgets.find((widget) => widget.name === name);
            if (chip)
                hideWidgetBlock(chip);
        });
        const panelLeft = panel ? Number(panel.left || Math.round(pageWidth * 0.06)) : Math.round(pageWidth * 0.06);
        const panelTop = panel ? Number(panel.top || Math.round(pageHeight * 0.54)) : Math.round(pageHeight * 0.54);
        const panelWidth = panel ? Number(panel.width || Math.round(pageWidth * 0.88)) : Math.round(pageWidth * 0.88);
        const panelHeight = panel ? Number(panel.height || Math.round(pageHeight * 0.28)) : Math.round(pageHeight * 0.28);
        const innerLeft = panelLeft + Math.round(pageWidth * 0.035);
        const innerWidth = panelWidth - Math.round(pageWidth * 0.07);
        const heroHeadline = chooseReadableColor(['#fffaf2', '#ffffff', '#fef3c7'], ['#0f172a', '#111827', '#1e293b'], 7);
        const heroSubline = chooseReadableColor(['#e9f1fb', '#fde7c8', '#f8fafc'], ['#0f172a', '#111827', '#1e293b'], 4.6);
        const heroMuted = chooseReadableColor(['#e8edf4', '#dbe4ee', '#f8fafc'], ['#0f172a', '#111827', '#1e293b'], 3.6);
        const hasLivePrice = Boolean(livePriceTag && !isCollapsedWidget(livePriceTag) && livePriceNum && !isCollapsedWidget(livePriceNum) && String(livePriceNum.text || '').trim());
        const footerLeft = Math.round(pageWidth * 0.065);
        const footerTop = Math.round(pageHeight * 0.73);
        const footerWidth = Math.round(pageWidth * 0.87);
        const footerHeight = Math.round(pageHeight * 0.16);
        const footerInnerLeft = footerLeft + Math.round(pageWidth * 0.03);
        const footerInnerRight = footerLeft + footerWidth - Math.round(pageWidth * 0.03);
        const footerInnerWidth = footerWidth - Math.round(pageWidth * 0.06);
        const priceColWidth = hasLivePrice ? Math.round(pageWidth * 0.24) : 0;
        const contentWidth = hasLivePrice ? footerInnerWidth - priceColWidth - Math.round(pageWidth * 0.04) : footerInnerWidth;
        const ctaWidth = Math.round(hasLivePrice ? pageWidth * 0.3 : pageWidth * 0.34);
        const heroFactRows = heroFacts.slice(0, 2);
        if (panel) {
            applyWidgetRect(panel, {
                left: footerLeft,
                top: footerTop,
                width: footerWidth,
                height: footerHeight,
            });
            panel.backgroundColor = 'rgba(15,23,42,0.6)';
            panel.borderColor = 'rgba(255,255,255,0.14)';
            panel.borderWidth = 1;
            panel.radius = Math.max(26, Math.round(pageWidth * 0.03));
        }
        if (badge && !isCollapsedWidget(badge)) {
            applyWidgetRect(badge, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.06),
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.044),
            });
            badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 26, 20));
            badge.backgroundColor = accent;
            badge.borderColor = accent;
            badge.borderWidth = 0;
            badge.color = '#fffaf4';
            badge.radius = Math.max(18, Math.round(pageWidth * 0.018));
            setWidgetAlign(badge, 'center');
        }
        if (body && !isCollapsedWidget(body)) {
            body.text = compactDeckLine(copyDeck.offerLine || copyDeck.actionReason || copyDeck.urgencyLine || String(body.text || '').trim(), 20) || String(body.text || '').trim();
            applyWidgetRect(body, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.35),
                width: Math.round(pageWidth * 0.56),
                height: Math.round(pageHeight * 0.045),
            });
            body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 21, 16));
            body.lineHeight = 1.16;
            body.backgroundColor = '#00000000';
            body.borderColor = '#00000000';
            body.borderWidth = 0;
            body.radius = 0;
            body.color = heroMuted;
            body.textEffects = [];
            setWidgetAlign(body, 'left');
        }
        if (title) {
            applyWidgetRect(title, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.14),
                width: Math.round(pageWidth * 0.72),
                height: Math.round(pageHeight * 0.14),
            });
            title.fontSize = Math.max(Number(title.fontSize || 0), getTextFont(pageWidth, 86, 56));
            title.lineHeight = 0.96;
            title.color = heroHeadline;
            title.textEffects = [{
                    type: 'shadow',
                    color: 'rgba(10,12,18,0.32)',
                    offsetX: 0,
                    offsetY: 10,
                    blur: 18,
                }];
            setWidgetAlign(title, 'left');
        }
        if (slogan && !isCollapsedWidget(slogan) && String(slogan.text || '').trim()) {
            applyWidgetRect(slogan, {
                left: Math.round(pageWidth * 0.08),
                top: Math.round(pageHeight * 0.29),
                width: Math.round(pageWidth * 0.72),
                height: Math.round(pageHeight * 0.05),
            });
            slogan.fontSize = Math.max(Number(slogan.fontSize || 0), getTextFont(pageWidth, 27, 19));
            slogan.lineHeight = 1.16;
            slogan.color = heroSubline;
            slogan.textEffects = [];
            setWidgetAlign(slogan, 'left');
        }
        const infoTop = footerTop + Math.round(pageHeight * 0.024);
        if (livePriceTag && !isCollapsedWidget(livePriceTag)) {
            applyWidgetRect(livePriceTag, {
                left: footerInnerRight - priceColWidth,
                top: footerTop + Math.round(pageHeight * 0.024),
                width: priceColWidth,
                height: Math.round(pageHeight * 0.036),
            });
            livePriceTag.fontSize = Math.max(Number(livePriceTag.fontSize || 0), getTextFont(pageWidth, 20, 16));
            livePriceTag.backgroundColor = accent;
            livePriceTag.borderColor = accent;
            livePriceTag.borderWidth = 0;
            livePriceTag.radius = Math.max(14, Math.round(pageWidth * 0.014));
            livePriceTag.color = '#fffaf4';
            livePriceTag.textEffects = [];
            setWidgetAlign(livePriceTag, 'center');
        }
        if (livePriceNum && !isCollapsedWidget(livePriceNum)) {
            applyWidgetRect(livePriceNum, {
                left: footerInnerRight - priceColWidth,
                top: footerTop + Math.round(pageHeight * 0.066),
                width: priceColWidth,
                height: Math.round(pageHeight * 0.066),
            });
            livePriceNum.fontSize = Math.max(Number(livePriceNum.fontSize || 0), getTextFont(pageWidth, 68, 44));
            livePriceNum.lineHeight = 0.96;
            livePriceNum.backgroundColor = '#00000000';
            livePriceNum.borderColor = '#00000000';
            livePriceNum.borderWidth = 0;
            livePriceNum.color = '#fff7ee';
            livePriceNum.textEffects = [];
            setWidgetAlign(livePriceNum, 'right');
        }
        if (heroChipWidgets.length) {
            heroChipWidgets.forEach((chip, index) => {
                showWidgetBlock(chip);
                chip.text = desiredHeroChips[index] || ' ';
                applyWidgetRect(chip, {
                    left: footerInnerLeft + index * Math.round(pageWidth * 0.25),
                    top: infoTop,
                    width: Math.round(pageWidth * 0.22),
                    height: Math.round(pageHeight * 0.038),
                });
                chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 18, 15));
                chip.lineHeight = 1.14;
                chip.backgroundColor = index === 0 ? `${accent}ee` : 'rgba(255,255,255,0.12)';
                chip.borderColor = index === 0 ? `${accent}ee` : 'rgba(255,255,255,0.16)';
                chip.color = '#fffaf3';
                chip.textEffects = [];
                setWidgetAlign(chip, 'center');
            });
        }
        let detailChip = widgets.find((widget) => widget.name === 'ai_chip_detail_1');
        const detailText = heroFactRows[1] || compactDeckLine(copyDeck.actionReason || copyDeck.trustLine || '', 16);
        if (!detailChip && detailText) {
            detailChip = makeTextWidget('ai_chip_detail_1', {
                text: detailText,
                left: 0,
                top: 0,
                width: Math.round(pageWidth * 0.28),
                height: Math.round(pageHeight * 0.038),
                fontSize: getTextFont(pageWidth, 17, 14),
                lineHeight: 1.16,
                color: '#fff8ef',
                backgroundColor: 'rgba(255,255,255,0.1)',
                textAlign: 'center',
                textAlignLast: 'center',
                borderWidth: 1,
                borderColor: 'rgba(255,255,255,0.14)',
                radius: Math.max(12, Math.round(pageWidth * 0.016)),
            });
            widgets.push(detailChip);
        }
        if (detailChip) {
            if (!detailText) {
                hideWidgetBlock(detailChip);
            }
            else {
                showWidgetBlock(detailChip);
                detailChip.text = detailText;
                applyWidgetRect(detailChip, {
                    left: footerInnerLeft,
                    top: footerTop + Math.round(pageHeight * 0.074),
                    width: Math.round(contentWidth * 0.46),
                    height: Math.round(pageHeight * 0.038),
                });
                detailChip.fontSize = Math.max(Number(detailChip.fontSize || 0), getTextFont(pageWidth, 17, 14));
                detailChip.backgroundColor = 'rgba(255,255,255,0.1)';
                detailChip.borderColor = 'rgba(255,255,255,0.14)';
                detailChip.color = '#fff8ef';
                detailChip.textEffects = [];
                setWidgetAlign(detailChip, 'center');
            }
        }
        metaWidgets.forEach((meta, index) => {
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            const metaText = compactDeckLine(copyDeck.urgencyLine || copyDeck.trustLine || String(meta.text || '').trim(), 18);
            if (!metaText || weakCommercialFact(metaText) || compareTexts.some((candidate) => isPosterEchoText(metaText, candidate))) {
                hideWidgetBlock(meta);
                return;
            }
            showWidgetBlock(meta);
            meta.text = metaText;
            meta.fontSize = Math.max(Number(meta.fontSize || 0), getTextFont(pageWidth, 16, 12));
            meta.backgroundColor = '#00000000';
            meta.borderColor = '#00000000';
            meta.borderWidth = 0;
            meta.color = heroMuted;
            meta.textEffects = [];
            applyWidgetRect(meta, {
                left: footerInnerLeft + Math.round(contentWidth * 0.5),
                top: footerTop + Math.round(pageHeight * 0.076),
                width: Math.round(contentWidth * 0.32),
                height: Math.round(pageHeight * 0.03),
            });
            setWidgetAlign(meta, 'left');
        });
        if (cta && !isCollapsedWidget(cta)) {
            applyWidgetRect(cta, {
                left: footerInnerLeft,
                top: footerTop + footerHeight - Math.round(pageHeight * 0.058),
                width: ctaWidth,
                height: Math.round(pageHeight * 0.045),
            });
            cta.backgroundColor = accent;
            cta.borderColor = accent;
            cta.color = '#ffffff';
            cta.borderWidth = 0;
            cta.radius = Math.max(18, Math.round(pageWidth * 0.018));
            cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 24, 18));
            cta.textEffects = [];
            setWidgetAlign(cta, 'center');
        }
    }
    if (family === 'split-editorial' || family === 'hero-left') {
        const sceneJoined = `${options?.input?.industry || ''} ${options?.input?.purpose || ''} ${options?.input?.theme || ''} ${options?.input?.content || ''}`;
        const infoFacts = [
            ...(Array.isArray(copyDeck.factCards) ? copyDeck.factCards.map((item) => item?.value || item?.hint || '') : []),
            copyDeck.audienceLine,
            copyDeck.offerLine,
            copyDeck.urgencyLine,
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints : []),
        ].map((item) => compactDeckLine(item, 15)).filter((item, index, arr) => item && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
        if (/课程|教育|培训|报名|招聘|招募/.test(sceneJoined)) {
            let infoChips = chips.filter((chip) => !isCollapsedWidget(chip)).slice(0, 3);
            while (infoChips.length < Math.min(3, infoFacts.length)) {
                const chip = makeTextWidget(`ai_chip_detail_${infoChips.length + 1}`, {
                    text: infoFacts[infoChips.length] || '',
                    left: 0,
                    top: 0,
                    width: Math.round(pageWidth * 0.24),
                    height: Math.round(pageHeight * 0.04),
                    fontSize: getTextFont(pageWidth, 17, 14),
                    lineHeight: 1.16,
                    color: strongText,
                    backgroundColor: '#ffffffee',
                    textAlign: 'center',
                    textAlignLast: 'center',
                    borderWidth: 1,
                    borderColor: `${accent}30`,
                    radius: Math.max(12, Math.round(pageWidth * 0.015)),
                    fontWeight: 'bold',
                });
                widgets.push(chip);
                chips.push(chip);
                infoChips.push(chip);
            }
            infoChips.forEach((chip, index) => {
                const text = infoFacts[index] || String(chip.text || '').trim();
                if (!text || compareTexts.some((candidate) => isPosterEchoText(text, candidate))) {
                    hideWidgetBlock(chip);
                    return;
                }
                showWidgetBlock(chip);
                chip.text = text;
                chip.color = strongText;
                chip.backgroundColor = '#ffffffef';
                chip.borderColor = `${accent}32`;
            });
            chips.slice(infoChips.length).forEach((chip) => hideWidgetBlock(chip));
            const visibleInfoChips = infoChips.filter((chip) => !isCollapsedWidget(chip));
            const panelLeft = panel ? Number(panel.left || 0) : Math.round(pageWidth * 0.05);
            const panelTop = panel ? Number(panel.top || 0) : Math.round(pageHeight * 0.05);
            const panelWidth = panel ? Number(panel.width || Math.round(pageWidth * 0.46)) : Math.round(pageWidth * 0.46);
            const panelHeight = panel ? Number(panel.height || Math.round(pageHeight * 0.78)) : Math.round(pageHeight * 0.78);
            const titleLeft = panelLeft + Math.round(pageWidth * 0.035);
            const contentWidth = panelWidth - Math.round(pageWidth * 0.07);
            if (badge && !isCollapsedWidget(badge)) {
                applyWidgetRect(badge, {
                    left: titleLeft,
                    top: panelTop + Math.round(pageHeight * 0.02),
                    width: Math.round(Math.max(pageWidth * 0.18, Math.min(contentWidth * 0.34, pageWidth * 0.28))),
                    height: Math.round(pageHeight * 0.042),
                });
                badge.backgroundColor = accent;
                badge.color = '#ffffff';
                badge.fontSize = Math.max(Number(badge.fontSize || 0), getTextFont(pageWidth, 22, 18));
                setWidgetAlign(badge, 'center');
            }
            const titleTop = panelTop + Math.round(pageHeight * 0.09);
            if (title) {
                applyWidgetRect(title, {
                    left: titleLeft,
                    top: titleTop,
                    width: contentWidth,
                    height: Math.round(pageHeight * 0.12),
                });
                title.fontSize = Math.max(Number(title.fontSize || 0), getTextFont(pageWidth, 62, 44));
                title.lineHeight = 1.08;
                setWidgetAlign(title, 'left');
            }
            if (slogan && !isCollapsedWidget(slogan) && String(slogan.text || '').trim()) {
                applyWidgetRect(slogan, {
                    left: titleLeft,
                    top: titleTop + Math.round(pageHeight * 0.155),
                    width: contentWidth,
                    height: Math.round(pageHeight * 0.065),
                });
                slogan.fontSize = Math.max(Number(slogan.fontSize || 0), getTextFont(pageWidth, 20, 16));
                slogan.lineHeight = 1.22;
                slogan.color = subText;
            }
            const sloganBottom = titleTop + Math.round(pageHeight * 0.235);
            if (body && !isCollapsedWidget(body)) {
                applyWidgetRect(body, {
                    left: titleLeft,
                    top: sloganBottom + Math.round(pageHeight * 0.024),
                    width: Math.round(Math.min(contentWidth, pageWidth * 0.4)),
                    height: Math.round(pageHeight * 0.052),
                });
                body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 20, 16));
                body.lineHeight = 1.16;
                body.backgroundColor = '#fff7eef2';
                body.borderColor = `${accent}24`;
                body.borderWidth = 1;
                body.radius = Math.max(14, Math.round(pageWidth * 0.018));
                body.color = subText;
                setWidgetAlign(body, 'center');
            }
            if (cta && !isCollapsedWidget(cta)) {
                cta.backgroundColor = accent;
                cta.color = '#ffffff';
                cta.borderWidth = 0;
                cta.width = Math.round(Math.max(pageWidth * 0.27, Math.min(Number(cta.width || 0), pageWidth * 0.34)));
                cta.height = Math.round(pageHeight * 0.06);
                cta.left = titleLeft;
                cta.top = Math.min(panelTop + panelHeight - Math.round(pageHeight * 0.11), Math.round(pageHeight * 0.79));
                cta.fontSize = Math.max(Number(cta.fontSize || 0), getTextFont(pageWidth, 23, 18));
            }
            if (visibleInfoChips.length) {
                const chipGap = Math.round(pageWidth * 0.014);
                const availableWidth = Math.round(Math.min(contentWidth, pageWidth * 0.4));
                const chipWidth = Math.round((availableWidth - chipGap * Math.max(0, visibleInfoChips.length - 1)) / Math.max(1, visibleInfoChips.length));
                const chipTop = (body && !isCollapsedWidget(body))
                    ? Number(body.top || 0) + Number(body.height || 0) + Math.round(pageHeight * 0.024)
                    : sloganBottom + Math.round(pageHeight * 0.04);
                visibleInfoChips.forEach((chip, index) => {
                    applyWidgetRect(chip, {
                        left: titleLeft + index * (chipWidth + chipGap),
                        top: chipTop,
                        width: chipWidth,
                        height: Math.round(pageHeight * 0.046),
                    });
                    chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(pageWidth, 17, 14));
                    setWidgetAlign(chip, 'center');
                });
            }
        }
        if (panel) {
            panel.backgroundColor = family === 'hero-left' ? '#fffdf9e9' : '#ffffffe8';
            panel.borderColor = `${accent}22`;
        }
    }
    if (family === 'clean-course') {
        metaWidgets.slice(2).forEach((meta) => hideWidgetBlock(meta));
        if (title && !isCollapsedWidget(title)) {
            title.color = '#0f172a';
            title.textEffects = [];
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            slogan.color = '#475569';
            slogan.textEffects = [];
        }
        if (body && !isCollapsedWidget(body) && supportLine) {
            const nextBody = compactDeckLine(copyDeck.offerLine || copyDeck.actionReason || String(body.text || '').trim(), 22);
            if (!nextBody) {
                hideWidgetBlock(body);
            } else {
                body.text = nextBody;
                applyWidgetRect(body, {
                    left: Math.round(pageWidth * 0.15),
                    top: Math.round(pageHeight * 0.82),
                    width: Math.round(pageWidth * 0.62),
                    height: Math.round(pageHeight * 0.05),
                });
                body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(pageWidth, 18, 14));
                body.lineHeight = 1.18;
                body.backgroundColor = '#fffaf6e0';
                body.borderColor = '#dbe4f0c8';
                body.borderWidth = 1;
                body.radius = Math.max(14, Math.round(pageWidth * 0.016));
                body.color = '#475569';
                body.textEffects = [];
                setWidgetAlign(body, 'left');
            }
        }
    }
    if (family === 'list-recruitment') {
        const roleCard = compactDeckLine(String(slogan?.text || '')
            .replace(/[，,。]/g, '｜')
            .replace(/虚位以待|欢迎加入|欢迎投递/g, '')
            .split(/[｜|]/)
            .slice(0, 2)
            .join(' · '), 18);
        const recruitFacts = [
            compactDeckLine(copyDeck.factCards?.[0] ? [copyDeck.factCards[0].label, copyDeck.factCards[0].value].filter(Boolean).join(' · ') : roleCard, 18),
            compactDeckLine(copyDeck.factCards?.[1] ? [copyDeck.factCards[1].label, copyDeck.factCards[1].value].filter(Boolean).join(' · ') : copyDeck.offerLine, 18),
            compactDeckLine(copyDeck.factCards?.[2] ? [copyDeck.factCards[2].label, copyDeck.factCards[2].value].filter(Boolean).join(' · ') : copyDeck.audienceLine, 18),
            compactDeckLine(copyDeck.actionReason, 16),
            compactDeckLine(copyDeck.trustLine, 16),
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints.map((item) => compactDeckLine(item, 16)) : []),
        ]
            .filter((item, index, arr) => item
            && item.length >= 4
            && !/^(人才|岗位|福利|适合|加码|地点|对象)$/.test(item)
            && arr.findIndex((cur) => isSamePosterText(cur, item)) === index)
            .filter((item) => !compareTexts.some((candidate) => isPosterEchoText(item, candidate)));
        const left = Math.round(pageWidth * 0.09);
        const contentWidth = Math.round(pageWidth * 0.44);
        const cardTop = Math.round(pageHeight * 0.55);
        if (panel) {
            applyWidgetRect(panel, {
                left: Math.round(pageWidth * 0.06),
                top: Math.round(pageHeight * 0.055),
                width: Math.round(pageWidth * 0.5),
                height: Math.round(pageHeight * 0.83),
            });
            panel.backgroundColor = '#fffdf9dc';
            panel.borderColor = `${accent}1f`;
            panel.borderWidth = 1;
            panel.radius = Math.max(22, Math.round(pageWidth * 0.028));
        }
        if (badge && !isCollapsedWidget(badge)) {
            badge.aiReadableMinFont = getTextFont(pageWidth, 20, 16);
            badge.aiReadableMaxFont = getTextFont(pageWidth, 26, 20);
            applyWidgetRect(badge, {
                left,
                top: Math.round(pageHeight * 0.08),
                width: Math.round(pageWidth * 0.22),
                height: Math.round(pageHeight * 0.036),
            });
            badge.backgroundColor = accent;
            badge.color = '#ffffff';
            setWidgetAlign(badge, 'center');
        }
        if (title) {
            title.aiReadableMinFont = getTextFont(pageWidth, 54, 38);
            title.aiReadableMaxFont = getTextFont(pageWidth, 58, 42);
            applyWidgetRect(title, {
                left,
                top: Math.round(pageHeight * 0.145),
                width: contentWidth,
                height: Math.round(pageHeight * 0.12),
            });
            title.lineHeight = 1.08;
            title.color = strongText;
            setWidgetAlign(title, 'left');
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            slogan.aiReadableMinFont = getTextFont(pageWidth, 20, 16);
            slogan.aiReadableMaxFont = getTextFont(pageWidth, 24, 18);
            applyWidgetRect(slogan, {
                left,
                top: Math.round(pageHeight * 0.29),
                width: contentWidth,
                height: Math.round(pageHeight * 0.07),
            });
            slogan.lineHeight = 1.22;
            slogan.color = subText;
            setWidgetAlign(slogan, 'left');
        }
        if (body && !isCollapsedWidget(body)) {
            const nextBody = compactDeckLine(copyDeck.offerLine || copyDeck.actionReason || String(body.text || '').trim(), 24);
            if (!nextBody || compareTexts.some((candidate) => isPosterEchoText(nextBody, candidate))) {
                hideTextWidget(body);
            }
            else {
                showWidgetBlock(body);
                body.text = nextBody;
                body.aiReadableMinFont = getTextFont(pageWidth, 19, 15);
                body.aiReadableMaxFont = getTextFont(pageWidth, 21, 17);
                applyWidgetRect(body, {
                    left,
                    top: Math.round(pageHeight * 0.4),
                    width: contentWidth,
                    height: Math.round(pageHeight * 0.05),
                });
                body.lineHeight = 1.18;
                body.backgroundColor = '#fff7eef4';
                body.borderColor = `${accent}24`;
                body.borderWidth = 1;
                body.radius = Math.max(16, Math.round(pageWidth * 0.018));
                body.color = subText;
                setWidgetAlign(body, 'center');
            }
        }
        recruitCards.forEach((card, index) => {
            const text = recruitFacts[index] || '';
            if (index > 2 || !text || compareTexts.some((candidate) => isPosterEchoText(text, candidate))) {
                hideWidgetBlock(card);
                return;
            }
            showWidgetBlock(card);
            card.text = text;
            card.aiReadableMinFont = getTextFont(pageWidth, 18, 14);
            card.aiReadableMaxFont = getTextFont(pageWidth, 21, 16);
            applyWidgetRect(card, {
                left,
                top: cardTop + index * Math.round(pageHeight * 0.078),
                width: contentWidth,
                height: Math.round(pageHeight * 0.058),
            });
            card.lineHeight = 1.16;
            card.backgroundColor = index === 0 ? '#fff6ecf8' : '#fffdfaf0';
            card.borderColor = `${accent}${index === 0 ? '36' : '1e'}`;
            card.borderWidth = 1;
            card.color = strongText;
            card.textEffects = [];
            card.radius = Math.max(14, Math.round(pageWidth * 0.016));
            setWidgetAlign(card, 'left');
        });
        const chipFacts = [
            compactDeckLine(copyDeck.actionReason, 12),
            compactDeckLine(copyDeck.trustLine, 12),
            compactDeckLine(copyDeck.proofPoints?.[0], 12),
            compactDeckLine(copyDeck.proofPoints?.[1], 12),
        ].filter((item, index, arr) => item
            && item.length >= 4
            && arr.findIndex((cur) => isSamePosterText(cur, item)) === index
            && !compareTexts.some((candidate) => isPosterEchoText(item, candidate)));
        chips.forEach((chip, index) => {
            const text = chipFacts[index] || '';
            if (index > 1 || !text) {
                hideWidgetBlock(chip);
                return;
            }
            showWidgetBlock(chip);
            chip.text = text;
            chip.aiReadableMinFont = getTextFont(pageWidth, 15, 13);
            chip.aiReadableMaxFont = getTextFont(pageWidth, 17, 14);
            applyWidgetRect(chip, {
                left: left + index * Math.round(pageWidth * 0.225),
                top: Math.round(pageHeight * 0.805),
                width: Math.round(pageWidth * 0.205),
                height: Math.round(pageHeight * 0.04),
            });
            chip.backgroundColor = '#fffdf7f0';
            chip.borderColor = `${accent}24`;
            chip.color = strongText;
            chip.borderWidth = 1;
            chip.radius = Math.max(14, Math.round(pageWidth * 0.015));
            setWidgetAlign(chip, 'center');
        });
        if (cta && !isCollapsedWidget(cta)) {
            cta.aiReadableMinFont = getTextFont(pageWidth, 21, 17);
            cta.aiReadableMaxFont = getTextFont(pageWidth, 24, 19);
            applyWidgetRect(cta, {
                left,
                top: Math.round(pageHeight * 0.865),
                width: Math.round(pageWidth * 0.3),
                height: Math.round(pageHeight * 0.056),
            });
            cta.backgroundColor = accent;
            cta.color = '#ffffff';
            cta.borderWidth = 0;
            setWidgetAlign(cta, 'center');
        }
        recruitCards.forEach((card) => {
            const safe = String(card.text || '').trim();
            if (safe.length < 4 || /^(人才|岗位|福利|适合|加码|地点|对象)$/.test(safe))
                hideWidgetBlock(card);
        });
    }
    return true;
}
function enforceLockedCtaAndCommerceSpacing(widgets, family, pageWidth, pageHeight) {
    const cta = widgets.find((item) => item.name === 'ai_cta');
    if (!cta || isCollapsedWidget(cta))
        return;
    if (Number.isFinite(Number(cta.aiPreferredWidth)) && Number(cta.aiPreferredWidth) > 0) {
        cta.width = Math.round(Number(cta.aiPreferredWidth));
        if (cta.record)
            cta.record.width = Math.round(Number(cta.aiPreferredWidth));
    }
    if (Number.isFinite(Number(cta.aiPreferredLeft)))
        cta.left = Math.round(Number(cta.aiPreferredLeft));
    if (Number.isFinite(Number(cta.aiMinTop)))
        cta.top = Math.max(Math.round(Number(cta.aiMinTop)), Math.round(Number(cta.top || 0)));
    if (Number.isFinite(Number(cta.aiMaxTop)))
        cta.top = Math.min(Math.round(Number(cta.aiMaxTop)), Math.round(Number(cta.top || 0)));
    if (!cta.aiPlacementLock)
        return;
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const qr = widgets.find((item) => item.name === 'ai_qrcode');
    const chips = widgets.filter((item) => /^ai_chip(_detail)?_/.test(String(item?.name || '')) && !isCollapsedWidget(item));
    const metas = widgets.filter((item) => /^ai_meta_/.test(String(item?.name || '')) && !isCollapsedWidget(item));
    const gap = Math.round(pageHeight * 0.014);
    const titleBottom = widgetTextBottom(title);
    const sloganBottom = widgetTextBottom(slogan);
    const priceTop = Math.min(Number(priceTag?.top || Infinity), Number(priceNum?.top || Infinity));
    if (Number.isFinite(priceTop) && titleBottom + gap > priceTop && family !== 'grid-product') {
        hideTextWidget(slogan);
        hideTextWidget(body);
        chips.slice(1).forEach((chip) => hideWidgetBlock(chip));
    }
    const contentBottom = Math.max(sloganBottom, widgetTextBottom(body), widgetTextBottom(priceTag), widgetTextBottom(priceNum), titleBottom);
    if (contentBottom + gap > Number(cta.top || 0)) {
        if (!isCollapsedWidget(body))
            hideTextWidget(body);
        chips.slice(1).forEach((chip) => hideWidgetBlock(chip));
        cta.top = Math.max(Number(cta.top || 0), contentBottom + gap);
        if (Number.isFinite(Number(cta.aiMaxTop)))
            cta.top = Math.min(Number(cta.top || 0), Number(cta.aiMaxTop));
    }
    if (qr && !isCollapsedWidget(qr)) {
        const qrLeft = Number(qr.left || 0);
        const qrTop = Number(qr.top || 0);
        const qrRight = qrLeft + Number(qr.width || 0);
        const qrBottom = qrTop + Number(qr.height || 0);
        const qrGap = Math.round(pageHeight * 0.012);
        const blockers = [cta, priceTag, priceNum, ...chips, ...metas]
            .filter((item) => item && !isCollapsedWidget(item))
            .filter((item) => {
            const left = Number(item.left || 0);
            const top = Number(item.top || 0);
            const right = left + Number(item.width || 0);
            const bottom = top + Number(item.height || 0);
            return left < qrRight + qrGap && right > qrLeft - qrGap && top < qrBottom + qrGap && bottom > qrTop - qrGap;
        });
        if (blockers.length) {
            const paddingX = Math.round(pageWidth * 0.03);
            const paddingY = Math.round(pageHeight * 0.03);
            const blockerTop = Math.min(...blockers.map((item) => Number(item.top || 0)));
            qr.left = Math.max(paddingX, Math.min(pageWidth - paddingX - Number(qr.width || 0), pageWidth - paddingX - Number(qr.width || 0)));
            qr.top = Math.max(paddingY, Math.min(pageHeight - paddingY - Number(qr.height || 0), blockerTop - Number(qr.height || 0) - Math.round(pageHeight * 0.024)));
        }
        if (family === 'premium-offer' && !isCollapsedWidget(priceNum)) {
            const premiumQrTop = Number(priceNum.top || 0) - Number(qr.height || 0) - Math.round(pageHeight * 0.02);
            qr.top = Math.max(Math.round(pageHeight * 0.12), Math.min(Number(qr.top || 0), premiumQrTop));
        }
    }
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
    if (isSamePosterText(t, s))
        s = '';
    return { title: t, slogan: s };
}
function clampRatio(value, min = 0, max = 1) {
    return Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
}
function findRoleWidget(widgets, role) {
    const roleMap = {
        title: ['ai_title'],
        slogan: ['ai_slogan'],
        body: ['ai_body'],
        cta: ['ai_cta'],
        hero: ['ai_hero'],
        qrcode: ['ai_qrcode'],
        badge: ['ai_badge'],
        priceTag: ['ai_price_tag'],
        priceNum: ['ai_price_num'],
        meta1: ['ai_meta_1'],
        meta2: ['ai_meta_2'],
        chip1: ['ai_chip_1'],
        chip2: ['ai_chip_2'],
        chip3: ['ai_chip_3'],
        chip4: ['ai_chip_4'],
        card1: ['ai_card_1'],
        card2: ['ai_card_2'],
        card3: ['ai_card_3'],
        card4: ['ai_card_4'],
        logo: ['ai_logo'],
    };
    const candidates = roleMap[role] || [];
    return widgets.find((widget) => candidates.includes(String(widget?.name || '').trim()));
}
function ensureAbsoluteRoleWidgets(widgets, absoluteLayout, pageWidth, pageHeight, copyDeck, palette, readability) {
    const layers = Array.isArray(absoluteLayout?.layers) ? absoluteLayout.layers : [];
    if (!layers.length)
        return widgets;
    const layerRoles = new Set(layers.map((layer) => String(layer?.role || '').trim()).filter(Boolean));
    const ensureTextWidget = (name, text, options = {}) => {
        const safeText = String(text || '').trim();
        if (!safeText)
            return;
        if (widgets.some((widget) => String(widget?.name || '').trim() === name))
            return;
        widgets.push(makeTextWidget(name, {
            text: safeText,
            left: Math.round(pageWidth * 0.08),
            top: Math.round(pageHeight * 0.08),
            width: Math.round(pageWidth * 0.32),
            height: Math.round(pageHeight * 0.05),
            fontSize: getTextFont(pageWidth, 22, 14),
            lineHeight: 1.35,
            color: readability.text,
            textAlign: 'left',
            textAlignLast: 'left',
            ...options,
            record: {
                width: Math.round(pageWidth * 0.32),
                height: Math.round(pageHeight * 0.05),
                minWidth: 12,
                minHeight: 12,
                dir: 'horizontal',
            },
        }));
    };
    if (layerRoles.has('priceTag')) {
        ensureTextWidget('ai_price_tag', copyDeck?.priceBlock?.tag || '', {
            color: readability.ctaText,
            backgroundColor: palette.primary,
            textAlign: 'center',
            textAlignLast: 'center',
            fontWeight: 'bold',
        });
    }
    if (layerRoles.has('priceNum')) {
        ensureTextWidget('ai_price_num', copyDeck?.priceBlock ? `${copyDeck.priceBlock.value || ''}${copyDeck.priceBlock.suffix || ''}`.trim() : '', {
            fontSize: getTextFont(pageWidth, 54, 28),
            lineHeight: 1.06,
            color: palette.primary,
            fontWeight: 'bold',
        });
    }
    const chipTexts = (Array.isArray(copyDeck?.factCards) ? copyDeck.factCards : [])
        .map((item) => String(item?.value || item?.hint || '').trim())
        .filter(Boolean);
    ['chip1', 'chip2', 'chip3', 'chip4'].forEach((role, index) => {
        if (!layerRoles.has(role))
            return;
        ensureTextWidget(`ai_chip_${index + 1}`, chipTexts[index] || '', {
            backgroundColor: `${palette.surface}f2`,
            borderWidth: 1,
            borderColor: `${palette.primary}20`,
            color: readability.text,
            textAlign: 'center',
            textAlignLast: 'center',
            fontWeight: 'bold',
        });
    });
    const metaRows = [
        copyDeck?.urgencyLine ? `限时｜${copyDeck.urgencyLine}` : '',
        copyDeck?.audienceLine ? `适合｜${copyDeck.audienceLine}` : '',
        copyDeck?.trustLine ? `背书｜${copyDeck.trustLine}` : '',
        copyDeck?.actionReason ? `理由｜${copyDeck.actionReason}` : '',
    ].filter(Boolean);
    ['meta1', 'meta2'].forEach((role, index) => {
        if (!layerRoles.has(role))
            return;
        ensureTextWidget(`ai_meta_${index + 1}`, metaRows[index] || '', {
            backgroundColor: `${palette.surface}ec`,
            borderWidth: 1,
            borderColor: `${palette.primary}18`,
            color: readability.text,
        });
    });
    return widgets;
}
function applyAbsoluteLayerToWidget(widget, layer, pageWidth, pageHeight) {
    if (!widget || !layer)
        return;
    const left = Math.round(clampRatio(layer.left) * pageWidth);
    const top = Math.round(clampRatio(layer.top) * pageHeight);
    const width = Math.round(clampRatio(layer.width, 0.04, 1) * pageWidth);
    const height = Math.round(clampRatio(layer.height, 0.04, 1) * pageHeight);
    applyWidgetRect(widget, { left, top, width, height });
    if (widget.type === 'w-text') {
        const align = ['left', 'center', 'right'].includes(String(layer.textAlign || '').trim())
            ? String(layer.textAlign).trim()
            : widget.textAlign || 'left';
        setWidgetAlign(widget, align);
        const fontRatio = Number(layer.fontSize || 0);
        if (Number.isFinite(fontRatio) && fontRatio > 0) {
            widget.fontSize = Math.max(12, Math.round(fontRatio * Math.min(pageWidth, pageHeight)));
        }
    }
    if (widget.name === 'ai_hero') {
        widget.fullBleed = left === 0 && top === 0 && width >= pageWidth - 2 && height >= pageHeight - 2;
        fitAiHeroToPage(widget, pageWidth, pageHeight);
    }
}
function applyAbsoluteLayoutPlan(widgets, absoluteLayout, pageWidth, pageHeight) {
    const layers = Array.isArray(absoluteLayout?.layers) ? absoluteLayout.layers : [];
    if (!layers.length)
        return;
    layers.forEach((layer) => {
        const widget = findRoleWidget(widgets, layer?.role);
        applyAbsoluteLayerToWidget(widget, layer, pageWidth, pageHeight);
    });
}
function applyTextStrategyPlan(widgets, designPlan, palette) {
    const textStrategy = String(designPlan?.textStrategy || '').trim();
    const backgroundTone = String(designPlan?.backgroundTone || '').trim();
    const sceneText = `${designPlan?.scene || ''} ${designPlan?.industry || ''} ${designPlan?.tone || ''} ${designPlan?.contentPattern || ''}`.trim();
    const skipForcedPanel = isLightFoodPosterContext(sceneText, designPlan || {}, palette || {});
    const titleWidget = widgets.find((item) => item.name === 'ai_title');
    const sloganWidget = widgets.find((item) => item.name === 'ai_slogan');
    const bodyWidget = widgets.find((item) => item.name === 'ai_body');
    const panelWidget = widgets.find((item) => item.name === 'ai_text_panel');
    const ctaWidget = widgets.find((item) => item.name === 'ai_cta');
    const badgeWidget = widgets.find((item) => item.name === 'ai_badge');
    if (panelWidget && !skipForcedPanel && (textStrategy === 'panel' || backgroundTone === 'dark')) {
        const titleTop = Number(titleWidget?.top || sloganWidget?.top || bodyWidget?.top || panelWidget.top || 0);
        const bodyBottom = Math.max(Number(bodyWidget?.top || 0) + Number(bodyWidget?.height || 0), Number(sloganWidget?.top || 0) + Number(sloganWidget?.height || 0), Number(titleWidget?.top || 0) + Number(titleWidget?.height || 0));
        const panelPadX = Math.round((Number(titleWidget?.width || panelWidget.width || 0)) * 0.06);
        const panelWidth = Math.max(Number(titleWidget?.width || 0), Number(sloganWidget?.width || 0), Number(bodyWidget?.width || 0), Number(panelWidget?.width || 0));
        applyWidgetRect(panelWidget, {
            left: Math.max(0, Number(titleWidget?.left || sloganWidget?.left || bodyWidget?.left || panelWidget.left || 0) - panelPadX),
            top: Math.max(0, titleTop - Math.round((titleWidget?.fontSize || 24) * 0.5)),
            width: panelWidth + panelPadX * 2,
            height: Math.max(Number(panelWidget?.height || 0), bodyBottom - titleTop + Math.round((bodyWidget?.fontSize || 20) * 1.3)),
        });
        panelWidget.backgroundColor = textStrategy === 'panel'
            ? withAlpha(backgroundTone === 'dark' ? '#08111d' : blendColor(palette.background || '#ffffff', '#ffffff', 0.16), backgroundTone === 'dark' ? 'f2' : 'eb')
            : panelWidget.backgroundColor;
    }
    if (panelWidget && !skipForcedPanel && (textStrategy === 'panel' || backgroundTone === 'dark')) {
        const panelBg = String(panelWidget.backgroundColor || '#08111d').trim() || '#08111d';
        const strongText = chooseReadableColor(['#ffffff', '#f8fafc', '#e2e8f0', '#0f172a', '#111111'], [panelBg], 5.6);
        const mutedText = chooseReadableColor(['#e2e8f0', '#cbd5e1', '#ffffff', '#334155'], [panelBg], 4.6);
        [titleWidget, bodyWidget].forEach((widget) => {
            if (widget)
                widget.color = strongText;
        });
        if (sloganWidget)
            sloganWidget.color = mutedText;
        widgets
            .filter((item) => item && (String(item.name || '').startsWith('ai_list_') || String(item.name || '').startsWith('ai_meta_')))
            .forEach((widget) => {
            widget.color = mutedText;
            widget.backgroundColor = widget.backgroundColor || withAlpha(blendColor(panelBg, '#ffffff', 0.06), 'd8');
        });
        widgets
            .filter((item) => item && String(item.name || '').startsWith('ai_chip_'))
            .forEach((widget) => {
            widget.color = strongText;
            widget.backgroundColor = widget.backgroundColor || withAlpha(blendColor(panelBg, '#ffffff', 0.08), 'dc');
        });
        if (ctaWidget) {
            ctaWidget.color = chooseReadableColor(['#ffffff', '#111111', '#f8fafc'], [ctaWidget.backgroundColor || palette.primary || '#2563eb'], 4.5);
        }
        if (badgeWidget && !isCollapsedWidget(badgeWidget)) {
            badgeWidget.color = chooseReadableColor(['#ffffff', '#111111'], [badgeWidget.backgroundColor || palette.primary || '#2563eb'], 4.5);
        }
    }
    if (textStrategy === 'clean') {
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => {
            if (widget)
                widget.textEffects = [];
        });
    }
    if (backgroundTone === 'light' || textStrategy === 'panel') {
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => {
            if (widget)
                widget.textEffects = [];
        });
    }
}
function enforceFullBleedHero(widget, pageWidth, pageHeight) {
    if (!widget || widget.name !== 'ai_hero')
        return;
    widget.fullBleed = true;
    widget.left = 0;
    widget.top = 0;
    widget.width = Math.max(1, Math.round(pageWidth || widget.width || 1));
    widget.height = Math.max(1, Math.round(pageHeight || widget.height || 1));
    widget.radius = 0;
    if (widget.record) {
        widget.record.width = widget.width;
        widget.record.height = widget.height;
    }
    fitAiHeroToPage(widget, pageWidth, pageHeight);
}
function sanitizePosterHighlights(headline, subline, bodyText, highlights) {
    const safeHeadline = String(headline || '').trim();
    const safeSubline = String(subline || '').trim();
    const safeBody = String(bodyText || '').trim();
    const filteredBodyLines = (highlights.bodyLines || []).filter((line, index, arr) => {
        const text = String(line || '').trim();
        if (!text)
            return false;
        if (isSamePosterText(text, safeHeadline) || isSamePosterText(text, safeSubline))
            return false;
        return arr.findIndex((item) => isSamePosterText(item, text)) === index;
    });
    const filteredChips = (highlights.infoChips || []).filter((chip, index, arr) => {
        const text = String(chip || '').trim();
        if (!text)
            return false;
        if (isSamePosterText(text, safeHeadline) || isSamePosterText(text, safeSubline) || isSamePosterText(text, safeBody))
            return false;
        if (filteredBodyLines.some((line) => isSamePosterText(line, text)))
            return false;
        return arr.findIndex((item) => isSamePosterText(item, text)) === index;
    });
    const safeBadge = isSamePosterText(highlights.badge, safeHeadline) || isSamePosterText(highlights.badge, safeSubline)
        ? ''
        : String(highlights.badge || '').trim();
    const filteredDetailLines = (highlights.detailLines || []).filter((line, index, arr) => {
        const text = String(line || '').trim();
        if (!text)
            return false;
        if (isSamePosterText(text, safeHeadline) || isSamePosterText(text, safeSubline) || isSamePosterText(text, safeBody))
            return false;
        if (filteredBodyLines.some((item) => isSamePosterText(item, text)))
            return false;
        if (filteredChips.some((item) => isSamePosterText(item, text)))
            return false;
        return arr.findIndex((item) => isSamePosterText(item, text)) === index;
    });
    return Object.assign({}, highlights, {
        badge: safeBadge,
        bodyLines: filteredBodyLines,
        infoChips: filteredChips,
        detailLines: filteredDetailLines,
    });
}
export function buildPosterLayout({ input, result }) {
    const resolvedSize = resolvePosterSize(input.sizeKey, result.size);
    const width = resolvedSize.width;
    const height = resolvedSize.height;
    const palette = result.palette;
    const readability = resolveReadablePalette(palette);
    let copyDeck = getPosterCopyDeck(input, result);
    let head = dedupePosterTitleSlogan(copyDeck.heroHeadline || result.title, copyDeck.supportLine || result.slogan);
    let layoutTitle = normalizePosterHeadline(stripInternalPromptEcho(head.title) || getSafeText(copyDeck.heroHeadline || result.title, '').trim());
    let layoutSlogan = normalizePosterSubline(stripInternalPromptEcho(head.slogan) || getSafeText(copyDeck.supportLine || result.slogan, '').trim());
    let bodySeed = [copyDeck.offerLine, ...(copyDeck.proofPoints || []), copyDeck.actionReason, copyDeck.audienceLine, copyDeck.trustLine]
        .filter(Boolean)
        .join('｜');
    let layoutBody = stripInternalPromptEcho(bodySeed || result.body) || getSafeText(result.body, '补充描述文案');
    const marginX = Math.round(width * 0.088);
    const marginTop = Math.round(height * 0.082);
    const safeBottom = Math.round(height * 0.088);
    const sizeProfile = getSizeProfile(width, height);
    const planFamily = result.designPlan?.layoutFamily;
    const normalizedPlannedFamily = normalizeLayoutFamily(planFamily);
    const hasPlannedFamily = Boolean(normalizedPlannedFamily);
    const hasAbsoluteLayoutPlan = Array.isArray(result.designPlan?.absoluteLayout?.layers) && result.designPlan.absoluteLayout.layers.length > 0;
    const isWide = width > height;
    const presetFamily = resolvePresetLayoutFamily(input.presetKey, sizeProfile);
    const hasExplicitPreset = Boolean(String(input.presetKey || '').trim());
    const multimodalHints = getPosterMultimodalHints(result);
    const templateRecommendedFamily = getPosterTemplateFamilyRecommendation(result, input);
    const hintedFamily = normalizeLayoutFamily(multimodalHints?.layoutDecision?.recommendedFamily);
    const hintedConfidence = Number(multimodalHints?.layoutDecision?.confidence || 0);
    const templateHintedFamily = normalizeLayoutFamily(templateRecommendedFamily?.family);
    const templateHintedScore = Number(templateRecommendedFamily?.score || 0);
    const structuredHintedFamily = hintedFamily && ((hintedFamily === 'grid-product' && (copyDeck.factCards || []).length >= 2)
        || (hintedFamily === 'premium-offer' && copyDeck.priceBlock)
        || (hintedFamily === 'list-recruitment' && (copyDeck.factCards || []).length >= 2)
        || hintedFamily === 'clean-course'
        || hintedFamily === 'hero-center'
        || hintedFamily === 'hero-left'
        || hintedFamily === 'split-editorial'
        || hintedFamily === 'magazine-cover'
        || hintedFamily === 'festive-frame'
        || hintedFamily === 'xiaohongshu-note');
    const structuredTemplateFamily = templateHintedFamily && (templateHintedFamily === 'grid-product'
        || templateHintedFamily === 'premium-offer'
        || templateHintedFamily === 'list-recruitment'
        || templateHintedFamily === 'clean-course'
        || templateHintedFamily === 'hero-center'
        || templateHintedFamily === 'hero-left'
        || templateHintedFamily === 'split-editorial'
        || templateHintedFamily === 'magazine-cover'
        || templateHintedFamily === 'festive-frame'
        || templateHintedFamily === 'xiaohongshu-note');
    const modelRecommendedFamily = normalizeLayoutFamily(multimodalHints?.layoutDecision?.recommendedFamily || result.designPlan?.layoutFamily);
    const modelHasRecommendation = Boolean(modelRecommendedFamily);
    const shouldPromoteHintedFamily = Boolean(hintedFamily && (hintedConfidence >= 0.35 || structuredHintedFamily));
    const shouldPromoteTemplateFamily = Boolean(!modelHasRecommendation && templateHintedFamily && (templateHintedScore >= 0.9 || structuredTemplateFamily));
    const aiPriorityFamily = normalizeLayoutFamily((shouldPromoteHintedFamily ? hintedFamily : '')
        || modelRecommendedFamily
        || (shouldPromoteTemplateFamily ? templateHintedFamily : '')
        || normalizedPlannedFamily);
    let selectedFamily = aiPriorityFamily || '';
    const sceneText = `${input.industry || ''} ${input.theme || ''} ${input.content || ''}`;
    const commerceLike = /电商|零售|商品|上新|促销|抢购|礼盒|新品|咖啡|茶饮|餐饮|美食/.test(`${input.industry || ''} ${input.purpose || ''} ${sceneText}`);
    const recruitLike = /招聘|招募/.test(`${input.industry || ''} ${input.purpose || ''} ${sceneText}`);
    const courseLike = /课程|教育|培训|报名/.test(`${input.industry || ''} ${input.purpose || ''} ${sceneText}`);
    const fitnessLike = /健身|运动|瑜伽|训练/.test(`${input.industry || ''} ${input.purpose || ''} ${sceneText}`);
    if (!modelHasRecommendation && !aiPriorityFamily && !isWide && commerceLike) {
        selectedFamily = sizeProfile === 'square' ? 'premium-offer' : 'hero-center';
    }
    else if (!modelHasRecommendation && !aiPriorityFamily && recruitLike) {
        selectedFamily = chooseRecruitmentLayoutFamily({
            input,
            result,
            sizeProfile,
            currentFamily: selectedFamily,
            isWide,
        });
    }
    else if (!modelHasRecommendation && !aiPriorityFamily && !isWide && courseLike) {
        selectedFamily = 'clean-course';
    }
    else if (!modelHasRecommendation && !aiPriorityFamily && !isWide && fitnessLike) {
        selectedFamily = sizeProfile === 'square' ? 'hero-center' : 'magazine-cover';
    }
    if (!modelHasRecommendation && !aiPriorityFamily && !isWide && /餐饮|美食|咖啡|茶饮/.test(sceneText) && (selectedFamily === 'hero-left' || selectedFamily === 'split-editorial')) {
        selectedFamily = 'hero-center';
    }
    if (modelHasRecommendation && hintedFamily && shouldPromoteHintedFamily) {
        selectedFamily = hintedFamily;
    }
    if (!selectedFamily && !modelHasRecommendation && presetFamily) {
        selectedFamily = presetFamily;
    }
    if (!selectedFamily && !modelHasRecommendation) {
        selectedFamily = hasExplicitPreset && presetFamily ? presetFamily : resolveLayoutFamily(planFamily, width, height);
    }
    selectedFamily = resolveStructuredLayoutFamily(selectedFamily, result.designPlan, copyDeck, sizeProfile, isWide, {
        input,
        palette,
        aiPriorityFamily,
        lockAiFamily: Boolean(aiPriorityFamily),
    });
    copyDeck = buildFamilySpecializedCopyDeck(copyDeck, selectedFamily, input, result);
    const inferredScene = inferPosterScene(input, result);
    if (!modelHasRecommendation && !isWide && inferredScene === 'recruitment' && selectedFamily !== 'list-recruitment') {
        selectedFamily = 'list-recruitment';
        copyDeck = buildFamilySpecializedCopyDeck(copyDeck, selectedFamily, input, result);
    }
    if (!modelHasRecommendation && !isWide && inferredScene === 'course' && selectedFamily !== 'clean-course') {
        selectedFamily = 'clean-course';
        copyDeck = buildFamilySpecializedCopyDeck(copyDeck, selectedFamily, input, result);
    }
    if (!modelHasRecommendation && !isWide && inferredScene === 'commerce' && !['premium-offer', 'grid-product', 'hero-center'].includes(selectedFamily)) {
        selectedFamily = copyDeck.priceBlock ? 'premium-offer' : 'hero-center';
        copyDeck = buildFamilySpecializedCopyDeck(copyDeck, selectedFamily, input, result);
    }
    if (!modelHasRecommendation && !isWide && inferredScene === 'food' && !['hero-center', 'magazine-cover', 'premium-offer'].includes(selectedFamily)) {
        selectedFamily = copyDeck.priceBlock ? 'hero-center' : 'magazine-cover';
        copyDeck = buildFamilySpecializedCopyDeck(copyDeck, selectedFamily, input, result);
    }
    head = dedupePosterTitleSlogan(copyDeck.heroHeadline || result.title, copyDeck.supportLine || result.slogan);
    layoutTitle = normalizePosterHeadline(stripInternalPromptEcho(head.title) || getSafeText(copyDeck.heroHeadline || result.title, '').trim());
    layoutSlogan = normalizePosterSubline(stripInternalPromptEcho(head.slogan) || getSafeText(copyDeck.supportLine || result.slogan, '').trim());
    bodySeed = [copyDeck.offerLine, ...(copyDeck.proofPoints || []), copyDeck.actionReason, copyDeck.audienceLine, copyDeck.trustLine]
        .filter(Boolean)
        .join('｜');
    layoutBody = stripInternalPromptEcho(bodySeed || result.body) || getSafeText(result.body, '补充描述文案');
    const denseRecruitmentInfo = recruitLike && !isWide && (((copyDeck.factCards || []).length >= 2) || ((copyDeck.proofPoints || []).length >= 3));
    if (!modelHasRecommendation && denseRecruitmentInfo && (selectedFamily === 'hero-left' || selectedFamily === 'hero-center')) {
        selectedFamily = 'list-recruitment';
    }
    const canApplyAbsoluteLayout = hasAbsoluteLayoutPlan && (!normalizedPlannedFamily || normalizedPlannedFamily === selectedFamily);
    const immersiveCommerceLike = !isWide && commerceLike && selectedFamily === 'hero-center';
    const contentProfile = getPosterContentProfile(selectedFamily, result.designPlan?.density || 'balanced', sizeProfile);
    const highlights = sanitizePosterHighlights(layoutTitle, layoutSlogan, layoutBody, derivePosterHighlights(input, result, contentProfile));
    const layoutBodyText = !contentProfile.maxBodyLines
        ? ''
        : highlights.bodyLines.length > 1
            ? highlights.bodyLines.join('\n')
            : (highlights.bodyLines[0] || normalizePosterInfoLine(layoutBody, contentProfile.maxBodyChars || 16));
    const includeHeroLayer = Boolean(String(result.hero?.imageUrl || '').trim());
    const universalFullScreenPoster = includeHeroLayer;
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
    let textWidth = selectedFamily === 'split-editorial' ? Math.round(width * 0.42) : selectedFamily === 'clean-course' ? Math.round(width * 0.52) : isWide ? Math.round(width * 0.44) : Math.round(width * 0.74);
    if (selectedFamily === 'split-editorial' && sizeProfile === 'banner') {
        textWidth = Math.round(width * 0.32);
    }
    if (selectedFamily === 'clean-course' && sizeProfile === 'banner') {
        textWidth = Math.round(width * 0.34);
    }
    if (selectedFamily === 'premium-offer' && sizeProfile === 'square') {
        textWidth = Math.round(width * 0.84);
    }
    if (selectedFamily === 'hero-center' && !isWide) {
        textWidth = Math.round(width * 0.82);
    }
    if (selectedFamily === 'hero-left' && !isWide) {
        textWidth = Math.round(width * 0.8);
    }
    let titleHeightLimit = Math.round(height * (isWide ? 0.24 : 0.18));
    if (sizeProfile === 'banner') {
        titleHeightLimit = Math.round(height * (isWide ? 0.22 : 0.16));
    }
    if (sizeProfile === 'portrait' && height > width * 1.5) {
        titleHeightLimit = Math.round(Math.min(titleHeightLimit, height * 0.14));
    }
    if (!isWide && (selectedFamily === 'premium-offer' || selectedFamily === 'hero-center' || selectedFamily === 'festive-frame')) {
        titleHeightLimit = Math.round(Math.min(titleHeightLimit, height * 0.12));
    }
    let titleFontMax = sizeProfile === 'banner' ? (isWide ? 68 : 82) : isWide ? 90 : 108;
    let titleFontMin = sizeProfile === 'banner' ? 36 : 52;
    if (!isWide && selectedFamily === 'premium-offer') {
        titleFontMax = Math.min(titleFontMax, 78);
        titleFontMin = Math.min(titleFontMin, 38);
    }
    if (!isWide && (selectedFamily === 'hero-center' || selectedFamily === 'festive-frame')) {
        titleFontMax = Math.min(titleFontMax, 84);
    }
    if (!isWide && (selectedFamily === 'list-recruitment' || selectedFamily === 'xiaohongshu-note')) {
        titleFontMax = Math.min(titleFontMax, 82);
    }
    const titleFont = fitTitleFont(layoutTitle, textWidth, titleHeightLimit, getTextFont(width, titleFontMax, titleFontMin));
    const titleHeight = estimateTextHeight(layoutTitle, titleFont, textWidth);
    const sloganFont = getTextFont(width, sizeProfile === 'banner' ? (isWide ? 22 : 26) : isWide ? 28 : 34, 20);
    const bodyFont = getTextFont(width, sizeProfile === 'banner' ? (isWide ? 18 : 22) : isWide ? 23 : 28, 18);
    const ctaFont = getTextFont(width, sizeProfile === 'banner' ? (isWide ? 22 : 26) : isWide ? 28 : 32, 22);
    const qrStrategy = result.designPlan?.qrStrategy;
    const wantQr = Boolean(String(input.qrUrl || '').trim());
    const qrCorner = wantQr && qrStrategy !== 'cta';
    const qrSize = qrCorner ? Math.round(Math.min(width, height) * (sizeProfile === 'banner' ? 0.12 : 0.14)) : 0;
    const ctaHeight = Math.round(ctaFont * 2.7);
    const baseCtaRatio = selectedFamily === 'list-recruitment'
        ? 0.42
        : selectedFamily === 'hero-center' || selectedFamily === 'xiaohongshu-note'
            ? 0.38
            : selectedFamily === 'premium-offer'
                ? (sizeProfile === 'square' ? 0.4 : 0.34)
                : 0.3;
    const ctaWidth = Math.round(Math.max(width * baseCtaRatio, ctaFont * Math.max(String(result.cta || '').length, 4) + 54));
    const textLeft = selectedFamily === 'clean-course' ? marginX + Math.round(width * 0.12) : marginX;
    const badgeFont = getTextFont(width, sizeProfile === 'banner' ? 15 : 18, 12);
    const badgeHeight = Math.round(badgeFont * 1.95);
    const badgeWidth = Math.round(Math.max(width * 0.14, badgeFont * Math.max(String(highlights.badge || '').length, 4) + 24));
    const segmentFallbacks = splitBodyLines(layoutBody, 5)
        .map((line) => normalizePosterInfoLine(line, 14))
        .filter((line, index, arr) => line
        && !isSamePosterText(line, layoutTitle)
        && !isSamePosterText(line, layoutSlogan)
        && arr.findIndex((item) => isSamePosterText(item, line)) === index);
    const explicitFactCards = (copyDeck.factCards || []).map((item) => item.value).filter(Boolean);
    const fallbackInfoChips = (selectedFamily === 'premium-offer' || selectedFamily === 'festive-frame' || selectedFamily === 'grid-product' || (selectedFamily === 'hero-center' && immersiveCommerceLike))
        ? segmentFallbacks.slice(0, selectedFamily === 'grid-product' ? 3 : 2)
        : [];
    const chipTexts = ((selectedFamily === 'grid-product'
        || selectedFamily === 'premium-offer'
        || selectedFamily === 'festive-frame'
        || (selectedFamily === 'hero-center' && immersiveCommerceLike)) && explicitFactCards.length
        ? explicitFactCards
        : highlights.infoChips && highlights.infoChips.length
        ? highlights.infoChips
        : fallbackInfoChips).slice(0, contentProfile.maxChips || 5);
    const detailLines = ([copyDeck.actionReason, copyDeck.audienceLine, copyDeck.trustLine]
        .filter(Boolean)
        .concat(highlights.detailLines && highlights.detailLines.length
        ? highlights.detailLines
        : (selectedFamily === 'premium-offer' || selectedFamily === 'festive-frame'
            ? segmentFallbacks.slice(chipTexts.length, chipTexts.length + 2)
            : []))).filter((item, index, arr) => item && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
    const structuredFacts = highlights.structuredFacts || {};
    const recruitmentMode = selectedFamily === 'list-recruitment'
        ? inferRecruitmentPosterMode(input, result)
        : '';
    const recruitmentDecoCopy = selectedFamily === 'list-recruitment'
        ? getRecruitmentDecoCopy(recruitmentMode)
        : { main: '', side: '', footer: '' };
    const recruitmentCards = selectedFamily === 'list-recruitment'
        ? ((copyDeck.factCards || []).length
            ? copyDeck.factCards.map((item) => item.value || item.hint).filter(Boolean).slice(0, 3)
            : deriveRecruitmentFactCards(input, result, highlights, 3))
        : [];
    const chipFont = getTextFont(width, sizeProfile === 'banner' ? 15 : 18, 13);
    const chipHeight = Math.round(chipFont * 2.05);
    const chipGap = Math.round(width * 0.018);
    const panelStyle = getReadablePanelStyle(palette, readability);
    const effectivePanelStyle = fitnessLike && (selectedFamily === 'hero-center' || selectedFamily === 'magazine-cover')
        ? {
            panelBackground: '#08111df2',
            panelBorder: withAlpha(blendColor('#08111d', palette.primary || '#F4C86A', 0.26), 'de'),
        }
        : panelStyle;
    const pushInfoChip = (name, text, left, top, chipWidth, backgroundColor = `${palette.surface}f2`, color = readability.text) => {
        widgets.push(makeTextWidget(name, {
            text,
            left,
            top,
            width: chipWidth,
            height: chipHeight,
            fontSize: chipFont,
            lineHeight: 1.35,
            color,
            backgroundColor,
            textAlign: 'center',
            textAlignLast: 'center',
            fontWeight: 'bold',
            record: {
                width: chipWidth,
                height: chipHeight,
                minWidth: chipFont,
                minHeight: chipFont,
                dir: 'horizontal',
            },
        }));
    };
    const pushMetaInfo = (name, text, left, top, metaWidth, align = 'left') => {
        const safeText = String(text || '').trim();
        if (!safeText)
            return;
        widgets.push(makeTextWidget(name, {
            text: safeText,
            left,
            top,
            width: metaWidth,
            height: Math.round(chipFont * 1.95),
            fontSize: Math.max(14, chipFont),
            lineHeight: 1.35,
            color: readability.text,
            backgroundColor: `${palette.surface}eb`,
            textAlign: align,
            textAlignLast: align,
            fontWeight: 'normal',
            record: {
                width: metaWidth,
                height: Math.round(chipFont * 1.95),
                minWidth: chipFont,
                minHeight: chipFont,
                dir: 'horizontal',
            },
        }));
    };
    let titleTop = selectedFamily === 'xiaohongshu-note' ? Math.round(height * 0.06) : selectedFamily === 'magazine-cover' ? Math.round(height * 0.62) : marginTop + badgeHeight + Math.round(height * 0.018);
    if (selectedFamily === 'list-recruitment') {
        titleTop = marginTop;
    }
    const titleToSloganGap = Math.round(height * 0.024) + Math.min(Math.round(height * 0.016), Math.round(titleFont * 0.14));
    const sloganTop = titleTop + titleHeight + titleToSloganGap;
    const sloganHeight = estimateTextHeight(layoutSlogan, sloganFont, textWidth);
    let bodyTop = sloganTop + sloganHeight + Math.round(height * 0.018);
    if (selectedFamily === 'magazine-cover') {
        bodyTop = sloganTop + sloganHeight + Math.round(height * 0.02);
    }
    if (selectedFamily === 'list-recruitment') {
        bodyTop = sloganTop + sloganHeight + Math.round(height * 0.02);
    }
    let bodyHeight = layoutBodyText ? estimateTextHeight(layoutBodyText, bodyFont, textWidth) : Math.round(bodyFont * 0.4);
    /** 竖版主图在文案下方时，正文过长会把主图压成一条「小图」，限制正文块高度为主图留出空间 */
    const portraitBigHeroFamilies = new Set(['hero-left', 'xiaohongshu-note', 'festive-frame']);
    if (includeHeroLayer && !isWide && portraitBigHeroFamilies.has(selectedFamily))
        bodyHeight = Math.min(bodyHeight, Math.round(height * 0.2));
    let ctaTop = Math.min(bodyTop + bodyHeight + Math.round(height * 0.028), height - safeBottom - ctaHeight - (qrCorner && !isWide ? qrSize + 24 : 0));
    const heroBottomLimit = Math.max(Math.round(height * 0.2), height - safeBottom - (qrCorner && !isWide ? qrSize + 20 : 0));
    const portraitStackFamilies = HERO_BELOW_TEXT_FAMILIES;
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
    if (universalFullScreenPoster) {
        heroLeft = 0;
        heroTop = 0;
        heroWidth = width;
        heroHeight = height;
    }
    }
    let widgets = [];
    const heroMockupLike = isPosterMockAsset(result.hero?.imageUrl || '');
    const preferHeroObjectLayout = heroMockupLike
        && new Set(['hero-center', 'premium-offer', 'clean-course', 'magazine-cover', 'festive-frame']).has(selectedFamily);
    const shouldFullBleedHero = universalFullScreenPoster || selectedFamily === 'hero-center' || selectedFamily === 'magazine-cover' || selectedFamily === 'festive-frame' || selectedFamily === 'xiaohongshu-note';
    const heroBackdropUrl = preferHeroObjectLayout
        ? createPosterBackdropDataUrl(palette, selectedFamily)
        : (result.hero?.imageUrl || '');
    if (includeHeroLayer) {
        widgets.push(makeImageWidget('ai_hero', {
            left: shouldFullBleedHero ? 0 : heroLeft,
            top: shouldFullBleedHero ? 0 : heroTop,
            width: shouldFullBleedHero ? width : heroWidth,
            height: shouldFullBleedHero ? height : heroHeight,
            radius: shouldFullBleedHero ? 0 : Math.max(22, Math.round(Math.min(width, height) * 0.028)),
            fullBleed: shouldFullBleedHero,
            imgUrl: heroBackdropUrl,
        }));
        fitAiHeroToPage(widgets[widgets.length - 1], width, height);
        if (preferHeroObjectLayout) {
            widgets.push(makeImageWidget('ai_hero_focus', {
                left: Math.round(width * 0.58),
                top: Math.round(height * 0.12),
                width: Math.round(width * 0.24),
                height: Math.round(height * 0.32),
                radius: Math.max(20, Math.round(Math.min(width, height) * 0.024)),
                fullBleed: false,
                imgUrl: result.hero?.imageUrl || '',
            }));
        }
    }
    const panelSceneText = `${input?.theme || ''} ${input?.purpose || ''} ${input?.industry || ''} ${input?.style || ''} ${result.designPlan?.contentPattern || ''}`.trim();
    const backgroundTone = String(result.designPlan?.backgroundTone || '').trim();
    const contentPattern = String(result.designPlan?.contentPattern || '').trim();
    const explicitPanelRequested = String(result.designPlan?.textStrategy || '').trim() === 'panel';
    const multimodalNeedsPanel = Boolean(multimodalHints?.visualAnalysis?.needsPanel);
    const foodLightScene = !isWide && isLightFoodPosterContext(panelSceneText, result.designPlan || {}, palette);
    const alwaysPanelFamilies = new Set(['grid-product', 'clean-course', 'list-recruitment']);
    const panelDensePattern = contentPattern === 'info-cards' || contentPattern === 'list-info';
    const familyNeedsPanel = (alwaysPanelFamilies.has(selectedFamily) && panelDensePattern)
        || (selectedFamily === 'list-recruitment')
        || (selectedFamily === 'premium-offer' && (!foodLightScene && contentPattern === 'price-first'))
        || (selectedFamily === 'hero-center' && backgroundTone === 'dark' && multimodalNeedsPanel);
    const shouldUseTextPanel = familyNeedsPanel || (!foodLightScene && explicitPanelRequested) || (multimodalNeedsPanel && !hasAbsoluteLayoutPlan && !foodLightScene);
    if (shouldUseTextPanel) {
        const panelLeft = selectedFamily === 'hero-center'
            ? immersiveCommerceLike ? Math.round(width * 0.04) : Math.round(width * 0.07)
            : selectedFamily === 'grid-product' || selectedFamily === 'premium-offer' || selectedFamily === 'clean-course' || selectedFamily === 'list-recruitment'
                ? Math.round(width * 0.05)
                : Math.max(Math.round(width * 0.042), textLeft - Math.round(width * 0.03));
        const panelWidth = selectedFamily === 'hero-center'
            ? immersiveCommerceLike ? Math.round(width * 0.92) : Math.round(width * 0.86)
            : selectedFamily === 'grid-product' || selectedFamily === 'premium-offer' || selectedFamily === 'clean-course' || selectedFamily === 'list-recruitment'
                ? Math.round(width * 0.9)
            : Math.min(Math.round(width * 0.72), textWidth + Math.round(width * 0.16));
        const panelTop = selectedFamily === 'grid-product'
            ? Math.round(height * 0.04)
            : selectedFamily === 'premium-offer'
                ? Math.round(height * 0.05)
                : immersiveCommerceLike
                    ? Math.round(height * 0.61)
                : Math.max(Math.round(height * 0.035), titleTop - badgeHeight - Math.round(height * 0.024));
        const panelBottom = selectedFamily === 'grid-product'
            ? Math.round(height * 0.52)
            : selectedFamily === 'premium-offer'
                ? Math.round(height * 0.48)
                : immersiveCommerceLike
                    ? Math.round(height * 0.97)
                : Math.min(height - safeBottom, ctaTop + ctaHeight + Math.round(height * 0.032));
        widgets.push(makeTextWidget('ai_text_panel', {
            text: '　',
            left: panelLeft,
            top: panelTop,
            width: panelWidth,
            height: Math.max(Math.round(height * 0.2), panelBottom - panelTop),
            fontSize: 8,
            lineHeight: 1,
            color: '#ffffff00',
            backgroundColor: effectivePanelStyle.panelBackground,
            borderWidth: 1,
            borderColor: effectivePanelStyle.panelBorder,
            radius: Math.max(20, Math.round(Math.min(panelWidth, panelBottom - panelTop) * 0.05)),
            record: {
                width: panelWidth,
                height: Math.max(Math.round(height * 0.2), panelBottom - panelTop),
                minWidth: 8,
                minHeight: 8,
                dir: 'all',
            },
        }));
    }
    widgets.push(makeTextWidget('ai_badge', {
        text: getSafeText(copyDeck.badge || highlights.badge, ' '),
        left: selectedFamily === 'hero-center' ? Math.round((width - badgeWidth) / 2) : textLeft,
        top: Math.max(Math.round(height * 0.04), titleTop - badgeHeight - Math.round(height * 0.018)),
        width: badgeWidth,
        height: badgeHeight,
        fontSize: Math.max(badgeFont, getTextFont(width, 15, 13)),
        lineHeight: 1.35,
        color: readability.ctaText,
        backgroundColor: palette.primary,
        textAlign: 'center',
        textAlignLast: 'center',
        fontWeight: 'bold',
        record: {
            width: badgeWidth,
            height: badgeHeight,
            minWidth: badgeFont,
            minHeight: badgeFont,
            dir: 'horizontal',
        },
    }));
    widgets.push(makeTextWidget('ai_title', {
            text: getSafeText(layoutTitle, 'AI 海报标题'),
            left: textLeft,
            top: titleTop,
            width: textWidth,
            height: titleHeight,
            fontSize: selectedFamily === 'magazine-cover' ? Math.min(titleFont + 8, getTextFont(width, 96, 36)) : titleFont,
            lineHeight: getLineHeight(titleFont),
            color: shouldUseTextPanel ? chooseReadableColor([readability.text, '#ffffff', '#f8fafc', '#0f172a', '#111111'], [effectivePanelStyle.panelBackground, palette.background], 5.2) : readability.text,
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
            color: shouldUseTextPanel ? chooseReadableColor([readability.muted, readability.text, '#e2e8f0', '#ffffff', '#334155'], [effectivePanelStyle.panelBackground, palette.background], 4.6) : readability.muted,
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
            text: layoutBodyText || ' ',
            left: selectedFamily === 'hero-center' ? Math.round((width - textWidth) / 2) : textLeft,
            top: bodyTop,
            width: textWidth,
            height: bodyHeight,
            fontSize: bodyFont,
            lineHeight: getLineHeight(bodyFont),
            color: shouldUseTextPanel ? chooseReadableColor([readability.text, '#ffffff', '#f8fafc', '#0f172a', '#111111'], [effectivePanelStyle.panelBackground, palette.background], 5.2) : readability.text,
            record: {
                width: textWidth,
                height: bodyHeight,
                minWidth: bodyFont,
                minHeight: bodyFont,
                dir: 'horizontal',
            },
        }),
        makeTextWidget('ai_cta', {
            text: getSafeText(stripInternalPromptEcho(copyDeck.cta || result.cta), '立即了解'),
            left: selectedFamily === 'hero-center' ? Math.round((width - ctaWidth) / 2) : textLeft,
            top: ctaTop,
            width: ctaWidth,
            height: ctaHeight,
            fontSize: ctaFont,
            lineHeight: 1.5,
            color: readability.ctaText,
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
    const chipWidthPool = chipTexts.map((text) => Math.round(Math.max(width * 0.18, chipFont * Math.max(String(text || '').length, 4) + 28)));
    if (selectedFamily === 'premium-offer' && sizeProfile === 'square') {
        const tw = Math.round(width * 0.86);
        const badge = widgets.find((w) => w.name === 'ai_badge');
        const titleW = widgets.find((w) => w.name === 'ai_title');
        const slog = widgets.find((w) => w.name === 'ai_slogan');
        const bod = widgets.find((w) => w.name === 'ai_body');
        const cta = widgets.find((w) => w.name === 'ai_cta');
        if (badge) {
            badge.left = Math.round((width - Number(badge.width || badgeWidth)) / 2);
        }
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
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = chipWidthPool[i] || Math.round(width * 0.24);
            const rowGap = Math.round(width * 0.02);
            const totalWidth = chipTexts.slice(0, 2).reduce((sum, _, index) => sum + (chipWidthPool[index] || chipWidth) + (index > 0 ? rowGap : 0), 0);
            const startLeft = Math.round((width - totalWidth) / 2);
            const left = startLeft + chipTexts.slice(0, i).reduce((sum, _, index) => sum + (chipWidthPool[index] || chipWidth) + rowGap, 0);
            pushInfoChip(`ai_chip_${i + 1}`, text, left, Math.round(height * 0.71), chipWidth, `${palette.secondary}ee`, palette.primary);
        });
    }
    if (selectedFamily === 'hero-center') {
        const badge = widgets.find((w) => w.name === 'ai_badge');
        const titleW = widgets.find((w) => w.name === 'ai_title');
        const slog = widgets.find((w) => w.name === 'ai_slogan');
        const bod = widgets.find((w) => w.name === 'ai_body');
        const cta = widgets.find((w) => w.name === 'ai_cta');
        const tw = Math.round(width * 0.84);
        if (badge) {
            badge.left = Math.round((width - Number(badge.width || badgeWidth)) / 2);
        }
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
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = Math.max(chipWidthPool[i] || Math.round(width * 0.22), Math.round(width * 0.24));
            const totalWidth = chipTexts.slice(0, 2).reduce((sum, _, index) => sum + (chipWidthPool[index] || chipWidth) + (index > 0 ? chipGap : 0), 0);
            const left = Math.round((width - totalWidth) / 2) + chipTexts.slice(0, i).reduce((sum, _, index) => sum + (chipWidthPool[index] || chipWidth) + chipGap, 0);
            pushInfoChip(`ai_chip_${i + 1}`, text, left, Math.round(ctaTop - chipHeight - height * 0.02), chipWidth);
        });
        if (fitnessLike) {
            if (badge) {
                badge.top = Math.round(height * 0.58);
            }
            if (titleW) {
                titleW.top = Math.round(height * 0.64);
                titleW.fontSize = Math.max(Number(titleW.fontSize || 0), getTextFont(width, 82, 48));
                titleW.width = Math.round(width * 0.8);
                titleW.left = Math.round((width - Number(titleW.width || 0)) / 2);
            }
            if (slog) {
                slog.top = Math.round(height * 0.75);
                slog.width = Math.round(width * 0.76);
                slog.left = Math.round((width - Number(slog.width || 0)) / 2);
            }
            if (bod) {
                bod.top = Math.round(height * 0.8);
                bod.width = Math.round(width * 0.78);
                bod.left = Math.round((width - Number(bod.width || 0)) / 2);
            }
            if (cta) {
                cta.top = Math.round(height * 0.89);
                cta.width = Math.max(Number(cta.width || 0), Math.round(width * 0.34));
                cta.left = Math.round((width - Number(cta.width || 0)) / 2);
            }
        }
        if (immersiveCommerceLike) {
            const panel = widgets.find((w) => w.name === 'ai_text_panel');
            const body = widgets.find((w) => w.name === 'ai_body');
            const detailChipWidgets = widgets.filter((w) => /^ai_chip(_detail)?_/.test(String(w.name || '')));
            const hasPriceBlock = Boolean(highlights.priceValue);
            const lightFoodCommerce = /餐饮|美食|茶饮|咖啡|食品|轻食|甜品|面|粉|锅|烧烤|小吃/.test(sceneText) && backgroundTone !== 'dark';
            const panelLeft = Math.round(width * 0.07);
            const panelTop = Math.round(height * (lightFoodCommerce ? 0.7 : 0.6));
            const panelWidth = Math.round(width * 0.86);
            const panelHeight = Math.round(height * (lightFoodCommerce ? 0.17 : 0.25));
            const contentLeft = panelLeft + Math.round(width * 0.05);
            const contentWidth = panelWidth - Math.round(width * 0.1);
            const priceZoneWidth = hasPriceBlock ? Math.round(width * 0.24) : 0;
            const titleWidth = hasPriceBlock ? Math.round(width * 0.48) : Math.round(width * 0.72);
            const chipBaseTop = panelTop + Math.round(height * 0.155);
            if (panel) {
                applyWidgetRect(panel, {
                    left: panelLeft,
                    top: panelTop,
                    width: panelWidth,
                    height: panelHeight,
                });
                panel.backgroundColor = lightFoodCommerce ? '#fff9f3bf' : '#08111dd8';
                panel.borderColor = lightFoodCommerce ? '#f1dcc88f' : withAlpha(blendColor('#08111d', palette.primary || '#f59e0b', 0.18), '8a');
                panel.borderWidth = lightFoodCommerce ? 0 : 1;
                panel.radius = Math.max(26, Math.round(width * 0.042));
            }
            if (badge) {
                applyWidgetRect(badge, {
                    left: contentLeft,
                    top: panelTop - Math.round(height * 0.03),
                    width: Math.max(Number(badge.width || 0), Math.round(width * 0.18)),
                    height: Math.round(height * 0.034),
                });
                badge.backgroundColor = '#fff6e8f4';
                badge.color = palette.primary || '#8a4b25';
                badge.borderColor = '';
                if (String(badge.text || '').trim().length <= 1) {
                    badge.text = ' ';
                    badge.height = 2;
                }
            }
            if (titleW) {
                applyWidgetRect(titleW, {
                    left: contentLeft,
                    top: panelTop + Math.round(height * 0.04),
                    width: titleWidth,
                    height: Math.round(height * 0.08),
                });
                titleW.fontSize = Math.max(Number(titleW.fontSize || 0), getTextFont(width, lightFoodCommerce ? 76 : 70, lightFoodCommerce ? 46 : 42));
                titleW.color = lightFoodCommerce ? '#2f190f' : '#f8fafc';
                titleW.textAlign = 'left';
                titleW.textAlignLast = 'left';
                titleW.lineHeight = 1.08;
                titleW.textEffects = [];
            }
            if (slog) {
                applyWidgetRect(slog, {
                    left: contentLeft,
                    top: panelTop + Math.round(height * 0.112),
                    width: hasPriceBlock ? Math.round(width * 0.46) : Math.round(width * 0.72),
                    height: Math.round(height * 0.05),
                });
                slog.color = lightFoodCommerce ? '#6a4636' : '#e8eef8';
                slog.textAlign = 'left';
                slog.textAlignLast = 'left';
                slog.fontSize = Math.max(Number(slog.fontSize || 0), getTextFont(width, 24, 18));
                slog.lineHeight = 1.28;
                slog.textEffects = [];
            }
            if (body) {
                applyWidgetRect(body, {
                    left: contentLeft,
                    top: panelTop + Math.round(height * 0.19),
                    width: contentWidth,
                    height: Math.round(height * 0.04),
                });
                body.color = lightFoodCommerce ? '#5b4337' : '#f5f7fb';
                body.textAlign = 'left';
                body.textAlignLast = 'left';
                body.fontSize = Math.max(Number(body.fontSize || 0), getTextFont(width, 19, 15));
                body.lineHeight = 1.35;
                body.textEffects = [];
            }
            if (cta) {
                applyWidgetRect(cta, {
                    left: contentLeft,
                    top: panelTop + panelHeight - Math.round(height * 0.068),
                    width: Math.max(Number(cta.width || 0), Math.round(width * 0.31)),
                    height: Math.max(Number(cta.height || 0), Math.round(height * 0.048)),
                });
                cta.backgroundColor = palette.primary || '#8a4b25';
                cta.color = readability.ctaText;
            }
            detailChipWidgets.forEach((chip, index) => {
                const row = Math.floor(index / 2);
                const col = index % 2;
                const chipWidth = Math.round(width * 0.34);
                applyWidgetRect(chip, {
                    left: contentLeft + col * (chipWidth + Math.round(width * 0.022)),
                    top: chipBaseTop + row * Math.round(height * 0.044),
                    width: chipWidth,
                    height: Math.max(Number(chip.height || 0), Math.round(height * 0.035)),
                });
                chip.backgroundColor = lightFoodCommerce ? (col === 0 ? '#fffdf8f0' : '#fff4e5f0') : col === 0 ? '#ffffff12' : withAlpha(palette.primary || '#f59e0b', '24');
                chip.borderColor = lightFoodCommerce ? '#efd7c0d8' : withAlpha('#ffffff', '18');
                chip.color = lightFoodCommerce ? '#533526' : '#f8fafc';
                chip.textAlign = 'center';
                chip.textAlignLast = 'center';
                chip.fontSize = Math.max(Number(chip.fontSize || 0), getTextFont(width, 17, 14));
                chip.textEffects = [];
            });
            if (body) {
                const usedChipRows = Math.ceil(detailChipWidgets.filter((chip) => String(chip.text || '').trim()).length / 2);
                if (usedChipRows >= 2) {
                    body.top = chipBaseTop + usedChipRows * Math.round(height * 0.05);
                }
            }
            if (highlights.priceValue && !widgets.some((w) => w.name === 'ai_price_num')) {
                widgets.push(makeTextWidget('ai_price_tag', {
                    text: highlights.priceTag || '限时福利',
                    left: panelLeft + panelWidth - priceZoneWidth - Math.round(width * 0.04),
                    top: panelTop + Math.round(height * 0.046),
                    width: Math.round(width * 0.2),
                    height: Math.round(height * 0.03),
                    fontSize: getTextFont(width, 16, 12),
                    lineHeight: 1.3,
                    color: readability.ctaText,
                    backgroundColor: palette.primary,
                    textAlign: 'center',
                    textAlignLast: 'center',
                    fontWeight: 'bold',
                }));
                widgets.push(makeTextWidget('ai_price_num', {
                    text: highlights.priceValue,
                    left: panelLeft + panelWidth - priceZoneWidth - Math.round(width * 0.04),
                    top: panelTop + Math.round(height * 0.082),
                    width: Math.round(width * 0.24),
                    height: Math.round(height * 0.058),
                    fontSize: getTextFont(width, 44, 28),
                    lineHeight: 1.05,
                    color: '#fff4ea',
                    fontWeight: 'bold',
                    textAlign: 'right',
                    textAlignLast: 'right',
                }));
            }
            if (!highlights.priceValue) {
                widgets = widgets.filter((w) => w.name !== 'ai_price_tag' && w.name !== 'ai_price_num');
            }
        }
    }
    if (selectedFamily === 'grid-product') {
        widgets = widgets.filter((w) => w.name !== 'ai_body');
        const cardCount = Math.max(2, Math.min(contentProfile.maxCards || 3, 3));
        const totalGap = Math.round(width * 0.04) * Math.max(0, cardCount - 1);
        const cardWidth = Math.round((width - marginX * 2 - totalGap) / cardCount);
        const cardHeight = Math.round(height * 0.105);
        const startLeft = marginX;
        const top = Math.round(height * (sizeProfile === 'banner' ? 0.73 : 0.665));
        const gap = Math.round(width * 0.04);
        const commerceCards = deriveCommerceFactCards(input, result, highlights, cardCount);
        const lines = commerceCards.length ? commerceCards : (detailLines.length ? detailLines : (highlights.bodyLines.length ? highlights.bodyLines : ['核心卖点', '活动信息', '立即了解']));
        const commerceChipTexts = chipTexts.filter((text) => !lines.some((line) => isSamePosterText(line, text))).slice(0, 2);
        commerceChipTexts.forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.26), chipWidthPool[i] || Math.round(width * 0.2));
            pushInfoChip(`ai_chip_${i + 1}`, text, startLeft + i * (chipWidth + chipGap), Math.round(top - chipHeight - height * 0.025), chipWidth, `${palette.surface}f0`, readability.text);
        });
        Array.from({ length: cardCount }).forEach((_, i) => {
            widgets.push(makeTextWidget(`ai_card_${i + 1}`, {
                text: lines[i] || lines[lines.length - 1] || `卖点 ${i + 1}`,
                left: startLeft + i * (cardWidth + gap),
                top,
                width: cardWidth,
                height: cardHeight,
                fontSize: getTextFont(width, 19, 15),
                lineHeight: 1.32,
                color: readability.text,
                backgroundColor: i === 0 ? `${palette.surface}f7` : i === 1 ? `${palette.secondary}36` : `${palette.surface}ee`,
                borderWidth: 1,
                borderColor: i === 1 ? `${palette.primary}33` : `${palette.secondary}4d`,
                textAlign: 'left',
                textAlignLast: 'left',
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
        if (highlights.priceValue) {
            widgets.push(makeTextWidget('ai_price_tag', {
                text: highlights.priceTag || '限时优惠',
                left: Math.round(width * 0.08),
                top: Math.round(height * 0.33),
                width: Math.round(width * 0.22),
                height: Math.round(height * 0.052),
                fontSize: getTextFont(width, 18, 13),
                lineHeight: 1.3,
                color: '#ffffffff',
                backgroundColor: palette.primary,
                textAlign: 'center',
                textAlignLast: 'center',
                fontWeight: 'bold',
            }), makeTextWidget('ai_price_num', {
                text: highlights.priceValue,
                left: Math.round(width * 0.08),
                top: Math.round(height * 0.38),
                width: Math.round(width * 0.3),
                height: Math.round(height * 0.08),
                fontSize: getTextFont(width, 54, 30),
                lineHeight: 1.05,
                color: palette.primary,
                fontWeight: 'bold',
                textAlign: 'left',
                textAlignLast: 'left',
            }));
        }
    }
    if (selectedFamily === 'list-recruitment') {
        widgets = widgets.filter((w) => w.name !== 'ai_body');
        const lines = detailLines.length ? detailLines : (highlights.bodyLines.length ? highlights.bodyLines : splitBodyLines(result.body, 3));
        const lineFont = getTextFont(width, sizeProfile === 'portrait' && height > width * 1.45 ? 21 : 24, 15);
        const lh = Math.round(lineFont * 1.5);
        const listTop = sloganTop + sloganHeight + Math.round(height * 0.03);
        let listBottom = listTop;
        lines.slice(0, 4).forEach((line, i) => {
            const top = listTop + i * (lh + 10);
            listBottom = top + lh + 8;
            widgets.push(makeTextWidget(`ai_list_${i + 1}`, {
                text: `· ${line}`,
                left: marginX,
                top,
                width: Math.round(width * 0.68),
                height: lh + 8,
                fontSize: lineFont,
                lineHeight: 1.45,
                color: '#f8fbff',
                record: {
                    width: Math.round(width * 0.68),
                    height: lh + 8,
                    minWidth: lineFont,
                    minHeight: lineFont,
                    dir: 'horizontal',
                },
            }));
        });
        recruitmentCards.forEach((text, index) => {
            widgets.push(makeTextWidget(`ai_recruit_card_${index + 1}`, {
                text,
                left: marginX,
                top: listBottom + Math.round(height * 0.02) + index * Math.round(height * 0.078),
                width: Math.round(width * 0.32),
                height: Math.round(height * 0.08),
                fontSize: getTextFont(width, 20, 14),
                lineHeight: 1.42,
                color: '#f8fbff',
                backgroundColor: '#112236ee',
                borderWidth: 1,
                borderColor: '#f8fbff1c',
                radius: Math.round(width * 0.02),
                record: {
                    width: Math.round(width * 0.32),
                    height: Math.round(height * 0.08),
                    minWidth: lineFont,
                    minHeight: lineFont,
                    dir: 'all',
                },
            }));
        });
        const ctaW = widgets.find((w) => w.name === 'ai_cta');
        if (ctaW) {
            const cardRows = Math.ceil(recruitmentCards.length / 2);
            const cardBlockBottom = recruitmentCards.length
                ? listBottom + Math.round(height * 0.02) + cardRows * Math.round(height * 0.086)
                : listBottom;
            ctaW.top = Math.min(cardBlockBottom + Math.round(height * 0.02), height - safeBottom - ctaHeight - (qrCorner && !isWide ? qrSize + 24 : 0));
        }
        widgets.push(makeTextWidget('ai_deco_recruit_main', {
            text: recruitmentDecoCopy.main,
            left: Math.round(width * 0.72),
            top: Math.round(height * 0.06),
            width: Math.round(width * 0.2),
            height: Math.round(height * 0.18),
            fontSize: getTextFont(width, recruitmentMode === 'black-gold' ? 84 : 124, 52),
            lineHeight: 0.92,
            fontWeight: 'bold',
            color: palette.primary,
            letterSpacing: 0,
            textAlign: 'center',
            textAlignLast: 'center',
            opacity: recruitmentMode === 'notice' ? 0.1 : 0.16,
            record: {
                width: Math.round(width * 0.2),
                height: Math.round(height * 0.18),
                minWidth: getTextFont(width, 42, 28),
                minHeight: getTextFont(width, 42, 28),
                dir: 'all',
            },
        }));
        widgets.push(makeTextWidget('ai_deco_recruit_side', {
            text: recruitmentDecoCopy.side,
            left: Math.round(width * 0.08),
            top: Math.round(height * 0.032),
            width: Math.round(width * 0.22),
            height: Math.round(height * 0.042),
            fontSize: getTextFont(width, 20, 14),
            lineHeight: 1.1,
            fontWeight: 'bold',
            color: palette.primary,
            textAlign: 'center',
            textAlignLast: 'center',
            record: {
                width: Math.round(width * 0.22),
                height: Math.round(height * 0.042),
                minWidth: getTextFont(width, 18, 14),
                minHeight: getTextFont(width, 18, 14),
                dir: 'all',
            },
        }));
        if (wantQr) {
            widgets.push(makeTextWidget('ai_deco_recruit_footer', {
                text: recruitmentDecoCopy.footer,
                left: Math.round(width * 0.74),
                top: height - safeBottom - Math.round(height * 0.12),
                width: Math.round(width * 0.18),
                height: Math.round(height * 0.036),
                fontSize: getTextFont(width, 18, 14),
                lineHeight: 1.1,
                fontWeight: 'bold',
                color: '#f8fbff',
                textAlign: 'center',
                textAlignLast: 'center',
                record: {
                    width: Math.round(width * 0.18),
                    height: Math.round(height * 0.036),
                    minWidth: getTextFont(width, 16, 12),
                    minHeight: getTextFont(width, 16, 12),
                    dir: 'all',
                },
            }));
        }
    }
    if ((selectedFamily === 'hero-left' || selectedFamily === 'xiaohongshu-note') && chipTexts.length) {
        const overlayTop = includeHeroLayer
            ? Math.max(heroTop + Math.round(heroHeight * 0.66), titleTop + titleHeight + Math.round(height * 0.08))
            : Math.round(ctaTop - chipHeight * 2 - height * 0.03);
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.34), chipWidthPool[i] || Math.round(width * 0.26));
            const left = (includeHeroLayer && !isWide)
                ? marginX + i * (chipWidth + chipGap)
                : textLeft + i * (chipWidth + chipGap);
            pushInfoChip(`ai_chip_${i + 1}`, text, left, overlayTop, chipWidth, `${palette.surface}dd`, readability.text);
        });
    }
    if (selectedFamily === 'magazine-cover' && chipTexts.length) {
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.28), chipWidthPool[i] || Math.round(width * 0.2));
            const left = width - marginX - chipWidth - i * (chipWidth + chipGap);
            pushInfoChip(`ai_chip_${i + 1}`, text, left, Math.round(height * 0.07), chipWidth, `${palette.secondary}ee`, palette.primary);
        });
    }
    if ((selectedFamily === 'split-editorial' || selectedFamily === 'festive-frame') && chipTexts.length) {
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.26), chipWidthPool[i] || Math.round(width * 0.18));
            pushInfoChip(`ai_chip_${i + 1}`, text, textLeft + i * (chipWidth + chipGap), Math.round(ctaTop - chipHeight - height * 0.022), chipWidth);
        });
    }
    if (selectedFamily === 'hero-center' && chipTexts.length && immersiveCommerceLike) {
        const visibleCount = Math.min(chipTexts.length, 3);
        const commerceGap = Math.round(width * 0.018);
        const commerceWidths = chipTexts.slice(0, visibleCount).map((text, index) => Math.min(Math.round(width * 0.24), Math.max(Math.round(width * 0.18), chipFont * Math.max(String(text || '').length, 4) + 28, chipWidthPool[index] || 0)));
        const totalWidth = commerceWidths.reduce((sum, item, index) => sum + item + (index > 0 ? commerceGap : 0), 0);
        const chipTop = Math.round(height * 0.73);
        chipTexts.slice(0, visibleCount).forEach((text, i) => {
            const left = Math.round((width - totalWidth) / 2) + commerceWidths.slice(0, i).reduce((sum, item) => sum + item + commerceGap, 0);
            pushInfoChip(`ai_chip_${i + 1}`, text, left, chipTop, commerceWidths[i], `${palette.surface}f0`, readability.text);
        });
    }
    if ((selectedFamily === 'hero-center' || selectedFamily === 'magazine-cover' || selectedFamily === 'premium-offer') && detailLines.length) {
        const supportTop = Math.round(ctaTop - chipHeight - height * 0.07);
        const visibleDetails = immersiveCommerceLike && selectedFamily === 'hero-center' ? Math.min(detailLines.length, 1) : Math.min(detailLines.length, 2);
        detailLines.slice(0, visibleDetails).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * (immersiveCommerceLike ? 0.46 : 0.28)), Math.max(Math.round(width * (immersiveCommerceLike ? 0.3 : 0.2)), chipFont * Math.max(String(text || '').length, 5) + 34));
            const gap = Math.round(width * 0.02);
            const totalWidth = Array.from({ length: visibleDetails }).reduce((sum, _, index) => {
                const currentText = detailLines[index] || '';
                const currentWidth = Math.min(Math.round(width * (immersiveCommerceLike ? 0.46 : 0.28)), Math.max(Math.round(width * (immersiveCommerceLike ? 0.3 : 0.2)), chipFont * Math.max(String(currentText).length, 5) + 34));
                return sum + currentWidth + (index > 0 ? gap : 0);
            }, 0);
            const left = Math.round((width - totalWidth) / 2) + detailLines.slice(0, i).reduce((sum, item) => {
                const currentWidth = Math.min(Math.round(width * (immersiveCommerceLike ? 0.46 : 0.28)), Math.max(Math.round(width * (immersiveCommerceLike ? 0.3 : 0.2)), chipFont * Math.max(String(item || '').length, 5) + 34));
                return sum + currentWidth + gap;
            }, 0);
            pushInfoChip(`ai_chip_detail_${i + 1}`, text, left, immersiveCommerceLike ? Math.round(height * 0.835) : supportTop, chipWidth, `${palette.surface}e8`, readability.text);
        });
    }
    if ((selectedFamily === 'hero-left' || selectedFamily === 'xiaohongshu-note' || selectedFamily === 'split-editorial' || selectedFamily === 'clean-course' || selectedFamily === 'festive-frame') && detailLines.length) {
        const detailTop = Math.round(ctaTop - chipHeight - height * 0.065);
        detailLines.slice(0, Math.min(detailLines.length, 2)).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.32), Math.max(Math.round(width * 0.2), chipFont * Math.max(String(text || '').length, 5) + 32));
            const gap = Math.round(width * 0.018);
            const baseLeft = selectedFamily === 'split-editorial' || selectedFamily === 'clean-course' ? textLeft : Math.round((width - Math.min(width * 0.74, chipWidth * 2 + gap)) / 2);
            const left = baseLeft + i * (chipWidth + gap);
            pushInfoChip(`ai_chip_detail_${i + 1}`, text, left, detailTop, chipWidth, `${palette.surface}ea`, readability.text);
        });
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
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.3), chipWidthPool[i] || Math.round(width * 0.22));
            pushInfoChip(`ai_chip_${i + 1}`, text, textLeft + i * (chipWidth + chipGap), Math.round(ctaTop - chipHeight - height * 0.02), chipWidth, `${palette.secondary}ee`, palette.primary);
        });
    }
    if (selectedFamily === 'festive-frame') {
        const deco = '※';
        const fs = getTextFont(width, 28, 18);
        const m = marginX * 0.5;
        const festiveCards = deriveFestivalFactCards(input, result, highlights, 3);
        const festiveCardWidth = Math.round(width * 0.22);
        const festiveCardHeight = Math.round(height * 0.065);
        festiveCards.slice(0, 3).forEach((text, index) => {
            widgets.push(makeTextWidget(`ai_festive_card_${index + 1}`, {
                text,
                left: Math.round(width * 0.14) + index * Math.round(width * 0.24),
                top: Math.round(height * 0.79),
                width: festiveCardWidth,
                height: festiveCardHeight,
                fontSize: getTextFont(width, 18, 14),
                lineHeight: 1.3,
                color: palette.primary,
                backgroundColor: `${palette.surface}ef`,
                borderWidth: 1,
                borderColor: `${palette.primary}22`,
                radius: Math.round(width * 0.015),
                textAlign: 'center',
                textAlignLast: 'center',
                fontWeight: 'bold',
                record: {
                    width: festiveCardWidth,
                    height: festiveCardHeight,
                    minWidth: 14,
                    minHeight: 14,
                    dir: 'horizontal',
                },
            }));
        });
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
    const resolvedPriceValue = getPosterPriceDisplay(copyDeck?.priceBlock || {}, highlights.priceValue);
    if ((selectedFamily === 'premium-offer' || (selectedFamily === 'festive-frame' && sizeProfile !== 'banner') || (selectedFamily === 'hero-center' && immersiveCommerceLike)) && resolvedPriceValue) {
        const priceCentered = sizeProfile === 'square' || (selectedFamily === 'festive-frame' && sizeProfile === 'portrait');
        const heroCenterPrice = selectedFamily === 'hero-center' && immersiveCommerceLike;
        const phrasePrice = !isNumericPriceDisplay(resolvedPriceValue);
        const tagW = Math.round(width * (heroCenterPrice ? 0.22 : priceCentered ? 0.34 : 0.22));
        const numW = Math.round(width * (heroCenterPrice ? (phrasePrice ? 0.42 : 0.34) : priceCentered ? (phrasePrice ? 0.5 : 0.4) : (phrasePrice ? 0.34 : 0.24)));
        const tagLeft = heroCenterPrice ? Math.round(width * 0.12) : priceCentered ? Math.round((width - tagW) / 2) : Math.round(width * 0.64);
        const numLeft = heroCenterPrice ? Math.round(width * 0.12) : priceCentered ? Math.round((width - numW) / 2) : Math.round(width * (phrasePrice ? 0.56 : 0.64));
        const tagTop = heroCenterPrice
            ? Math.round(height * 0.645)
            : priceCentered
                ? Math.round(height * (selectedFamily === 'festive-frame' ? 0.26 : 0.52))
                : Math.round(height * 0.12);
        const numTop = heroCenterPrice
            ? Math.round(height * 0.69)
            : priceCentered
                ? Math.round(height * (selectedFamily === 'festive-frame' ? 0.32 : 0.58))
                : Math.round(height * 0.18);
        widgets.push(makeTextWidget('ai_price_tag', {
            text: highlights.priceTag || '限时优惠',
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
            text: resolvedPriceValue,
            left: numLeft,
            top: numTop,
            width: numW,
            height: Math.round(height * (priceCentered ? 0.07 : 0.08)),
            fontSize: getTextFont(width, phrasePrice ? (priceCentered ? 38 : 44) : (priceCentered ? 52 : 64), 24),
            lineHeight: phrasePrice ? 1.12 : 1.05,
            color: palette.primary,
            fontWeight: 'bold',
            textAlign: phrasePrice ? 'left' : 'right',
            textAlignLast: phrasePrice ? 'left' : 'right',
        }));
    }
    if (selectedFamily === 'premium-offer' && chipTexts.length) {
        chipTexts.slice(0, 2).forEach((text, i) => {
            const chipWidth = Math.min(Math.round(width * 0.26), chipWidthPool[i] || Math.round(width * 0.22));
            const chipTop = sizeProfile === 'square' ? Math.round(height * 0.78) : Math.round(ctaTop - chipHeight - height * 0.024);
            const chipLeft = sizeProfile === 'square'
                ? Math.round((width - (chipWidth * Math.min(chipTexts.length, 2) + chipGap * Math.max(0, Math.min(chipTexts.length, 2) - 1))) / 2) + i * (chipWidth + chipGap)
                : textLeft + i * (chipWidth + chipGap);
            pushInfoChip(`ai_chip_${i + 1}`, text, chipLeft, chipTop, chipWidth, `${palette.secondary}ee`, palette.primary);
        });
    }
    const metaLimit = selectedFamily === 'list-recruitment' ? 0 : 2;
    const metaRows = [
        structuredFacts.time ? `时间｜${structuredFacts.time}` : '',
        structuredFacts.place ? `地点｜${structuredFacts.place}` : '',
        structuredFacts.audience ? `对象｜${structuredFacts.audience}` : '',
        structuredFacts.benefit ? `权益｜${structuredFacts.benefit}` : '',
    ].filter((item) => {
        const safe = String(item || '').replace(/^(时间|地点|对象|权益)[｜:：]/, '').trim();
        return safe && !/^(限时|本周|周末|今日)$/.test(safe);
    }).slice(0, metaLimit);
    if (metaRows.length) {
        const metaWidth = !isWide && (selectedFamily === 'hero-center' || selectedFamily === 'premium-offer' || selectedFamily === 'festive-frame' || selectedFamily === 'xiaohongshu-note')
            ? Math.round(width * 0.74)
            : Math.round(width * (selectedFamily === 'split-editorial' || selectedFamily === 'clean-course' ? 0.34 : 0.42));
        const metaLeft = !isWide && (selectedFamily === 'hero-center' || selectedFamily === 'premium-offer' || selectedFamily === 'festive-frame' || selectedFamily === 'xiaohongshu-note')
            ? Math.round((width - metaWidth) / 2)
            : textLeft;
        const metaBaseTop = Math.max(Math.round(height * 0.05), ctaTop - Math.round(height * 0.11) - Math.max(0, metaRows.length - 1) * Math.round(height * 0.035));
        metaRows.forEach((line, index) => {
            pushMetaInfo(`ai_meta_${index + 1}`, line, metaLeft, metaBaseTop + index * Math.round(height * 0.038), metaWidth, metaLeft === textLeft ? 'left' : 'center');
        });
    }
    const badgeWidget = widgets.find((w) => w.name === 'ai_badge');
    const titleWidget = widgets.find((w) => w.name === 'ai_title');
    const sloganWidget = widgets.find((w) => w.name === 'ai_slogan');
    const bodyWidget = widgets.find((w) => w.name === 'ai_body');
    const ctaWidget = widgets.find((w) => w.name === 'ai_cta');
    const heroWidget = widgets.find((w) => w.name === 'ai_hero');
    const panelWidget = widgets.find((w) => w.name === 'ai_text_panel');
    const priceTagWidget = widgets.find((w) => w.name === 'ai_price_tag');
    const priceNumWidget = widgets.find((w) => w.name === 'ai_price_num');
    const infoChipWidgets = widgets.filter((w) => w.name && w.name.startsWith('ai_chip_'));
    const cardWidgets = widgets.filter((w) => w.name && w.name.startsWith('ai_card_'));
    const festiveCardWidgets = widgets.filter((w) => w.name && w.name.startsWith('ai_festive_card_'));
    const recruitCardWidgets = widgets.filter((w) => w.name && w.name.startsWith('ai_recruit_card_'));
    if (selectedFamily === 'hero-left' && !isWide) {
        const tw = Math.round(width * 0.84);
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => applyWidgetRect(widget, { left: Math.round((width - tw) / 2), width: tw }));
        if (badgeWidget)
            centerWidgetHorizontally(badgeWidget, width);
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, { width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.38)) });
            centerWidgetHorizontally(ctaWidget, width);
        }
        if (panelWidget) {
            applyWidgetRect(panelWidget, { left: Math.round(width * 0.06), width: Math.round(width * 0.88) });
        }
    }
    if (selectedFamily === 'split-editorial') {
        const tw = Math.round(width * (sizeProfile === 'banner' ? 0.34 : 0.42));
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => applyWidgetRect(widget, { left: marginX, width: tw }));
        [titleWidget, sloganWidget, bodyWidget, ctaWidget].forEach((widget) => setWidgetAlign(widget, 'left'));
        if (ctaWidget)
            applyWidgetRect(ctaWidget, { left: marginX, width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.3)) });
        if (panelWidget)
            applyWidgetRect(panelWidget, { left: Math.round(width * 0.04), width: Math.round(width * 0.46) });
        if (heroWidget && sizeProfile !== 'banner')
            applyWidgetRect(heroWidget, { left: width - marginX - Number(heroWidget.width || 0), top: Math.round(height * 0.14) });
    }
    if (selectedFamily === 'grid-product') {
        const cardsPerRow = sizeProfile === 'banner' ? 3 : Math.min(3, Math.max(2, cardWidgets.length));
        const rowGap = Math.round(height * 0.02);
        const colGap = Math.round(width * 0.03);
        const availableW = width - marginX * 2 - colGap * Math.max(0, cardsPerRow - 1);
        const cardWidth = Math.round(availableW / cardsPerRow);
        const cardHeight = Math.round(Math.max(height * 0.11, cardWidth * 0.48));
        const startTop = Math.round(height * (sizeProfile === 'banner' ? 0.63 : 0.6));
        const headerTop = Math.round(height * 0.06);
        const headerHeight = Math.round(height * 0.48);
        cardWidgets.forEach((widget, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            applyWidgetRect(widget, {
                left: marginX + col * (cardWidth + colGap),
                top: startTop + row * (cardHeight + rowGap),
                width: cardWidth,
                height: cardHeight,
            });
        });
        if (ctaWidget)
            applyWidgetRect(ctaWidget, { left: marginX, top: Math.round(startTop + cardHeight + rowGap + height * 0.05), width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.38)) });
        if (heroWidget) {
            const gridHeroBottom = Math.min(startTop - Math.round(height * 0.04), headerTop + headerHeight - Math.round(height * 0.05));
            clampHeroIntoBounds(heroWidget, {
                left: Math.round(width * 0.48),
                top: Math.round(height * 0.14),
                right: Math.round(width * 0.9),
                bottom: Math.max(Math.round(height * 0.34), gridHeroBottom),
                minWidth: Math.round(width * 0.34),
                minHeight: Math.round(height * 0.2),
            });
            heroWidget.left = Math.max(Math.round(width * 0.5), width - marginX - Number(heroWidget.width || 0));
        }
        if (titleWidget) {
            applyWidgetRect(titleWidget, { left: marginX, top: Math.round(height * 0.1), width: Math.round(width * 0.54) });
            setWidgetAlign(titleWidget, 'left');
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(width, 64, 36));
        }
        if (sloganWidget) {
            applyWidgetRect(sloganWidget, { left: marginX, top: Math.round(height * 0.285), width: Math.round(width * 0.42) });
            setWidgetAlign(sloganWidget, 'left');
        }
        if (badgeWidget) {
            applyWidgetRect(badgeWidget, { left: marginX, top: Math.round(height * 0.04) });
        }
        if (panelWidget) {
            applyWidgetRect(panelWidget, { left: Math.round(width * 0.05), top: headerTop, width: Math.round(width * 0.9), height: headerHeight });
        }
        if (bodyWidget) {
            hideWidgetBlock(bodyWidget);
        }
        infoChipWidgets.slice(0, 2).forEach((widget, index) => {
            if (!widget)
                return;
            const chipWidth = Math.max(Number(widget.width || 0), Math.round(width * 0.16));
            applyWidgetRect(widget, {
                left: marginX + index * (chipWidth + chipGap),
                top: Math.round(height * 0.5),
                width: chipWidth,
            });
        });
    }
    if (selectedFamily === 'magazine-cover') {
        const tw = Math.round(width * 0.78);
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => {
            applyWidgetRect(widget, { left: Math.round((width - tw) / 2), width: tw });
            setWidgetAlign(widget, 'left');
        });
        if (badgeWidget)
            applyWidgetRect(badgeWidget, { left: Math.round(width * 0.08), top: Math.round(height * 0.08) });
        if (ctaWidget)
            applyWidgetRect(ctaWidget, { left: Math.round(width * 0.11), width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.34)), top: height - safeBottom - Math.round(height * 0.1) });
        if (panelWidget)
            applyWidgetRect(panelWidget, { left: Math.round(width * 0.06), width: Math.round(width * 0.88), top: Math.round(height * 0.54), height: Math.round(height * 0.34) });
        infoChipWidgets.forEach((widget, index) => applyWidgetRect(widget, { left: width - marginX - Number(widget.width || 0) - index * (Number(widget.width || 0) + chipGap), top: Math.round(height * 0.08) }));
        if (heroWidget) {
            const heroBottom = Number(panelWidget?.top || Math.round(height * 0.54)) - Math.round(height * 0.03);
            clampHeroIntoBounds(heroWidget, {
                left: Math.round(width * 0.07),
                top: Math.round(height * 0.06),
                right: Math.round(width * 0.93),
                bottom: Math.max(Math.round(height * 0.34), heroBottom),
                minWidth: Math.round(width * 0.72),
                minHeight: Math.round(height * 0.22),
            });
            heroWidget.left = Math.round((width - Number(heroWidget.width || 0)) / 2);
        }
    }
    if (selectedFamily === 'festive-frame') {
        const tw = Math.round(width * (sizeProfile === 'portrait' ? 0.8 : 0.72));
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => {
            applyWidgetRect(widget, { left: Math.round((width - tw) / 2), width: tw });
            setWidgetAlign(widget, 'center');
        });
        if (badgeWidget)
            centerWidgetHorizontally(badgeWidget, width);
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, { width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.36)) });
            centerWidgetHorizontally(ctaWidget, width);
        }
        if (panelWidget)
            applyWidgetRect(panelWidget, { left: Math.round(width * 0.08), top: Math.round(height * 0.56), width: Math.round(width * 0.84), height: Math.round(height * 0.3) });
        festiveCardWidgets.forEach((widget, index) => {
            applyWidgetRect(widget, {
                left: Math.round(width * 0.14) + index * Math.round(width * 0.24),
                top: Math.round(height * 0.8),
                width: Math.round(width * 0.22),
                height: Math.round(height * 0.06),
            });
        });
    }
    if (selectedFamily === 'list-recruitment') {
        const recruitMode = inferRecruitmentPosterMode(input, result);
        const multimodalHints = getPosterMultimodalHints(result);
        const recruitNeedsPanel = shouldUseLargeTextPanel(selectedFamily, multimodalHints, '#ffffff');
        const recruitMainWidget = widgets.find((w) => w.name === 'ai_deco_recruit_main');
        const recruitSideWidget = widgets.find((w) => w.name === 'ai_deco_recruit_side');
        const recruitFooterWidget = widgets.find((w) => w.name === 'ai_deco_recruit_footer');
        const qrWidget = widgets.find((w) => w.name === 'ai_qrcode');
        const listWidgets = widgets
            .filter((w) => w.name && w.name.startsWith('ai_list_'))
            .sort((a, b) => (Number(String(a.name).split('_').pop()) || 0) - (Number(String(b.name).split('_').pop()) || 0));
        const visibleListCount = Math.min(listWidgets.length, 2);
        const visibleRecruitCardCount = Math.min(recruitCardWidgets.length, 3);
        const panelLeft = Math.round(width * 0.055);
        const panelTop = Math.round(height * 0.058);
        let panelWidth = Math.round(width * (recruitNeedsPanel ? 0.43 : 0.34));
        let panelHeight = Math.round(height * (recruitNeedsPanel ? 0.82 : 0.68));
        if (recruitMode === 'retro') {
            panelWidth = Math.round(width * 0.78);
            panelHeight = Math.round(height * 0.84);
        }
        else if (recruitMode === 'bold-red') {
            panelWidth = Math.round(width * (recruitNeedsPanel ? 0.46 : 0.38));
            panelHeight = Math.round(height * (recruitNeedsPanel ? 0.8 : 0.72));
        }
        else if (recruitMode === 'black-gold') {
            panelWidth = Math.round(width * 0.5);
            panelHeight = Math.round(height * 0.82);
        }
        const contentInset = recruitMode === 'retro' ? Math.round(width * 0.05) : Math.round(width * 0.04);
        const contentLeft = panelLeft + contentInset;
        const contentWidth = panelWidth - contentInset * 2;
        const badgeTop = panelTop + Math.round(height * 0.02);
        const titleTop = panelTop + Math.round(height * 0.078);
        const sloganTop = panelTop + Math.round(height * 0.184);
        const bodyTop = panelTop + Math.round(height * 0.265);
        const cardsTop = panelTop + Math.round(height * 0.355);
        const cardGapY = Math.round(height * 0.014);
        const cardHeight = Math.round(height * 0.052);
        const listTop = cardsTop + visibleRecruitCardCount * (cardHeight + cardGapY) + Math.round(height * 0.022);
        const listRowGap = Math.round(height * 0.043);
        const qrGap = Math.round(width * 0.024);
        const qrReserve = qrWidget ? Number(qrWidget.width || 0) + qrGap : 0;
        const actionHeight = Math.round(height * 0.074);
        const actionTop = Math.min(panelTop + panelHeight - actionHeight - Math.round(height * 0.04), listTop + Math.max(0, visibleListCount - 1) * listRowGap + Math.round(height * 0.07));
        if (panelWidget) {
            applyWidgetRect(panelWidget, {
                left: panelLeft,
                top: panelTop,
                width: panelWidth,
                height: panelHeight,
            });
            panelWidget.backgroundColor = recruitMode === 'retro'
                ? '#f3e3cbf2'
                : recruitMode === 'bold-red'
                    ? (recruitNeedsPanel ? '#fff8f3f0' : '#fffaf0cc')
                : recruitMode === 'black-gold'
                        ? '#071018e8'
                : (recruitNeedsPanel ? '#fffdf7ba' : '#fffdf48e');
            panelWidget.borderColor = recruitMode === 'retro'
                ? '#964234cc'
                : recruitMode === 'bold-red'
                    ? '#d63b2fcc'
                    : recruitMode === 'black-gold'
                        ? '#d3a658aa'
                        : (recruitNeedsPanel ? '#23262d42' : '#23262d24');
            panelWidget.text = '　';
            panelWidget.height = panelHeight;
            if (panelWidget.record)
                panelWidget.record.height = panelHeight;
            panelWidget.radius = recruitMode === 'retro' || recruitMode === 'notice'
                ? Math.round(width * 0.007)
                : Math.round(width * 0.014);
            panelWidget.borderWidth = recruitMode === 'black-gold' ? 2 : (recruitNeedsPanel ? 1 : 0);
        }
        if (badgeWidget) {
            showWidgetBlock(badgeWidget);
            badgeWidget.aiReadableMinFont = getTextFont(width, 20, 16);
            badgeWidget.aiReadableMaxFont = getTextFont(width, 24, 20);
            applyWidgetRect(badgeWidget, {
                left: contentLeft,
                top: badgeTop,
                width: Math.round(width * 0.17),
                height: Math.round(height * 0.036),
            });
            badgeWidget.backgroundColor = recruitMode === 'black-gold' ? '#b88a3b' : recruitMode === 'bold-red' ? '#d83c30' : '#1f2832';
            badgeWidget.color = '#ffffff';
            setWidgetAlign(badgeWidget, 'center');
        }
        if (bodyWidget) {
            showWidgetBlock(bodyWidget);
            bodyWidget.aiReadableMinFont = getTextFont(width, 19, 15);
            bodyWidget.aiReadableMaxFont = getTextFont(width, 21, 17);
            applyWidgetRect(bodyWidget, {
                left: contentLeft,
                top: bodyTop,
                width: contentWidth,
                height: Math.round(height * 0.044),
            });
            bodyWidget.backgroundColor = recruitMode === 'black-gold' ? '#111923e0' : (recruitNeedsPanel ? '#fff8f0ea' : '#fffef7d8');
            bodyWidget.borderColor = recruitMode === 'black-gold' ? '#d3a65844' : (recruitNeedsPanel ? '#1f283224' : '#1f283214');
            bodyWidget.borderWidth = recruitNeedsPanel ? 1 : 0;
            bodyWidget.radius = Math.max(16, Math.round(width * 0.016));
            bodyWidget.color = recruitMode === 'black-gold' ? '#f4ead4' : '#4a5563';
            bodyWidget.lineHeight = 1.18;
            setWidgetAlign(bodyWidget, 'left');
        }
        if (titleWidget) {
            titleWidget.aiReadableMinFont = getTextFont(width, 46, 34);
            titleWidget.aiReadableMaxFont = getTextFont(width, recruitMode === 'black-gold' ? 52 : 50, 38);
            applyWidgetRect(titleWidget, {
                left: contentLeft,
                top: titleTop,
                width: contentWidth,
                height: Math.round(height * 0.095),
            });
            setWidgetAlign(titleWidget, 'left');
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(width, recruitMode === 'black-gold' ? 48 : 46, 34));
            titleWidget.color = recruitMode === 'retro'
                ? '#8d2d20'
                : recruitMode === 'bold-red'
                    ? '#1c1715'
                    : recruitMode === 'black-gold'
                        ? '#f2d7a0'
                        : '#12161b';
            titleWidget.lineHeight = 1.04;
            if (titleWidget.record)
                titleWidget.record.height = Math.round(height * 0.095);
        }
        if (sloganWidget) {
            sloganWidget.aiReadableMinFont = getTextFont(width, 21, 16);
            sloganWidget.aiReadableMaxFont = getTextFont(width, 24, 18);
            applyWidgetRect(sloganWidget, {
                left: contentLeft,
                top: sloganTop,
                width: contentWidth,
                height: Math.round(height * 0.058),
            });
            setWidgetAlign(sloganWidget, 'left');
            sloganWidget.color = recruitMode === 'retro'
                ? '#6f4d39'
                : recruitMode === 'bold-red'
                    ? '#4f3d36'
                    : recruitMode === 'black-gold'
                        ? '#ead8b0'
                        : '#434b56';
            sloganWidget.fontSize = Math.max(Number(sloganWidget.fontSize || 0), getTextFont(width, 21, 16));
            sloganWidget.lineHeight = 1.18;
            if (sloganWidget.record)
                sloganWidget.record.height = Math.round(height * 0.058);
        }
        infoChipWidgets.forEach((widget) => {
            widget.width = 0;
            widget.height = 0;
            widget.opacity = 0;
            if (widget.record) {
                widget.record.width = 0;
                widget.record.height = 0;
            }
        });
        listWidgets.forEach((widget, index) => {
            if (index >= visibleListCount) {
                widget.text = ' ';
                widget.width = 0;
                widget.height = 0;
                widget.opacity = 0;
                if (widget.record) {
                    widget.record.width = 0;
                    widget.record.height = 0;
                }
                return;
            }
            applyWidgetRect(widget, {
                left: contentLeft,
                top: listTop + index * listRowGap,
                width: contentWidth,
                height: Math.round(height * 0.036),
            });
            widget.color = recruitMode === 'retro'
                ? '#51392a'
                : recruitMode === 'bold-red'
                    ? '#2a211e'
                    : recruitMode === 'black-gold'
                        ? '#f5ecd4'
                        : '#1d2630';
            widget.aiReadableMinFont = getTextFont(width, 17, 14);
            widget.aiReadableMaxFont = getTextFont(width, 18, 15);
            widget.fontSize = Math.max(Number(widget.fontSize || 0), getTextFont(width, 18, 15));
            widget.lineHeight = 1.16;
            setWidgetAlign(widget, 'left');
            widget.backgroundColor = recruitMode === 'black-gold' ? '#101823ea' : (recruitNeedsPanel ? '#fffaf4' : '#fffdf7d6');
            widget.borderColor = recruitMode === 'black-gold' ? '#d3a65833' : '#1f283214';
            widget.borderWidth = recruitNeedsPanel ? 1 : 0;
            widget.radius = Math.max(12, Math.round(width * 0.012));
        });
        recruitCardWidgets.forEach((widget, index) => {
            if (index >= visibleRecruitCardCount) {
                widget.text = ' ';
                widget.width = 0;
                widget.height = 0;
                widget.opacity = 0;
                if (widget.record) {
                    widget.record.width = 0;
                    widget.record.height = 0;
                }
                return;
            }
            applyWidgetRect(widget, {
                left: contentLeft,
                top: cardsTop + index * (cardHeight + cardGapY),
                width: contentWidth,
                height: cardHeight,
            });
            widget.backgroundColor = recruitMode === 'retro'
                ? '#f8eedff4'
                : recruitMode === 'bold-red'
                    ? '#fff3edf4'
                    : recruitMode === 'black-gold'
                        ? '#121923f2'
                        : '#fffdfaf2';
            widget.borderColor = recruitMode === 'retro'
                ? '#b67d4f88'
                : recruitMode === 'bold-red'
                    ? '#db4b3c66'
                    : recruitMode === 'black-gold'
                        ? '#d3a65866'
                        : '#1f283235';
            widget.borderWidth = recruitMode === 'black-gold' ? 2 : (recruitNeedsPanel ? 1 : 0);
            widget.color = recruitMode === 'retro'
                ? '#5e4232'
                : recruitMode === 'bold-red'
                    ? '#2d2320'
                    : recruitMode === 'black-gold'
                        ? '#f6e9c4'
                        : '#1b232d';
            widget.radius = recruitMode === 'retro' || recruitMode === 'notice'
                ? Math.round(width * 0.006)
                : Math.round(width * 0.015);
            widget.fontSize = Math.max(Number(widget.fontSize || 0), getTextFont(width, 18, 14));
            widget.aiReadableMinFont = getTextFont(width, 18, 14);
            widget.aiReadableMaxFont = getTextFont(width, 20, 16);
            widget.lineHeight = 1.18;
            setWidgetAlign(widget, 'left');
            widget.height = cardHeight;
            if (widget.record)
                widget.record.height = cardHeight;
        });
        if (ctaWidget) {
            ctaWidget.aiReadableMinFont = getTextFont(width, 21, 17);
            ctaWidget.aiReadableMaxFont = getTextFont(width, 24, 19);
            const ctaWidth = qrWidget
                ? Math.round(Math.max(width * 0.24, Math.min(contentWidth - qrReserve - Math.round(width * 0.012), width * 0.26)))
                : Math.round(Math.max(width * 0.24, Math.min(contentWidth, width * 0.3)));
            applyWidgetRect(ctaWidget, {
                left: contentLeft,
                top: actionTop,
                width: ctaWidth,
                height: actionHeight,
            });
            setWidgetAlign(ctaWidget, 'center');
            ctaWidget.fontSize = Math.max(Number(ctaWidget.fontSize || 0), getTextFont(width, 22, 18));
            ctaWidget.backgroundColor = recruitMode === 'retro'
                ? '#9d3a2c'
                : recruitMode === 'bold-red'
                    ? '#d83c30'
                    : recruitMode === 'black-gold'
                        ? '#b88a3b'
                        : '#1f2832';
            ctaWidget.color = recruitMode === 'black-gold' ? '#10151d' : '#fffaf2';
            ctaWidget.radius = Math.max(18, Math.round(width * 0.018));
        }
        if (qrWidget) {
            applyWidgetRect(qrWidget, {
                left: panelLeft + panelWidth - Number(qrWidget.width || 0) - Math.round(width * 0.032),
                top: actionTop + Math.round((actionHeight - Number(qrWidget.height || 0)) / 2),
            });
        }
        if (recruitFooterWidget) {
            if (qrWidget) {
                applyWidgetRect(recruitFooterWidget, {
                    left: Number(qrWidget.left) - Math.round(width * 0.006),
                    top: Number(qrWidget.top) - Math.round(height * 0.026),
                    width: Number(qrWidget.width || 0) + Math.round(width * 0.012),
                });
                recruitFooterWidget.color = recruitMode === 'black-gold' ? '#f2d7a0' : recruitMode === 'retro' ? '#7b3428' : recruitMode === 'bold-red' ? '#b0362c' : '#38424d';
                recruitFooterWidget.fontSize = Math.max(Number(recruitFooterWidget.fontSize || 0), getTextFont(width, 15, 12));
            }
            else {
                recruitFooterWidget.text = ' ';
                recruitFooterWidget.width = 0;
                recruitFooterWidget.height = 0;
                recruitFooterWidget.opacity = 0;
                if (recruitFooterWidget.record) {
                    recruitFooterWidget.record.width = 0;
                    recruitFooterWidget.record.height = 0;
                }
            }
        }
        if (recruitMainWidget) {
            applyWidgetRect(recruitMainWidget, recruitMode === 'retro'
                ? {
                    left: width - Math.round(width * 0.25),
                    top: Math.round(height * 0.072),
                    width: Math.round(width * 0.15),
                    height: Math.round(height * 0.16),
                }
                : recruitMode === 'bold-red'
                    ? {
                        left: width - Math.round(width * 0.29),
                        top: Math.round(height * 0.062),
                        width: Math.round(width * 0.22),
                        height: Math.round(height * 0.2),
                    }
                    : recruitMode === 'black-gold'
                        ? {
                            left: width - Math.round(width * 0.19),
                            top: Math.round(height * 0.108),
                            width: Math.round(width * 0.1),
                            height: Math.round(height * 0.24),
                        }
                        : {
                            left: width - Math.round(width * 0.22),
                            top: Math.round(height * 0.07),
                            width: Math.round(width * 0.14),
                            height: Math.round(height * 0.1),
                        });
            recruitMainWidget.color = recruitMode === 'retro'
                ? '#b44835'
                : recruitMode === 'bold-red'
                    ? '#d73f33'
                    : recruitMode === 'black-gold'
                        ? '#cda261'
                        : '#1c2733';
            recruitMainWidget.opacity = recruitMode === 'notice' ? 0.1 : recruitMode === 'black-gold' ? 0.18 : 0.12;
            recruitMainWidget.fontSize = Math.max(Number(recruitMainWidget.fontSize || 0), getTextFont(width, recruitMode === 'black-gold' ? 84 : recruitMode === 'bold-red' ? 138 : 112, 52));
            recruitMainWidget.lineHeight = recruitMode === 'black-gold' ? 0.96 : 0.9;
            recruitMainWidget.opacity = recruitMode === 'notice' ? 0.06 : 0.09;
        }
        if (recruitSideWidget) {
            recruitSideWidget.width = 0;
            recruitSideWidget.height = 0;
            recruitSideWidget.opacity = 0;
            if (recruitSideWidget.record) {
                recruitSideWidget.record.width = 0;
                recruitSideWidget.record.height = 0;
            }
        }
        if (heroWidget) {
            heroWidget.fullBleed = true;
            applyWidgetRect(heroWidget, {
                left: 0,
                top: 0,
                width,
                height,
            });
            heroWidget.left = 0;
            heroWidget.top = 0;
            heroWidget.width = width;
            heroWidget.height = height;
            if (heroWidget.record) {
                heroWidget.record.width = width;
                heroWidget.record.height = height;
            }
            fitAiHeroToPage(heroWidget, width, height);
            heroWidget.opacity = 1;
        }
    }
    if (selectedFamily === 'xiaohongshu-note') {
        const tw = Math.round(width * 0.86);
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => {
            applyWidgetRect(widget, { left: Math.round((width - tw) / 2), width: tw });
            setWidgetAlign(widget, 'left');
        });
        if (badgeWidget)
            applyWidgetRect(badgeWidget, { left: Math.round(width * 0.08) });
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, { width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.38)) });
            centerWidgetHorizontally(ctaWidget, width);
        }
        if (panelWidget)
            applyWidgetRect(panelWidget, { left: Math.round(width * 0.07), width: Math.round(width * 0.86) });
    }
    if (selectedFamily === 'clean-course') {
        const tw = Math.round(width * (sizeProfile === 'banner' ? 0.32 : 0.54));
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => applyWidgetRect(widget, { left: textLeft, width: tw }));
        if (ctaWidget)
            applyWidgetRect(ctaWidget, { left: textLeft, width: Math.max(Number(ctaWidget.width || 0), Math.round(width * 0.3)) });
        if (panelWidget)
            applyWidgetRect(panelWidget, { left: Math.max(Math.round(width * 0.04), textLeft - Math.round(width * 0.04)), width: Math.round(width * (sizeProfile === 'banner' ? 0.36 : 0.62)) });
    }
    if (selectedFamily === 'premium-offer') {
        const centered = sizeProfile === 'square' || !isWide;
        const tw = Math.round(width * (centered ? 0.84 : 0.44));
        [titleWidget, sloganWidget, bodyWidget].forEach((widget) => {
            applyWidgetRect(widget, { left: centered ? Math.round((width - tw) / 2) : textLeft, width: tw });
            setWidgetAlign(widget, centered ? 'center' : 'left');
        });
        if (badgeWidget) {
            if (centered)
                centerWidgetHorizontally(badgeWidget, width);
            else
                applyWidgetRect(badgeWidget, { left: textLeft });
        }
        if (ctaWidget) {
            applyWidgetRect(ctaWidget, { width: Math.max(Number(ctaWidget.width || 0), Math.round(width * (centered ? 0.38 : 0.28))) });
            if (centered)
                centerWidgetHorizontally(ctaWidget, width);
        }
        if (panelWidget)
            applyWidgetRect(panelWidget, { left: centered ? Math.round(width * 0.08) : Math.max(Math.round(width * 0.04), textLeft - Math.round(width * 0.03)), width: centered ? Math.round(width * 0.84) : Math.round(width * 0.5) });
        if (priceTagWidget && centered)
            centerWidgetHorizontally(priceTagWidget, width);
        if (priceNumWidget && centered)
            centerWidgetHorizontally(priceNumWidget, width);
        if (!isWide && heroWidget && heroWidget.fullBleed !== true) {
            clampHeroIntoBounds(heroWidget, {
                left: Math.round(width * 0.14),
                top: Math.round(height * 0.16),
                right: Math.round(width * 0.86),
                bottom: Math.round(height * 0.56),
                minWidth: Math.round(width * 0.58),
                minHeight: Math.round(height * 0.22),
            });
            heroWidget.left = Math.round((width - Number(heroWidget.width || 0)) / 2);
        }
        if (!isWide && titleWidget) {
            applyWidgetRect(titleWidget, { left: Math.round(width * 0.08), top: Math.round(height * 0.62), width: Math.round(width * 0.84) });
            setWidgetAlign(titleWidget, 'center');
            titleWidget.fontSize = Math.max(Number(titleWidget.fontSize || 0), getTextFont(width, 66, 38));
        }
        if (!isWide && sloganWidget) {
            applyWidgetRect(sloganWidget, { left: Math.round(width * 0.12), top: Math.round(height * 0.73), width: Math.round(width * 0.76) });
            setWidgetAlign(sloganWidget, 'center');
        }
        if (!isWide && ctaWidget) {
            applyWidgetRect(ctaWidget, { left: Math.round(width * 0.31), top: Math.round(height * 0.86), width: Math.round(width * 0.38) });
            setWidgetAlign(ctaWidget, 'center');
        }
    }
    if (qrCorner) {
        widgets.push(makeQrcodeWidget('ai_qrcode', {
            width: qrSize,
            height: qrSize,
            left: width - marginX - qrSize,
            top: height - safeBottom - qrSize,
            value: input.qrUrl,
            dotColor: readability.qrDot,
            dotColor2: readability.qrDot,
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
            dotColor: readability.qrDot,
            dotColor2: readability.qrDot,
        }));
    }
    widgets = ensureAbsoluteRoleWidgets(widgets, canApplyAbsoluteLayout ? result.designPlan?.absoluteLayout : null, width, height, copyDeck, palette, readability);
    pruneDuplicatePosterWidgets(widgets, {
        family: selectedFamily,
        designPlan: result.designPlan || {},
    });
    collapseEmptyPosterWidgets(widgets, selectedFamily);
    if (selectedFamily !== 'list-recruitment') {
        compressHeaderStack(widgets, {
            height,
            safeBottom,
            fallbackLimit: includeHeroLayer && !isWide && !universalFullScreenPoster
                ? Math.max(Math.round(height * 0.2), heroTop - Math.round(height * 0.03))
                : Math.round(height * (selectedFamily === 'magazine-cover' ? 0.82 : 0.58)),
            family: selectedFamily,
            isWide,
        });
        stabilizeFloatingWidgets(widgets, {
            width,
            height,
            safeBottom,
            family: selectedFamily,
        });
    }
    const hero = widgets.find((w) => w.name === 'ai_hero');
    if (hero && hero.fullBleed !== true && !isWide && !universalFullScreenPoster && portraitStackFamilies.has(selectedFamily)) {
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
    if (canApplyAbsoluteLayout && selectedFamily !== 'list-recruitment') {
        applyAbsoluteLayoutPlan(widgets, result.designPlan?.absoluteLayout, width, height);
    }
    const finalHeroWidget = widgets.find((w) => w.name === 'ai_hero');
    if (includeHeroLayer) {
        enforceFullBleedHero(finalHeroWidget, width, height);
    }
    applyPosterReadabilityEffects(widgets, palette, result.designPlan);
    applyTextStrategyPlan(widgets, result.designPlan, palette);
    applyMultimodalLayoutHints(widgets, result, width, height, palette, selectedFamily);
    collapseEmptyPosterWidgets(widgets, selectedFamily);
    refinePosterTemplateFinish(widgets, selectedFamily, width, height, {
        input,
        palette,
        designPlan: result.designPlan || {},
    });
    applyStructuredCtaStyle(widgets, width, height, palette, readability, {
        input,
        copyDeck,
        designPlan: result.designPlan || {},
    });
    applyPosterDensityGuard(widgets, selectedFamily, width, height, {
        input,
        palette,
        designPlan: result.designPlan || {},
    });
    applyLateStageLightFoodPosterPolish(widgets, selectedFamily, width, height, {
        input,
        palette,
        designPlan: result.designPlan || {},
        copyDeck,
    });
    applyLateStageCommercialPosterPolish(widgets, selectedFamily, width, height, {
        input,
        palette,
        designPlan: result.designPlan || {},
        copyDeck,
    });
    compactPosterActionZone(widgets, selectedFamily, width, height);
    tightenPosterInfoPanel(widgets, selectedFamily, width, height);
    fitPanelTextStack(widgets, selectedFamily, width);
    collapseEmptyPosterWidgets(widgets, selectedFamily);
    cleanupWeakPosterWidgets(widgets, selectedFamily, width, height);
    removeDuplicatePosterNamedWidgets(widgets);
    applyMinimumReadablePosterTypography(widgets, width, height);
    if (selectedFamily === 'list-recruitment') {
        const panel = widgets.find((item) => item.name === 'ai_text_panel');
        const badge = widgets.find((item) => item.name === 'ai_badge');
        const cta = widgets.find((item) => item.name === 'ai_cta');
        const title = widgets.find((item) => item.name === 'ai_title');
        const slogan = widgets.find((item) => item.name === 'ai_slogan');
        const body = widgets.find((item) => item.name === 'ai_body');
        const listRows = widgets.filter((item) => item.name && item.name.startsWith('ai_list_'));
        const cards = widgets
            .filter((item) => item.name && item.name.startsWith('ai_recruit_card_') && !isCollapsedWidget(item));
        const allRecruitCards = widgets
            .filter((item) => item.name && item.name.startsWith('ai_recruit_card_'));
        const tidyRecruitLine = (value, limit = 16) => {
            const raw = String(value || '').trim();
            const normalizeSegment = (text) => String(text || '')
                .replace(/^[·•\-\s]+/, '')
                .replace(/[·•|｜/,\-]+$/g, '')
                .replace(/\s+/g, ' ')
                .trim();
            const isBrokenRecruitFragment = (text) => {
                const safe = normalizeSegment(text);
                if (!safe || safe.length < 4)
                    return true;
                if (/[空等日来起通机权利及和与之可助您]/.test(safe.slice(-1)))
                    return true;
                if (/(招聘|招募|热招|欢迎|优先)$/.test(safe))
                    return true;
                return false;
            };
            const next = compactDeckLine(raw, limit);
            const cleaned = normalizeSegment(next);
            const semanticSplit = raw.split(/[，,。；;：:｜|]/).map((item) => normalizeSegment(item)).filter(Boolean);
            const completeSegment = semanticSplit.find((item) => item.length <= limit && !isBrokenRecruitFragment(item));
            if (completeSegment)
                return completeSegment;
            if (cleaned && !isBrokenRecruitFragment(cleaned))
                return cleaned;
            const relaxedSegment = semanticSplit.find((item) => item.length >= 4 && item.length <= Math.max(limit + 2, 18));
            if (relaxedSegment)
                return relaxedSegment.slice(0, Math.max(limit, 12));
                return cleaned || normalizeSegment(raw).slice(0, limit);
        };
        const recruitHints = getPosterMultimodalHints(result);
        const recruitSafeZone = getPrimarySafeZone(recruitHints, { x: 0.06, y: 0.08, w: 0.34, h: 0.26 });
        const recruitAvoidZones = getPrimaryAvoidZones(recruitHints, 3);
        const recruitTone = String(recruitHints?.visualAnalysis?.dominantTone || '').trim();
        const recruitTexture = String(recruitHints?.visualAnalysis?.texture || '').trim();
        const panelPreferred = shouldUseLargeTextPanel(selectedFamily, recruitHints, '#ffffff');
        const cleanRecruitScene = recruitTone !== 'dark' && recruitTexture !== 'detailed';
        const panelVisible = Boolean(panel && panelPreferred && !cleanRecruitScene);
        const panelLeft = panelVisible
            ? Math.round(width * Math.max(0.045, Math.min(0.12, recruitSafeZone.x || 0.055)))
            : Math.round(width * Math.max(0.05, Math.min(0.12, recruitSafeZone.x || 0.06)));
        const panelTop = panelVisible
            ? Math.round(height * Math.max(0.05, Math.min(0.14, recruitSafeZone.y || 0.07)))
            : Math.round(height * 0.06);
        const panelWidth = panelVisible
            ? Math.round(width * Math.max(0.32, Math.min(0.4, (recruitSafeZone.w || 0.34) + 0.03)))
            : Math.round(width * Math.max(0.28, Math.min(0.36, recruitSafeZone.w || 0.34)));
        const panelHeight = panelVisible
            ? Math.round(height * Math.max(0.58, Math.min(0.7, ((recruitSafeZone.h || 0.26) + 0.38))))
            : Math.round(height * 0.6);
        const contentLeft = panelVisible ? panelLeft + Math.round(width * 0.024) : panelLeft;
        const contentWidth = panelVisible ? panelWidth - Math.round(width * 0.048) : Math.round(width * Math.max(0.28, Math.min(0.36, recruitSafeZone.w || 0.34)));
        const titleColor = panelVisible ? '#111111' : (recruitTone === 'dark' || recruitTexture === 'detailed' ? '#fffaf4' : '#111827');
        const subColor = panelVisible ? '#38424d' : (titleColor === '#111827' ? '#334155' : '#eef2f7');
        if (panel) {
            if (panelVisible) {
                applyWidgetRect(panel, {
                    left: panelLeft,
                    top: panelTop,
                    width: panelWidth,
                    height: panelHeight,
                });
                panel.backgroundColor = recruitTone === 'dark' ? '#fffdf7dd' : '#ffffffe8';
                panel.borderColor = recruitTone === 'dark' ? '#ffffff88' : '#1f283226';
                panel.radius = Math.max(18, Math.round(width * 0.016));
                panel.borderWidth = 1;
                panel.opacity = 1;
            }
            else {
                hidePanelSurface(panel);
            }
        }
        if (badge) {
            showWidgetBlock(badge);
            badge.text = tidyRecruitLine(badge.text, 6) || '官方直聘';
            applyWidgetRect(badge, {
                left: contentLeft,
                top: panelVisible ? panelTop + Math.round(height * 0.024) : Math.round(height * Math.max(0.05, (recruitSafeZone.y || 0.08) - 0.01)),
                width: Math.round(width * 0.18),
                height: Math.round(height * 0.04),
            });
            badge.fontSize = getTextFont(width, 20, 16);
            badge.backgroundColor = panelVisible ? '#1f2832' : '#111827';
            badge.color = '#ffffff';
            setWidgetAlign(badge, 'center');
        }
        if (title) {
            showWidgetBlock(title);
            const nextTitle = tidyRecruitLine(title.text, 16);
            if (nextTitle)
                title.text = nextTitle;
            applyWidgetRect(title, {
                left: contentLeft,
                top: panelVisible ? panelTop + Math.round(height * 0.095) : Math.round(height * Math.max(0.12, recruitSafeZone.y || 0.12)),
                width: contentWidth,
                height: Math.round(height * 0.12),
            });
            title.fontSize = getTextFont(width, 42, 32);
            title.lineHeight = 1.08;
            title.color = titleColor;
            title.textEffects = panelVisible ? [] : [{
                    type: 'shadow',
                    color: 'rgba(0,0,0,0.34)',
                    offsetX: 0,
                    offsetY: 3,
                    blur: 10,
                }];
            setWidgetAlign(title, 'left');
            if (!panelVisible)
                nudgeWidgetOutOfAvoidZones(title, recruitAvoidZones, width, height, { preferLeft: true, preferUp: true, threshold: 0.05 });
        }
        if (slogan) {
            const nextSlogan = tidyRecruitLine(slogan.text, 18);
            if (!nextSlogan || isPosterEchoText(nextSlogan, String(title?.text || '').trim())) {
                hideWidgetBlock(slogan);
            }
            else {
                showWidgetBlock(slogan);
                slogan.text = nextSlogan;
                applyWidgetRect(slogan, {
                    left: contentLeft,
                    top: panelVisible ? panelTop + Math.round(height * 0.215) : Math.round(height * Math.max(0.25, (recruitSafeZone.y || 0.12) + 0.115)),
                    width: contentWidth,
                    height: Math.round(height * 0.042),
                });
                slogan.fontSize = getTextFont(width, 18, 15);
                slogan.lineHeight = 1.12;
                slogan.color = subColor;
                slogan.backgroundColor = '#ffffff00';
                slogan.borderColor = '#ffffff00';
                slogan.borderWidth = 0;
                slogan.textEffects = panelVisible ? [] : [{
                        type: 'shadow',
                        color: 'rgba(0,0,0,0.24)',
                        offsetX: 0,
                        offsetY: 2,
                        blur: 8,
                    }];
                setWidgetAlign(slogan, 'left');
                if (!panelVisible)
                    nudgeWidgetOutOfAvoidZones(slogan, recruitAvoidZones, width, height, { preferLeft: true, preferUp: true, threshold: 0.05 });
            }
        }
        if (body) {
            hideWidgetBlock(body);
        }
        const compSignal = (value) => /薪资|底薪|高薪|面议|提成|奖金|补贴|社保|五险|公积金|餐补|住宿|年假|双休|排班|培训|晋升/.test(String(value || '').trim());
        const recruitFallbackLines = [
            copyDeck.offerLine,
            copyDeck.priceBlock ? `${copyDeck.priceBlock.value || ''}${copyDeck.priceBlock.suffix || ''}`.trim() : '',
            copyDeck.trustLine,
            copyDeck.actionReason,
            ...(Array.isArray(copyDeck.proofPoints) ? copyDeck.proofPoints : []),
        ]
            .map((item) => tidyRecruitLine(item, 16))
            .filter((item, index, arr) => item && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
        const factCardValues = (copyDeck.factCards || [])
            .map((item) => tidyRecruitLine(item?.value || item?.hint || '', 16))
            .filter(Boolean);
        const salaryCardText = factCardValues.find((item) => compSignal(item))
            || recruitFallbackLines.find((item) => compSignal(item))
            || '';
        const roleCardText = tidyRecruitLine(copyDeck.factCards?.find((item) => /岗位|方向|职位/.test(String(item?.label || '')))?.value
            || copyDeck.factCards?.[0]?.value
            || allRecruitCards[0]?.text
            || '', 16);
        const cardTexts = [
            roleCardText,
            salaryCardText || tidyRecruitLine(copyDeck.factCards?.[1]?.value || recruitFallbackLines[0] || allRecruitCards[1]?.text || '', 16),
            tidyRecruitLine(copyDeck.factCards?.[2]?.value || copyDeck.actionReason || recruitFallbackLines[1] || '', 16),
        ].filter((item, index, arr) => item && arr.findIndex((cur) => isSamePosterText(cur, item)) === index);
        allRecruitCards.forEach((card, index) => {
            if (index > 2) {
                hideWidgetBlock(card);
                return;
            }
            const text = cardTexts[index] || recruitFallbackLines.find((item) => item && !cardTexts.some((used) => isSamePosterText(used, item))) || '';
            if (!text) {
                hideWidgetBlock(card);
                return;
            }
            showWidgetBlock(card);
            card.text = text;
            applyWidgetRect(card, {
                left: contentLeft,
                top: (panelVisible ? panelTop + Math.round(height * 0.34) : Math.round(height * 0.42)) + index * Math.round(height * 0.07),
                width: contentWidth,
                height: Math.round(height * 0.048),
            });
            card.fontSize = getTextFont(width, 18, 14);
            card.lineHeight = 1.16;
            card.backgroundColor = panelVisible ? '#fffdfaf2' : '#ffffffd8';
            card.borderColor = panelVisible ? '#1f283220' : '#ffffff8a';
            card.borderWidth = 1;
            card.radius = Math.max(14, Math.round(width * 0.014));
            card.color = '#1b232d';
            setWidgetAlign(card, 'left');
            if (!panelVisible)
                nudgeWidgetOutOfAvoidZones(card, recruitAvoidZones, width, height, { preferLeft: true, preferUp: false, threshold: 0.08 });
        });
        listRows.forEach((row, index) => {
            const text = tidyRecruitLine(String(row.text || '').replace(/^[·•]\s*/, ''), 16);
            if (index > 1 || !text || isWeakGeneratedPosterLine(text) || cards.some((card) => isSamePosterText(String(card.text || '').trim(), text))) {
                hideWidgetBlock(row);
                return;
            }
            showWidgetBlock(row);
            row.text = `· ${text}`;
            applyWidgetRect(row, {
                left: contentLeft,
                top: (panelVisible ? panelTop + Math.round(height * 0.57) : Math.round(height * 0.66)) + index * Math.round(height * 0.044),
                width: contentWidth,
                height: Math.round(height * 0.038),
            });
            row.fontSize = getTextFont(width, 17, 14);
            row.lineHeight = 1.14;
            row.backgroundColor = panelVisible ? '#fffaf4' : '#ffffffcc';
            row.borderColor = panelVisible ? '#1f283218' : '#ffffff74';
            row.borderWidth = 1;
            row.radius = Math.max(12, Math.round(width * 0.012));
            row.color = '#1d2630';
            setWidgetAlign(row, 'left');
            if (!panelVisible)
                nudgeWidgetOutOfAvoidZones(row, recruitAvoidZones, width, height, { preferLeft: true, preferUp: false, threshold: 0.08 });
        });
        if (cta) {
            showWidgetBlock(cta);
            const ctaWidth = Math.round(Math.min(width * (panelVisible ? 0.32 : 0.28), contentWidth));
            const ctaHeight = Math.round(height * 0.068);
            applyWidgetRect(cta, {
                left: contentLeft,
                top: panelVisible
                    ? panelTop + panelHeight - ctaHeight - Math.round(height * 0.04)
                    : Math.round(height * 0.84),
                width: ctaWidth,
                height: ctaHeight,
            });
            cta.fontSize = Math.min(Math.max(Number(cta.fontSize || 0), getTextFont(width, 22, 18)), getTextFont(width, 24, 19));
            cta.radius = Math.max(18, Math.round(width * 0.018));
            cta.backgroundColor = '#0f172a';
            cta.color = '#ffffff';
            setWidgetAlign(cta, 'center');
            if (!panelVisible)
                nudgeWidgetOutOfAvoidZones(cta, recruitAvoidZones, width, height, { preferLeft: true, preferUp: true, threshold: 0.05 });
        }
    }
    if (selectedFamily === 'premium-offer' || selectedFamily === 'hero-center' || selectedFamily === 'split-editorial') {
        const panel = widgets.find((item) => item.name === 'ai_text_panel');
        const title = widgets.find((item) => item.name === 'ai_title');
        const slogan = widgets.find((item) => item.name === 'ai_slogan');
        const body = widgets.find((item) => item.name === 'ai_body');
        const cta = widgets.find((item) => item.name === 'ai_cta');
        const chips = widgets.filter((item) => /^ai_chip(_detail)?_/.test(String(item?.name || '')) && !isCollapsedWidget(item));
        const metas = widgets.filter((item) => /^ai_meta_/.test(String(item?.name || '')) && !isCollapsedWidget(item));
        const tidyLine = (value, limit = 18) => compactDeckLine(String(value || '').trim(), limit).replace(/[之与和及可工岗店类中提您者]$/, '').trim();
        if (title) {
            const nextTitle = tidyLine(title.text, selectedFamily === 'split-editorial' ? 18 : 16);
            if (nextTitle)
                title.text = nextTitle;
        }
        if (slogan && !isCollapsedWidget(slogan)) {
            const nextSlogan = tidyLine(slogan.text, selectedFamily === 'hero-center' ? 20 : 18);
            if (!nextSlogan || isPosterEchoText(nextSlogan, String(title?.text || '').trim())) {
                hideWidgetBlock(slogan);
            }
            else {
                slogan.text = nextSlogan;
            }
        }
        if (body && !isCollapsedWidget(body)) {
            const nextBody = tidyLine(body.text, 20);
            if (!nextBody || isPosterEchoText(nextBody, String(title?.text || '').trim())) {
                hideWidgetBlock(body);
            }
            else {
                body.text = nextBody;
            }
        }
        chips.forEach((chip, index) => {
            if (index > (selectedFamily === 'split-editorial' ? 2 : 1)) {
                hideWidgetBlock(chip);
                return;
            }
            const nextText = tidyLine(chip.text, 14);
            if (!nextText)
                hideWidgetBlock(chip);
            else
                chip.text = nextText;
        });
        metas.forEach((meta, index) => {
            if (index > 0) {
                hideWidgetBlock(meta);
                return;
            }
            const nextText = tidyLine(meta.text, 12);
            if (!nextText || /^(限时|本周|周末|今日)$/.test(nextText))
                hideWidgetBlock(meta);
            else
                meta.text = nextText;
        });
        if (panel) {
            panel.radius = Math.max(18, Math.round(width * 0.016));
        }
        if (cta) {
            const targetWidth = selectedFamily === 'split-editorial'
                ? Math.round(width * 0.26)
                : selectedFamily === 'hero-center'
                    ? Math.round(width * 0.3)
                    : Math.round(width * 0.28);
            const targetHeight = selectedFamily === 'split-editorial'
                ? Math.round(height * 0.05)
                : Math.round(height * 0.06);
            applyWidgetRect(cta, {
                width: Math.min(Math.round(Number(cta.width || targetWidth)), targetWidth),
                height: Math.min(Math.round(Number(cta.height || targetHeight)), targetHeight),
            });
            cta.radius = Math.max(16, Math.round(width * 0.015));
            cta.fontSize = Math.min(Math.max(Number(cta.fontSize || 0), getTextFont(width, 20, 16)), getTextFont(width, 24, 18));
            setWidgetAlign(cta, 'center');
        }
    }
    applyProtocolDrivenPosterFinish(widgets, selectedFamily, width, height, {
        input,
        palette,
        designPlan: result.designPlan || {},
        copyDeck,
        result,
    });
    applyMinimumReadablePosterTypography(widgets, width, height);
    enforcePosterContrast(widgets, palette, result.designPlan || {});
    finalizeAiWidgetEditability(widgets);
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
    const copyDeck = getPosterCopyDeck(input, result);
    const layoutFamily = normalizeLayoutFamily(result.designPlan?.layoutFamily)
        || (widgets.some((item) => item.name && item.name.startsWith('ai_card_')) ? 'grid-product'
            : widgets.some((item) => item.name && item.name.startsWith('ai_list_')) ? 'list-recruitment'
                : widgets.some((item) => item.name === 'ai_course_bar') ? 'clean-course'
                    : 'hero-left');
    const specializedDeck = buildFamilySpecializedCopyDeck(copyDeck, layoutFamily, input, result);
    const head = dedupePosterTitleSlogan(specializedDeck.heroHeadline || result.title, specializedDeck.supportLine || result.slogan);
    const layoutTitle = normalizePosterHeadline(stripInternalPromptEcho(head.title) || getSafeText(specializedDeck.heroHeadline || result.title, '').trim());
    const layoutSlogan = normalizePosterSubline(stripInternalPromptEcho(head.slogan) || getSafeText(specializedDeck.supportLine || result.slogan, '').trim());
    const priceValueText = [specializedDeck.priceBlock?.value, specializedDeck.offerLine, result.offerLine, result.slogan].map((item) => String(item || '').trim()).filter(Boolean);
    const bodySegments = [specializedDeck.offerLine, ...(specializedDeck.proofPoints || []), specializedDeck.actionReason, specializedDeck.audienceLine, specializedDeck.trustLine]
        .map((item) => stripInternalPromptEcho(item))
        .filter((item) => item && !isSamePosterText(item, layoutTitle) && !isSamePosterText(item, layoutSlogan) && !priceValueText.some((price) => isSamePosterText(item, price)));
    const layoutBody = stripInternalPromptEcho(bodySegments.join('｜') || result.body) || getSafeText(result.body, '补充描述文案');
    const contentProfile = getPosterContentProfile(layoutFamily, result.designPlan?.density || 'balanced', 'portrait');
    const highlights = sanitizePosterHighlights(layoutTitle, layoutSlogan, layoutBody, derivePosterHighlights(input, result, contentProfile));
    const layoutBodyText = !contentProfile.maxBodyLines
        ? ''
        : highlights.bodyLines.length > 1
            ? highlights.bodyLines.join('\n')
            : (highlights.bodyLines[0] || normalizePosterInfoLine(layoutBody, contentProfile.maxBodyChars || 16));
    const title = widgets.find((item) => item.name === 'ai_title');
    const slogan = widgets.find((item) => item.name === 'ai_slogan');
    const body = widgets.find((item) => item.name === 'ai_body');
    const cta = widgets.find((item) => item.name === 'ai_cta');
    const badge = widgets.find((item) => item.name === 'ai_badge');
    const qr = widgets.find((item) => item.name === 'ai_qrcode');
    const priceTag = widgets.find((item) => item.name === 'ai_price_tag');
    const priceNum = widgets.find((item) => item.name === 'ai_price_num');
    const metaWidgets = widgets.filter((item) => item.name && item.name.startsWith('ai_meta_'));
    const recruitCardWidgets = widgets.filter((item) => item.name && item.name.startsWith('ai_recruit_card_'));
    const listLines = highlights.bodyLines.length ? highlights.bodyLines : splitBodyLines(layoutBody, 3);
    const recruitmentCards = layoutFamily === 'list-recruitment'
        ? ((specializedDeck.factCards || []).length
            ? specializedDeck.factCards.map((item) => item.value || item.hint).filter(Boolean).slice(0, 3)
            : deriveRecruitmentFactCards(input, result, highlights, 3))
        : [];
    const cardTexts = ((specializedDeck.factCards || []).length
        ? specializedDeck.factCards.map((item) => item.value || item.hint).filter(Boolean)
        : listLines);
    const chipTexts = ((specializedDeck.factCards || []).length
        ? specializedDeck.factCards.map((item) => item.value).filter(Boolean)
        : highlights.infoChips);
    const cards = widgets.filter((item) => item.name && item.name.startsWith('ai_card_'));
    const chips = widgets.filter((item) => item.name && item.name.startsWith('ai_chip_'));
    const metaRows = [
        specializedDeck.audienceLine ? `对象｜${specializedDeck.audienceLine}` : '',
        specializedDeck.trustLine ? `背书｜${specializedDeck.trustLine}` : '',
        highlights.structuredFacts?.time ? `时间｜${highlights.structuredFacts.time}` : '',
        highlights.structuredFacts?.place ? `地点｜${highlights.structuredFacts.place}` : '',
        highlights.structuredFacts?.benefit ? `权益｜${highlights.structuredFacts.benefit}` : '',
    ].filter(Boolean).slice(0, 2);
    if (title)
        title.text = getSafeText(layoutTitle, 'AI 海报标题');
    if (slogan)
        slogan.text = layoutSlogan || ' ';
    if (body)
        body.text = layoutBodyText || ' ';
    if (cta)
        cta.text = getSafeText(stripInternalPromptEcho(specializedDeck.cta || result.cta), '立即了解');
    if (badge)
        badge.text = specializedDeck.badge || highlights.badge || ' ';
    if (qr && input.qrUrl)
        qr.value = input.qrUrl;
    widgets.filter((w) => w.name && w.name.startsWith('ai_list_')).forEach((w, i) => {
        w.text = listLines[i] ? `· ${listLines[i]}` : ' ';
    });
    cards.forEach((w, i) => {
        w.text = cardTexts[i] || ' ';
    });
    chips.forEach((w, i) => {
        w.text = chipTexts[i] || ' ';
    });
    metaWidgets.forEach((w, i) => {
        w.text = metaRows[i] || ' ';
    });
    recruitCardWidgets.forEach((w, i) => {
        w.text = recruitmentCards[i] || ' ';
    });
    if (priceTag)
        priceTag.text = (specializedDeck.priceBlock?.tag || highlights.priceTag) || ' ';
    if (priceNum)
        priceNum.text = specializedDeck.priceBlock ? `${specializedDeck.priceBlock.value || ''}${specializedDeck.priceBlock.suffix || ''}`.trim() || ' ' : (highlights.priceValue || ' ');
    if (!getPosterPriceDisplay(specializedDeck.priceBlock || {}, String(priceNum?.text || highlights.priceValue || '').trim())) {
        hidePosterPriceWidgets(widgets);
    }
    pruneDuplicatePosterWidgets(widgets, {
        family: layoutFamily,
        designPlan: result.designPlan || {},
    });
    collapseEmptyPosterWidgets(widgets, layoutFamily);
    const inferredPageWidth = Math.max(1, ...widgets.map((item) => Math.round(Number(item.left || 0) + Number(item.width || 0))));
    const inferredPageHeight = Math.max(1, ...widgets.map((item) => Math.round(Number(item.top || 0) + Number(item.height || 0))));
    refinePosterTemplateFinish(widgets, layoutFamily, inferredPageWidth, inferredPageHeight, {
        input,
        palette: result.palette || {},
        designPlan: result.designPlan || {},
    });
    applyLateStageLightFoodPosterPolish(widgets, layoutFamily, inferredPageWidth, inferredPageHeight, {
        input,
        palette: result.palette || {},
        designPlan: result.designPlan || {},
        copyDeck,
    });
    applyLateStageCommercialPosterPolish(widgets, layoutFamily, inferredPageWidth, inferredPageHeight, {
        input,
        palette: result.palette || {},
        designPlan: result.designPlan || {},
        copyDeck,
    });
    cleanupWeakPosterWidgets(widgets, layoutFamily, inferredPageWidth, inferredPageHeight);
    removeDuplicatePosterNamedWidgets(widgets);
    applyMinimumReadablePosterTypography(widgets, inferredPageWidth, inferredPageHeight);
    applyProtocolDrivenPosterFinish(widgets, layoutFamily, inferredPageWidth, inferredPageHeight, {
        input,
        palette: result.palette || {},
        designPlan: result.designPlan || {},
        copyDeck,
        result,
    });
    applyMinimumReadablePosterTypography(widgets, inferredPageWidth, inferredPageHeight);
    enforcePosterContrast(widgets, result.palette || {}, result.designPlan || {});
    finalizeAiWidgetEditability(widgets);
    return widgets;
}
export function applyPosterPalette(widgets, palette) {
    const readability = resolveReadablePalette(palette);
    widgets.forEach((widget) => {
        if (widget.name === 'ai_title' || widget.name === 'ai_body' || (widget.name && widget.name.startsWith('ai_list_'))) {
            widget.color = readability.text;
            widget.textEffects = buildPosterTextEffects(widget.name === 'ai_title' ? 'title' : 'body', readability.text, palette);
        }
        if (widget.name === 'ai_slogan') {
            widget.color = readability.muted;
            widget.textEffects = buildPosterTextEffects('slogan', readability.muted, palette);
        }
        if (widget.name === 'ai_badge') {
            widget.color = readability.ctaText;
            widget.backgroundColor = palette.primary;
            widget.textEffects = [];
        }
        if (widget.name === 'ai_text_panel') {
            const panelStyle = getReadablePanelStyle(palette, readability);
            widget.backgroundColor = panelStyle.panelBackground;
            widget.borderColor = panelStyle.panelBorder;
        }
        if (widget.name && widget.name.startsWith('ai_chip_')) {
            widget.color = readability.text;
            widget.backgroundColor = `${palette.surface}f6`;
            widget.textEffects = buildPosterTextEffects('chip', readability.text, palette);
        }
        if (widget.name && widget.name.startsWith('ai_meta_')) {
            widget.color = readability.text;
            widget.backgroundColor = `${palette.surface}eb`;
            widget.textEffects = buildPosterTextEffects('body', readability.text, palette);
        }
        if (widget.name && widget.name.startsWith('ai_recruit_card_')) {
            widget.color = readability.text;
            widget.backgroundColor = withAlpha(blendColor(palette.background, palette.surface, 0.56), 'f2');
            widget.borderColor = withAlpha(blendColor(palette.surface, readability.text, 0.18), '3a');
            widget.textEffects = buildPosterTextEffects('body', readability.text, palette);
        }
        if (widget.name === 'ai_cta') {
            widget.color = readability.ctaText;
            widget.backgroundColor = palette.primary;
            widget.textEffects = [];
        }
        if (widget.name === 'ai_qrcode') {
            widget.dotColor = readability.qrDot;
            widget.dotColor2 = readability.qrDot;
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
            widget.textEffects = buildPosterTextEffects('title', palette.primary, palette);
        }
        if (widget.name === 'ai_course_bar') {
            widget.backgroundColor = palette.primary;
        }
        if (widget.name && widget.name.startsWith('ai_deco_')) {
            widget.color = palette.primary;
            widget.textEffects = [];
        }
    });
    finalizeAiWidgetEditability(widgets);
    return widgets;
}
export function replaceHeroImage(widgets, imageUrl, page = {}) {
    const hero = widgets.find((item) => item.name === 'ai_hero');
    if (hero) {
        hero.imgUrl = imageUrl;
        hero.opacity = 1;
        fitAiHeroToPage(hero, Number(page.width) || Number(hero.width) || 1, Number(page.height) || Number(hero.height) || 1);
    }
    return widgets;
}
export function getPosterGradient(palette) {
    return getBackgroundGradient(palette);
}
//# sourceMappingURL=posterEngine.js.map

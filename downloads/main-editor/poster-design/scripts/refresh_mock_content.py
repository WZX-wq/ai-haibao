import json
from copy import deepcopy
from datetime import datetime
from pathlib import Path
from urllib.parse import quote


ROOT = Path(__file__).resolve().parents[1]
MOCK_ROOT = ROOT / "service" / "src" / "mock"

NOW = "2024-01-01T00:00:00.000Z"
FONT_CLASS = {
    "alias": "站酷快乐体",
    "id": 543,
    "value": "zcool-kuaile-regular",
    "url": "https://lib.baomitu.com/fonts/zcool-kuaile/zcool-kuaile-regular.woff2",
}


def data_url(svg: str) -> str:
    return f"data:image/svg+xml,{quote(svg)}"


def write_json(path: Path, payload):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def preview_card(title: str, eyebrow: str, color: str, bg: str = "#fffaf6") -> str:
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135">
      <rect width="240" height="135" rx="24" fill="{bg}"/>
      <text x="24" y="34" font-size="13" fill="#8b5e34" font-family="Arial">{eyebrow}</text>
      <text x="24" y="92" font-size="34" font-weight="800" fill="{color}" font-family="Arial">{title}</text>
    </svg>
    """.strip()
    return data_url(svg)


def text_cover(text: str, color: str, bg: str = "#fffaf6") -> str:
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 135">
      <rect width="240" height="135" rx="24" fill="{bg}"/>
      <text x="28" y="74" font-size="42" font-weight="800" fill="{color}" font-family="Arial">{text}</text>
    </svg>
    """.strip()
    return data_url(svg)


def make_text_layer(
    text: str,
    color: str,
    font_size: int,
    left: int = 40,
    top: int = 292,
    width: int = 640,
    text_align: str = "center",
    letter_spacing: int = 0,
    font_weight: int = 700,
    background_color: str = "",
):
    return {
        "name": "文本",
        "type": "w-text",
        "uuid": -1,
        "editable": False,
        "left": left,
        "top": top,
        "transform": "",
        "lineHeight": 1.2,
        "letterSpacing": letter_spacing,
        "fontSize": font_size,
        "fontClass": deepcopy(FONT_CLASS),
        "fontWeight": font_weight,
        "fontStyle": "normal",
        "writingMode": "horizontal-tb",
        "textDecoration": "none",
        "color": color,
        "textAlign": text_align,
        "text": text,
        "opacity": 1,
        "backgroundColor": background_color,
        "parent": "-1",
        "record": {
            "width": width,
            "height": int(font_size * 1.8),
            "minWidth": 10,
            "minHeight": 10,
            "dir": "all",
        },
        "width": width,
        "height": int(font_size * 1.8),
    }


def make_image_layer(name: str, img_url: str, width: int, height: int, left: int, top: int):
    return {
        "name": name,
        "type": "w-image",
        "uuid": f"{name}_{width}_{height}_{left}_{top}",
        "width": width,
        "height": height,
        "left": left,
        "top": top,
        "zoom": 1,
        "transform": " scale(1)",
        "radius": 0,
        "opacity": 1,
        "parent": "-1",
        "imgUrl": img_url,
        "setting": [],
        "record": {"width": 0, "height": 0, "minWidth": 10, "minHeight": 10, "dir": "all"},
        "rotate": 0,
        "imageTransform": {"a": 1, "b": 0, "c": 0, "d": 1, "tx": 0, "ty": 0},
        "filter": {
            "contrast": 0,
            "sharpness": 0,
            "hueRotate": 0,
            "saturate": 0,
            "brightness": 0,
            "gaussianBlur": 0,
            "temperature": 0,
            "tint": 0,
        },
    }


def simple_hero_svg(title: str, subtitle: str, primary: str, accent: str, bg: str) -> str:
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 764 345">
      <rect width="764" height="345" rx="40" fill="{bg}"/>
      <rect x="36" y="34" width="692" height="277" rx="32" fill="{accent}" opacity="0.18"/>
      <circle cx="620" cy="96" r="60" fill="{primary}" opacity="0.18"/>
      <circle cx="132" cy="262" r="44" fill="{primary}" opacity="0.12"/>
      <text x="56" y="88" font-size="20" fill="{primary}" font-family="Arial">{subtitle}</text>
      <text x="56" y="180" font-size="56" font-weight="800" fill="{primary}" font-family="Arial">{title}</text>
      <text x="56" y="234" font-size="24" fill="#3f3f46" font-family="Arial">点击后可拆分文字与主图继续编辑</text>
    </svg>
    """.strip()
    return data_url(svg)


def build_text_detail(item_id: int, title: str, sample: str, color: str, bg: str = "", font_size: int = 156, letter_spacing: int = 0):
    detail = {
        "id": item_id,
        "title": title,
        "data": json.dumps(
            make_text_layer(
                text=sample,
                color=color,
                font_size=font_size,
                background_color=bg,
                letter_spacing=letter_spacing,
            ),
            ensure_ascii=False,
        ),
    }
    return detail


def build_comp_detail(item_id: int, title: str, eyebrow: str, headline: str, subtitle: str, primary: str, accent: str, bg: str):
    hero = simple_hero_svg(headline, subtitle, primary, accent, bg)
    layers = [
        make_image_layer("图片", hero, 764, 345, 0, 0),
        make_text_layer(eyebrow, primary, 22, left=36, top=34, width=340, text_align="left", font_weight=400, letter_spacing=2),
        make_text_layer(headline, primary, 62, left=36, top=90, width=500, text_align="left"),
        make_text_layer(subtitle, "#3f3f46ff", 24, left=36, top=176, width=520, text_align="left", font_weight=400),
        make_text_layer("立即编辑", "#ffffffff", 28, left=36, top=272, width=220, background_color=primary, text_align="center"),
    ]
    return {
        "id": item_id,
        "title": title,
        "width": 764,
        "height": 345,
        "data": json.dumps(layers, ensure_ascii=False),
    }


def template_preview(title: str, subtitle: str, primary: str, accent: str, bg: str) -> str:
    svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 320">
      <rect width="180" height="320" rx="20" fill="{bg}"/>
      <rect x="18" y="18" width="144" height="120" rx="18" fill="{accent}" opacity="0.36"/>
      <circle cx="130" cy="80" r="30" fill="{primary}" opacity="0.2"/>
      <text x="24" y="84" font-size="24" font-weight="700" fill="{primary}" font-family="Arial">{title}</text>
      <text x="24" y="114" font-size="10" fill="#40332d" font-family="Arial">{subtitle}</text>
      <rect x="24" y="170" width="132" height="92" rx="18" fill="#ffffff" opacity="0.68"/>
      <rect x="24" y="280" width="84" height="20" rx="10" fill="{primary}" opacity="0.2"/>
    </svg>
    """.strip()
    return data_url(svg)


def build_template_detail(seed: dict):
    width = seed["width"]
    height = seed["height"]
    margin_x = int(width * 0.09)
    hero_width = int(width * 0.78)
    hero_height = int(height * 0.34)
    hero_top = int(height * 0.28)
    qr_size = int(min(width, height) * 0.12)
    hero_svg = f"""
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 860 620">
      <rect width="860" height="620" rx="44" fill="{seed['accent']}" opacity="0.26"/>
      <circle cx="680" cy="156" r="108" fill="{seed['primary']}" opacity="0.18"/>
      <circle cx="178" cy="454" r="96" fill="{seed['primary']}" opacity="0.14"/>
      <rect x="122" y="114" width="616" height="392" rx="36" fill="#ffffff" opacity="0.78"/>
      <text x="430" y="266" text-anchor="middle" font-size="72" font-weight="700" fill="{seed['primary']}" font-family="Arial">{seed['title']}</text>
      <text x="430" y="334" text-anchor="middle" font-size="28" fill="{seed['text']}" font-family="Arial">{seed['subtitle']}</text>
    </svg>
    """.strip()

    layers = [
        make_text_layer(seed["subtitle"], f"{seed['primary']}ff".replace("##", "#"), 34 if width >= 1200 else 24, left=margin_x, top=int(height * 0.12), width=int(width * 0.64), text_align="left", letter_spacing=2, font_weight=400),
        make_text_layer(seed["title"], f"{seed['text']}ff".replace("##", "#"), 138 if width >= 1200 else 88, left=margin_x, top=int(height * 0.16), width=int(width * 0.70), text_align="left"),
        make_image_layer("图片", data_url(hero_svg), hero_width, hero_height, int(width * 0.11), hero_top),
        make_text_layer(seed["body"], f"{seed['text']}ff".replace("##", "#"), 36 if width >= 1200 else 24, left=margin_x, top=int(height * 0.66), width=int(width * 0.68), text_align="left", font_weight=400),
        make_text_layer(seed["cta"], "#ffffffff", 32 if width >= 1200 else 22, left=margin_x, top=int(height * 0.83), width=int(width * 0.26), background_color=seed["primary"], text_align="center"),
    ]
    if height > 1000:
        layers.append(
            {
                "name": "二维码",
                "type": "w-qrcode",
                "uuid": f"qr_{seed['id']}",
                "width": qr_size,
                "height": qr_size,
                "left": width - margin_x - qr_size,
                "top": height - margin_x - qr_size,
                "zoom": 1,
                "transform": "",
                "radius": 0,
                "opacity": 1,
                "parent": "-1",
                "url": "",
                "dotType": "classy",
                "dotColorType": "single",
                "dotRotation": 270,
                "dotColor": seed["text"],
                "dotColor2": seed["text"],
                "value": "https://example.com",
                "setting": [],
                "record": {"width": 0, "height": 0, "minWidth": 10, "minHeight": 10, "dir": "all"},
            }
        )
    payload = [
        {
            "global": {
                "name": "作品页",
                "type": "page",
                "uuid": "-1",
                "left": 0,
                "top": 0,
                "width": width,
                "height": height,
                "backgroundColor": f"{seed['background']}ff",
                "backgroundGradient": "",
                "backgroundImage": "",
                "backgroundTransform": {},
                "opacity": 1,
                "tag": 0,
                "setting": [],
                "record": {},
            },
            "layers": layers,
        }
    ]
    return {
        "id": str(seed["id"]),
        "title": seed["fullTitle"],
        "width": width,
        "height": height,
        "data": json.dumps(payload, ensure_ascii=False),
    }


def make_material_item(item_id: int, title: str, svg: str, kind: str = "image", model=None):
    model = model or {}
    return {
        "id": item_id,
        "title": title,
        "width": 800,
        "height": 800,
        "type": kind,
        "model": json.dumps(model, ensure_ascii=False),
        "thumb": data_url(svg),
        "url": data_url(svg) if kind != "svg" else svg,
        "created_time": NOW,
        "updated_time": NOW,
        "state": 1,
    }


def sticker_svg(shape: str, color: str, accent: str = "#fff7ed") -> str:
    if shape == "bubble":
        content = f"<path d='M48 62h144a22 22 0 0 1 22 22v58a22 22 0 0 1-22 22H116l-38 28v-28H48a22 22 0 0 1-22-22V84a22 22 0 0 1 22-22z' fill='{color}'/>"
    elif shape == "star":
        content = f"<path d='M120 36l22 48 52 7-38 36 10 52-46-26-46 26 10-52-38-36 52-7 22-48z' fill='{color}'/>"
    elif shape == "burst":
        content = f"<path d='M120 34l18 34 38-18-10 40 42 8-32 22 26 34-42-4 0 46-40-24-40 24 0-46-42 4 26-34-32-22 42-8-10-40 38 18 18-34z' fill='{color}'/>"
    elif shape == "heart":
        content = f"<path d='M120 188c-44-26-70-52-70-86 0-24 16-42 38-42 14 0 26 6 32 18 6-12 18-18 32-18 22 0 38 18 38 42 0 34-26 60-70 86z' fill='{color}'/>"
    else:
        content = f"<rect x='44' y='44' width='152' height='152' rx='36' fill='{color}'/>"
    return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><rect width='240' height='240' rx='40' fill='{accent}' opacity='0.18'/>{content}</svg>"


def organic_svg(title: str, path_d: str, color: str) -> dict:
    svg = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240' preserveAspectRatio='none'><g fill='{{{{colors[0]}}}}'><path d='{path_d}'/></g></svg>"
    thumb = f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 240 240'><rect width='240' height='240' rx='36' fill='#fffaf6'/><g fill='{color}'><path d='{path_d}'/></g></svg>"
    return {
        "title": title,
        "thumb": thumb,
        "url": svg,
        "model": {"colors": [color]},
    }


text_presets = [
    (1, "描边标题", "输入文字", "#f59e0bff", "", 156, 0),
    (2, "霓虹字效", "焦点内容", "#ef4444ff", "", 156, 2),
    (3, "渐变海报字", "高光主题", "#8b5cf6ff", "", 148, 2),
    (7, "暖杏标题", "暖调推荐", "#f59e0bff", "", 152, 0),
    (8, "海盐蓝调", "海报主标", "#3b82f6ff", "", 150, 2),
    (9, "甜酷紫光", "今日种草", "#8b5cf6ff", "", 150, 2),
    (10, "珊瑚热卖", "爆款上新", "#fb7185ff", "", 150, 0),
    (14, "墨黑极简", "简约封面", "#111827ff", "", 148, 0),
    (16, "电商促销价签", "限时直降", "#f97316ff", "#fff7ed", 136, 1),
    (17, "招聘主标题", "热招岗位", "#2563ebff", "#eff6ff", 136, 2),
    (18, "餐饮爆款字", "招牌必点", "#d97706ff", "#fffbeb", 136, 0),
    (19, "节日祝福体", "节日快乐", "#db2777ff", "#fff1f2", 136, 2),
    (20, "小红书封面字", "氛围感封面", "#7c3aedff", "#faf5ff", 126, 2),
    (21, "直播倒计时", "今晚八点", "#ef4444ff", "#fff1f2", 136, 4),
]

combo_presets = [
    (4, "电商推荐组合", "电商推荐组合", "好物推荐", "高颜值主图 + 卖点一句话", "#f97316", "#fdba74", "#fff7ed"),
    (5, "活动主视觉组合", "活动主视觉组合", "今日探店", "地点、福利、报名动作一屏带出", "#fb7185", "#fecdd3", "#fff1f2"),
    (6, "节日促销组合", "节日促销组合", "今日上新", "节日限定气氛 + 促销文案", "#3b82f6", "#bfdbfe", "#eff6ff"),
    (11, "电商大促组合", "电商大促组合", "今晚大促", "爆款主图 + 到手价 + 下单引导", "#2563eb", "#bfdbfe", "#eff6ff"),
    (12, "电商新品组合", "电商新品组合", "新品首发", "适合上新预热和详情页首屏", "#8b5cf6", "#ddd6fe", "#f5f3ff"),
    (13, "招聘热招组合", "招聘热招组合", "热招岗位", "岗位亮点、薪资福利和投递入口", "#f59e0b", "#fde68a", "#fffbeb"),
    (15, "餐饮探店组合", "餐饮探店组合", "今日必点", "门店招牌菜、优惠和到店提醒", "#ec4899", "#fbcfe8", "#fdf2f8"),
    (22, "节日福利组合", "节日福利组合", "节日好礼", "礼赠活动、满减福利、节日氛围", "#dc2626", "#fecaca", "#fff1f2"),
    (23, "小红书种草组合", "小红书种草", "通勤穿搭", "封面感强，适合种草笔记首图", "#7c3aed", "#c4b5fd", "#faf5ff"),
    (24, "小红书清单组合", "小红书清单", "自用好物", "适合收藏向、清单向封面排版", "#0891b2", "#a5f3fc", "#ecfeff"),
    (25, "门店开业组合", "开业引流组合", "新店开业", "门店位置、到店礼、活动时间", "#ea580c", "#fdba74", "#fff7ed"),
    (26, "节日礼赠组合", "节日礼赠组合", "心意上线", "礼盒、贺卡、节日限定视觉", "#db2777", "#f9a8d4", "#fff1f6"),
    (27, "招聘校招组合", "校招海报组合", "校园招募", "适合校招、实习招募和宣讲会", "#2563eb", "#93c5fd", "#eff6ff"),
    (28, "餐饮套餐组合", "餐饮套餐组合", "双人套餐", "价格感突出，适合团购和套餐", "#d97706", "#fde68a", "#fffbeb"),
    (29, "电商直播组合", "直播预告组合", "直播开抢", "直播间节奏、福利点和时间提醒", "#ef4444", "#fca5a5", "#fff1f2"),
    (30, "小红书封面组合", "封面主视觉", "氛围感封面", "适合小红书笔记首屏和合集封面", "#8b5cf6", "#ddd6fe", "#f5f3ff"),
]

png_material_presets = [
    (890, "贴纸对话气泡", sticker_svg("bubble", "#a78bfa", "#f3e8ff")),
    (889, "贴纸爆款星标", sticker_svg("star", "#60a5fa", "#eff6ff")),
    (888, "贴纸折扣爆炸", sticker_svg("burst", "#fb7185", "#fff1f2")),
    (887, "贴纸节日爱心", sticker_svg("heart", "#f97316", "#fff7ed")),
    (886, "贴纸礼物盒", sticker_svg("square", "#ef4444", "#fff1f2")),
    (885, "贴纸星芒章", sticker_svg("star", "#f59e0b", "#fffbeb")),
    (882, "贴纸爱心气泡", sticker_svg("heart", "#ec4899", "#fdf2f8")),
    (891, "贴纸招聘徽章", sticker_svg("burst", "#2563eb", "#eff6ff")),
    (892, "贴纸开业标签", sticker_svg("bubble", "#10b981", "#ecfdf5")),
    (893, "贴纸套餐推荐", sticker_svg("square", "#d97706", "#fff7ed")),
    (894, "贴纸种草便签", sticker_svg("bubble", "#7c3aed", "#faf5ff")),
    (895, "贴纸礼赠蝴蝶结", sticker_svg("star", "#db2777", "#fff1f6")),
]

svg_presets = [
    (1000, organic_svg("SVG-流动波形", "M67 55c34-20 85-27 118 0 32 27 40 82 18 120-23 38-77 58-119 45-42-13-73-58-69-101 4-43 18-45 52-64z", "#34d399")),
    (999, organic_svg("SVG-圆角流体", "M70 66c22-24 72-39 112-18 39 20 56 73 41 114-15 42-61 69-108 65-47-4-95-38-104-84-8-46 24-53 59-77z", "#60a5fa")),
    (998, organic_svg("SVG-云朵底板", "M56 136c0-30 24-54 54-54 10-28 33-44 62-44 38 0 68 30 68 68 0 34-28 62-62 62H92c-20 0-36-15-36-32z", "#f59e0b")),
    (997, organic_svg("SVG-花瓣装饰", "M120 38c18 22 34 36 52 46 24 14 38 40 38 68 0 42-34 76-76 76s-76-34-76-76c0-28 14-54 38-68 18-10 34-24 52-46z", "#fb7185")),
    (996, organic_svg("SVG-基础形状-多边形", "M120 26l82 52v84l-82 52-82-52V78l82-52z", "#8b5cf6")),
    (995, organic_svg("SVG-装饰圆角条", "M38 102c0-24 20-44 44-44h76c24 0 44 20 44 44s-20 44-44 44H82c-24 0-44-20-44-44z", "#22c55e")),
    (994, organic_svg("SVG-基础形状-三角形", "M120 36l84 152H36L120 36z", "#f97316")),
    (993, organic_svg("SVG-胶片边框", "M46 44h148v152H46z M70 68h100v104H70z", "#111827")),
    (992, organic_svg("SVG-小红书标签底", "M52 64h136c22 0 40 18 40 40v32c0 22-18 40-40 40H52c-22 0-40-18-40-40v-32c0-22 18-40 40-40z", "#ec4899")),
    (991, organic_svg("SVG-节日挂旗", "M42 48h156l-22 34 22 34H42l22-34-22-34zm26 94h104v52H68z", "#dc2626")),
]

template_presets = [
    {"id": 301, "cate": 1, "title": "新品秒杀", "subtitle": "首发预热 / 到手低价", "body": "适合电商上新、直播前预告与活动转化，一屏带出卖点、价格和购买动作。", "cta": "立即抢购", "width": 1242, "height": 1660, "background": "#fff5ec", "primary": "#f97316", "accent": "#fdba74", "text": "#4a2811", "fullTitle": "示例模板 - 新品秒杀海报"},
    {"id": 302, "cate": 1, "title": "爆款清单", "subtitle": "高转化推荐 / 收藏加购", "body": "适合电商合集推荐、好物榜单和爆款清单封面，强调商品主图与推荐理由。", "cta": "查看清单", "width": 1242, "height": 1660, "background": "#fff7ed", "primary": "#ea580c", "accent": "#fed7aa", "text": "#5b3418", "fullTitle": "示例模板 - 爆款清单海报"},
    {"id": 303, "cate": 1, "title": "直播预告", "subtitle": "今晚开抢 / 限量福利", "body": "适合直播带货预告、福利剧透和倒计时提醒，画面更强调时间与利益点。", "cta": "预约直播", "width": 1242, "height": 1660, "background": "#fff1f2", "primary": "#ef4444", "accent": "#fca5a5", "text": "#4a1d1f", "fullTitle": "示例模板 - 直播预告海报"},
    {"id": 304, "cate": 1, "title": "会员专享", "subtitle": "专属折扣 / 进店领券", "body": "适合会员日、私域活动和拉新裂变，突出专属权益和转化入口。", "cta": "领取优惠", "width": 1242, "height": 1660, "background": "#fdf4ff", "primary": "#a855f7", "accent": "#e9d5ff", "text": "#3b1757", "fullTitle": "示例模板 - 会员专享海报"},
    {"id": 305, "cate": 2, "title": "门店热招", "subtitle": "高薪诚聘 / 福利清晰", "body": "适合门店、服务业和零售招聘，岗位亮点、薪资和联系方式一屏展示。", "cta": "马上投递", "width": 1242, "height": 2208, "background": "#eff6ff", "primary": "#2563eb", "accent": "#93c5fd", "text": "#11284b", "fullTitle": "示例模板 - 门店热招海报"},
    {"id": 306, "cate": 2, "title": "校园招募", "subtitle": "实习 / 校招 / 宣讲会", "body": "适合校招、实习生招募和宣讲活动，突出成长空间与团队氛围。", "cta": "立即报名", "width": 1242, "height": 2208, "background": "#eef2ff", "primary": "#4f46e5", "accent": "#c7d2fe", "text": "#1f2554", "fullTitle": "示例模板 - 校园招募海报"},
    {"id": 307, "cate": 2, "title": "设计师招募", "subtitle": "作品说话 / 远程可聊", "body": "适合创意岗位招募，用更轻盈的视觉强调岗位要求、审美与投递方式。", "cta": "投递作品", "width": 1242, "height": 1660, "background": "#f5f3ff", "primary": "#7c3aed", "accent": "#c4b5fd", "text": "#2f175f", "fullTitle": "示例模板 - 设计师招募海报"},
    {"id": 308, "cate": 2, "title": "团队扩招", "subtitle": "加入我们 / 一起成长", "body": "适合品牌长期招聘、团队扩招和岗位合集页，强调团队文化与发展机会。", "cta": "查看岗位", "width": 1242, "height": 1660, "background": "#ecfeff", "primary": "#0891b2", "accent": "#a5f3fc", "text": "#153246", "fullTitle": "示例模板 - 团队扩招海报"},
    {"id": 309, "cate": 7, "title": "今日必点", "subtitle": "门店招牌 / 到店即享", "body": "适合餐饮门店上新、招牌菜推荐和探店引流，强调食欲感与到店动作。", "cta": "扫码点单", "width": 1125, "height": 2001, "background": "#fff9ec", "primary": "#d97706", "accent": "#fcd34d", "text": "#4a2508", "fullTitle": "示例模板 - 今日必点海报"},
    {"id": 310, "cate": 7, "title": "双人套餐", "subtitle": "高性价比 / 限时团购", "body": "适合套餐推荐、到店团购和节假日促销，突出价格锚点与菜品组合。", "cta": "立即下单", "width": 1125, "height": 2001, "background": "#fff7ed", "primary": "#ea580c", "accent": "#fdba74", "text": "#51210c", "fullTitle": "示例模板 - 双人套餐海报"},
    {"id": 311, "cate": 7, "title": "探店福利", "subtitle": "新品试吃 / 评论有礼", "body": "适合餐饮探店合作、评论返券和引导到店，画面更偏社交分享感。", "cta": "到店领取", "width": 1242, "height": 1660, "background": "#fff1f2", "primary": "#fb7185", "accent": "#fecdd3", "text": "#52212d", "fullTitle": "示例模板 - 探店福利海报"},
    {"id": 312, "cate": 7, "title": "夜宵上新", "subtitle": "人气推荐 / 深夜不打烊", "body": "适合夜宵、咖啡、甜品等门店新品海报，强调氛围感与即时消费。", "cta": "立即尝鲜", "width": 1242, "height": 1660, "background": "#fdf2f8", "primary": "#db2777", "accent": "#f9a8d4", "text": "#4a1431", "fullTitle": "示例模板 - 夜宵上新海报"},
    {"id": 313, "cate": 5, "title": "节日好礼", "subtitle": "限定礼盒 / 氛围上线", "body": "适合节日礼盒、祝福活动和品牌礼赠推荐，突出情绪价值和仪式感。", "cta": "查看详情", "width": 1242, "height": 2208, "background": "#fff7ed", "primary": "#ea580c", "accent": "#fdba74", "text": "#51210c", "fullTitle": "示例模板 - 节日好礼海报"},
    {"id": 314, "cate": 5, "title": "心意限定", "subtitle": "节日祝福 / 限时上线", "body": "适合节日祝福、限定新品和品牌主视觉，用更柔和的画面强化礼赠氛围。", "cta": "立即查看", "width": 1242, "height": 1660, "background": "#fff1f6", "primary": "#db2777", "accent": "#f9a8d4", "text": "#4a1431", "fullTitle": "示例模板 - 心意限定海报"},
    {"id": 315, "cate": 5, "title": "节日开门红", "subtitle": "满减福利 / 气氛拉满", "body": "适合节日促销、开门红活动和节庆节点冲量，突出活动力度和时效感。", "cta": "领取福利", "width": 1242, "height": 2208, "background": "#fff1f2", "primary": "#dc2626", "accent": "#fecaca", "text": "#4a1717", "fullTitle": "示例模板 - 节日开门红海报"},
    {"id": 316, "cate": 5, "title": "节庆邀请函", "subtitle": "到店有礼 / 名额有限", "body": "适合节庆活动邀请、线下打卡和门店主题活动，视觉更偏仪式感。", "cta": "立即预约", "width": 1242, "height": 1660, "background": "#fdf4ff", "primary": "#a855f7", "accent": "#e9d5ff", "text": "#3b1757", "fullTitle": "示例模板 - 节庆邀请函"},
    {"id": 317, "cate": 8, "title": "通勤穿搭", "subtitle": "小红书封面 / 一眼想点", "body": "适合小红书穿搭、日常分享和种草笔记首图，强调标题、风格和氛围感。", "cta": "封面预览", "width": 900, "height": 1200, "background": "#faf5ff", "primary": "#7c3aed", "accent": "#ddd6fe", "text": "#2f175f", "fullTitle": "示例模板 - 小红书通勤穿搭封面"},
    {"id": 318, "cate": 8, "title": "居家改造", "subtitle": "封面合集 / 清单感强", "body": "适合居家、收纳和改造类内容封面，强调清单感、对比感和收藏欲。", "cta": "继续编辑", "width": 900, "height": 1200, "background": "#ecfeff", "primary": "#0891b2", "accent": "#a5f3fc", "text": "#153246", "fullTitle": "示例模板 - 小红书居家改造封面"},
    {"id": 319, "cate": 8, "title": "早餐合集", "subtitle": "封面吸睛 / 收藏导向", "body": "适合美食合集、教程封面和日更封面，标题更紧凑，突出收藏属性。", "cta": "立即套用", "width": 900, "height": 1200, "background": "#fff7ed", "primary": "#ea580c", "accent": "#fdba74", "text": "#51210c", "fullTitle": "示例模板 - 小红书早餐合集封面"},
    {"id": 320, "cate": 8, "title": "预算穿搭", "subtitle": "平价种草 / 一屏讲清", "body": "适合种草、攻略和预算类笔记封面，强调亮点词、数字和收藏感。", "cta": "生成封面", "width": 900, "height": 1200, "background": "#fff1f2", "primary": "#ef4444", "accent": "#fca5a5", "text": "#4a1d1f", "fullTitle": "示例模板 - 小红书预算穿搭封面"},
    {"id": 321, "cate": 8, "title": "氛围感自拍", "subtitle": "封面主标题 / 视觉先行", "body": "适合自拍、写真和情绪向内容封面，版式更偏视觉大片和单句主标题。", "cta": "预览效果", "width": 900, "height": 1200, "background": "#fdf2f8", "primary": "#db2777", "accent": "#f9a8d4", "text": "#4a1431", "fullTitle": "示例模板 - 小红书氛围感自拍封面"},
]


def refresh_texts():
    list_payload = []
    for item_id, title, sample, color, bg, font_size, letter_spacing in text_presets:
        list_payload.append({
            "id": item_id,
            "title": title,
            "cover": text_cover(sample[:4], color.replace("ff", ""), bg or "#fffaf6"),
        })
        detail = build_text_detail(item_id, title, sample, color, bg, font_size, letter_spacing)
        write_json(MOCK_ROOT / "components" / "detail" / f"{item_id}.json", detail)
    write_json(MOCK_ROOT / "components" / "list" / "text.json", list_payload)


def refresh_comps():
    list_payload = []
    for item_id, title, eyebrow, headline, subtitle, primary, accent, bg in combo_presets:
        list_payload.append({
            "id": item_id,
            "title": title,
            "cover": preview_card(headline, eyebrow, primary, bg),
        })
        detail = build_comp_detail(item_id, title, eyebrow, headline, subtitle, primary, accent, bg)
        write_json(MOCK_ROOT / "components" / "detail" / f"{item_id}.json", detail)
    write_json(MOCK_ROOT / "components" / "list" / "comp.json", list_payload)


def refresh_materials():
    png_payload = [make_material_item(item_id, title, svg) for item_id, title, svg in png_material_presets]
    write_json(MOCK_ROOT / "materials" / "png.json", png_payload)

    svg_payload = []
    for item_id, item in svg_presets:
        svg_payload.append({
            "id": item_id,
            "title": item["title"],
            "width": 800,
            "height": 800,
            "type": "svg",
            "model": json.dumps(item["model"], ensure_ascii=False),
            "thumb": data_url(item["thumb"]),
            "url": item["url"],
            "created_time": NOW,
            "updated_time": NOW,
            "state": 1,
        })
    write_json(MOCK_ROOT / "materials" / "svg.json", svg_payload)


def refresh_templates():
    list_path = MOCK_ROOT / "templates" / "list.json"
    existing = json.loads(list_path.read_text(encoding="utf-8"))
    keep_ids = {1, 2, 101, 102, 103, 104, 105, 106, 107, 201, 202, 203, 204, 205, 206, 207, 208}
    list_payload = [item for item in existing if int(item["id"]) in keep_ids]

    for seed in template_presets:
        list_payload.append({
            "id": seed["id"],
            "cover": template_preview(seed["title"], seed["subtitle"], seed["primary"], seed["accent"], seed["background"]),
            "title": seed["fullTitle"],
            "width": seed["width"],
            "height": seed["height"],
            "state": 1,
            "cate": seed["cate"],
        })
        detail = build_template_detail(seed)
        write_json(MOCK_ROOT / "templates" / f"{seed['id']}.json", detail)

    list_payload = sorted(list_payload, key=lambda item: int(item["id"]))
    write_json(list_path, list_payload)


if __name__ == "__main__":
    refresh_texts()
    refresh_comps()
    refresh_materials()
    refresh_templates()
    print("mock content refreshed")

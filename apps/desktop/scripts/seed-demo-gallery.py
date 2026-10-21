#!/usr/bin/env python3
"""往本地图库造演示数据（主图 / 详情图 / 复刻图）。

数据落在真实位置，图库页面（asset.list / asset.raw / 下载 / 删除）可直接读到：
  - 图片字节：~/ecommerce/assets/{main,detail,replicate}/*.png     (data-root 的 userRoot)
  - 数据库：  ~/.ecommerce/desktop.db 的 GeneratedAsset 表（category 决定归到哪个 Tab）
幂等：重跑会先删除 runId like 'demo-%' 的记录与对应文件。
"""
import hashlib
import os
import sqlite3
import time
import uuid
from datetime import datetime

from PIL import Image, ImageDraw, ImageFont

HOME = os.path.expanduser("~")
USER_ROOT = os.path.join(HOME, "ecommerce")
DB = os.path.join(HOME, ".ecommerce", "desktop.db")

FONT_CANDIDATES = [
    "/System/Library/Fonts/PingFang.ttc",
    "/System/Library/Fonts/Supplemental/Songti.ttc",
    "/System/Library/Fonts/Supplemental/Arial Unicode.ttf",
    "/System/Library/Fonts/Helvetica.ttc",
]


def load_font(size):
    for path in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size)
            except Exception:
                continue
    return ImageFont.load_default()


def mix(c1, c2, t):
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def gradient(size, top, bottom):
    w, h = size
    img = Image.new("RGB", (w, h))
    draw = ImageDraw.Draw(img)
    for y in range(h):
        draw.line([(0, y), (w, y)], fill=mix(top, bottom, y / max(1, h - 1)))
    return img


PRODUCTS = [
    {"code": "SP2026001", "name": "主动降噪蓝牙耳机 Pro", "brand": "声阔", "id": "cmvfcacdk00008qd0tprllfyc",
     "platform": "淘宝", "base": (36, 61, 122), "accent": (90, 140, 255), "shape": "buds"},
    {"code": "SP2026002", "name": "智能运动手表 GT5", "brand": "华为", "id": "cmvfcacdn00038qd0kgjlf6ed",
     "platform": "京东", "base": (18, 32, 46), "accent": (0, 180, 170), "shape": "watch"},
    {"code": "SP2026004", "name": "护眼国AA级 LED 台灯", "brand": "飞利浦", "id": "cmvfcacdq00098qd02vjs2kz4",
     "platform": "拼多多", "base": (58, 46, 32), "accent": (255, 196, 92), "shape": "lamp"},
    {"code": "SP2026005", "name": "户外防水蓝牙音箱", "brand": "JBL", "id": "cmvfcacdr000c8qd07mkm1v4f",
     "platform": "抖店", "base": (60, 24, 30), "accent": (255, 108, 92), "shape": "speaker"},
    {"code": "SP2026003", "name": "便携式随行榨汁杯", "brand": "九阳", "id": "cmvfcacdo00078qd0kwgulca3",
     "platform": "天猫", "base": (24, 58, 40), "accent": (108, 220, 140), "shape": "cup"},
]


def draw_product(draw, cx, cy, scale, shape, accent):
    """简化产品剪影 + 光晕（演示用占位图，不冒充真实商品摄影）"""
    glow = mix(accent, (255, 255, 255), 0.72)
    for r in range(int(150 * scale), int(40 * scale), -10):
        alpha = int(10 + (150 * scale - r) * 1.2)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=mix(glow, (255, 255, 255), min(alpha, 255) / 255))

    body = mix(accent, (255, 255, 255), 0.12)
    dark = mix(accent, (0, 0, 0), 0.55)
    s = scale
    if shape == "buds":
        for dx in (-95 * s, 95 * s):
            draw.rounded_rectangle([cx + dx - 42 * s, cy - 78 * s, cx + dx + 42 * s, cy + 58 * s], radius=int(36 * s), fill=body, outline=dark, width=3)
            draw.ellipse([cx + dx - 16 * s, cy - 66 * s, cx + dx + 16 * s, cy - 34 * s], fill=mix(dark, (0, 0, 0), 0.25))
        draw.rounded_rectangle([cx - 70 * s, cy + 66 * s, cx + 70 * s, cy + 150 * s], radius=int(26 * s), fill=mix(accent, (255, 255, 255), 0.32), outline=dark, width=2)
    elif shape == "watch":
        draw.rounded_rectangle([cx - 74 * s, cy - 128 * s, cx + 74 * s, cy + 128 * s], radius=int(34 * s), fill=dark)
        draw.rounded_rectangle([cx - 62 * s, cy - 96 * s, cx + 62 * s, cy + 96 * s], radius=int(26 * s), fill=(12, 14, 18))
        draw.rounded_rectangle([cx - 44 * s, cy - 34 * s, cx + 44 * s, cy + 44 * s], radius=int(12 * s), fill=body)
        draw.ellipse([cx - 8 * s, cy - 8 * s, cx + 8 * s, cy + 8 * s], fill=accent)
    elif shape == "lamp":
        draw.rounded_rectangle([cx - 130 * s, cy + 96 * s, cx + 130 * s, cy + 126 * s], radius=int(12 * s), fill=dark)
        draw.line([cx, cy + 96 * s, cx - 30 * s, cy - 10 * s], fill=dark, width=int(10 * s))
        draw.rounded_rectangle([cx - 120 * s, cy - 74 * s, cx + 40 * s, cy - 10 * s], radius=int(22 * s), fill=mix(accent, (255, 255, 255), 0.35), outline=dark, width=3)
        draw.polygon([(cx + 40 * s, cy - 62 * s), (cx + 118 * s, cy - 30 * s), (cx + 40 * s, cy - 12 * s)], fill=mix(accent, (255, 255, 255), 0.6))
    elif shape == "cup":
        draw.rounded_rectangle([cx - 66 * s, cy - 110 * s, cx + 66 * s, cy + 110 * s], radius=int(26 * s), fill=body, outline=dark, width=3)
        draw.rounded_rectangle([cx - 48 * s, cy - 92 * s, cx + 48 * s, cy - 40 * s], radius=int(14 * s), fill=mix(accent, (255, 255, 255), 0.5))
        draw.rounded_rectangle([cx - 20 * s, cy - 140 * s, cx + 20 * s, cy - 110 * s], radius=int(10 * s), fill=dark)
    else:  # speaker
        draw.rounded_rectangle([cx - 118 * s, cy - 96 * s, cx + 118 * s, cy + 96 * s], radius=int(30 * s), fill=body, outline=dark, width=3)
        for dx in (-56 * s, 0, 56 * s):
            draw.ellipse([cx + dx - 22 * s, cy - 22 * s, cx + dx + 22 * s, cy + 22 * s], fill=mix(dark, (0, 0, 0), 0.3))
        draw.rounded_rectangle([cx - 26 * s, cy + 96 * s, cx + 26 * s, cy + 120 * s], radius=int(8 * s), fill=dark)


def badge(draw, text, xy, font, fg=(51, 136, 255), bg=(255, 255, 255, 225)):
    x, y = xy
    width = draw.textlength(text, font=font)
    draw.rounded_rectangle([x, y, x + width + 40, y + 50], radius=25, fill=bg)
    draw.text((x + 20, y + 12), text, font=font, fill=fg)


def render_main(product, index, scene, ratio, out_path):
    w, h = (800, 800) if ratio == "1:1" else (750, 1000)
    img = gradient((w, h), mix(product["base"], (255, 255, 255), 0.06), mix(product["base"], (0, 0, 0), 0.35))
    draw = ImageDraw.Draw(img, "RGBA")
    draw_product(draw, w // 2, int(h * 0.46), 1.0, product["shape"], product["accent"])

    draw.rectangle([0, h - 132, w, h], fill=(255, 255, 255, 236))
    name_font = load_font(38 if w >= 800 else 34)
    sub_font = load_font(26)
    draw.text((44, h - 108), product["name"], font=name_font, fill=(10, 27, 57))
    draw.text((44, h - 56), f'{product["brand"]}  ·  {scene}', font=sub_font, fill=(134, 144, 156))

    tiny = load_font(24)
    badge(draw, product["platform"], (36, 34), tiny)
    tag = f"主图 {index + 1}"
    tag_w = draw.textlength(tag, font=tiny)
    badge(draw, tag, (w - 36 - tag_w - 40, 34), tiny, fg=(64, 158, 255))
    img.save(out_path, "PNG", optimize=True)


def render_detail(product, index, out_path):
    """详情图：横版 banner（左产品 / 右卖点）"""
    w, h = 1280, 720
    img = gradient((w, h), mix(product["base"], (255, 255, 255), 0.5), mix(product["base"], (0, 0, 0), 0.25))
    draw = ImageDraw.Draw(img, "RGBA")
    draw.rectangle([0, 0, w, h], fill=(255, 255, 255, 40))
    draw_product(draw, int(w * 0.3), int(h * 0.55), 1.0, product["shape"], product["accent"])

    draw.rounded_rectangle([int(w * 0.52), 120, w - 80, h - 120], radius=28, fill=(255, 255, 255, 238))
    title_font = load_font(44)
    body_font = load_font(28)
    muted = (110, 120, 136)
    draw.text((int(w * 0.52) + 44, 168), product["name"], font=title_font, fill=(10, 27, 57))
    bullets = [
        "核心卖点一：一件解决日常痛点",
        "核心卖点二：材质 / 工艺细节说明",
        "核心卖点三：适用场景与人群",
        "服务承诺：7天无理由 · 全国联保",
    ]
    y = 250
    for text in bullets:
        draw.ellipse([int(w * 0.52) + 46, y + 8, int(w * 0.52) + 62, y + 24], fill=product["accent"])
        draw.text((int(w * 0.52) + 78, y), text, font=body_font, fill=muted)
        y += 62

    tiny = load_font(24)
    badge(draw, product["platform"], (36, 34), tiny)
    tag = f"详情图 {index + 1}"
    tag_w = draw.textlength(tag, font=tiny)
    badge(draw, tag, (w - 36 - tag_w - 40, 34), tiny, fg=(64, 158, 255))
    img.save(out_path, "PNG", optimize=True)


def render_replicate(product, index, out_path):
    """复刻图：左原图（低饱和）/ 右复刻（高饱和）+ 箭头"""
    w = h = 800
    img = gradient((w, h), mix(product["base"], (255, 255, 255), 0.08), mix(product["base"], (0, 0, 0), 0.32))
    draw = ImageDraw.Draw(img, "RGBA")

    draw.rectangle([0, 0, w // 2, h], fill=(0, 0, 0, 60))
    draw_product(draw, int(w * 0.25), int(h * 0.48), 0.72, product["shape"], mix(product["accent"], (140, 140, 140), 0.55))
    draw_product(draw, int(w * 0.75), int(h * 0.48), 0.72, product["shape"], product["accent"])

    label_font = load_font(26)
    draw.text((60, h - 210), "原图", font=label_font, fill=(255, 255, 255))
    draw.text((int(w * 0.62), h - 210), "复刻结果", font=label_font, fill=(255, 255, 255))
    draw.polygon([(w // 2 - 18, h // 2 - 22), (w // 2 + 22, h // 2), (w // 2 - 18, h // 2 + 22)], fill=(255, 255, 255, 220))

    draw.rectangle([0, h - 132, w, h], fill=(255, 255, 255, 236))
    name_font = load_font(36)
    draw.text((44, h - 108), f'{product["name"]} 复刻', font=name_font, fill=(10, 27, 57))
    draw.text((44, h - 58), f'{product["brand"]}  ·  AI 复刻', font=load_font(26), fill=(134, 144, 156))

    tiny = load_font(24)
    badge(draw, product["platform"], (36, 34), tiny)
    tag = f"复刻图 {index + 1}"
    tag_w = draw.textlength(tag, font=tiny)
    badge(draw, tag, (w - 36 - tag_w - 40, 34), tiny, fg=(64, 158, 255))
    img.save(out_path, "PNG", optimize=True)


# 每个平台组：商品、场景数、category、目录、比例
PLAN = [
    ("main", "SP2026001", 4, ["主图", "侧视", "细节", "场景"], ["1:1", "1:1", "1:1", "3:4"]),
    ("main", "SP2026002", 4, ["主图", "侧视", "细节", "场景"], ["1:1", "1:1", "1:1", "3:4"]),
    ("main", "SP2026004", 4, ["主图", "侧视", "细节", "场景"], ["1:1", "1:1", "1:1", "3:4"]),
    ("main", "SP2026005", 4, ["主图", "侧视", "细节", "场景"], ["1:1", "1:1", "1:1", "3:4"]),
    ("detail", "SP2026001", 6, None, ["16:9"] * 6),
    ("detail", "SP2026002", 6, None, ["16:9"] * 6),
    ("detail", "SP2026004", 6, None, ["16:9"] * 6),
    ("replicate", "SP2026005", 4, None, ["1:1"] * 4),
    ("replicate", "SP2026003", 4, None, ["1:1"] * 4),
]

by_code = {p["code"]: p for p in PRODUCTS}
conn = sqlite3.connect(DB)

# 幂等：先清掉上次演示数据（storageKey 唯一，重复插入会冲突）
for (key,) in conn.execute("select storageKey from GeneratedAsset where runId like 'demo-%'").fetchall():
    path = os.path.join(USER_ROOT, key)
    if os.path.exists(path):
        os.remove(path)
conn.execute("delete from GeneratedAsset where runId like 'demo-%'")
conn.commit()

now_ms = int(time.time() * 1000)
rows = []
for group_index, (kind, code, count, scenes, ratios) in enumerate(PLAN):
    product = by_code[code]
    run_id = f"demo-{kind}-{group_index + 1}"
    group_time = now_ms - (group_index + 1) * 47 * 60 * 1000  # 每组间隔 47 分钟 → 一定分成不同组
    out_dir = os.path.join(USER_ROOT, "assets", kind)
    os.makedirs(out_dir, exist_ok=True)
    for i in range(count):
        scene = scenes[i] if scenes else f"详情{i + 1}"
        file_name = f"{code}-{kind}-{i + 1}.png"
        path = os.path.join(out_dir, file_name)
        if kind == "main":
            render_main(product, i, scene, ratios[i], path)
        elif kind == "detail":
            render_detail(product, i, path)
        else:
            render_replicate(product, i, path)
        data = open(path, "rb").read()
        rows.append((
            uuid.uuid4().hex, "local", None, None, f"assets/{kind}/{file_name}", "image/png", len(data),
            hashlib.sha256(data).hexdigest(), f"{product['name']}-{scene}.png", None,
            run_id, kind, f"{product['name']} {scene} 演示图", ratios[i],
            product["id"], product["name"], "admin", product["platform"],
            group_time + i * 1000,
        ))

conn.executemany("""INSERT OR REPLACE INTO GeneratedAsset
  (id, tenantId, jobId, analysisRunId, storageKey, mimeType, size, sha256, originalName, sourceUrl,
   runId, category, prompt, ratio, productId, productName, createdBy, platform, createdAt)
  VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""", rows)
conn.commit()

print(f"写入 {len(rows)} 张 → {USER_ROOT}/assets/{{main,detail,replicate}}")
for kind, label in (("main", "主图"), ("detail", "详情图"), ("replicate", "复刻图")):
    total = conn.execute("select count(*) from GeneratedAsset where category = ?", (kind,)).fetchone()[0]
    groups = conn.execute("select count(distinct runId) from GeneratedAsset where category = ?", (kind,)).fetchone()[0]
    print(f"  {label}: {total} 张 / {groups} 组")
conn.close()

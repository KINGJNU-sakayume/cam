#!/usr/bin/env python3
"""개발할 때만 쓰는 도구(사이트는 의존성 없음, pip install pillow). F2 조밀 테마 검토용 대조 시트.
무작위 직캠 N개·풀캠 M개의 실제 유튜브 썸네일을 받아, 원본과 크롭 후보를 나란히 놓은 PNG를 만든다.

직캠 한 줄:  원본 16:9 | 지금(2:3, thumbPos) | 후보 A 1:2.2 전신 띠 | 후보 B 3:4 상반신
풀캠 한 줄:  원본 16:9 | 지금(16:9) | 후보 C 3:1 띠(위아래 로고 잘라냄) | 후보 D 2.4:1 띠(가운데)

python3 scripts/thumb-sheet.py --out .cache/thumb-sheet.png --fancam 24 --full 12 --seed 7
"""
import argparse, io, json, random, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

ap = argparse.ArgumentParser()
ap.add_argument('--data', default='data/videos.json')
ap.add_argument('--out', default='.cache/thumb-sheet.png')
ap.add_argument('--fancam', type=int, default=24)
ap.add_argument('--full', type=int, default=12)
ap.add_argument('--seed', type=int, default=7)
a = ap.parse_args()

d = json.load(open(a.data))
rnd = random.Random(a.seed)
live = [v for v in d['videos'] if not v.get('gone') and v.get('ytId')]
fan = rnd.sample([v for v in live if v['type'] == 'fancam' and len(v['memberIds']) == 1], a.fancam)
full = rnd.sample([v for v in live if v['type'] == 'full'], a.full)

def fetch(v):
    for name in ('hq720', 'hqdefault'):
        try:
            with urllib.request.urlopen(f'https://i.ytimg.com/vi/{v["ytId"]}/{name}.jpg', timeout=15) as r:
                im = Image.open(io.BytesIO(r.read())).convert('RGB')
            if im.width > 200:
                if name == 'hqdefault':  # 4:3 안의 16:9 (위아래 검은 띠 제거)
                    h = im.width * 9 // 16; t = (im.height - h) // 2; im = im.crop((0, t, im.width, t + h))
                return im.resize((640, 360))
        except Exception:
            continue
    return None

with ThreadPoolExecutor(8) as ex:
    imgs = list(ex.map(fetch, fan + full))
if not any(imgs):
    sys.exit('✗ 썸네일을 하나도 못 받았어요 (i.ytimg.com 허용 필요)')

def pct(pos, i, default):
    try: return float(pos.split()[i].rstrip('%')) / 100
    except Exception: return default

def crop_ratio(im, rw, rh, cx=0.5, cy=0.5):
    W, H = im.size
    if W / H > rw / rh: h = H; w = round(H * rw / rh)
    else: w = W; h = round(W * rh / rw)
    x = min(max(round(cx * W - w / 2), 0), W - w)
    y = min(max(round(cy * H - h / 2), 0), H - h)
    return im.crop((x, y, x + w, y + h))

ROW_H = 220
def fit_h(im, h=ROW_H): return im.resize((round(im.width * h / im.height), h))

try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 15)
except Exception:
    font = ImageFont.load_default()

members = {m['id']: m['name'] for g in d['groups'] for m in g['members']}
rows = []
for v, im in zip(fan + full, imgs):
    if im is None: continue
    if v['type'] == 'fancam':
        pos = v.get('thumbPos') or '50% 35%'
        cx = pct(pos, 0, 0.5)
        # 후보 B: 높이의 위쪽 70%만 쓰는 3:4 (머리~허리)
        top = im.crop((0, 0, im.width, round(im.height * 0.7)))
        cells = [('원본', im), ('지금 2:3', crop_ratio(im, 2, 3, cx)), ('A 1:2.2 전신', crop_ratio(im, 1, 2.2, cx)),
                 ('B 3:4 상반신', crop_ratio(top, 3, 4, cx, 0.5))]
        label = f'{v["id"]} 직캠 {members.get(v["memberIds"][0], "")} · {v.get("channel", "")}'
    else:
        cells = [('원본', im), ('지금 16:9', im), ('C 3:1 띠', crop_ratio(im, 3, 1, 0.5, 0.55)), ('D 2.4:1 띠', crop_ratio(im, 2.4, 1, 0.5, 0.5))]
        label = f'{v["id"]} 풀캠 · {v.get("channel", "")}'
    rows.append((label, [(t, fit_h(c)) for t, c in cells]))

GAP, HEAD = 12, 26
width = max(sum(c.width for _, c in cs) + GAP * (len(cs) + 1) for _, cs in rows)
height = sum(HEAD + ROW_H + 26 + GAP for _ in rows) + GAP
sheet = Image.new('RGB', (width, height), (236, 237, 240))
dr = ImageDraw.Draw(sheet)
y = GAP
for label, cs in rows:
    dr.text((GAP, y), label[:90], fill=(26, 27, 30), font=font)
    x = GAP; y2 = y + HEAD
    for t, c in cs:
        sheet.paste(c, (x, y2))
        dr.text((x, y2 + ROW_H + 4), f'{t}  {c.width}×{c.height}', fill=(92, 95, 102), font=font)
        x += c.width + GAP
    y = y2 + ROW_H + 26 + GAP
import os; os.makedirs(os.path.dirname(a.out) or '.', exist_ok=True)
sheet.save(a.out, optimize=True)
print(f'✓ {a.out}: 직캠 {sum(1 for l,_ in rows if "직캠" in l)} · 풀캠 {sum(1 for l,_ in rows if "풀캠" in l)} · 못 받음 {imgs.count(None)}')

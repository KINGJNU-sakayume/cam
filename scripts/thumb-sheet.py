#!/usr/bin/env python3
"""개발할 때만 쓰는 도구(사이트는 의존성 없음). F2 조밀 테마 검토용 대조 시트.
무작위 직캠·풀캠의 실제 유튜브 썸네일을 받아, 원본과 크롭 후보를 나란히 놓은 PNG를 만든다.

  pip install pillow opencv-python-headless --break-system-packages
  python3 scripts/thumb-sheet.py --fancam 24 --full 12 --seed 7
    → .cache/thumb-sheet-fancam.png, .cache/thumb-sheet-full.png

직캠 한 줄: 원본 16:9 | A 1:2.2 저장된 위치(thumbPos, 없으면 가운데) | A 1:2.2 새로 얼굴 인식(못 찾으면 가운데)
풀캠 한 줄: 원본 16:9 | C 3:1 가운데 | C 3:1 얼굴 기준(얼굴이 띠 위쪽에 오게)

얼굴 인식은 scripts/face-pos.py와 같은 YuNet 모델(.cache/, 처음 한 번 huggingface에서 받음)을 쓴다.
"""
import argparse, io, json, os, random, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor
from PIL import Image, ImageDraw, ImageFont

os.environ.setdefault('OPENCV_LOG_LEVEL', 'ERROR')
try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit('✗ opencv가 없어요: pip install opencv-python-headless --break-system-packages')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, '.cache', 'face_detection_yunet_2023mar.onnx')
MODEL_URL = 'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx'

ap = argparse.ArgumentParser()
ap.add_argument('--data', default=os.path.join(ROOT, 'data', 'videos.json'))
ap.add_argument('--out', default=os.path.join(ROOT, '.cache', 'thumb-sheet'))
ap.add_argument('--fancam', type=int, default=24)
ap.add_argument('--full', type=int, default=12)
ap.add_argument('--seed', type=int, default=7)
ap.add_argument('--local', default='', help='썸네일을 받지 않고 이 폴더의 <영상id>.jpg를 쓴다(오프라인 확인용)')
a = ap.parse_args()

if not os.path.exists(MODEL):
    os.makedirs(os.path.dirname(MODEL), exist_ok=True)
    print('얼굴 모델 받는 중…')
    urllib.request.urlretrieve(MODEL_URL, MODEL)

d = json.load(open(a.data, encoding='utf8'))
rnd = random.Random(a.seed)
live = [v for v in d['videos'] if not v.get('gone') and v.get('ytId')]
fan = rnd.sample([v for v in live if v['type'] == 'fancam' and len(v['memberIds']) == 1], a.fancam)
full = rnd.sample([v for v in live if v['type'] == 'full'], a.full)
members = {m['id']: m['name'] for g in d['groups'] for m in g['members']}


def fetch(v):
    """사이트와 같은 이미지(hq720, 없으면 hqdefault의 16:9 부분)를 원래 크기로"""
    if a.local:
        f = os.path.join(a.local, f'{v["id"]}.jpg')
        return Image.open(f).convert('RGB').resize((1280, 720)) if os.path.exists(f) else None
    for name in ('hq720', 'hqdefault'):
        try:
            with urllib.request.urlopen(f'https://i.ytimg.com/vi/{v["ytId"]}/{name}.jpg', timeout=15) as r:
                im = Image.open(io.BytesIO(r.read())).convert('RGB')
        except Exception:
            continue
        if im.width <= 120:  # '이미지 없음' 자리표시
            continue
        if name == 'hqdefault':
            h = im.width * 9 // 16; t = (im.height - h) // 2; im = im.crop((0, t, im.width, t + h))
        return im
    return None


def faces_of(im, min_score):
    arr = cv2.cvtColor(np.asarray(im), cv2.COLOR_RGB2BGR)
    h, w = arr.shape[:2]
    det = cv2.FaceDetectorYN.create(MODEL, '', (w, h), min_score, 0.3, 200)
    _, f = det.detect(arr)
    return [] if f is None else [tuple(map(float, r[:4])) for r in f]


# ---------- 직캠: 가로 위치 ----------
W23 = (2 / 3) / (16 / 9)  # 2:3 칸이 16:9 이미지에서 차지하는 폭(0.375)


def cx_from_pos(pos):
    """저장된 thumbPos(2:3 칸 기준 object-position x%) → 얼굴 가운데 x(0~1)"""
    p = float(pos.split()[0].rstrip('%')) / 100
    return p * (1 - W23) + W23 / 2


def fancam_cx(im):
    """가장 큰 얼굴의 가운데 x. 비슷한 크기가 여럿이거나 없으면 None (face-pos.py와 같은 규칙)"""
    fs = sorted((f for f in faces_of(im, 0.7) if f[2] >= im.width * 0.03), key=lambda f: f[2] * f[3], reverse=True)
    if not fs or (len(fs) > 1 and fs[0][2] * fs[0][3] < 1.8 * fs[1][2] * fs[1][3]):
        return None
    f = fs[0]
    return (f[0] + f[2] / 2) / im.width


# ---------- 풀캠: 세로 위치 ----------
def band_top(im, ratio=3.0):
    """3:1 띠의 위쪽 y(px). 얼굴이 가장 많이 띠 위쪽 60% 안에 들어오는 자리. 얼굴이 없으면 None"""
    W, H = im.size
    bh = round(W / ratio)
    fs = [f for f in faces_of(im, 0.6) if f[2] >= W * 0.012]
    if not fs:
        return None, 0
    big = max(w * h for x, y, w, h in fs)
    best, best_score = None, -1e9
    for top in range(0, H - bh + 1, 2):
        # 큰 얼굴(앞줄 무대 위 멤버)에 무게를 둔다: 뒤쪽 관객·화면 속 작은 얼굴이 띠를 끌고 가지 않게
        upper = sum(w * h for x, y, w, h in fs if y >= top and y + h <= top + bh * 0.6)
        inside = sum(w * h for x, y, w, h in fs if y >= top and y + h <= top + bh)
        score = (upper * 2 + inside) / big - abs(top + bh / 2 - H / 2) / H * 0.1  # 같으면 가운데에 가까운 쪽
        if score > best_score:
            best, best_score = top, score
    return best, len(fs)


def crop_w(im, rw, rh, cx):
    W, H = im.size
    w = round(H * rw / rh)
    x = min(max(round(cx * W - w / 2), 0), W - w)
    return im.crop((x, 0, x + w, H))


def band(im, top, ratio=3.0):
    W, H = im.size
    bh = round(W / ratio)
    if top is None: top = (H - bh) // 2
    return im.crop((0, top, W, top + bh))


with ThreadPoolExecutor(8) as ex:
    imgs = list(ex.map(fetch, fan + full))
if not any(imgs):
    sys.exit('✗ 썸네일을 하나도 못 받았어요 (i.ytimg.com 허용 필요)')

ROW_H = 220
fit = lambda im: im.resize((max(1, round(im.width * ROW_H / im.height)), ROW_H))
try:
    font = ImageFont.truetype('/usr/share/fonts/truetype/noto/NotoSansCJK-Regular.ttc', 15)
except Exception:
    font = ImageFont.load_default()

fan_rows, full_rows, stat = [], [], {'fan_saved': 0, 'fan_new': 0, 'fan_none': 0, 'full_face': 0}
for v, im in zip(fan + full, imgs):
    if im is None: continue
    if v['type'] == 'fancam':
        saved = cx_from_pos(v['thumbPos']) if v.get('thumbPos') else None
        new = fancam_cx(im)
        stat['fan_saved' if saved is not None else 'fan_new' if new is not None else 'fan_none'] += 1
        cells = [('원본', im),
                 ('A 저장값' if saved is not None else 'A 가운데', crop_w(im, 1, 2.2, saved if saved is not None else 0.5)),
                 ('A 얼굴' if new is not None else 'A 못 찾음', crop_w(im, 1, 2.2, new if new is not None else 0.5))]
        fan_rows.append((f'{v["id"]} 직캠 {members.get(v["memberIds"][0], "")} · {v.get("channel", "")}', cells))
    else:
        top, n = band_top(im)
        if top is not None: stat['full_face'] += 1
        cells = [('원본', im), ('C 가운데', band(im, None)), (f'C 얼굴 기준 (얼굴 {n})' if top is not None else 'C 얼굴 못 찾음', band(im, top))]
        full_rows.append((f'{v["id"]} 풀캠 · {v.get("channel", "")}', cells))


def draw(rows, path):
    GAP, HEAD = 12, 26
    rows = [(l, [(t, fit(c)) for t, c in cs]) for l, cs in rows]
    width = max(sum(c.width for _, c in cs) + GAP * (len(cs) + 1) for _, cs in rows)
    sheet = Image.new('RGB', (width, len(rows) * (HEAD + ROW_H + 26 + GAP) + GAP), (236, 237, 240))
    dr = ImageDraw.Draw(sheet)
    y = GAP
    for label, cs in rows:
        dr.text((GAP, y), label[:90], fill=(26, 27, 30), font=font)
        x = GAP
        for t, c in cs:
            sheet.paste(c, (x, y + HEAD))
            dr.text((x, y + HEAD + ROW_H + 4), t, fill=(92, 95, 102), font=font)
            x += c.width + GAP
        y += HEAD + ROW_H + 26 + GAP
    os.makedirs(os.path.dirname(path) or '.', exist_ok=True)
    sheet.save(path, optimize=True)
    print(f'✓ {path}')


if fan_rows: draw(fan_rows, f'{a.out}-fancam.png')
if full_rows: draw(full_rows, f'{a.out}-full.png')
print(f"직캠 {len(fan_rows)}: 저장 위치 {stat['fan_saved']} · 새로 인식 {stat['fan_new']} · 못 찾음 {stat['fan_none']}"
      f" | 풀캠 {len(full_rows)}: 얼굴 기준 {stat['full_face']} | 못 받음 {imgs.count(None)}")

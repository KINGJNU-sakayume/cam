#!/usr/bin/env python3
"""직캠 썸네일에서 얼굴을 찾아 2:3 칸의 자르는 위치(thumbPos)를 정한다. 개발할 때만 쓰는 도구(사이트는 의존성 없음).

  pip install opencv-python-headless
  python3 scripts/face-pos.py                 thumbPos가 없는 직캠 전부 → .cache/face-pos.json
  python3 scripts/face-pos.py --ids v1,v2     이 영상만
  python3 scripts/face-pos.py --sheet 30      무작위 30개를 원본·지금 크롭·새 크롭으로 나란히 놓은 확인용 이미지도 만든다
  node scripts/archive.mjs thumbpos .cache/face-pos.json --dry-run   → 적용(사람이 고른 thumbPos는 덮어쓰지 않음)

YuNet 얼굴 모델은 처음 한 번 huggingface에서 .cache/로 받는다. 화면과 같은 이미지(hq720, 없으면 hqdefault)로 계산한다.
"""
import argparse, json, os, random, sys, urllib.request
from concurrent.futures import ThreadPoolExecutor

os.environ.setdefault('OPENCV_LOG_LEVEL', 'ERROR')
try:
    import cv2
    import numpy as np
except ImportError:
    sys.exit('✗ opencv가 없어요: pip install opencv-python-headless')

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL = os.path.join(ROOT, '.cache', 'face_detection_yunet_2023mar.onnx')
MODEL_URL = 'https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx'
DEFAULT_Y = '35%'  # js/model.js DEFAULT_THUMB_POS의 세로 위치. 16:9 이미지를 2:3에 채우면 세로는 잘리지 않는다

ap = argparse.ArgumentParser()
ap.add_argument('--data', default=os.path.join(ROOT, 'data', 'videos.json'))
ap.add_argument('--out', default=os.path.join(ROOT, '.cache', 'face-pos.json'))
ap.add_argument('--ids', default='')
ap.add_argument('--all', action='store_true', help='thumbPos가 이미 있는 영상도 계산(적용 때는 덮어쓰지 않음)')
ap.add_argument('--jobs', type=int, default=16)
ap.add_argument('--sheet', type=int, default=0)
ap.add_argument('--min-score', type=float, default=0.7)
args = ap.parse_args()

if not os.path.exists(MODEL):
    os.makedirs(os.path.dirname(MODEL), exist_ok=True)
    print('얼굴 모델 받는 중…')
    urllib.request.urlretrieve(MODEL_URL, MODEL)

data = json.load(open(args.data, encoding='utf8'))
ids = set(filter(None, args.ids.split(',')))
vids = [v for v in data['videos'] if v.get('type') == 'fancam' and not v.get('thumb')
        and (v['id'] in ids if ids else (args.all or not v.get('thumbPos')))]
print(f'대상 직캠 {len(vids)}개')


def fetch(yt):
    for name in ('hq720', 'hqdefault'):
        try:
            b = urllib.request.urlopen(f'https://i.ytimg.com/vi/{yt}/{name}.jpg', timeout=15).read()
        except Exception:
            continue
        img = cv2.imdecode(np.frombuffer(b, np.uint8), cv2.IMREAD_COLOR)
        if img is not None and img.shape[1] > 120:  # 120px은 '이미지 없음' 자리표시(app.js와 같은 기준)
            return img
    return None


def face_x(img):
    """가장 큰 얼굴의 가운데 x(0~1)와 점수. 없으면 None"""
    h, w = img.shape[:2]
    det = cv2.FaceDetectorYN.create(MODEL, '', (w, h), args.min_score, 0.3, 50)
    _, faces = det.detect(img)
    if faces is None or not len(faces):
        return None
    faces = sorted(faces, key=lambda r: r[2] * r[3], reverse=True)
    f = faces[0]
    if f[2] < w * 0.03:  # 아주 작은 얼굴(관객·화면 속 얼굴)은 믿지 않는다
        return None
    # 여러 명이 비슷한 크기로 나오면 누가 주인공인지 알 수 없으니 옮기지 않는다
    if len(faces) > 1 and f[2] * f[3] < 1.8 * faces[1][2] * faces[1][3]:
        return 'multi'
    return (f[0] + f[2] / 2) / w


def pos_for(img, cx):
    """2:3 칸에 object-fit: cover로 채울 때 얼굴이 가운데 오게 하는 object-position x(%)"""
    h, w = img.shape[:2]
    cw = h * 2 / 3
    if w <= cw:
        return 50
    p = (cx * w - cw / 2) / (w - cw)
    return int(round(min(1, max(0, p)) * 100))


def work(v):
    img = fetch(v['ytId'])
    if img is None:
        return v['id'], None, 'no-image', None
    cx = face_x(img)
    if cx is None or cx == 'multi':
        return v['id'], None, 'multi' if cx else 'no-face', img
    return v['id'], pos_for(img, cx), 'ok', img


res, stat, imgs = {}, {'ok': 0, 'center': 0, 'multi': 0, 'no-face': 0, 'no-image': 0}, {}
want_sheet = set(random.sample([v['id'] for v in vids], min(args.sheet, len(vids)))) if args.sheet else set()
with ThreadPoolExecutor(args.jobs) as ex:
    for i, (vid, x, why, img) in enumerate(ex.map(work, vids), 1):
        if why == 'ok' and abs(x - 50) <= 5:
            why = 'center'
        stat[why] += 1
        if why == 'ok':
            res[vid] = f'{x}% {DEFAULT_Y}'
        if vid in want_sheet and img is not None:
            imgs[vid] = (img, x)
        if i % 200 == 0 or i == len(vids):
            print(f'\r  {i}/{len(vids)}', end='', flush=True)
print()

os.makedirs(os.path.dirname(args.out), exist_ok=True)
json.dump(res, open(args.out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(f"얼굴로 옮김 {stat['ok']} · 이미 가운데 {stat['center']} · 여러 명이라 그대로 {stat['multi']} · 얼굴 못 찾음 {stat['no-face']} · 이미지 없음 {stat['no-image']}")
print(f'→ {args.out}\n다음: node scripts/archive.mjs thumbpos {os.path.relpath(args.out, ROOT)} --dry-run')

if imgs:
    # 확인용: [원본(얼굴 위치 선) | 지금 크롭(50%) | 새 크롭]
    rows = []
    for vid, (img, x) in list(imgs.items())[:40]:
        h, w = img.shape[:2]
        img = cv2.resize(img, (int(w * 240 / h), 240))
        h, w = img.shape[:2]
        cw = int(h * 2 / 3)
        crop = lambda p: img[:, int((w - cw) * p / 100):int((w - cw) * p / 100) + cw]
        new = crop(x if x is not None else 50).copy()
        cv2.putText(new, f'{x if x is not None else "-"}%', (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        row = np.hstack([img, np.full((h, 6, 3), 255, np.uint8), crop(50), np.full((h, 6, 3), 255, np.uint8), new])
        cv2.putText(row, vid, (4, h - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        rows.append(row)
    wmax = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 6), (0, wmax - r.shape[1]), (0, 0)), constant_values=255) for r in rows]
    path = os.path.join(os.path.dirname(args.out), 'face-pos-sheet.jpg')
    cv2.imwrite(path, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(f'확인용 이미지: {path}')

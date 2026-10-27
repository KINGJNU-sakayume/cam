#!/usr/bin/env python3
"""썸네일에서 얼굴을 찾아 자르는 위치(thumbPos)를 정한다. 개발할 때만 쓰는 도구(사이트는 의존성 없음).

  pip install opencv-python-headless
  python3 scripts/face-pos.py                 thumbPos가 없는 직캠 전부 → .cache/face-pos.json
  python3 scripts/face-pos.py --ids v1,v2     이 영상만
  python3 scripts/face-pos.py --sheet 30      무작위 30개를 원본·지금 크롭·새 크롭으로 나란히 놓은 확인용 이미지도 만든다
  python3 scripts/face-pos.py --full          풀캠: 조밀 모드 3:1 띠의 세로 위치("50% y%")를 얼굴 기준으로 → .cache/face-pos-full.json
  node scripts/archive.mjs thumbpos .cache/face-pos.json --dry-run   → 적용(사람이 고른 thumbPos는 덮어쓰지 않음)

직캠 thumbPos는 2:3 칸 기준 가로 위치예요(조밀 모드의 1:2.2 띠는 js/components.js posFor가 같은 값에서 다시 계산).
풀캠 thumbPos는 3:1 띠 기준 세로 위치예요(16:9 칸에서는 잘리지 않아 영향 없음).

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
ap.add_argument('--out', default='')
ap.add_argument('--full', action='store_true', help='풀캠의 3:1 띠 세로 위치를 계산')
ap.add_argument('--local', default='', help='썸네일을 받지 않고 이 폴더의 <영상id>.jpg를 쓴다(오프라인 확인용)')
ap.add_argument('--ids', default='')
ap.add_argument('--all', action='store_true', help='thumbPos가 이미 있는 영상도 계산(적용 때는 덮어쓰지 않음)')
ap.add_argument('--jobs', type=int, default=16)
ap.add_argument('--sheet', type=int, default=0)
ap.add_argument('--min-score', type=float, default=0.7)
args = ap.parse_args()
KIND = 'full' if args.full else 'fancam'
if not args.out:
    args.out = os.path.join(ROOT, '.cache', 'face-pos-full.json' if args.full else 'face-pos.json')

if not os.path.exists(MODEL):
    os.makedirs(os.path.dirname(MODEL), exist_ok=True)
    print('얼굴 모델 받는 중…')
    urllib.request.urlretrieve(MODEL_URL, MODEL)

data = json.load(open(args.data, encoding='utf8'))
ids = set(filter(None, args.ids.split(',')))
vids = [v for v in data['videos'] if v.get('type') == KIND and not v.get('thumb')
        and (v['id'] in ids if ids else (args.all or not v.get('thumbPos')))]
print(f'대상 {"풀캠" if args.full else "직캠"} {len(vids)}개')


def fetch(yt):
    if args.local:
        v = next((x for x in vids if x['ytId'] == yt), None)
        f = os.path.join(args.local, f"{v['id']}.jpg") if v else ''
        img = cv2.imread(f) if f and os.path.exists(f) else None
        return cv2.resize(img, (1280, 720)) if img is not None else None
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


BAND = 3.0  # 조밀 모드 풀캠 띠 비율(styles.css .rband)


def band_y(img):
    """3:1 띠의 object-position y(%). 큰 얼굴(앞줄 멤버)이 가장 많이 띠 위쪽 60% 안에 오는 자리. 얼굴이 없으면 None"""
    h, w = img.shape[:2]
    bh = int(round(w / BAND))
    if bh >= h:
        return None
    det = cv2.FaceDetectorYN.create(MODEL, '', (w, h), 0.6, 0.3, 200)
    _, faces = det.detect(img)
    fs = [] if faces is None else [tuple(map(float, f[:4])) for f in faces if f[2] >= w * 0.012]
    if not fs:
        return None
    big = max(fw * fh for _, _, fw, fh in fs)
    best, best_score = 0, -1e9
    for top in range(0, h - bh + 1, 2):
        upper = sum(fw * fh for _, y, fw, fh in fs if y >= top and y + fh <= top + bh * 0.6)
        inside = sum(fw * fh for _, y, fw, fh in fs if y >= top and y + fh <= top + bh)
        score = (upper * 2 + inside) / big - abs(top + bh / 2 - h / 2) / h * 0.1
        if score > best_score:
            best, best_score = top, score
    return int(round(best / (h - bh) * 100))


def work(v):
    img = fetch(v['ytId'])
    if img is None:
        return v['id'], None, 'no-image', None
    if args.full:
        y = band_y(img)
        return v['id'], y, 'ok' if y is not None else 'no-face', img
    cx = face_x(img)
    if cx is None or cx == 'multi':
        return v['id'], None, 'multi' if cx else 'no-face', img
    return v['id'], pos_for(img, cx), 'ok', img


res, stat, imgs = {}, {'ok': 0, 'center': 0, 'multi': 0, 'no-face': 0, 'no-image': 0}, {}
want_sheet = set(random.sample([v['id'] for v in vids], min(args.sheet, len(vids)))) if args.sheet else set()
with ThreadPoolExecutor(args.jobs) as ex:
    for i, (vid, x, why, img) in enumerate(ex.map(work, vids), 1):
        if why == 'ok' and not args.full and abs(x - 50) <= 5:
            why = 'center'
        stat[why] += 1
        if why == 'ok':
            res[vid] = f'50% {x}%' if args.full else f'{x}% {DEFAULT_Y}'
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
        if args.full:
            # [원본 | 가운데 띠 | 새 띠]
            bh = int(w / BAND)
            band = lambda p: cv2.resize(img[int((h - bh) * p / 100):int((h - bh) * p / 100) + bh], (int(w * h / bh / 2), h // 2))
            new = band(x if x is not None else 50).copy()
            cv2.putText(new, f'{x if x is not None else "-"}%', (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            right = np.vstack([band(50), new])
            row = np.hstack([img, np.full((h, 6, 3), 255, np.uint8), right[:h]])
            cv2.putText(row, vid, (4, h - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
            rows.append(row)
            continue
        cw = int(h * 2 / 3)
        crop = lambda p: img[:, int((w - cw) * p / 100):int((w - cw) * p / 100) + cw]
        new = crop(x if x is not None else 50).copy()
        cv2.putText(new, f'{x if x is not None else "-"}%', (4, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        row = np.hstack([img, np.full((h, 6, 3), 255, np.uint8), crop(50), np.full((h, 6, 3), 255, np.uint8), new])
        cv2.putText(row, vid, (4, h - 6), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (0, 255, 255), 1)
        rows.append(row)
    wmax = max(r.shape[1] for r in rows)
    rows = [np.pad(r, ((0, 6), (0, wmax - r.shape[1]), (0, 0)), constant_values=255) for r in rows]
    path = os.path.join(os.path.dirname(args.out), 'face-pos-full-sheet.jpg' if args.full else 'face-pos-sheet.jpg')
    cv2.imwrite(path, np.vstack(rows), [cv2.IMWRITE_JPEG_QUALITY, 80])
    print(f'확인용 이미지: {path}')

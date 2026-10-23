---
name: add-clips
description: 무대 서랍에 움짤(webp·gif·mp4·webm)을 담는 절차. 사용자가 움짤 파일을 첨부하거나 "이 움짤 넣어줘", "유나 엔딩 움짤 추가"라고 할 때 쓴다. 파일을 clips/에 넣고 포스터를 만들고 담아 둔 영상이나 공연에 연결한다.
---

# 움짤 담기

## 1. 파일 확인

- 첨부 파일은 보통 `/root/.claude/uploads/…` 아래에 있어요. 파일 이름과 크기를 확인해요.
- 형식: webp·gif·mp4·webm. 다른 형식(mov, png 등)이나 **8MB가 넘는 파일**은 ffmpeg로 줄인 뒤 담아요(25MB 넘으면 도구가 거부해요).

```bash
# 큰 gif → 애니메이션 webp
ffmpeg -i in.gif -vf "scale=360:-2,fps=12" -c:v libwebp_anim -loop 0 -quality 70 /tmp/out.webp
# 영상 → 짧은 mp4 (소리 없음)
ffmpeg -i in.mov -vf "scale=480:-2,fps=15" -an -c:v libx264 -crf 28 -pix_fmt yuv420p -movflags +faststart /tmp/out.mp4
```

변환한 결과 파일 경로를 다음 단계에 넘겨요. 원본 첨부 파일은 저장소에 넣지 않아요.

- 다른 사람이 찍은 직캠으로 만든 움짤이면, 공개 사이트에 올라간다는 점(README “공개 범위 주의”)을 사용자에게 한 번 알려요.

## 2. 무엇에 연결할지 정하기

움짤은 **담아 둔 영상**에 연결하는 게 기본이에요(원본 시점으로 이동할 수 있어서).

```bash
node scripts/archive.mjs find 유나 261023 "paper moon"     # 연결할 영상 찾기 → v80 같은 id
```

- 영상을 하나로 정할 수 있으면 `--video <id>`.
- 원본 영상을 담지 않았으면 `--event <공연id>` + `--song <곡>` + `--members <멤버,…>`(단체면 생략).
- 사용자가 아무 정보도 안 줬고 파일명에 날짜·멤버·곡이 있으면(`261023_yuna_paper-moon.webp`) 둘 다 빼고 `--group <그룹>`만 주면 도구가 파일명으로 찾아요. 후보가 여럿이면 실패하니 사용자에게 물어요.
- 구간을 알면 `--t 0:42 --end 0:48`, 메모는 `--note "엔딩 손하트"`.

## 3. 실행

```bash
node scripts/archive.mjs add-clip /tmp/out.webp --video v80 --t 0:42 --end 0:48 --note "엔딩 손하트" --dry-run
node scripts/archive.mjs add-clip /tmp/out.webp --video v80 --t 0:42 --end 0:48 --note "엔딩 손하트"
node scripts/archive.mjs validate
```

- 도구가 `clips/<id>.<확장자>`로 복사하고 첫 프레임 포스터 `clips/posters/<id>.jpg`를 만들어요(ffmpeg → ImageMagick → Python PIL 순서로 시도).
- 포스터를 못 만들었다는 경고가 나오면 사용자에게 알려요(사이트는 실루엣을 보여 줘요).

## 4. 커밋·보고

새 파일(`clips/<id>.*`, `clips/posters/<id>.jpg`)과 `data/videos.json`을 함께 커밋해요. 메시지: `움짤: <그룹> <날짜> <멤버> <곡> <메모>`. 이후는 `CLAUDE.md` Git 흐름. 보고에 움짤 상세 주소(`#clip=<id>`)를 넣어요.

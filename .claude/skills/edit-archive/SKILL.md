---
name: edit-archive
description: 무대 서랍 데이터를 고치거나 지우는 절차. 영상 정보 수정, 삭제·비공개 영상 표시(dead-videos 이슈 처리), 칸 대표(pin)·공연 표지(cover), 의상 메모·setlist, 그룹·멤버·곡 추가와 이름·별칭·멤버색·순서·활동 종료, 썸네일 위치, 샘플 데이터 지우기를 부탁받았을 때 쓴다.
---

# 고치기·지우기·그룹 관리

항상 `node scripts/archive.mjs`로 바꾸고, 바꾸기 전에 대상을 `find`/`show`로 확인해요. 쓰기 명령은 모두 `--dry-run`이 돼요.

## 대상 찾기

```bash
node scripts/archive.mjs find 세린 10.15          # 영상·공연·움짤 (날짜 261015·10.15·10월 15일 모두 됨)
node scripts/archive.mjs find AbCdEfGhIj1          # 유튜브 ID로
node scripts/archive.mjs show v62                  # 한 항목의 JSON
```

여러 개가 걸리면 사용자에게 어느 것인지 물어요.

## 자주 쓰는 수정

| 부탁 | 명령 |
|---|---|
| 영상이 지워졌어/비공개야 | `gone <영상id|ytId>` (되살리기 `--undo`) |
| 이 직캠을 대표로 | `pin <영상id>` (같은 칸 다른 영상의 대표는 자동 해제) |
| 공연 표지를 이걸로 | `cover <공연id> <영상id>` (자동으로 되돌리기: `auto`) |
| 의상 메모 | `set <공연id> note="아이보리 셋업"` |
| 무대 순서 | `set <공연id> setlist="Paper Moon,Static"` |
| 공연 날짜·행사·label | `set <공연id> date=2026-10-23 show="쇼! 음악중심" label=사전녹화` |
| 멤버 잘못 넣음 | `set <영상id> members=도희` (단체: `members=단체`, 유닛: `members=도희,세린`) |
| 곡·시작 시각 | `set <영상id> song="Paper Moon@0:31"` (두 곡: `song="Paper Moon@0,Static@3:34"`, 전체 공연: `song=none`) |
| 직캠↔풀캠 | `set <영상id> type=full` |
| 공식/팬 | `set <영상id> source=official` (`fan`, `none`) |
| 태그 | `set <영상id> tags=4K,세로` (모두 지우기 `tags=none`) |
| 다른 공연으로 옮기기 | `set <영상id> event=<공연id>` |
| 같은 행사가 공연 여럿으로 쪼개짐 | `merge <남길공연id> <공연id>...` 또는 `dedupe-events --fuzzy --dry-run` |
| 썸네일 위치(전신이 보이게) | `set <영상id> thumbPos="50% 25%"` (위쪽을 더 보이려면 두 번째 값을 줄여요. 기본 `50% 35%`, 되돌리기 `thumbPos=none`) |
| 움짤 구간·메모 | `set <움짤id> t=0:42 end=0:48 note="..."` |

전체 키: `node scripts/archive.mjs set --help`.

## 썸네일 이미지 직접 지정

사용자가 이미지를 주면 ffmpeg로 칸 비율로 잘라 `thumbs/<영상id>.jpg`를 만들고 `set <영상id> thumb=thumbs/<영상id>.jpg thumbPos=none`.

```bash
# 직캠 2:3 (400×600). crop의 x 위치로 좌우를 조정
ffmpeg -i in.jpg -vf "crop=ih*2/3:ih:(iw-ih*2/3)/2:0,scale=400:600" -q:v 3 thumbs/v80.jpg
# 풀캠 16:9 (640×360)
ffmpeg -i in.jpg -vf "crop=iw:iw*9/16:0:(ih-iw*9/16)/2,scale=640:360" -q:v 3 thumbs/v12.jpg
```

멤버 썸네일(멤버 보기 타일, 2:3)도 같은 방법으로 `thumbs/<멤버id>.jpg`를 만들고 `set <멤버id> thumb=thumbs/<멤버id>.jpg`. 되돌리기는 `thumb=none`.

이미지 없이 위치만 바꾸면 되는 경우(유튜브 기본 썸네일에서 얼굴이 잘림)는 `thumbPos`만 고쳐요. 여러 개면 `python3 scripts/face-pos.py --ids v1,v2 --sheet 10`(얼굴 인식, 확인용 이미지 `.cache/face-pos-sheet.jpg`) → `archive.mjs thumbpos .cache/face-pos.json --force`. 직캠 썸네일은 대부분 이미 얼굴 위치로 잡혀 있어요(여러 명이 비슷한 크기로 나오면 그대로 둠). 끌어서 맞추고 싶어 하면 관리 화면 썸네일 탭도 있다고 알려요.

## 지우기 (사용자 확인 후)

```bash
node scripts/archive.mjs remove <영상id> [--with-empty-event]   # 영상. 연결된 움짤은 공연에 직접 연결해 남겨요
node scripts/archive.mjs remove <공연id> --cascade               # 공연과 그 영상·움짤(파일 포함)
node scripts/archive.mjs remove <움짤id>                         # 움짤과 파일
```

지우기 전에 무엇이 지워지는지(`--dry-run` 출력) 사용자에게 보여 주고 확인을 받아요.

## 그룹·멤버·곡

새 그룹을 통째로 등록하거나 자료(위키백과 등)로 멤버·곡을 한꺼번에 보강할 때는 `register-group` 스킬(`roster` 명령)을 써요. 하나씩 고칠 때는:

```bash
node scripts/archive.mjs add-group 하이디어 --en HIDEAR --hue 150      # hue 0~360, 강조색
node scripts/archive.mjs add-member 하이디어 채이 --alias CHAEI,채이 --color "#c2553f"
node scripts/archive.mjs add-song 하이디어 Sunroom --alias 선룸 --release 2026-09-30
node scripts/archive.mjs move <멤버id|곡id> 2                          # 순서(라인업 열 순서)
node scripts/archive.mjs set <멤버id> name=채이 aliases=CHAEI color=#2f7d6d active=false   # active=false: 활동 종료
node scripts/archive.mjs set <곡id> title="Sunroom" aliases=선룸 release=2026-09-30
node scripts/archive.mjs set <그룹id> name=하이디어 en=HIDEAR hue=150
```

- 멤버를 새로 만들 때 영문 별칭(제목 자동 해석에 쓰임)을 꼭 물어보거나 알면 넣어요.
- 멤버색 기본 팔레트: `#c2553f #2f7d6d #3d6fb6 #b07f22 #8a5aa8 #c0567e #4f8a3c #7a6a58`. 지정하지 않으면 순서대로 배정돼요.
- 그만둔 멤버는 지우지 말고 `active=false`(영상이 있는 멤버는 지울 수 없어요).

### 곡 정리

```bash
node scripts/archive.mjs merge-songs <남길곡id> <합칠곡id>... [--title "곡명"]   # 같은 곡 항목 합치기(이름은 별칭으로)
node scripts/archive.mjs dedupe-songs --dry-run                               # 대소문자·띄어쓰기·오타만 다른 곡 모두
node scripts/archive.mjs set <곡id> kind=cover                                # 다른 가수 곡(필터에서 '커버'로 따로)
node scripts/archive.mjs set <곡id> kind=other                                # 곡이 아님(투어·상·챌린지 이름): 제목에서 찾지 않고 화면에서 숨김
node scripts/archive.mjs reclassify --all --dry-run                           # 바뀐 규칙·곡 목록으로 제목을 다시 읽어 곡 바로잡기
node scripts/archive.mjs lint                                                 # 쪼개진 공연·중복 곡·곡 없는 영상 점검
```

곡을 합치거나 `kind`를 바꾼 뒤에는 `reclassify --all --dry-run`으로 영향을 보고 실행해요. 곡 항목을 지우는 건 사용자 확인 후 `remove-songs <곡id>...`(`--kind other`로 곡 아닌 항목 모두). 영상·움짤이 쓰는 곡은 지우지 않고, setlist에서는 빼요(여러 곡을 묶은 항목은 낱곡으로 바꿔 넣음).

## 삭제된 영상 이슈(`dead-videos`) 처리

주간 워크플로가 연 이슈의 표에 있는 영상 id마다 `gone <id>`를 실행하고, 커밋 메시지에 이슈 번호를 적어요(`수정: 삭제·비공개 영상 3개 표시 (#12)`). merge 뒤 이슈는 다음 주간 확인에서 대상이 없으면 자동으로 닫혀요.

## 샘플 데이터 지우기

사용자가 실제 데이터로 시작하겠다고 하면:

```bash
node scripts/archive.mjs clear-samples          # 무엇이 지워지는지 출력만
node scripts/archive.mjs clear-samples --yes    # 확인 받은 뒤
```

샘플 영상(`SMPL…`), 그 움짤과 파일, 비게 된 공연, 공연이 모두 샘플이던 그룹(르니에·하이디어·모노키)을 지워요. 사용자가 만든 그룹은 남아요. 그룹 틀은 남기려면 `--keep-groups`.

## 마무리

`node scripts/archive.mjs validate` → 커밋(`수정: …`) → `CLAUDE.md` Git 흐름 → 무엇을 바꿨는지 전·후 값으로 보고.

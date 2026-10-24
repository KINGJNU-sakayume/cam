# 무대 서랍

내가 고른 여자 아이돌 무대 영상(방송 풀캠, 멤버 직캠, 단체 직캠)과 짧은 움짤을 **그룹 → 날짜(행) × 멤버(열)** 로 펼쳐 보는 개인 아카이브예요. 정적 파일만으로 돌아가고 GitHub Pages로 배포해요. 서버·DB·빌드 도구·외부 JS 라이브러리는 쓰지 않아요.

- 라인업: 그날 멤버별 의상과 직캠은 가로로, 한 멤버의 변화는 세로로 봐요.
- 곡 보기·멤버 보기: 특정 곡이나 멤버로 좁혀 날짜순으로 봐요.
- 움짤 → 원본 영상(그 시점부터) → 그날 공연 → 그 멤버의 같은 곡 직캠 모아보기로 이어져요.

---

> 지금 `data/videos.json`은 실제 데이터(아이브·엔믹스·프로미스나인·하츠투하츠)예요. 아래 "샘플로 둘러볼 순서"는 처음 만들 때의 가상 샘플 기준이에요. `scripts/make-samples.mjs`는 데이터 파일을 덮어쓰니 실행하지 마세요.

## 평가용 빠른 시작

```bash
git clone <이 저장소> && cd <저장소 폴더>
python3 -m http.server 8000
# 브라우저에서 http://localhost:8000
```

### 샘플로 둘러볼 순서

샘플은 실존 인물과 무관한 가상 그룹 3팀(르니에·하이디어·모노키)이에요. 썸네일은 실루엣 플레이스홀더이고, 샘플 영상(`SMPL…`)은 재생 대신 “샘플 영상입니다”가 떠요.

1. **라인업** (`#g=g1`): 10.23 행에서 곡 버튼 `02 Static`을 눌러 칸이 바뀌는지, 세린·리아 칸이 빈 칸(점선 + “+ 담기”)인지 봐요. “이 날 전체 보기 ↓”로 풀캠·단체·유닛·여러 개 칸·움짤 패널을 열어요(한 번에 한 행).
2. 빈 칸의 **+ 담기** → 관리 화면에 그룹·공연·멤버·곡이 미리 채워져요.
3. 썸네일을 눌러 **플레이어**: ← → 로 옆 멤버(빈 칸은 “도희 칸은 비어 있어 건너뜀”), ↑ ↓ 로 같은 멤버의 이전·다음 날짜. Esc 또는 뒤로 가기로 닫혀요. 10.17 행(`#g=g1&e=e9`)이 빈 칸 건너뛰기를 보기 좋아요.
4. 날짜를 눌러 **공연 폴더**: 곡별 섹션, 단체 → 멤버 → 유닛 고정 순서 칸, `+1` 배지를 누르면 그 칸의 영상 목록이 펼쳐져요. 이전·다음 공연 버튼.
5. **곡** 보기 → Paper Moon → 멤버 칩 “도희”: 날짜순 격자와 “직캠 없는 날”.
6. **멤버** 보기 → 유나: 월별 의상 타임라인, “곡별로 묶기”.
7. **움짤** 보기 → 움짤 상세: “원본 영상 0:42부터”, “이 날 공연 폴더”, “유나의 Paper Moon 직캠 모아보기”, “같은 영상의 다른 움짤”.
8. 검색창: `유나 10.23`, `Paper Moon 세로`, `261023`, `10월 18일 사전녹화`. 한글 조합 중에는 검색하지 않고 Esc로 비워요.
9. 하이디어 탭: 활동 종료 멤버 하린의 열이 8월 공연 범위에서만 붙어요. 모노키 탭도 같은 구조예요.
10. 오른쪽 위 달/해 버튼으로 다크 모드. 선택은 기억돼요.

샘플에 들어 있는 경우: 하루 2곡 공연(10.09·10.11·10.23), 같은 날 본방 + 사전녹화(10.18), 빈 멤버 칸, 한 칸에 영상 여러 개, 단체 직캠, 유닛 직캠, 곡 구분 없는 전체 공연(9.12 축제), 두 곡이 든 영상(10.09 송출본), 삭제된 영상 1개(10.15 세린 팬캠), 원본 영상 없는 움짤(c5), 활동 종료 멤버(하이디어 하린), 월이 바뀌는 구간, 의상 메모.

### 실제 영상 10개로 바꿔 보기

1. `http://localhost:8000/admin.html` → **그룹·멤버·곡**에서 그룹을 만들고 멤버·곡을 넣어요. (샘플을 비우려면 **가져오기**에 `{"version":3,"groups":[],"events":[],"videos":[],"clips":[]}`를 붙여 넣고 바꾸면 돼요.)
2. **공연 단위 담기**: 날짜·행사를 넣고 이날 부른 곡을 무대 순서대로 누른 뒤, 유튜브 링크 10개를 줄바꿈으로 붙여 넣어요. 제목·채널은 oEmbed로 불러오고, 제목에서 날짜·멤버·곡·직캠/풀캠·세로·4K·얼빡·리허설·사녹·방송사 채널을 읽어 미리 채워요(테두리 강조된 값). 직캠은 멤버 또는 “단체”를 골라야 담겨요.
3. **저장** 탭에서 (A) 폴더에 쓰기 또는 (B) videos.json·ZIP 내보내기.
4. 커밋·푸시하면 Actions가 검증하고 Pages가 배포해요.

### 성능 확인

`http://localhost:8000/?stress=1` 은 첫 그룹의 공연을 날짜를 옮겨 복제해 영상 약 2,000개·공연 약 300개·움짤 약 300개로 부풀려 그려요(개발 옵션, 데이터 파일은 바뀌지 않아요). 탭·보기 전환과 검색이 100ms 안에 반응하는지 확인할 때 써요.

---

## Claude에게 부탁해서 담기

관리 화면을 직접 쓰지 않고 Claude Code(웹·앱·터미널)에서 이 저장소를 열고 말로 부탁해도 돼요. **유튜브 링크만 붙여 넣어도 돼요.**

> (링크 5개)
> 이것도 담아 줘. 마지막 건 단체 직캠이야. (링크 2개)
> 세린 10.15 팬캠 지워졌대. 삭제됨으로 표시해 줘.
> 이 움짤 넣어 줘. 유나 10.23 Paper Moon 0:42부터 엔딩 손하트. (파일 첨부)

Claude는 다음 순서로 일해요.

1. `CLAUDE.md`를 읽고, 부탁 종류에 맞는 스킬을 골라요.
   - `.claude/skills/add-videos`: 영상 담기
   - `.claude/skills/register-group`: 그룹 자동 등록
   - `.claude/skills/add-clips`: 움짤 담기
   - `.claude/skills/edit-archive`: 고치기·지우기·샘플 정리
2. 링크마다 유튜브 제목을 불러와 그룹·날짜·행사(사녹이면 사전녹화)·멤버·곡·태그를 읽고, 날짜·행사별로 공연을 나눠 담아요.
3. 등록 안 된 그룹이면 위키백과 등에서 멤버(영문 표기·활동 종료 포함)와 곡을 찾아 먼저 등록해요. 제목에 나온 새 곡도 곡 목록에 더해요.
4. `data/videos.json`은 손으로 고치지 않고 `node scripts/archive.mjs`로 바꿔요. 관리 화면과 같은 해석·검증 규칙을 쓰고, 검증에 실패하면 아무것도 쓰지 않아요.
5. 제목에도 말에도 없어서 정할 수 없는 것, 자료끼리 어긋나는 것, 지우는 일은 사용자에게 물어요.
6. 검증 → 커밋 → PR → `validate` 체크 통과 → merge하면 Pages가 새로 배포해요. 무엇을 담고 무엇을 등록했는지(참고 자료 포함) 알려 줘요.

직접 써도 돼요: `node scripts/archive.mjs help` (또는 `npm run archive -- help`).

### 기간을 정해 한꺼번에 찾기

```bash
node scripts/harvest.mjs 2026-09-01 2026-10-24 --deep     # 검색·거르기·업로드 날짜·분류를 한 번에(동시 실행, 캐시)
node scripts/archive.mjs add .cache/harvest/auto.json --create-songs --dry-run   # 확실한 영상
# .cache/harvest/review.txt 에 남은 영상만 확인해서 담기
node scripts/harvest.mjs --since-last --deep              # 다음엔 지난번 이어서
node scripts/archive.mjs lint                             # 쪼개진 공연·같은 곡 항목·곡 없는 영상 점검
```

`.cache/`(제목·업로드 날짜 캐시, 검색 진행 상황)는 저장소에 올리지 않아요.

### 클라우드 환경에서 허용할 도메인

Claude Code 클라우드 환경의 Network access → Allowed domains에 넣으세요(세션 제목 옆 환경 메뉴 → Edit, [안내](https://code.claude.com/docs/en/cloud-environments#network-access)).

| 도메인 | 쓰는 곳 |
|---|---|
| `www.youtube.com` | **필수.** 제목·채널 불러오기(oEmbed) → 자동 해석 |
| `ko.wikipedia.org`, `en.wikipedia.org` | **필수.** 그룹 자동 등록(멤버·영문 표기·곡·발매일) |
| `i.ytimg.com` | 유튜브 썸네일 확인·자르기 |
| `namu.wiki`, `kprofiles.com`, `www.wikidata.org` | 그룹 등록 보조 자료 |
| `cdn.jsdelivr.net` | 화면 확인 때 본문 글꼴(없어도 동작은 같음) |

막혀 있으면 Claude가 어느 도메인 때문인지 알려 주고, 그동안은 멤버·곡을 물어봐요.

## 왜 `file://`로 열면 안 되나요

`index.html`을 더블클릭해 `file://`로 열면 브라우저가 보안상 ES 모듈 스크립트와 `fetch('data/videos.json')`를 막아요. 그래서 데이터가 안 보여요(화면에 해결 방법이 떠요). 위처럼 `python3 -m http.server`로 열거나 GitHub Pages 주소로 보세요.

## GitHub Pages 켜기

저장소 **Settings → Pages → Build and deployment → Source: Deploy from a branch → Branch: `main` / `/ (root)` → Save**. 1~2분 뒤 `https://<사용자명>.github.io/<저장소>/` 에 떠요. 관리 화면은 `…/admin.html`이에요.

## GitHub Actions

워크플로 두 개가 있고 따로 설정할 것은 없어요(의존성·시크릿 없음, Node 24 러너, `actions/checkout@v5`·`actions/setup-node@v5`).

| 워크플로 | 언제 | 하는 일 |
|---|---|---|
| `validate` | 모든 push·PR, 수동 실행 | `node scripts/validate.mjs`로 데이터 검증 + `node scripts/test-parse.mjs` 제목 해석 회귀 테스트 + 스크립트 문법 확인. 실패하면 커밋 옆에 ✗가 떠요 |
| `check-alive` | 매주 월요일 12:17(KST), 수동 실행 | 유튜브 영상 생존 확인 → 이슈 하나로 정리(아래 참고). 워크플로 안에서 `issues: write` 권한을 스스로 요청해요 |

- 예약 실행(schedule)과 Actions 탭의 **Run workflow** 버튼은 **기본 브랜치**에 있는 워크플로만 동작해요. Settings → General → Default branch가 `main`인지 확인하세요.
- 로컬에서도 같은 명령을 쓸 수 있어요: `npm run validate`, `npm run check-alive`, `npm run samples` (`package.json`은 스크립트 단축키뿐이고 설치할 것이 없어요).

## 공개 범위 주의

- **Pages 사이트는 주소만 알면 누구나 볼 수 있어요.** 비공개 저장소에서 배포해도 사이트는 공개예요(유료 플랜의 Enterprise 비공개 Pages 제외). `admin.html`에는 `noindex`를 달았지만 접근을 막지는 않아요. 관리 화면은 브라우저 안에서만 동작하고 저장은 내 컴퓨터 폴더나 내 토큰으로만 되니 다른 사람이 데이터를 바꿀 수는 없어요.
- **다른 사람이 찍은 직캠으로 만든 움짤**은 원 촬영자의 저작물이에요. 공개 사이트에 올리면 무단 재배포가 될 수 있고, 홈마가 2차 가공을 금지한 경우도 많아요. 대안:
  - 움짤은 내가 직접 찍었거나 공식(방송사·소속사) 영상에서 짧게 만든 것만 올리기.
  - 팬 직캠은 움짤 대신 **유튜브 링크 + 시작 시각**(플레이어가 그 시점부터 재생)으로만 담기.
  - 움짤까지 꼭 담고 싶으면 로컬에서만 쓰기: 저장소를 비공개로 두고 Pages를 끄고 `python3 -m http.server`로만 보기.
  - 메모에 출처(채널명)를 남기고, 요청이 오면 바로 지우기.

## 용량 주의

- GitHub Pages 배포 사이트는 **1GB 제한**(저장소는 권장 1GB, 파일 하나 100MB 제한)이 있어요. 영상은 유튜브 링크라 용량이 없고 문제는 움짤이에요.
- 움짤은 **webp 또는 mp4**로 작게: 가로 360~480px, 3~6초, 12~15fps면 보통 200KB~1MB예요. 관리 화면은 8MB를 넘으면 경고하고 25MB를 넘으면 받지 않아요. 검증 스크립트도 25MB를 넘으면 실패해요.

```bash
# 영상 일부(42초부터 6초) → 세로 480px mp4 (소리 없음)
ffmpeg -ss 42 -t 6 -i input.mp4 -vf "scale=480:-2,fps=15" -an -c:v libx264 -crf 28 -pix_fmt yuv420p -movflags +faststart clips/c9.mp4

# 같은 구간 → 애니메이션 webp
ffmpeg -ss 42 -t 6 -i input.mp4 -vf "scale=360:-2,fps=12" -an -c:v libwebp_anim -loop 0 -quality 70 clips/c9.webp

# 큰 gif → webp (보통 1/3~1/5 크기)
ffmpeg -i big.gif -c:v libwebp_anim -loop 0 -quality 70 clips/c9.webp

# 정지 포스터(첫 프레임) — 관리 화면이 자동으로 만들지만 직접 만들 때
ffmpeg -i clips/c9.mp4 -frames:v 1 -q:v 4 clips/posters/c9.jpg
```

---

## 담기 흐름 4단계

1. **찾기** — 유튜브에서 직캠·풀캠 링크를 모아요. 공연 하나(같은 날·같은 행사)씩 모으면 편해요.
2. **관리 화면에서 담기** — `admin.html` → 공연 단위 담기에 링크를 줄바꿈으로 붙여 넣고, 표에서 멤버·곡을 확인한 뒤 “준비된 N개 담기”. 변경은 브라우저에 임시 저장돼서 창을 닫아도 남고, 저장 버튼에 저장 안 한 변경 수가 보여요.
3. **저장 후 커밋**
   - (A) **폴더에 쓰기**(Chrome·Edge 데스크톱): 저장 탭에서 내 컴퓨터의 저장소 폴더를 한 번 연결하면 `data/videos.json`, `thumbs/`, `clips/`에 바로 써요. 연결은 기억되고 다음엔 권한만 다시 물어요. 그다음 GitHub Desktop 등으로 커밋·푸시.
   - (B) **내보내기**: videos.json 다운로드(또는 복사) + 새 이미지·움짤 ZIP 다운로드 → GitHub 웹에서 같은 위치에 올리고 커밋.
   - (C) **토큰 커밋**(설정에서 켜야 보임): 아래 주의를 읽고 쓰세요.
4. **자동 배포** — 푸시하면 `validate` 워크플로가 데이터를 검사하고, Pages가 새로 배포해요.

## 썸네일 위치 잡기 (전신이 보이게)

- 직캠 칸은 2:3로 잘려요. 기본 위치는 전신이 보이도록 `50% 35%`예요.
- 관리 화면 **썸네일** 탭(또는 영상 수정 화면의 “썸네일 고르기”) → 후보(유튜브 큰 기본·기본·자동 장면 3개, 연결된 움짤 첫 프레임, 직접 업로드) 중 하나를 고르고, 2:3(풀캠은 16:9) 틀을 끌거나 화살표 키(Shift는 크게)로 옮겨요. 오른쪽 미리 보기가 실제 칸 모양이에요.
- 업로드·움짤 이미지는 직캠 400×600, 풀캠 640×360 JPEG(품질 0.85)로 `thumbs/<id>.jpg`를 만들어요. 유튜브 이미지는 브라우저가 canvas에 그리는 것을 막으면(CORS) 파일을 만들지 않고 `thumb`에 `i.ytimg.com` 주소, `thumbPos`에 위치만 저장해요.
- 멤버 썸네일(멤버 보기 타일)도 같은 도구로 2:3. “기본값으로 되돌리기”로 지울 수 있어요.

## 움짤 담기

관리 화면 **움짤 담기**에 webp·gif·mp4·webm 파일을 여러 개 끌어다 놓아요. 파일명(`261023_yuna_paper-moon_ending.webp`처럼)에서 날짜·멤버·곡을 읽어, 맞는 담아 둔 영상을 찾아 연결해 둬요. 시작·끝은 `0:42` 형식. 원본 영상이 없으면 “영상 없이 지정”으로 공연·곡·멤버를 직접 골라요. 정지 포스터는 첫 프레임을 뽑아 `clips/posters/<id>.jpg`로 만들어요.

재생: 목록에서는 정지 포스터, 데스크톱은 마우스를 올리면, 모바일은 화면에 들어오면 재생(동시에 최대 4개, 화면 밖이면 정지). `prefers-reduced-motion`이면 자동 재생하지 않고 상세 화면에서 눌러야 재생해요.

## 멤버색·그룹색

**그룹·멤버·곡** 탭에서 멤버마다 색 고르기 또는 기본 팔레트(`#c2553f #2f7d6d #3d6fb6 #b07f22 #8a5aa8 #c0567e #4f8a3c #7a6a58`) 버튼으로 지정해요. 멤버색은 이름 앞 점, 썸네일 아래 띠, 빈 칸 이니셜 원에만 쓰고 글자색으로는 쓰지 않아요. 그룹 hue는 강조색(선택된 탭, 곡 번호, 링크, 포커스 링)이 되고, 화면이 배경 대비 4.5:1 이상이 되도록 명도를 자동으로 조정해요. 멤버·곡 순서는 끌어서 옮기거나 위·아래 버튼으로 바꿔요(라인업 열 순서·곡 순서).

## 토큰 방식(C)의 주의점

- **fine-grained 개인 액세스 토큰**을 만들고 *Repository access: Only select repositories → 이 저장소*, *Permissions: Contents → Read and write* 만 주세요. 만료일도 짧게.
- 토큰은 그 탭의 `sessionStorage`에만 두고 탭을 닫으면 사라져요. 저장소·URL·localStorage에는 절대 넣지 않아요.
- 공용 컴퓨터에서는 쓰지 말고, 브라우저 확장 프로그램이 페이지를 읽을 수 있다는 점을 기억하세요. 다 쓰면 GitHub에서 토큰을 지우는 게 안전해요.
- Git Data API(blob → tree → commit → ref)로 JSON과 이미지·움짤을 커밋 하나로 올려요.

## 삭제·비공개 영상 이슈 처리

`check-alive` 워크플로가 매주 월요일(그리고 Actions 탭에서 수동 실행) 모든 유튜브 ID를 oEmbed로 확인해, 404·401(삭제·비공개)인 영상을 **이슈 하나**(라벨 `dead-videos`)로 올려요. 같은 이슈가 열려 있으면 내용을 갱신하고, 모두 살아나면 닫아요. 샘플 ID와 이미 `gone`인 영상은 건너뛰어요.

이슈를 받으면: 관리 화면 **수정·삭제**에서 유튜브 ID로 찾아 “삭제·비공개됨”을 켜고 저장 → 커밋. 영상은 목록에 흐리게 남고 “삭제됨” 배지가 붙으며, 플레이어는 저장해 둔 제목·채널을 보여 줘요. 다른 사람이 다시 올린 영상이 있으면 새로 담고 이전 것을 지워도 돼요.

---

## 데이터와 검증

`data/videos.json`이 유일한 데이터 원본이에요(코드에 데이터 없음). 형식은 version 3:

- `groups[]` — `members[]`(id, name, aliases, order, active, color, thumb), `songs[]`(id, title, aliases, order, release)
- `events[]` — 공연 = 같은 그룹·날짜·행사·label. `setlist`(곡 순서), `note`(의상 메모), `cover`(표지 영상)
- `videos[]` — `songs: [{songId, t}]`(빈 배열 = 곡 구분 없는 전체 공연, 여러 개 = 메들리·풀 퍼포먼스), `type`(full/fancam), `memberIds`(빈 배열 = 단체), `source`(official/fan/null), `tags`, `thumb`, `thumbPos`, `pin`(칸 대표), `gone`, `uploaded`(유튜브 업로드 날짜, 한국 기준, 있을 때만)
- `songs[].kind` — 없음(그룹 곡) / `cover`(다른 가수 곡) / `other`(곡이 아닌 항목: 제목 해석·화면에서 빠짐). `events[].aliases` — 같은 공연의 다른 표기(다음 담기 때 같은 공연으로 연결)
- `clips[]` — `videoId`가 있으면 공연·곡·멤버를 영상에서, 없으면 `eventId`·`songId`·`memberIds`를 직접. `t`·`end`는 원본 안 구간(초)

```bash
node scripts/validate.mjs            # data/videos.json 검사 (Node 20+, 의존성 없음)
node scripts/validate.mjs 경로.json  # 다른 파일 검사 (경로의 상위 폴더 기준으로 파일 존재 확인)
```

필수 필드, ID 중복, 참조 무결성(공연·그룹·곡·멤버·setlist·clip.videoId), 유튜브 ID 11자, 실제 존재하는 날짜, 같은 ytId 중복, full 영상의 memberIds, 같은 공연 중복, 색 형식, `thumb`·`file`·`poster` 파일 존재(URL thumb은 `i.ytimg.com`만), 움짤 25MB 이하, `t ≤ end`를 검사하고, 오류를 `videos[12] (v40): memberIds의 g2m1은 g1 그룹 멤버가 아니에요`처럼 위치와 이유로 알려 줘요. 같은 규칙을 관리 화면 저장 탭도 써요.

### 이전 형식 가져오기

관리 화면 **가져오기**는 version 1·2(무대 `stages[]` 단위)를 version 3으로 바꿔요: 같은 그룹·날짜·행사·label 무대를 공연 하나로 합치고 무대의 곡(`song` 제목 또는 `songId`)은 그룹 곡 목록·setlist로, `stageId` → `eventId`, `rehearsal: true` → 태그 “리허설”, `memberId` → `memberIds`, 없는 멤버 `color`는 기본 팔레트, 없는 `setlist`는 무대 순서로 채워요.

### 샘플 다시 만들기

```bash
node scripts/make-samples.mjs          # data/videos.json + clips/ (ffmpeg 필요: libwebp_anim, gif, libx264)
node scripts/make-samples.mjs --data   # 데이터만
node scripts/make-samples.mjs --clips  # 움짤만
```

## 파일 구조

```
index.html  admin.html  styles.css  app.js  admin.js
js/           util·model·data·indexer·router·theme·state·components·placeholder·clipplay·validate-core·migrate
js/views/     lineup·folder·player·clipdetail·song·member·clips·search·states
js/admin/     store·parse·zip·ui·bulk·edit·roster·thumbs·clips·save·import
data/videos.json   thumbs/   clips/   clips/posters/
scripts/      validate.mjs  archive.mjs  harvest.mjs  test-parse.mjs  make-samples.mjs  check-alive.mjs
scripts/lib/  yt.mjs (유튜브 검색·영상 정보)   scripts/fixtures/  titles.json (제목 해석 스냅숏)
CLAUDE.md  .claude/skills/   Claude에게 부탁할 때 읽는 규칙과 절차
.github/workflows/  validate.yml  check-alive.yml
```

## URL

해시에는 영문·숫자·`=`·`&`만 써요. `#g=g1`(라인업), `#g=g1&open=e12`(펼친 행), `#g=g1&v=song&s=g1s2`, `#g=g1&v=song&s=g1s2&m=g1m3`, `#g=g1&v=member&m=g1m3`, `#g=g1&v=clip`, `#g=g1&e=e12`(공연 폴더), `#play=v40`(플레이어, `ps`=곡, `pt`=시작 초), `#clip=c3`(움짤 상세). 뒤로 가기로 플레이어가 닫히고 하위 화면에서 나와요. 검색어는 해시에 넣지 않아요. 키보드: Tab·Enter, Esc로 닫기, 플레이어에서 화살표 이동, `/`로 검색창.

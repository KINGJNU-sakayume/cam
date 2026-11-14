# 2024년까지 과거 영상 수집 — 2차 (전수 검색) 계획

1차(`docs/backfill-2024.md`)는 유튜브 접속이 막힌 환경에서 방송사 목록 위주로만 담았어요. 2차는 `harvest.mjs --full`로 **날짜 × 그룹, 날짜 × 멤버 전수 검색**을 해서 빠진 영상을 채워요.

**`www.youtube.com`에 접속할 수 있는 곳에서 돌려야 해요.** Claude Code 클라우드 환경은 정책상 youtube.com·ytimg.com을 막고 있어서(허용 목록에 넣어도 403), 내 컴퓨터의 터미널이나 내 컴퓨터에서 연 Claude Code에서 돌려요.

## `--full`이 더 찾는 것

- 날짜마다 `그룹명 YYMMDD`, `영문명 YYMMDD`에 더해 `그룹명 직캠 YYMMDD`, `영문명 fancam YYMMDD`
- 후보가 **1개라도** 있는 날은 모든 멤버(활동 종료 멤버 포함) × 그 날짜: `멤버 직캠`, `MEMBER fancam`, `그룹명 멤버 직캠`
- 검색이 실패하면 경고를 띄우고, 같은 명령을 다시 돌리면 실패한 검색만 다시 해요(`done.txt`). 모든 검색이 실패하면 멈춰요(종료 코드 3).

## 돌리는 순서

그룹 하나씩, 결과 폴더를 따로 둬요(중간에 끊겨도 같은 명령으로 이어져요).

```bash
git pull
# 0) 새로 등록한 르세라핌: 2024년부터 지금까지
node scripts/harvest.mjs 2024-01-01 2026-11-13 --group g11 --full --out .cache/bf2/g11

# 1) 나머지 10팀: 2024-01-01 ~ 2025-12-31 (2026년은 11-04 최신화 때 --deep으로 찾음)
for g in g1 g2 g3 g5 g6 g7 g8 g9 g10; do
  node scripts/harvest.mjs 2024-01-01 2025-12-31 --group $g --full --out .cache/bf2/$g
done
# 하츠투하츠는 데뷔일부터
node scripts/harvest.mjs 2025-02-24 2025-12-31 --group g4 --full --out .cache/bf2/g4

# 2) 11-04 이후 최신 영상(전 그룹)
node scripts/harvest.mjs --since-last --deep
```

그룹마다 검색이 수천 개라 한 팀에 수십 분~한두 시간 걸려요. 유튜브가 막기 시작하면(실패 경고가 늘면) `--jobs 2`로 줄이고 잠시 뒤 같은 명령을 다시 돌려요.

## 담기

그룹마다:

```bash
node scripts/archive.mjs add .cache/bf2/<그룹>/auto.json --create-songs --dry-run   # 경고 읽기
node scripts/archive.mjs add .cache/bf2/<그룹>/auto.json --create-songs
# .cache/bf2/<그룹>/review.txt 는 Claude가 읽고 정할 수 있는 것만 review.json에서 골라 담기
node scripts/archive.mjs validate
```

이미 담긴 영상은 `add`가 같은 유튜브 ID로 건너뛰어요. 담은 뒤 `lint`·`audit`을 돌리고, 정하지 못한 것은 `docs/open-questions.md`에 적어요. 1차의 보류 후보 608개(`docs/backfill-2024-review.json`)도 이때 다시 봐요.

커밋은 그룹마다 하나씩: `담기: <그룹> 2024~2025년 무대 영상 N개 (2차 전수 검색)`.

## 진행 상황

| 그룹 | 범위 | 상태 |
|---|---|---|
| 르세라핌 (g11) | 2024-01-01 ~ 2026-11-13 | 진행 중 — 아래 월별 표 |
| 아이브·엔믹스·프로미스나인·에스파·트리플에스·있지·베이비몬스터·최예나·키스오브라이프 | 2024-01-01 ~ 2025-12-31 | 1차만(방송사 목록) |
| 하츠투하츠 | 2025-02-24 ~ 2025-12-31 | 1차만 |
| 전 그룹 최신 | 2026-11-04 ~ | 아직 |

### 월별 (2차, 세션 bf2)

| 그룹 | 월 | 담은 수 | 남은 보류 |
|---|---|---|---|
| g11 | 2024-01 | 3 (공연 2) | open-questions §8 (검색 18개는 유튜브 실패로 못 함) |
| g11 | 2024-02 | 131 (자동 97 + Swan Song 직캠 34, 공연 6) | open-questions §8 (검색 실패 0, `--jobs 1`) |
| g11 | 2024-03 | 75 (공연 9, 02월분 3 포함) | open-questions §8 (검색 실패 0, `--jobs 1`) |
| g11 | 2024-04 | 6 (코첼라 공연 2) | open-questions §8 (검색 실패 0) |
| g11 | 2024-05 | 38 (자동 26 + 직캠 12, 공연 3) | open-questions §8 (검색 실패 0) |
| g11 | 2024-06 | 20 (위버스콘 페스티벌 직캠, 공연 1) | open-questions §8 (검색 실패 0) |
| g11 | 2024-07 | 19 (가요대전 Summer 07-21 14 + 07-26 5, 공연 2) | open-questions §8 (검색 실패 0) |
| g11 | 2024-08 | 19 (뮤직뱅크 08-30 10 + 음악중심 08-31 9, 공연 2) | open-questions §8 (검색 실패 0) |
| g11 | 2024-09 | 88 (자동 75 + 직캠 13, 공연 11) | open-questions §8 (검색 실패 0) |
| g11 | 2024-10 | 37 (호서대 16, 동명대 12, 영남대 6 중 자동 34 + 직캠 3, 공연 3) | open-questions §8 (검색 실패 0) |

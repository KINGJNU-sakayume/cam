# 2024년까지 과거 영상 수집 — 1차 (2026-11-08)

목표는 등록된 10팀 모두 2024-01-01까지 거슬러 수집하는 것이다. 이후 데뷔한 하츠투하츠는 공식 데뷔일인 2025-02-24까지만 수집한다. 그룹·멤버는 새로 등록하지 않았다.

**전체 수집은 미완료다.** 이 기록은 웹 색인에서 찾을 수 있었던 방송사 직캠 목록과 일부 직접 검색 결과를 반영한 1차 작업이다. 날짜별·멤버별 YouTube 전수 검색, 팬 직캠·콘서트·축제의 충분한 수집은 남아 있다. 아래 최초 날짜는 이번에 담은 영상의 날짜이며 해당 날짜까지 빠짐없이 검색했다는 뜻이 아니다.

## 반영한 영상

영상 1184개, 새 공연 225개. 전체 영상 12637 → 13821개, 공연 875 → 1100개.

| 대상 | 목표 하한 | 새 영상 | 새 공연 | 이번 추가 영상 날짜 |
|---|---|---:|---:|---|
| 아이브 | 2024-01-01 | 164 | 25 | 2024-05-02 ~ 2025-02-16 |
| 엔믹스 | 2024-01-01 | 191 | 32 | 2024-01-18 ~ 2025-04-06 |
| 프로미스나인 | 2024-01-01 | 42 | 7 | 2024-08-16 ~ 2025-06-28 |
| 하츠투하츠 | 2025-02-24 | 123 | 18 | 2025-02-24 ~ 2025-06-28 |
| 에스파 | 2024-01-01 | 112 | 19 | 2024-05-16 ~ 2025-07-12 |
| 트리플에스 | 2024-01-01 | 116 | 28 | 2024-01-28 ~ 2025-06-01 |
| 있지 | 2024-01-01 | 175 | 33 | 2024-01-11 ~ 2025-12-25 |
| 베이비몬스터 | 2024-01-01 | 142 | 28 | 2024-04-07 ~ 2025-12-25 |
| 최예나 | 2024-01-01 | 7 | 6 | 2024-01-20 ~ 2024-10-25 |
| 키스오브라이프 | 2024-01-01 | 112 | 29 | 2024-04-04 ~ 2025-06-29 |

하츠투하츠의 데뷔 쇼케이스에서는 이안·유하의 Butterflies 직캠 2개를 담았다. 방송사 목록의 표기에서 제목·날짜·곡·멤버를 확인한 영상을 우선 반영했고, 업로드 날짜를 공연일로 대신 쓰지 않았다. 직접 확인하지 못한 채널명·업로드 날짜는 빈 값으로 두었다. Zzalbox가 공식 음악 방송 직캠으로 분류한 영상은 source=official로 담았다. 새 영상의 재생 가능 여부·현재 제목·채널은 YouTube 접근이 가능해지면 다시 확인해야 한다.

새 곡: 엔믹스 **Love Is Lonely**, 있지 **BORN TO BE**, **Mr. Vampire**. 기존 곡의 발매일 오류 2개도 공식 자료로 확인해 고쳤다: Rebel Heart 2025-02-03 → 2025-01-13, Dash 2024-08-19 → 2024-01-15. 기존 영상·공연·움짤은 변경하거나 삭제하지 않았다.

## 보류와 남은 작업

재검토 후보 608개는 [backfill-2024-review.json](backfill-2024-review.json)에 링크·원제목·수집 출처·보류 이유를 보존했다. 날짜가 없는 후보는 대상 기간에 속하는지도 아직 확정하지 않았다.

- 제목에 공연 날짜 없음: 285개
- 방송일과 실제 공연일 대조 필요: 94개
- 멤버 확인 필요: 227개
- 정규 방송 요일과 제목 날짜가 다름: 2개

그 밖에 이미 담긴 267개, 기간 밖 238개, 아티스트가 다르거나 여럿인 13개, 무대 모음 7개, 편집본 2개, 출퇴근 1개를 건너뛰었다. 특히 IVE 목록에 섞인 솔로 가수 Yves(이브)의 영상은 담지 않았다.

연말 방송과 가요대전 썸머 후보는 제목의 방송일과 실제 공연일을 대조해야 한다. 제목에 멤버가 없는 영상을 단체로 임의 지정하지 않았다. 기존 docs/open-questions.md의 보류 항목은 그대로 두었다.

현재 환경은 www.youtube.com을 허용 목록에 포함하지만 플랫폼 차단 목록에도 youtube.com·ytimg.com이 있어 CONNECT 403을 반환한다. 샌드박스 밖의 동일 요청도 403이었다. 따라서 scripts/harvest.mjs의 날짜별·멤버별 검색을 실행 완료한 것으로 기록하지 않았고 harvest-state.json에 완료 날짜를 쓰지 않았다. 썸네일 얼굴 위치 보정도 수행하지 않았다.

접속이 가능해지면 기존 harvest 수집기로 각 그룹의 targetFrom부터 기존 수집 구간까지 --deep 검색하고, 새 결과를 중복 제거·dry-run·검토 후 담는다. 하츠투하츠는 --group g4 2025-02-24부터, 나머지 9팀은 2024-01-01부터 검색한다. 특히 있지·베이비몬스터의 2025년, 최예나의 2024~2025년 팬 무대, 전 팀의 콘서트·축제가 남아 있다. 현재 리뷰 파일의 후보도 이때 재검토한다.

## 검증

- archive.mjs add --create-songs --no-fetch: dry-run 검토 후 실제 실행.
- archive.mjs validate: 그룹 10, 공연 1100, 영상 13821, 움짤 0 통과.
- 제목 해석 회귀 테스트 374개 통과, JavaScript 문법 검사 통과.
- lint·audit 수행. 새 영상에는 제외 규칙 위반이 없고, 새 정규 음악 방송 공연에는 요일 불일치가 없다. 새 공연의 멤버별 빈 칸과 기존 데이터에 남은 검토 항목은 전체 수집 완료로 취급하지 않는다.

## 등록·수정 근거

- [하츠투하츠 공식 데뷔일·쇼케이스](https://news.sbs.co.kr/amp/news.amp?news_id=N1007995754)
- [SM 공식 데뷔 안내](https://cdn2.smentertainment.com/wp-content/uploads/2025/02/4Q24_CEO-MessageENG_20250210_vF.pdf)
- [Rebel Heart 공식 발매 안내](https://www.sonymusic.co.jp/artist/IVE/info/570375)
- [Dash 공식 음반 정보](https://nmixx.jype.com/Mobile/DiscographyView?AamSeq=219&AmSeq=0&PgIndex=0)
- [Love Is Lonely 공식 수록곡 안내](https://nmixx.jype.com/discography/dxybr7kg)
- [BORN TO BE·Mr. Vampire 공식 음반 정보](https://itzy.jype.com/discography/xjd1g7wf?AmSeq=undefined&PgIndex=undefined)

## 영상 제목과 링크를 확인한 목록

- https://theqoo.net/choiyena/3433596256?category=1014850370&page=2
- https://theqoo.net/choiyena/3438770236?category=1014850370&page=2
- https://theqoo.net/choiyena/3452288078?category=1014850370
- https://www.youtube.com/watch?v=FeTs1ubr4qw
- https://www.youtube.com/watch?v=KmY-WjG8CAk
- https://www.youtube.com/watch?v=aznGJPlpbe8
- https://www.youtube.com/watch?v=geb-GAmNt8U
- https://www.youtube.com/watch?v=mYWV8EbwxMA
- https://www.youtube.com/watch?v=ysY8-vX3AeI
- https://zzalbox.com/en/fancam/group/aespa
- https://zzalbox.com/en/fancam/group/babymonster
- https://zzalbox.com/en/fancam/group/fromis9
- https://zzalbox.com/en/fancam/group/hearts2hearts
- https://zzalbox.com/en/fancam/group/itzy
- https://zzalbox.com/en/fancam/group/ive
- https://zzalbox.com/en/fancam/group/kiss-of-life
- https://zzalbox.com/en/fancam/group/nmixx
- https://zzalbox.com/en/fancam/group/triples
- https://zzalbox.com/en/fancam/song/aespa-armageddon
- https://zzalbox.com/en/fancam/song/aespa-dirty-work
- https://zzalbox.com/en/fancam/song/aespa-supernova
- https://zzalbox.com/en/fancam/song/aespa-whiplash
- https://zzalbox.com/en/fancam/song/babymonster-drip
- https://zzalbox.com/en/fancam/song/babymonster-forever
- https://zzalbox.com/en/fancam/song/babymonster-hot-sauce
- https://zzalbox.com/en/fancam/song/babymonster-like-that
- https://zzalbox.com/en/fancam/song/babymonster-sheesh
- https://zzalbox.com/en/fancam/song/babymonster-we-go-up
- https://zzalbox.com/en/fancam/song/fromis9-like-you-better
- https://zzalbox.com/en/fancam/song/fromis9-supersonic
- https://zzalbox.com/en/fancam/song/hearts2hearts-style
- https://zzalbox.com/en/fancam/song/hearts2hearts-the-chase
- https://zzalbox.com/en/fancam/song/itzy-born-to-be
- https://zzalbox.com/en/fancam/song/itzy-girls-will-be-girls
- https://zzalbox.com/en/fancam/song/itzy-gold
- https://zzalbox.com/en/fancam/song/itzy-imaginary-friend
- https://zzalbox.com/en/fancam/song/itzy-kiss-tell
- https://zzalbox.com/en/fancam/song/itzy-tunnel-vision
- https://zzalbox.com/en/fancam/song/itzy-untouchable
- https://zzalbox.com/en/fancam/song/ive-accendio
- https://zzalbox.com/en/fancam/song/ive-attitude
- https://zzalbox.com/en/fancam/song/ive-heya
- https://zzalbox.com/en/fancam/song/ive-rebel-heart
- https://zzalbox.com/en/fancam/song/kiss-of-life-get-loud
- https://zzalbox.com/en/fancam/song/kiss-of-life-igloo
- https://zzalbox.com/en/fancam/song/kiss-of-life-lips-hips-kiss
- https://zzalbox.com/en/fancam/song/kiss-of-life-midas-touch
- https://zzalbox.com/en/fancam/song/kiss-of-life-sticky
- https://zzalbox.com/en/fancam/song/kiss-of-life-te-quiero
- https://zzalbox.com/en/fancam/song/nmixx-dash
- https://zzalbox.com/en/fancam/song/nmixx-high-horse
- https://zzalbox.com/en/fancam/song/nmixx-know-about-me
- https://zzalbox.com/en/fancam/song/nmixx-love-is-lonely
- https://zzalbox.com/en/fancam/song/nmixx-run-for-roses
- https://zzalbox.com/en/fancam/song/nmixx-see-that
- https://zzalbox.com/en/fancam/song/nmixx-sonar
- https://zzalbox.com/en/fancam/song/triples-are-you-alive
- https://zzalbox.com/en/fancam/song/triples-girls-never-die
- https://zzalbox.com/en/fancam/song/triples-hit-the-floor
- https://zzalbox.com/en/fancam/song/triples-non-scale

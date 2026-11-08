# 과거 영상 수집 진행 상황

마지막 작업: 2026-11-08 (한국 시간)

## 목표와 현재 상태

등록된 10팀 전체의 무대 영상을 기존 수집 구간부터 과거로 거슬러 수집한다. 하한은 2024-01-01이며, 이후 데뷔한 팀은 데뷔일까지다. 하츠투하츠는 [SMTOWN 공식 데뷔 공지](https://smtown-official.jp/news/detail.php?nid=pxQyx+y4uWM%3D)에 따라 2025-02-24가 하한이다.

**전체 기간 수집은 진행 중이다.** 첫 작업에서 방송 무대·직캠 59개를 39개 새 공연으로 추가했고, 이어 ITZY·베이비몬스터의 2025-12-25 SBS 가요대전 영상 13개를 새 공연 2개로 추가했다. PR #49의 누적 추가는 영상 72개·공연 41개다. 사용자의 요청에 따라 PR 상태로 유지하며 병합하지 않는다. 날짜별 전체 검색이나 모든 멤버의 빈칸 채우기는 완료하지 않았다. 아래 최초 날짜는 보유 자료의 최솟값이며, 그 이후 구간에도 미수집 영상이 있다.

| 대상 | 수집 하한 | 작업 전 최초 공연 | 현재 최초 공연 | PR 누적 추가 |
|---|---|---|---|---:|
| 아이브 | 2024-01-01 | 2025-07-05 | 2024-05-02 | 5 |
| 엔믹스 | 2024-01-01 | 2025-07-12 | 2025-03-20 | 5 |
| 프로미스나인 | 2024-01-01 | 2025-06-28 | 2025-06-27 | 4 |
| 하츠투하츠 | 2025-02-24 | 2025-06-28 | 2025-02-28 | 6 |
| 에스파 | 2024-01-01 | 2025-07-03 | 2024-10-24 | 4 |
| 트리플에스 | 2024-01-01 | 2025-07-05 | 2024-05-12 | 6 |
| 있지 | 2024-01-01 | 2026-01-31 | 2024-01-11 | 23 |
| 베이비몬스터 | 2024-01-01 | 2026-01-02 | 2024-11-10 | 13 |
| 최예나 | 2024-01-01 | 2025-07-29 | 2024-01-18 | 2 |
| 키스오브라이프 | 2024-01-01 | 2025-06-28 | 2024-07-04 | 4 |

## 이어서 할 순서

1. ITZY·베이비몬스터의 2025년 하반기부터 월 단위로 거슬러 검색한다. 두 팀은 이번 작업 전 2026년 자료만 있었다.
2. 10팀의 2025년 상반기를 6월부터 1월까지 채운다. 하츠투하츠는 2월 24일에서 멈춘다.
3. 나머지 9팀의 2024년을 12월부터 1월 1일까지 채운다.
4. 각 월의 날짜별 검색·deep 검색·검토 후보 처리 후에만 해당 구간을 검색 완료로 기록하고, 멤버별 빈칸도 확인한다. 현재 검색 완료로 표시한 새 구간은 없다.

기존 `docs/open-questions.md`·`docs/pending-videos*.md`의 보류 항목은 기존 상태로 두었다. 같은 날의 여러 행사와 제목 날짜가 방영일인 무대는 자료를 확인하고 구분한다.

## 수집을 막는 환경 설정

사용자가 도메인을 환경 설정에 추가했으나 2026-11-08 15:12 KST 재확인에서도 현재 실행 환경의 `allowed_hosts`는 빈 목록, 적용 버전은 1이었다. 유튜브와 한국어 위키백과에 새 연결로 접속해도 CONNECT 403이었다. 설정 변경이 현재 실행 환경에 반영되어야 재개할 수 있다.

`https://www.youtube.com/results?search_query=IVE+240101` 접속이 환경 프록시에서 CONNECT 403으로 차단되었다. `www.youtube.com`을 허용해야 기존 `scripts/harvest.mjs`의 날짜별 검색·영상 정보 확인을 실행할 수 있다. 그룹 자료 확인에는 `ko.wikipedia.org`·`en.wikipedia.org`, 썸네일 확인에는 `i.ytimg.com`도 필요하다. 기존 허용 항목을 보존하고 환경 설정에 추가한다.

이번 링크·제목은 공개 웹 검색 결과와 아래 영상 목록의 원본 YouTube 링크에서 확보했다. 공연 날짜·행사·곡·멤버는 제목에 있는 정보로 지정했다. 원본 채널명·정확한 업로드일·조회수·현재 재생 가능 여부는 직접 확인하지 못했다. 채널명과 출처는 추정하지 않고 비워 두었고, 업로드일도 채우지 않았다. 추가 후 연결 확인과 채널 보강이 남아 있다.

재개 명령 예시(한 번에 하나씩 실행):

```sh
node scripts/harvest.mjs 2025-12-01 2025-12-31 --group g7 --deep --out .cache/backfill/g7-2025-12
node scripts/archive.mjs add .cache/backfill/g7-2025-12/auto.json --create-songs --dry-run
# 경고와 review.txt를 검토한 다음 실제 add 실행
```

제목만으로 개인/단체 여부를 알 수 없는 직캠은 단체로 임의 지정하지 않았다. 방송 무대 원본과 FullCam·단독샷캠은 풀캠으로 분류했다. `Sticky` 개인 직캠 2개는 제목의 곡을 명시하여 자동 해석이 함께 잡은 `Midas Touch`를 배제했다. 새 그룹·멤버·곡 등록은 없다.

## 검증

- `archive.mjs add --dry-run` 후 실제 `add`로만 데이터를 변경했다.
- `archive.mjs validate`·`validate.mjs` 통과: 그룹 10, 공연 916, 영상 12,709.
- 제목 해석 회귀 검사 374개 및 JavaScript 문법 검사 통과.
- 기존 그룹·곡·공연·영상의 변경·삭제 없음. 이번 추가만 반영했다.
- lint의 새 문제 없음. audit의 제외 규칙·방송 요일·도시 문제 수는 작업 전과 같다. 멤버 직캠이 덜 채워진 새 공연이 추가되어 빈칸 목록은 140개에서 176개로 늘었다.

## 추가한 영상과 확보 경로

### 아이브 (5개)

- 2024-05-02 엠카운트다운 · [FwPdj7QRykU](https://www.youtube.com/watch?v=FwPdj7QRykU) · [입덕직캠] 아이브 장원영 직캠 4K '해야 (HEYA)' (IVE WONYOUNG FanCam) | @MCOUNTDOWN_2024.5.2 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/%ED%95%B4%EC%95%BC/))
- 2025-02-08 쇼! 음악중심 · [BLA0BB3zGIc](https://www.youtube.com/watch?v=BLA0BB3zGIc) · [#최애직캠] IVE JANG WONYOUNG (아이브 장원영) – ATTITUDE | 쇼! 음악중심 | MBC250208 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/attitude/))
- 2025-02-09 인기가요 · [qg3WHiwhHPw](https://www.youtube.com/watch?v=qg3WHiwhHPw) · [단독샷캠4K] 아이브 'ATTITUDE' 단독샷 별도녹화│IVE ONE TAKE STAGE @SBS Inkigayo 250209 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/attitude/))
- 2025-02-09 인기가요 · [VWNfprBaXt0](https://www.youtube.com/watch?v=VWNfprBaXt0) · [안방1열 직캠4K] 아이브 장원영 'ATTITUDE' (IVE JANG WONYOUNG FanCam) @SBS Inkigayo 250209 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/attitude/))
- 2025-02-09 인기가요 · [xW7zPvW13N0](https://www.youtube.com/watch?v=xW7zPvW13N0) · [안방1열 직캠4K] 아이브 안유진 'ATTITUDE' (IVE AN YUJIN FanCam) @SBS Inkigayo 250209 ([확보 경로](https://www.youtube.com/watch?v=xW7zPvW13N0))

### 엔믹스 (5개)

- 2025-03-20 엠카운트다운 · [-pWytfdJmko](https://www.youtube.com/watch?v=-pWytfdJmko) · '최초 공개' NMIXX - KNOW ABOUT ME #엠카운트다운 EP.880 | Mnet 250320 방송 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/knowaboutme/))
- 2025-03-21 뮤직뱅크 · [DSVZ3qVJs6I](https://www.youtube.com/watch?v=DSVZ3qVJs6I) · [K-Fancam] 엔믹스 설윤 직캠 'KNOW ABOUT ME'(NMIXX SULLYOON Fancam) @뮤직뱅크(Music Bank) 250321 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/knowaboutme/))
- 2025-03-23 인기가요 · [a1ssvmj2E9g](https://www.youtube.com/watch?v=a1ssvmj2E9g) · NMIXX (엔믹스) - KNOW ABOUT ME @인기가요 inkigayo 20250323 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/knowaboutme/))
- 2025-03-23 인기가요 · [CvN9Ptb65Hg](https://www.youtube.com/watch?v=CvN9Ptb65Hg) · [단독샷캠4K] 엔믹스 'KNOW ABOUT ME' 단독샷 별도녹화│NMIXX ONE TAKE STAGE│@SBS Inkigayo 250323 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/knowaboutme/))
- 2025-03-26 쇼챔피언 · [HEd1P4DD1iI](https://www.youtube.com/watch?v=HEd1P4DD1iI) · [COMEBACK] 엔믹스(NMIXX) - KNOW ABOUT ME l Show Champion l EP.548 l 250326 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/knowaboutme/))

### 프로미스나인 (4개)

- 2025-06-27 뮤직뱅크 · [Jqw3pOozZXU](https://www.youtube.com/watch?v=Jqw3pOozZXU) · [K-Fancam] 프로미스나인 이나경 직캠 'LIKE YOU BETTER' (fromis_9 LEE NA GYUNG Fancam) @뮤직뱅크(Music Bank) 250627 ([확보 경로](https://www.youtube.com/watch?v=Jqw3pOozZXU))
- 2025-06-27 뮤직뱅크 · [43EsrNJn3fQ](https://www.youtube.com/watch?v=43EsrNJn3fQ) · [K-Fancam] 프로미스나인 박지원 직캠 'LIKE YOU BETTER' (fromis_9 PARK JI WON Fancam) @뮤직뱅크(Music Bank) 250627 ([확보 경로](https://www.youtube.com/watch?v=43EsrNJn3fQ))
- 2025-06-27 뮤직뱅크 · [SIUG9C8sBsM](https://www.youtube.com/watch?v=SIUG9C8sBsM) · [K-Fancam] 프로미스나인 송하영 직캠 'LIKE YOU BETTER' (fromis_9 SONG HA YOUNG Fancam) @뮤직뱅크(Music Bank) 250627 ([확보 경로](https://www.youtube.com/watch?v=SIUG9C8sBsM))
- 2025-06-27 뮤직뱅크 · [G0ZA8iIb_sA](https://www.youtube.com/watch?v=G0ZA8iIb_sA) · [K-Fancam] 프로미스나인 백지헌 직캠 'LIKE YOU BETTER' (fromis_9 BAEK JI HEON Fancam) @뮤직뱅크(Music Bank) 250627 ([확보 경로](https://www.youtube.com/watch?v=G0ZA8iIb_sA))

### 하츠투하츠 (6개)

- 2025-02-28 뮤직뱅크 · [87-QS4y8UBQ](https://www.youtube.com/watch?v=87-QS4y8UBQ) · [K-Fancam] 하츠투하츠 스텔라 'The Chase' (Hearts2Hearts STELLA Fancam) @뮤직뱅크(Music Bank) 250228 ([확보 경로](https://kpop-universe.kr/en/g/hearts2hearts/stella/s/thechase/))
- 2025-03-02 인기가요 · [oEDgwk5cUDs](https://www.youtube.com/watch?v=oEDgwk5cUDs) · [안방1열 직캠4K] 하츠투하츠 스텔라 'The Chase' (Hearts2Hearts STELLA FanCam) @SBS Inkigayo 250302 ([확보 경로](https://kpop-universe.kr/en/g/hearts2hearts/stella/s/thechase/))
- 2025-03-05 쇼챔피언 · [M5Nt9ywS2c8](https://www.youtube.com/watch?v=M5Nt9ywS2c8) · [쇼챔직캠 4K] Hearts2Hearts STELLA(하츠투하츠 스텔라) - The Chase | Show Champion | EP.545 | 250305 ([확보 경로](https://kpop-universe.kr/en/g/hearts2hearts/stella/s/thechase/))
- 2025-03-09 인기가요 · [4Ak8fanF-S4](https://www.youtube.com/watch?v=4Ak8fanF-S4) · [페이스캠4K] 하츠투하츠 스텔라 'The Chase' (Hearts2Hearts STELLA FaceCam) @SBS Inkigayo 250309 ([확보 경로](https://kpop-universe.kr/en/g/hearts2hearts/stella/s/thechase/))
- 2025-03-09 인기가요 · [le5vCG-TQps](https://www.youtube.com/watch?v=le5vCG-TQps) · [안방1열 직캠4K] 하츠투하츠 스텔라 'The Chase' (Hearts2Hearts STELLA FanCam) @SBS Inkigayo 250309 ([확보 경로](https://kpop-universe.kr/en/g/hearts2hearts/stella/s/thechase/))
- 2025-03-12 쇼챔피언 · [bX7LIf7xKlE](https://www.youtube.com/watch?v=bX7LIf7xKlE) · [쇼챔직캠 4K] Hearts2Hearts STELLA(하츠투하츠 스텔라) - The Chase | Show Champion | EP.546 | 250312 ([확보 경로](https://kpop-universe.kr/en/g/hearts2hearts/stella/s/thechase/))

### 에스파 (4개)

- 2024-10-24 엠카운트다운 · [3DeTW8FKKYg](https://www.youtube.com/watch?v=3DeTW8FKKYg) · [입덕직캠] 에스파 윈터 직캠 4K 'Whiplash' (aespa WINTER FanCam) | @MCOUNTDOWN_2024.10.24 ([확보 경로](https://kpop-universe.kr/en/g/aespa/s/whiplash/))
- 2024-10-26 쇼! 음악중심 · [eXk-CNSNcto](https://www.youtube.com/watch?v=eXk-CNSNcto) · aespa (에스파) - Whiplash | Show! MusicCore | MBC241026방송 ([확보 경로](https://kpop-universe.kr/en/g/aespa/s/whiplash/))
- 2024-10-27 인기가요 · [e9y52Y_qZdg](https://www.youtube.com/watch?v=e9y52Y_qZdg) · [페이스캠4K] 에스파 닝닝 'Whiplash' (aespa NINGNING FaceCam) @SBS Inkigayo 241027 ([확보 경로](https://kpop-universe.kr/en/g/aespa/s/whiplash/))
- 2024-11-02 쇼! 음악중심 · [rHZv44fPcuE](https://www.youtube.com/watch?v=rHZv44fPcuE) · aespa (에스파) - Whiplash | Show! MusicCore | MBC241102방송 ([확보 경로](https://kpop-universe.kr/en/g/aespa/s/whiplash/))

### 트리플에스 (6개)

- 2024-05-12 인기가요 · [eEWrbcm6rHI](https://www.youtube.com/watch?v=eEWrbcm6rHI) · [페이스캠4K] 트리플에스 김유연 'Girls Never Die' (tripleS Kim YooYeon FaceCam) @SBS Inkigayo 240512 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/girlsneverdie/))
- 2025-05-15 엠카운트다운 · [mivd53H0Vm4](https://www.youtube.com/watch?v=mivd53H0Vm4) · 'COMEBACK' tripleS - 깨어 (Are You Alive) #엠카운트다운 EP.888 | Mnet 250515 방송 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/%EA%B9%A8%EC%96%B4/))
- 2025-05-15 엠카운트다운 · [Uw7ZVt-Wqbo](https://www.youtube.com/watch?v=Uw7ZVt-Wqbo) · [입덕직캠] 트리플에스 유연 직캠 4K '깨어 (Are You Alive)' (tripleS YooYeon FanCam) | @MCOUNTDOWN_2025.5.15 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/%EA%B9%A8%EC%96%B4/))
- 2025-05-16 뮤직뱅크 · [m6el-2QsiZ0](https://www.youtube.com/watch?v=m6el-2QsiZ0) · 깨어 (Are You Alive) - tripleS [뮤직뱅크/Music Bank] | KBS 250516 방송 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/%EA%B9%A8%EC%96%B4/))
- 2025-05-17 쇼! 음악중심 · [sLUXfWrWkho](https://www.youtube.com/watch?v=sLUXfWrWkho) · [#음중직캠] tripleS KIM YOOYEON (트리플에스 김유연) – 깨어 (Are You Alive) FanCam | 쇼! 음악중심 | MBC250517 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/%EA%B9%A8%EC%96%B4/))
- 2025-05-29 엠카운트다운 · [2fsXORTi0Rk](https://www.youtube.com/watch?v=2fsXORTi0Rk) · tripleS - 깨어 (Are You Alive) (본교 교복ver.) #엠카운트다운 EP.890 | Mnet 250529 방송 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/%EA%B9%A8%EC%96%B4/))

### 있지 (15개)

- 2024-01-11 엠카운트다운 · [59B_ChmxT_w](https://www.youtube.com/watch?v=59B_ChmxT_w) · [MPD직캠] 있지 류진 직캠 4K 'UNTOUCHABLE' (ITZY RYUJIN FanCam) | @MCOUNTDOWN_2024.1.11 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/untouchable/))
- 2024-01-14 인기가요 · [vEutjPgFUPw](https://www.youtube.com/watch?v=vEutjPgFUPw) · [안방1열 풀캠4K] 있지 'UNTOUCHABLE' (ITZY FullCam)│@SBS Inkigayo 240114 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/untouchable/))
- 2024-01-14 인기가요 · [5d_IVDyYhYE](https://www.youtube.com/watch?v=5d_IVDyYhYE) · [안방1열 직캠4K] 있지 유나 'UNTOUCHABLE' (ITZY YUNA FanCam) @SBS Inkigayo 240114 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/untouchable/))
- 2024-01-14 인기가요 · [pAIh2WkuneQ](https://www.youtube.com/watch?v=pAIh2WkuneQ) · [안방1열 직캠4K] 있지 채령 'UNTOUCHABLE' (ITZY CHAERYEONG FanCam) @SBS Inkigayo 240114 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/untouchable/))
- 2025-06-12 엠카운트다운 · [2nwPlnHMReo](https://www.youtube.com/watch?v=2nwPlnHMReo) · '최초 공개' ITZY - Girls Will Be Girls #엠카운트다운 EP.892 | Mnet 250612 방송 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/girlswillbegirls/))
- 2025-06-12 엠카운트다운 · [lIUItSfGEOs](https://www.youtube.com/watch?v=lIUItSfGEOs) · [MPD직캠] 있지 류진 직캠 4K 'Girls Will Be Girls' (ITZY RYUJIN FanCam) | @MCOUNTDOWN_2025.6.12 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/girlswillbegirls/))
- 2025-06-12 엠카운트다운 · [l7S8MkMtW4w](https://www.youtube.com/watch?v=l7S8MkMtW4w) · [MPD직캠] 있지 유나 직캠 4K 'Girls Will Be Girls' (ITZY YUNA FanCam) | @MCOUNTDOWN_2025.6.12 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/girlswillbegirls/))
- 2025-06-13 뮤직뱅크 · [oM8rGkL2f6U](https://www.youtube.com/watch?v=oM8rGkL2f6U) · Girls Will Be Girls - ITZY イットジー 있지 [Music Bank] | KBS WORLD TV 250613 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/girlswillbegirls/))
- 2025-06-13 뮤직뱅크 · [bVt4Cq8pJcE](https://www.youtube.com/watch?v=bVt4Cq8pJcE) · [얼빡직캠 4K] 있지 유나 'Girls Will Be Girls' (ITZY YUNA Facecam) @뮤직뱅크(Music Bank) 250613 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/girlswillbegirls/))
- 2025-06-13 뮤직뱅크 · [vJXg4Q9ZWGE](https://www.youtube.com/watch?v=vJXg4Q9ZWGE) · [K-Fancam] 있지 유나 직캠 'Girls Will Be Girls' (ITZY YUNA Fancam) @뮤직뱅크(Music Bank) 250613 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/girlswillbegirls/))
- 2025-06-13 뮤직뱅크 · [sZZLFlvtypc](https://www.youtube.com/watch?v=sZZLFlvtypc) · [K-Fancam] 있지 류진 직캠 'Girls Will Be Girls' (ITZY RYUJIN Fancam) @뮤직뱅크(Music Bank) 250613 ([확보 경로](https://www.youtube.com/watch?v=sZZLFlvtypc))
- 2025-06-14 쇼! 음악중심 · [BtEvxo-_gs0](https://www.youtube.com/watch?v=BtEvxo-_gs0) · ITZY (있지) - Girls Will Be Girls | Show! MusicCore | MBC250614방송 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/girlswillbegirls/))
- 2025-06-15 인기가요 · [90O9yt7biPE](https://www.youtube.com/watch?v=90O9yt7biPE) · [안방1열 직캠4K] 있지 유나 'Girls Will Be Girls' (ITZY YUNA FanCam) @SBS Inkigayo 250615 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/girlswillbegirls/))
- 2025-06-19 엠카운트다운 · [gu7myuOp-WE](https://www.youtube.com/watch?v=gu7myuOp-WE) · [MPD직캠] 있지 유나 직캠 4K 'Girls Will Be Girls' (ITZY YUNA FanCam) | @MCOUNTDOWN_2025.6.19 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/girlswillbegirls/))
- 2025-06-20 뮤직뱅크 · [rwmW-ELgmBg](https://www.youtube.com/watch?v=rwmW-ELgmBg) · [K-Fancam] 있지 유나 직캠 'Girls Will Be Girls' (ITZY YUNA Fancam) @뮤직뱅크(Music Bank) 250620 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/girlswillbegirls/))

### 베이비몬스터 (8개)

- 2024-11-10 인기가요 · [ciXIQK6G230](https://www.youtube.com/watch?v=ciXIQK6G230) · [안방1열 직캠4K] 베이비몬스터 아현 'DRIP' (BABYMONSTER AHYEON FanCam) @SBS Inkigayo 241110 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/ahyeon/s/drip/))
- 2024-11-17 인기가요 · [karQAIwewUk](https://www.youtube.com/watch?v=karQAIwewUk) · [안방1열 직캠4K] 베이비몬스터 아현 'DRIP' (BABYMONSTER AHYEON FanCam) @SBS Inkigayo 241117 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/ahyeon/s/drip/))
- 2024-11-24 인기가요 · [1YHemRmyWmU](https://www.youtube.com/watch?v=1YHemRmyWmU) · BABYMONSTER (베이비몬스터) - DRIP @인기가요 inkigayo 20241124 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/drip/))
- 2024-11-24 인기가요 · [prowHppYlsg](https://www.youtube.com/watch?v=prowHppYlsg) · [안방1열 풀캠4K] 베이비몬스터 'DRIP' (BABYMONSTER FullCam)│@SBS Inkigayo 241124 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/drip/))
- 2024-11-24 인기가요 · [8q6o3D0m0QM](https://www.youtube.com/watch?v=8q6o3D0m0QM) · [안방1열 직캠4K] 베이비몬스터 아현 'DRIP' (BABYMONSTER AHYEON FanCam) @SBS Inkigayo 241124 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/ahyeon/s/drip/))
- 2024-12-25 SBS 가요대전 · [OQbDSGVASa0](https://www.youtube.com/watch?v=OQbDSGVASa0) · [2024 가요대전 4K] 베이비몬스터 아현 'INTRO + DRIP' (BABYMONSTER AHYEON FanCam)│@SBS Gayo Daejeon 241225 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/ahyeon/s/drip/))
- 2024-12-25 SBS 가요대전 · [a95AGRbel4A](https://www.youtube.com/watch?v=a95AGRbel4A) · 241225 #2024SBS가요대전 'DRIP' AHYEON 아현 직캠 (4K) ([확보 경로](https://kpop-universe.kr/en/g/babymonster/ahyeon/s/drip/))
- 2025-07-27 SBS 가요대전 · [IUx2uLTU0YQ](https://www.youtube.com/watch?v=IUx2uLTU0YQ) · 250727 SBS 가요대전 'DRIP + HOT SAUCE' AHYEON 아현 직캠 (4K) ([확보 경로](https://kpop-universe.kr/en/g/babymonster/ahyeon/s/drip/))

### 최예나 (2개)

- 2024-01-18 엠카운트다운 · [6QBVGXuoT6U](https://www.youtube.com/watch?v=6QBVGXuoT6U) · [MPD직캠] 최예나 직캠 4K 'Good Morning' (YENA FanCam) | @MCOUNTDOWN_2024.1.18 ([확보 경로](https://www.youtube.com/watch?v=6QBVGXuoT6U))
- 2024-01-18 엠카운트다운 · [7tKpl5WxC3s](https://www.youtube.com/watch?v=7tKpl5WxC3s) · [MPD직캠] 최예나 직캠 8K 'Good Morning' (Horizontal Ver.) (YENA FanCam) | @MCOUNTDOWN_2024.1.18 ([확보 경로](https://www.youtube.com/watch?v=7tKpl5WxC3s))

### 키스오브라이프 (4개)

- 2024-07-04 엠카운트다운 · [K-6frHauuNE](https://www.youtube.com/watch?v=K-6frHauuNE) · [MPD직캠] 키스오브라이프 나띠 직캠 4K 'Sticky' (KISS OF LIFE NATTY FanCam) | @MCOUNTDOWN_2024.7.4 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/sticky/))
- 2024-07-04 엠카운트다운 · [ANeqtKm2o7s](https://www.youtube.com/watch?v=ANeqtKm2o7s) · [MPD직캠] 키스오브라이프 쥴리 직캠 4K 'Sticky' (KISS OF LIFE JULIE FanCam) | @MCOUNTDOWN_2024.7.4 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/sticky/))
- 2025-06-14 쇼! 음악중심 · [gi3bQPuZYhc](https://www.youtube.com/watch?v=gi3bQPuZYhc) · KISS OF LIFE (키스 오브 라이프) - Lips Hips Kiss | Show! MusicCore | MBC250614방송 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/lipshipskiss/))
- 2025-06-20 뮤직뱅크 · [5dH3SB8Pso0](https://www.youtube.com/watch?v=5dH3SB8Pso0) · Lips Hips Kiss - KISS OF LIFE (키스오브라이프) [뮤직뱅크/Music Bank] | KBS 250620 방송 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/lipshipskiss/))

## 이번 후보 중 보류·제외

다음 후보는 이번에 추가하지 않았다. 공연 정보나 영상 종류 확인이 필요하며, 비무대 영상은 제외했다.

- [ZANNhhL8n5c](https://www.youtube.com/watch?v=ZANNhhL8n5c) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/attitude/))
- [Vbj9BxIiVjQ](https://www.youtube.com/watch?v=Vbj9BxIiVjQ) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/attitude/))
- [QRa1-qZg8Z4](https://www.youtube.com/watch?v=QRa1-qZg8Z4) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/knowaboutme/))
- [T_Q48oUx61E](https://www.youtube.com/watch?v=T_Q48oUx61E) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/girlswillbegirls/))
- [STgiVYpd3PE](https://www.youtube.com/watch?v=STgiVYpd3PE) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/itzy/s/girlswillbegirls/))
- [MO3JEHcFZ90](https://www.youtube.com/watch?v=MO3JEHcFZ90) · 제목에 날짜 없음 / 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/drip/))
- [8Dk63EzXs0w](https://www.youtube.com/watch?v=8Dk63EzXs0w) · 포토콜·레드카펫·브랜드 행사 / 제목에 날짜 없음 / 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/drip/))
- [t1AdBPEtVjs](https://www.youtube.com/watch?v=t1AdBPEtVjs) · 제목에 날짜 없음 / 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/drip/))
- [aNHMgxZCAto](https://www.youtube.com/watch?v=aNHMgxZCAto) · 공식 퍼포먼스 영상·연습 영상 / 제목에 날짜 없음 / 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/drip/))
- [BxzWxdVFmVI](https://www.youtube.com/watch?v=BxzWxdVFmVI) · 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/aespa/s/whiplash/))
- [8wb1k60_vkk](https://www.youtube.com/watch?v=8wb1k60_vkk) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/aespa/s/whiplash/))
- [Zbe22iOcmes](https://www.youtube.com/watch?v=Zbe22iOcmes) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/triples/s/%EA%B9%A8%EC%96%B4/))
- [plzo4duPA88](https://www.youtube.com/watch?v=plzo4duPA88) · 제목에 날짜 없음 / 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/lipshipskiss/))
- [gUixRexd_rM](https://www.youtube.com/watch?v=gUixRexd_rM) · 제목에 날짜 없음 / 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/lipshipskiss/))
- [-SN9GlKcVlM](https://www.youtube.com/watch?v=-SN9GlKcVlM) · 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/lipshipskiss/))
- [X2XT2Vs1EGQ](https://www.youtube.com/watch?v=X2XT2Vs1EGQ) · 제목에 날짜 없음 ([확보 경로](https://kpop-universe.kr/en/g/kiss-of-life/s/lipshipskiss/))
- [hoHy38Jjkvg](https://www.youtube.com/watch?v=hoHy38Jjkvg) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/dash/))
- [x_ObXank5kA](https://www.youtube.com/watch?v=x_ObXank5kA) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/nmixx/s/dash/))
- [HUOASu_-PPQ](https://www.youtube.com/watch?v=HUOASu_-PPQ) · 개인/단체 영상 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/%ED%95%B4%EC%95%BC/))
- [O2OTLgY3EK4](https://www.youtube.com/watch?v=O2OTLgY3EK4) · 행사 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/ive/s/%ED%95%B4%EC%95%BC/))

## 2차 추가: 2025-12-25 SBS 가요대전 (13개)

ITZY 8개(예지·류진·채령·유나), 베이비몬스터 5개(풀캠·치키타·아현·아사). 채널·업로드일·재생 가능 여부의 직접 확인은 환경 적용 후 남아 있다. 베이비몬스터의 두 곡은 제목대로 연결했으며, 곡별 실제 시작 시각은 확인하지 못해 기본값이다. 새 그룹·곡은 만들지 않았다.

- 2025-12-25 SBS 가요대전 · [UK2o1LSqFAE](https://www.youtube.com/watch?v=UK2o1LSqFAE) · [2025 가요대전 4K] 있지 유나 'INTRO + TUNNEL VISION (Remix)' (ITZY YUNA FanCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [WeFQuiSbhVk](https://www.youtube.com/watch?v=WeFQuiSbhVk) · [2025 가요대전 4K] 있지 류진 'INTRO + TUNNEL VISION (Remix)' (ITZY RYUJIN FanCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/itzy/ryujin/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [RJe8cphv_Bw](https://www.youtube.com/watch?v=RJe8cphv_Bw) · [4K] 251225 ITZY RYUJIN 류진 Intro + TUNNEL VISION Fancam 직캠 @ SBS 가요대전 GAYO DAEJEON ([확보 경로](https://kpop-universe.kr/en/g/itzy/ryujin/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [OszFo_HTEnM](https://www.youtube.com/watch?v=OszFo_HTEnM) · [4K] 251225 ITZY RYUJIN 'TUNNEL VISION' fancam 있지 류진 직캠 @ SBS 가요대전 ([확보 경로](https://kpop-universe.kr/en/g/itzy/ryujin/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [iR3pombYXCw](https://www.youtube.com/watch?v=iR3pombYXCw) · 251225 TUNNEL VISION -YEJI FOCUS 직캠 [4K] 있지 예지 ITZY FANCAM@SBS Gayo Daejeon 가요대전 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yeji/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [JTbayp0L50g](https://www.youtube.com/watch?v=JTbayp0L50g) · 251225 있지 예지 직캠 4K 'TUNNEL VISION' (ITZY YEJI FANCAM) | SBS Gayo Daejeon 2025 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yeji/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [Dr5K56vIGMc](https://www.youtube.com/watch?v=Dr5K56vIGMc) · [2025 가요대전 4K] 있지 예지 'INTRO + TUNNEL VISION (Remix)' (ITZY YEJI FanCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yeji/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [Pg6hKBh6Dg4](https://www.youtube.com/watch?v=Pg6hKBh6Dg4) · 251225 〖4K〗SBS Gayo Daejeon ITZY CHAERYEONG FOCUS TUNNEL VISION 채령 직캠 ([확보 경로](https://kpop-universe.kr/en/g/itzy/chaeryeong/s/tunnelvision/))
- 2025-12-25 SBS 가요대전 · [in83gtdK29Q](https://www.youtube.com/watch?v=in83gtdK29Q) · [2025 가요대전 4K] 베이비몬스터 'WE GO UP + PSYCHO' (BABYMONSTER FullCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/psycho/))
- 2025-12-25 SBS 가요대전 · [W6hRxeHYZ1I](https://www.youtube.com/watch?v=W6hRxeHYZ1I) · [2025 가요대전 4K] 베이비몬스터 치키타 'WE GO UP + PSYCHO' (BABYMONSTER CHIQUITA FanCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/psycho/))
- 2025-12-25 SBS 가요대전 · [ChpgsyU2lls](https://www.youtube.com/watch?v=ChpgsyU2lls) · [2025 가요대전 4K] 베이비몬스터 아현 'WE GO UP + PSYCHO' (BABYMONSTER AHYEON FanCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/psycho/))
- 2025-12-25 SBS 가요대전 · [vr6oUKLOs00](https://www.youtube.com/watch?v=vr6oUKLOs00) · [4K] 251225 BABYMONSTER ASA 베이비몬스터 아사 'WE GO UP + PSYCHO' FANCAM 직캠 | SBS 가요대전 GayoDaejeon ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/psycho/))
- 2025-12-25 SBS 가요대전 · [BG2tKAdecD0](https://www.youtube.com/watch?v=BG2tKAdecD0) · [2025 가요대전 4K] 베이비몬스터 아사 'WE GO UP + PSYCHO' (BABYMONSTER ASA FanCam) @SBS GayoDaejeon 251225 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/psycho/))

추가 확인이 필요한 후보:

- [mhuWKClfAHI](https://www.youtube.com/watch?v=mhuWKClfAHI) · 공연일 추가 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/itzy/yuna/s/tunnelvision/))
- [uPe7fk-L5xg](https://www.youtube.com/watch?v=uPe7fk-L5xg) · 행사명 추가 확인 필요 ([확보 경로](https://kpop-universe.kr/en/g/babymonster/s/psycho/))

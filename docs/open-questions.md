# 보류 중인 판단

사용자가 결정하기 전까지 **합치거나(merge) 지우지(remove) 않는** 항목이에요. Claude는 이 목록의 공연·영상을 `dedupe-events`·`merge`·`remove`로 건드리지 않고, 사용자가 정하면 처리한 뒤 이 문서에서 지워요.
마지막 점검: 2026-10-24 (`node scripts/archive.mjs lint`·`audit`, 같은 날 공연이 둘 이상인 경우 전부 확인)

## 1. 같은 행사인지 정하지 않은 공연

(없음. 2026-10-24에 혼자 다른 날짜에 있던 음악 방송 e147·e352·e160·e370을 같은 방송의 다수 날짜 공연으로 합쳤어요. 아이브 09-22·09-23 인기가요 라이브 인 도쿄는 같은 업로더가 날짜를 따로 적어 이틀 공연으로 두었어요.)

## 2. 날짜·장소가 의심스러운 공연·영상 (`archive.mjs audit`)

| 공연·영상 | 내용 | 의심 이유 |
|---|---|---|
| `e371` 06-04(목) 쇼! 음악중심 | "SPECIAL MC ON MBC MUSIC CORE 260604" | 음악중심은 토요일. 근처에 합칠 음악중심 공연이 없어요 |
| `e372` 06-08(월) 쇼챔피언 | "WIN 🏆🏆 on SHOW CHAMPION 260608" | 쇼챔은 수요일. 근처에 합칠 쇼챔 공연이 없어요 |
| v186 (`e25` 08-01 LA) | "IN SEATTLE \| 260801" | 같은 날 다른 영상 9개는 모두 LA(Inglewood). 시애틀은 08-07(`e27`) |
| v7854 (`e240` 04-12 광안리) | "IVE 2026 FAN CONCERT DIVE into IVE, 소원을 말해봐 리즈" | 팬콘(03-21·03-22) 영상인지 광안리 행사인지 날짜를 정할 수 없어요 |

## 2-1. 빈 칸 찾기에서 날짜를 못 정한 영상 (2026-10-24 `harvest --gaps`)

| 유튜브 | 제목 요약 | 이유 |
|---|---|---|
| 13cfG2OY35A · EiarumROf0k | M2 [입덕직캠] 하츠투하츠 스텔라·이안 'ICONIC HEART (Korean Ver.)' @MCOUNTDOWN | 제목에 날짜가 없고 엠카운트다운 10-15·10-22 둘 다 가능 |
| hG9cPDT_jqI · T6rsKrhsKnw | 260822 엔믹스 설윤·해원 'RICO' (Makestar) | 날짜는 있지만 행사 이름을 확인 못 함 |
| uKuhJy8uAJw | 장원영 '해야' IVE 4TH FAN CONCERT | 03-21·03-22 중 어느 날인지 모름 |
| Ll7-5aDkWhM | Hearts2Hearts TIMA Live 2026 Hong Kong Full Performance | 하츠투하츠 TIMA 2026 공연이 07-25·08-16·08-22·08-23 넷이라 홍콩이 어느 날인지 모름 (2026-10-24 `--gaps --all-events`) |
| MR8noFcOGqU | 아이브 INTRO + BANG BANG 2026 INKIGAYO LIVE in TOKYO (SBSKPOP) | 09-22·09-23 중 어느 날인지 모름 |
| FX-m_h9fDuo | 엔믹스 규진 'TIC TIC' 1ST WORLD TOUR 직캠 | 제목에 날짜·도시 없음 |

2025년 연말 무대(SBS 가요대전 12-25, 뮤직뱅크 글로벌 페스티벌 12-30)의 하츠투하츠 직캠 10여 개는 찾았지만 담아 둔 공연이 없어 새 공연을 만들지 않았어요. 담을지 정하면 `harvest --gaps --all-events`의 결과로 다시 찾을 수 있어요.

멤버 직캠이 빈 음악 방송 35개는 대부분 1위 발표·스페셜 MC·특집 재업로드만 있는 공연이라, 검색해도 멤버 직캠이 나오지 않았어요.

## 2-2. 11-04 최신화 검토 후보 중 정하지 못한 영상 (2026-11-07)

1,337개 중 259개는 담았어요. 무대가 아닌 영상(MV·연습·베리즈 라이브·예능·라디오·MR 제거·커버 팀 등)과 2025년 이전 영상은 뺐어요. 아래는 무대는 맞지만 날짜·멤버·곡을 정할 수 없어 담지 않은 것들이에요.

| 유튜브 | 내용 | 이유 |
|---|---|---|
| Wt3zERevELI | 엔믹스 NOL Festival Full version "2026.10.26" | NOL은 10-18. 같은 업로더 다른 영상은 10.18 |
| fvhSbaoANkQ · klrqOlvJMJ8 · W8MSaBEWSiY | 아이브 World Tour in Hong Kong (N R) | 홍콩 09-04·05·06 중 어느 날인지 모름 |
| pVkEcdqivtg | 아이브 INTRO + BANG BANG 인기가요 라이브 인 도쿄 (안방1열 풀캠) | 09-22·09-23 중 어느 날인지 모름 |
| tJB0mg6Yd9c | 아이브 Austin 072926 'Supernova Love' | 멤버 없음, 곡 미등록 |
| 9N8zi6Dr57Y · uXHReYtZsr0 · XesmhK9j2mY · 6X1JKPXyaMM | 에스파 LA "10/2/2026"·Intuit Dome | 담아 둔 LA는 10-03 하루. 10-02 공연이 따로 있는지 모름 |
| gOBYJuntsUI · keswnhaQ4rw · QHyWtVw9hFg · pC1QrxjcQ6k · yp9zs8hvnu8 · XCZp0obr-9E | 에스파 "261010 … in Vancouver" | 담아 둔 밴쿠버는 10-11. 현지 날짜인지 다른 공연인지 모름 |
| 0zFjcwDAiIM | 하츠투하츠 스텔라 '마지막처럼' 2026 SBS SUMMER | 가요대전 썸머가 08-08(e361)·08-09(e174) 둘로 나뉘어 있음 |
| UKGQ9hrpLNk · eqn44pJHXXw · BiiQAGZ1svE · 9DfZV6K0dOg | 트리플에스 zenith 11-01 Objekt 이벤트 'See You' | 곡 'See You' 미등록(발매 확인 못 함) |
| LkRufPt6P2g · B2GMGF7VgbY · n4FDtBYg-rs | 트리플에스 니엔·소현·지연 'Baby Flower' 10-15·10-17 | 어느 행사인지 모름 |
| xhr67S0MypY · zkRBdScuXYY | 프로미스나인 송하영 'Wonderland' (타이베이 10-25) | 곡 미등록(발매 확인 못 함) |
| vPBLP40rOGk · Z8Pqq1DC-zU · 4Ls0APReuOs · bIXjMnwFEao | 프로미스나인 타이베이 (떽빵)·(하빵)·(아기블루베리) 직캠 | 별명이 어느 멤버인지 모름 |
| 13cfG2OY35A · EiarumROf0k | (2-1과 같음) | |
| ITZY 파리·마와진·가오슝·싱가포르 공식 클립 | 투어 영상 | 파리·마와진 공연이 없고, 가오슝·싱가포르는 이틀 중 어느 날인지 모름 |

## 3. 지우지 않고 남겨 둔 것 (2026-10-24 정리 때)

- 사용자가 고른 종류(예능·인터뷰·공항·출퇴근·포토콜·레드카펫·시구·리액션, 다른 사람의 무대·편집본)만 지웠어요.
- 남긴 것: 무대 모음(Full ZIP cam·STAGE COMPILATION) 7개, 공식 퍼포먼스 비디오·Stage Practice 4개. 제외 규칙에는 걸리니 `audit`에 계속 보여요. 지울지 정하면 `remove-videos`.
- 콘서트 안의 멘트·VCR·사운드체크, 1위 발표·MC컷은 남기기로 했어요.

## 4. 같은 날 공연이 여럿이어도 따로인 것 (확인함, 그대로 둠)

- 음악 방송 + 사전녹화·더 시즌즈·팬미팅·쇼케이스·팝업 등 다른 일정: 아이브 10.19 · 10.23, 엔믹스 05.23, 프로미스나인 07.24 · 07.25 등
- 프로미스나인 5월 · 9~10월, 하츠투하츠 3월 · 9월 대학 축제: 하루에 여러 학교를 돌아요(학교 이름이 다르면 다른 공연)
- 하츠투하츠 MEGA CONCERT(05.30) · 아돌라(07.08) · K-WORLD DREAM AWARDS(08.27): 같은 날 음악 방송과 다른 행사
- 하츠투하츠 KCON JAPAN(05.08 · 05.29), HEARTS 2 HOUSE LA + 인기가요(03.22), 한국대중음악상 + TIMA(07.25), ICONIC HEART 발매 이벤트 + 쇼케이스(08.12), 쇼! 음악중심 + NOL FESTIVAL(10.17) 등: 이름이 뚜렷이 다른 행사

## 5. 그 밖

- 제목이 없는 영상 23개: 2026-10-24에도 oEmbed가 401(퍼가기 금지·비공개일 때)을 돌려줘서 제목을 못 불러왔어요. 썸네일은 살아 있어요. 사이트에서 재생되지 않으면 `gone`으로 표시하거나 지울지 정해야 해요(`set <영상id> title=… channel=…`, 제목은 지어내지 않음).

## 5. 담지 못한 영상 (2026-10-24, 에스파·트리플에스)

날짜·행사·멤버·곡을 제목만으로 정할 수 없어 담지 않은 영상 420개는 `docs/pending-videos.md`에 있어요. 사용자가 정해 주기 전까지 담지 않아요.
- 에스파: 서울 `260807-08`처럼 이틀을 묶은 표기, 멤버 이름이 없는 직캠, 워터밤·롤라팔루자 날짜
- 트리플에스: 팬사인회로 보이는 Baby Flower 직캠(행사 불명), 멤버 불명 직캠, `261010-11` 합본, 같은 날 두 행사에 걸친 영상
- 곡 `kind`: 트리플에스 커버곡 4개(누난 너무 예뻐·CHEER UP·Psycho·Mr.Mr.)는 cover로 바꿨어요. `LEMONADE`, `복합성`, `꿈결의 조각`, `Colorful`, `Lit Pop`, `World Wild Women`은 원곡을 확인하지 못했어요.

## 6. 최예나·키스오브라이프 후보 검토에서 담지 않은 영상 (2026-11-07, `harvest --gaps --all-events`)

최예나 7개·키스오브라이프 33개는 담았어요. 아래는 정할 수 없어 담지 않았어요.

| 유튜브 | 내용 | 이유 |
|---|---|---|
| 69xFz9BYJ0c | 해나 '그건 사랑이었다고' (원곡: 최예나) | 다른 사람의 무대 |
| vQHBgbtcrjM · KXUZK70319A · VgoL_JZzYEM · xVABp7iQKJ0 | 최예나 단독 콘서트 '스티커'·'캐치 캐치'·'설탕'·메들리 | 제목에 날짜 없음(앙콘은 08-22·23, 투어 04-04·05). 메들리 곡 미등록 |
| 8yLOs8GSCqc | 최예나 연세대 축제 | 날짜 없음(담아 둔 연세대 공연 없음) |
| 6yT5fvvyYG8 · eg3ckFN69zM · EbFb9ZUvXCU | 'SWEAT' 가요대전 260809 · 더 쇼 260811·0813 (멤버 이름 없음) | 단체 직캠인지 확인 못 함 |
| g41i0zO0DOM · tAvykXHijLg · 26JZyOjuUDU · P4UiBg3jxoA · vjx8ryE8TQI · IvTsBKk6y4o 등 | 하늘 직캠 260613 타이베이·260903 KT WIZ·261012 | 담아 둔 공연 없음 |
| 곡·날짜 없는 나머지 | 연성대·배재대 풀버전, Voice Focused, 워터밤 가오슝 260913, 멘트·Berriz | 멤버·곡·행사 불명 |

2022~2025년 업로드(Simply K-Pop·스튜디오 춤 등)는 올해 무대가 아니라 뺐어요. 최예나 `reclassify`는 다른 그룹 영상까지 한꺼번에 바꿔서 돌리지 않았어요.

## 7. 2025년 하반기 후보 검토에서 담지 않은 영상 (2026-11-07, `harvest 2025-07-01 2025-12-31 --deep`)

최예나 75개(공연 17개 새로 만듦)·키스오브라이프 97개를 담았어요. 최예나의 울산 음악중심(08-04)은 `울산 음악중심` 하나로 합쳤어요. 아래는 정할 수 없어 담지 않았어요.

- 최예나: APEC 뮤직페스타 영상 4개(251021 방송·251026 월드 두 날짜), 2025 콘서트·도쿄 팬미팅 라이브 스테이지(날짜 없음, 일본 커버곡 '晩餐歌'가 STAR!로 잘못 읽혀 뺌), 서일대 '너만 아니면 돼'·'Lxxk 2 U' 공식 영상(곡 미확인), AAA·ACON 2025·코믹월드 윈터 무대(행사 이름 불명).
- 키스오브라이프: 멤버 이름이 없는 직캠(워터밤 서울 250706, KISS ROAD 앙콘 250719·20, 청년의 날 콘서트 풀버전), 직캠·풀캠을 알 수 없는 영상(릉릉·랑자 등), 풀 콘서트 영상(말레이시아·시카고·후쿠오카·앙콘 1·2일차), 날짜가 업로드 추정뿐인 Simply K-Pop·스튜디오 춤 등. 제목 날짜가 공연과 맞는 직캠도 `KISSY LOAD`·`10 Minutes`(MC) 같은 곡 아닌 항목이 곡으로 읽혀 담지 않았어요.

## 있지 2024년 1분기 2차 수집에서 담지 않은 영상 (2026-11-14)

- 멤버 없는 직캠·풀영상: 1월 방송 직캠 중 멤버 이름이 없는 MPD직캠·예능연구소 풀·뮤뱅 원테이크, 서울(02-24·25)·방콕(03-16)·오클랜드/시드니/멜버른 투어의 풀콘서트·멤버 없는 곡별 영상
- 곡 미등록: Gas Me Up, Dynamite, Kidding Me, Kill Shot, Escalator, Psychic Lover, Swipe, Run Away, Crown On My Head, Yet But, Mine, RACER 등 (솔로·커버·앨범 수록곡 여부 확인 필요)
- 직캠 단서 없음: 유나 'Not Shy'·'Wannabe' 방콕 03-16 (멤버·곡·날짜는 있으나 직캠/fancam 표기 없음)
- 제외: 미니팬미팅(01-20), 키스더라디오·가요광장·IG Live·라디오스타 등
## 키스오브라이프 2024년 1분기 2차 수집에서 담지 않은 영상 (2026-11-14)

- 곡 미등록·원곡 불확실: 'Sugarcoat'(서울가요대상 240102, 1Spirit 240302), 'Bye My Neverland'(벨 240220), 'Standing Next To You'(정국 곡 커버)·'Guilty'(태민 곡 커버)
- 직캠/풀캠 단서·멤버 없음: 2CkhyU9f03M, 0jKQJCpp1eQ(서울가요대상), qWnrKanuhxw(CCMA 풀), NXSXN_UaaJc(한터 풀), vefEdRiSLuQ(나띠, 곡 없음), odvhsAa5FGw(하늘 위주)
- 제외: IG Live·버블·팬미팅(DEAR KISSY)·복면가왕·HAKENTER 레벨체크
## 8. 2차 전수 검색(bf2)에서 담지 않은 영상

### 르세라핌 2024-01
- PbBW8awuQ6g: 골든디스크 JTBC 방송 YB × 르세라핌 3곡 메들리(UNFORGIVEN + Stay Alive + Fire in the belly). 곡별 시작 초를 몰라 보류.
- 멤버 이름 없는 골든디스크 2024 자카르타 240106 직캠(ZjJBdaT_lq8 · uyqx6WdmYq0 · XzYiQQqQn5I · NooMsMwJsqY · 2IWhcL3fJro · YxdG9hS-jGg · OSPUC9jX1aQ · OWwDBuWRlZY): 단체 직캠인지 확인 못 함.
- 날짜는 맞지만 담아 둔 공연이 없고 행사·곡이 불명인 것: 240113 임페리얼 월드 Samrong(ILFpymPAEjU), 240127 TTV SUPER STAR 타이완(Samx00ntGT8). 윤아 팬미팅(niAf566r4lo)은 무대 영상 아님.
- 나머지 review 약 350개는 제목에 날짜가 없고 업로드가 2024-01이 아니라 기간 밖.

### 르세라핌 2024-02
- 쇼케이스(02-19) 팬 업로드 다수: 멤버 이름이 없거나(Smart·Perfect Night·EASY 등) 풀캠인지 직캠인지 몰라 보류. 2곡 메들리(No Celestial + Fire in the belly)는 곡별 시작 초를 몰라 보류.
- 240220 THE GARAGE(7N02c0yhaaM · EY4fudJSEhQ · yIhIaMk4Up4 · kQi9LHsbdHs): 행사 불명, 담아 둔 공연 없음.
- 미니팬미팅 직캠(음악중심 02-24·엠카운트다운 02-29), 뜬뜬편집실, 비어 있는 멤버 없는 K-Choreo(m7uws0SVJxg 등): 무대 직캠인지·멤버 불명.
- 02-24·02-25 방송에 Swan Song를 담았으나 공연 setlist에는 EASY만 있어 경고가 났어요(실제 무대 곡이라 담음, setlist 확인 필요).

### 르세라핌 2024-03
- 2O6OttvX0tI: 03-08 "마지막 미니 팬미팅 Full ver." — 같은 날 뮤직뱅크(e1265)와 같은 공연인지, 별도 팬미팅인지 애매해 담지 않음.
- 미니팬미팅 직캠(ffrS_taKgeY 등), 귀국길(nPv6lyeakvU)·숙소(z2mtQbF-gtQ)·챌린지(TIl_6Q6ER3w)·MAX 내한(wOYUcEn3BjU, 행사·곡 불명): 무대 영상 아님이거나 판단 불가.
- 나머지 review 약 400개: 제목에 날짜가 없거나 기간 밖 업로드.

### 르세라핌 2024-04
- 자동으로 담긴 것 없음(활동 쉬는 달). 코첼라 2024(04-13·04-20) 멤버·곡이 제목에 있는 직캠 6개만 담음.
- 코첼라: 멤버 이름 없는 직캠(o8qhqQlpHXc 등), 두 멤버 합본(WJHQzI9XFlY·_gIsPGlhqRw 허윤진+카즈하 SHINEZ), 04-14 표기 클린 MR 영상(1yjvB8Xspw8), 라이브 논란 뉴스·반응 영상: 보류/제외.
- 인천 투어(04-19, Ue90vfR47-Y·JUxokzluqDI): 멤버 없음.

### 르세라핌 2024-05
- 팬미팅 FEARNADA(05-11·12) 팬 직캠 다수: 멤버 이름 없음·풀캠/직캠 불명·커버곡(Get A Guitar·으르렁)·미등록곡(피어나)·2024-05-02 2주년 라이브(공연 아님)는 보류. 제목에서 멤버·곡·날짜가 모두 확인되는 직캠 6개만 추가로 담음(`pick.mjs` 규칙).

### 르세라핌 2024-06
- 자동으로 담긴 것 없음. 위버스콘 페스티벌(06-15) 직캠 중 제목에 멤버·곡 한 개가 있는 20개만 담음. 멤버 없음·풀캠/직캠 불명·2곡 이상(No Celestial + Smart 등, 곡 시작 초 모름)·미등록곡 No Celestial은 보류. 행사명은 `위버스콘 페스티벌 2024`로 지었어요(공식 표기: AliExpress 2024 Weverse Con Festival).

### 르세라핌 2024-07
- 멤버 없는 07-21 가요대전 Summer 직캠(그룹 직캠): 5_fkZ1uiqRo, 186 AC8d5MBB0yo(Smart), 2TG4KIClecs, FUAnwZe4Coc, nvsu6rLLBTM, l-fMFxihSiA, kLchJjVAtaY(풀 직캠) 등 — 멤버 없는 직캠을 단체로 임의 지정하지 않으려고 보류.
- 곡 없음/엔딩·퇴장 인사 직캠(6VeEoMbZ47s, iiIXUl0v80w, G_6952e_X18, bbNJ2PKmp9g, BxkPnRs3zK0, kuK4ICpYzY0): 곡을 정할 수 없어 보류.
- SBS 공식 풀캠(hCcTfBWC0O8, V9ND5sdmQQ0, vLiJHEnHRvQ): 07-21인지 07-26인지 제목에 날짜가 없어 보류. 해외 팬 직캠(AtotheJOne97 등, 제목에 072124)도 종류 불명이라 보류.
- 일본 방송(FNS 07-03, NTV MUSIC DAY 07-06, 엠카 07-25)과 FEARNADA 일본 팬미팅(07-06~07-31, 사쿠라·채원 직캠 등): 행사가 새 공연이고 풀캠/직캠 구분·곡이 불명이라 보류.

### 르세라핌 2024-08
- 08-30 뮤직뱅크·08-31 음악중심 방송사 공식 영상(CRAZY·1-800-hot-n-fun 무대, KBS/MBC/Mnet 등 gZuKmC_cDPA, CxiuxbsdfOc, AgZGnrG8XzU, dxhfi7VPDwk, YhzF50WE3w0 등)과 4K 원테이크·공간음향 Choreography 영상: 풀캠/직캠 구분이 제목에 없어 보류.
- 멤버 없는 직캠(Ez6NpqarMxo, bASHGZRHKg0, gwQ_nVqzedA)과 08-30 뮤뱅 미니 팬미팅 영상(8hfjqhFBs4E, VmlDY8lhUGw, 1mG5hVoXu3I, aLmUZfHKSqU, HN6YzdNwuZI, 4_bbrZ749is, jbJlQY0qg4A, nnMn5lmyE6Q): 멤버·곡 불명 또는 같은 날 미니 팬미팅과 뮤뱅 구분이 애매해 보류.
- 08-29·08-30 CRAZY THUNDER PARTY(청음회) 영상(TcFN_qmw8-0, OPdvfGNWvpI, noNzFyPMHHM, kimbilly 영상 등): 새 행사라 보류. 08-16 뮤뱅 MR 제거(2zL9pJWF2-A)·팬 라이브 방송류도 보류.

### 르세라핌 2024-09
- 09-06 뮤직뱅크 Crazy 미니팬미팅 사쿠라 세로 직캠(HTKIKl2lHxU): 같은 날 뮤직뱅크와 미니 팬미팅 구분이 애매해 보류(이전 달과 같은 처리).
- 같은 날(09-27) 서강대·서울과학기술대 축제는 제목에 학교명이 분명해 각각 다른 공연으로 담음.
- 방송사 공식 영상·멤버 없는 직캠·곡을 알 수 없는 영상은 이전 달과 같은 기준으로 보류(review.txt 참고).
- 광주대 09-30 카즈하 UNFORGIVEN(WthHd8XKeCE): 제목에 곡이 분명해 담았지만 공연 setlist에 없어 경고가 났어요. 확인 필요.

### 르세라핌 2024-10
- 10-01 호서대·10-02 동명대/영남대 축제 영상: 멤버 없는 직캠(DaftTaengk, Bamp VIDEO 등), 풀캠/직캠 구분 없는 kimbilly·Rock Music·K-MORY 영상, 풀 버전(J6yzPl6GNhE, xAQ0MHP5WVY, k49JPBO3-38 등), 멤버는 있으나 곡 표기가 달라 자동 선별을 못 한 동명대 직캠(GS5bwm1h_DI, ny-AcHA-DBU, JxFvcqrMfGI, snlPYZR7HV4, QaHTSFAI8aM, UuGsVOkklNg, CuzPjapIpHs)은 보류.
- 10-01 한양대 에리카 축제(OCzGc-sxTfg, O_VICinYco8): 새 행사라 보류.
- 09-30 광주대 영상 4개는 3분기 PR(#59)에 이미 담겨 있어 이번 브랜치에서는 뺐어요.

### 르세라핌 2024-11
- 광주대 카즈하 Full Ver.(TvqR1uOp8SY): 제목에 날짜가 없어 보류(09-30 광주대 축제로 보이나 확인 필요).
- JTBC 골든 웨이브 241108 방송 무대(o2GDtkQaz7c, mbDq75c63lE, w8hZJwMOGns, fkxrCMImq28, Ch-rAUgYRhQ), MTV EMA 공식 무대(NdExiLt1erE, QMXvuKzbgkI), 맨체스터 직캠(p68-MTjjWjg, B-QzfBIfDic): 풀캠/직캠·멤버가 불명이라 보류.
- 영남대 축제 직캠(l9vGJ72Dud4)은 멤버·곡 없음, 11-24 Revive X 파티 영상은 새 행사라 보류.
- 담은 것: 2024 MTV EMA(11-10) 사쿠라·홍은채 CRAZY 직캠 2개(제목에 행사·날짜·멤버·곡 모두 있음).

### 르세라핌 2024-12
- 뮤직뱅크 글로벌 페스티벌 in Japan(12-15·12-19)과 SBS 가요대전(12-25) 방송사 공식 영상·풀 버전(rBiV7TvXPkc, 0WlaZHrYkK4, bmN1swMtOnY, n01BljCjzhE, CxEvMW5uGVs, sBfi84W5bww 등): 풀캠/직캠 구분이 없어 보류.
- 새 곡이 제목에 나온 직캠(Star Signs, jewelry — KgC3BOssAng, w_8n2DVMtVI, gPGYFjtDkr8 / Category is LE SSERAFIM — BjAunphZpHU, D8aCGyIGS98, VPJNVQ7iNxs, oFixg386g6I): 곡이 그룹 곡인지 커버·특별 무대인지 확인이 필요해 보류. oFixg386g6I는 제목 날짜(241215)가 SBS 가요대전과 맞지 않아 더 보류.
- AAA 12-27 직캠: 멤버 1명·곡 1개가 제목에 있는 6개만 담음. 두 곡이 묶인 영상(KbFCBbU2CQk), 멤버·곡 없음, 곡 불명(Love Is An Open Door), 풀캠 불명 영상은 보류.
- 방송 영상 제목에 "뮤직뱅크 글로벌 페스티벌"이 있으면 일반 뮤직뱅크가 아니라 별도 행사 "뮤직뱅크 글로벌 페스티벌"로 담음.

### 르세라핌 2025-01
- 제39회 골든디스크 JTBC 공식 방송 무대(bza4Cz8FOpo, HKJcwNwk5eA 등)와 2025 GDA 직캠 중 곡이 Pierrot 한 곡이거나 Pierrot+CRAZY 두 곡인 영상(MBmLtGD8SK8, rCy1xonCiXM, 5aQ1K4ONzNI, R7JLLxj7dnw, 9WCbiITYHpg 등): Pierrot가 곡 목록에 없어 새 곡 여부 확인이 필요해 보류. 곡 없음·시상식 소감·방송사 풀캠도 보류.
- 12-25 가요대전 홍은채 CRAZY(Atntuz3jfxY)는 4분기 PR에 이미 담음. Category is LESSERAFIM(oEXbNTiTBaw, fcFrfSZUsMs)은 12월과 같은 이유로 보류.
- 01-24 SWU, 01-30 엠카운트다운(vf97Wm2RS8U)은 새 행사·풀캠/직캠 불명으로 보류.

### 르세라핌 2025-02
- 확실한 무대 영상이 없었어요(자동 0, 확인 필요 364는 대부분 범위 밖·비무대). 02-18 오버워치2 라이브 스트리밍 이벤트 직캠(nFhr7tsB1_Y, OWt2FPWjyho)은 곡이 없어 보류.

### 르세라핌 2025-03
- HOT·Come Over 컴백 활동(03-14~03-29) 방송사 공식 영상(KBS·MBC·Mnet·SBS, 항공캠, KBS WORLD 등)은 풀캠/직캠 구분이 제목에 없어 보류. 쇼케이스 공식 Stage Cam(W7lcs4w-y_c)·STUDIO CHOOM 영상도 보류.
- 03-14 컴백 쇼케이스 홍은채 직캠(R8rUN0s0r3k): 제목에 쇼케이스·날짜가 모두 있어 담았지만, 같은 날 뮤직뱅크가 있어 쇼케이스 날짜(03-13/03-14)를 확인하면 좋아요.
- 03-08 CDTV 라이브(8KjWoy1y8jM 등 일본 방송 직캠): 새 행사·풀캠/직캠 불명으로 보류.

### 르세라핌 2025-04
- 투어 'EASY CRAZY HOT' 인천(04-19·04-20) 콘서트 영상: 제목에 날짜·멤버·곡·직캠 표기가 모두 있는 7개만 담음(공연 2, 이름은 `LE SSERAFIM TOUR 'EASY CRAZY HOT' 인천`). 나머지(kimbilly 등 풀캠/직캠 불명, 여러 곡 묶음, VCR·Weverse Live 등 곡 불명, Zereu·YOYO 멤버 직캠 등 제목에 행사 표기가 약한 것)는 보류.
- 2025-04 수집에서 03-27 엠카운트다운·03-29 음악중심 영상 6개가 새로 발견됨(4pI6u5UbGjY, VzML0MvnGdQ, _F3KhkKVFs8, P2FwGUkfn1A, UsuU5Y5Wy6g, rjg1XEhBvO4). 1분기 PR(#64) 공연과 겹쳐 공연이 둘로 갈라질 수 있어 #64 병합 뒤 담음.

### 르세라핌 2025-05
- 고려대 입실렌티(05-24): 제목에 멤버 1명·곡 1개가 있는 직캠 8개(자동 3 + 직캠 5)만 담음. KTN·교육TV방송국 영상, 풀버전·여러 곡 묶음, 멤버 없는 직캠은 보류. 공연 setlist에 없는 곡(CRAZY, UNFORGIVEN)은 경고가 났지만 제목에 곡이 분명해 담음.
- 투어 인천 'Come Over' Stage Cam(u9CPVmAnE3s)은 날짜가 업로드일 추정에 곡이 여러 곡으로 잘못 읽혀 보류. 05-06 나고야·05-13/14 오사카 콘서트 영상은 새 투어 도시 공연이고 풀캠/직캠이 불명이라 보류.
- 위버스 라이브(05-02, 05-13, 05-18, 05-19)·05-16 대전여상 체육대회는 무대 영상이 아니거나 새 행사라 보류.

### 르세라핌 2025-06
- 위버스콘 페스티벌 2025(06-01) 직캠 5개(제목에 멤버·곡·날짜·WEVERSE CON 표기)와 사이타마 투어 5개(06-12·14·15 사쿠라 DIFFERENT 직캠 5개)만 담음. 행사명은 기존 `위버스콘 페스티벌 2024` 형식과 투어 이름 형식에 맞춤.
- 두 곡 묶음(I93J1eyWafk, XhuR8qIYpl8), 풀캠/직캠 불명 사이타마 영상(きーま🐰, POOH 등), 새 곡 Pierrot, 06-11 윤진 DIFFERENT(iMiJ66ci3zw, 공연 날짜 불명)는 보류. 06-18 요코하마 청사과 축제 직캠(yHfDN3ye1a8, LW-Sv8mY6_Q)은 제목 행사명이 불분명해 보류.
- 05-24 고려대 페이스캠 3개(_SLqL4ipY0Q 등)는 06월 수집에서 새로 발견돼 담음.

### 르세라핌 2025-07
- 07-03 엠카운트다운·07-04 뮤직뱅크·07-06 인기가요(DIFFERENT English ver.) 방송사 공식 영상·KBS WORLD·1HR LOOP·릴레이댄스·TV 라이브 영상: 풀캠/직캠 구분이 없어 보류. 인기가요 안방1열 직캠 중 제목에 날짜가 없는 것(L6cAO4V7Iw4, U9VPiF1yMRM)과 [FOCUS ON FACE] 영상(p70b4udHtR8, N4vBId7QS5M)은 날짜 불명이라 보류.
- 타이베이 투어 'EASY CRAZY HOT'(07-19) 직캠 3개만 담음(제목에 날짜·멤버·곡 모두 있음). 이름은 `LE SSERAFIM TOUR 'EASY CRAZY HOT' 타이베이`. 새 곡(Burn the Bridge, Blue Flame, FEARNOT, Fire in the belly 등)이나 두 곡 묶음, 풀 콘서트, 멤버 없는 영상은 보류.
- 고려대 입실렌티 풀버전(3_TBBivstB8): 업로드가 7월이라 날짜 불명으로 보류(05-24 공연).

### 르세라핌 2025-08
- 자동 선별 3개는 모두 보류: 타이베이 풀콘서트(Hjjb13IQAgs)·채원 DIFFERENT(2qMxufv2ad8)는 제목에 날짜가 없어 추정 날짜라 보류, 고려대 풀버전(3_TBBivstB8)은 날짜 불명.
- 마닐라 투어(08-02) 직캠 7개·방콕(08-09) 채원 CRAZY 1개만 담음(제목에 날짜·멤버·곡 1개·투어 도시 모두 있음). 이름은 `LE SSERAFIM TOUR 'EASY CRAZY HOT' 마닐라/방콕`. 두 곡 이상 묶음(Highdef… 채널 등), 새 곡(Fire in the belly, FEARNOT, Blue Flame 등), 풀콘서트·풀캠/직캠 불명(kpopante·Jae·Leiso 등), 방콕 08-10 Day2는 보류.

### 르세라핌 2025-09
- 자동 '확실' 3개 보류: 타이베이 풀콘서트(`Hjjb13IQAgs`)·채원 DIFFERENT(`2qMxufv2ad8`)는 제목에 날짜가 없고 업로드일 추정이라 보류, 고려대 입실렌티 풀버전(`3_TBBivstB8`)은 날짜를 알 수 없어 보류. 시카고 채원 영상(`Xs8HeD_CuUw`)은 제목이 NMIXX 투어로 잘못 읽혀 르세라핌 투어 시카고로 직접 지정해 담음.
- 미국 투어(뉴어크 09-03/04, 시카고, 달라스, 로스앤젤레스, 샌프란시스코, 라스베이거스, 시애틀) 직캠 중 보류: 멤버 없는 직캠(ggoomCAM·Bic·Notag 등), 여러 곡 묶음·풀콘서트, 미등록 곡(Pierrot·Sour Grapes·Blue Flame·The Great Mermaid·Impurities·No-Return·Burn the Bridge·Fire in the belly), 버전 표기곡(Smart remix, EASY rock ver.), 날짜 없는 방콕 채원 ANTIFRAGILE(`TusKrs_nLvo`), 마닐라 사쿠라 묶음(`Oe63euXWMrg`), 공식 'IN US' Stage Cam(날짜 불명).

### 르세라핌 2025-10
- 10-24 뮤직뱅크·10-25 음악중심·10-26 인기가요·10-31 뮤직뱅크 자동 확실 29개는 모두 담음.
- 보류: M2 '입덕직캠·MPD직캠' 계열(제목에 날짜 없음, 업로드일로만 10-25/26 추정), STUDIO CHOOM UNFILTERED CAM(날짜 없음), KBS K-Choreo 타워캠(멤버 없음), 연세대 10-29 직캠 등 멤버 없는 영상, 지포스 게이머 페스티벌·10-01 출범식의 UNFORGIVEN+ANTIFRAGILE·SPAGHETTI 묶음/풀버전·풀캠, 제목에 날짜가 없는 지포스 직캠(윤진 `9HYr4rHwSPg` 등), 마닐라 사쿠라 묶음(`Oe63euXWMrg`), 공식 IN US 스테이지캠(날짜 불명). 2026년 영상(고려대 석탑대동제·골든디스크 등)은 해당 월에서 처리.

### 르세라핌 2025-11
- 자동 '확실' 36개 중 12개 보류: 추정 날짜인 10-01 출범식 풀캠(`-2ngVqqCAPA`)·마닐라 사쿠라 묶음(`Oe63euXWMrg`), 미니 팬미팅 풀캠(음악중심 `4Wjs21SauBk`, 인기가요 `02vx_Co4bdg`, 팬미팅은 보류), 10-30 지포스 게이머 페스티벌의 여러 곡 묶음 직캠 8개(`HQwwCQFefUA`·`YyPpHxJbOqk`·`syJIM_JX1KM`·`ULwHF0UReN4`·`lCmlWQq9wQk`·`XJoijtow03g`·`_5EdUWIgpy0`·`QYNF7Lwn7FI`). 나머지 24개(음악중심 11-01·인기가요 11-02/09·더 시즌즈·지포스 단곡 1개)는 담음.
- 도쿄돔 앵콜(11-18/19) 직캠은 대부분 멤버 없음(coldnadong 등), 사쿠라 Kawaii는 미등록 곡이라 보류. 음중·인기가요 미니 팬미팅 직캠(`H0tILb32oEg`·`aGoHVLolkXU`·`NFB7zQXhyt8`·`mTaLUcAzrzY`), KBS 더 시즌즈 공식 CRAZY(`wznKC21EGyg`, 종류 불명), KBS K-Choreo 타워캠(멤버 없음), ILLIT 콘서트 속 르세라핌 곡은 담지 않음.

### 르세라핌 2025-12
- 자동 '확실' 54개 중 2개 보류(추정 날짜의 10-01 출범식 풀캠 `-2ngVqqCAPA`, 마닐라 사쿠라 묶음 `Oe63euXWMrg`). 제목의 'Hot Chili ver.'가 곡 HOT으로 읽힌 2개(`vZ4BRmDak0I`, `ED96qYga1Wo`)는 SPAGHETTI 한 곡으로 고쳐 담음.
- AAA 12-06(가오슝)은 멤버·곡 하나가 제목에 있는 직캠 5개만 담음. 보류: 'Born Fire+Ash+HOT' 등 묶음·멤버 없는 영상, 'Born Fire'(미등록), 대상 수상소감.
- 가요대축제 12-19 카즈하 'Standing Next to You'(정국 커버) 직캠 약 9개, 채원 'Never Ending Story'(아이유 커버), 가요대전 홍은채 'Pretty Savage' 직캠은 커버곡이라 곡 목록 종류 결정이 필요해 보류. 허윤진 'Intro Performance' 직캠(곡 아님), 12-28 사쿠라 포커스(행사 불명), 공식 K-Choreo 8K(멤버 없음), 팬미팅·FIFTY FIFTY·김소원 팬미팅 속 SPAGHETTI 커버는 담지 않음.

### 르세라핌 2026-01
- 자동 '확실' 7개 중 12월 가요대전·가요대제전 3개는 4분기 PR(#67)에 이미 있어 제외, 골든디스크 'Intro + SPAGHETTI + HOT' 묶음(`a1CTkZnWk7o`)은 보류. 자동 3개와 직접 고른 9개(골든디스크 2, 앙코르 서울 01-31 7)를 담음.
- 보류: 앙코르 서울 풀 분할본(enustiK 등)·멤버 없는 직캠·묶음('UNFORGIVEN+ANTIFRAGILE', 'HOT+Come Over', 'Impurities & The Great Mermaid'), 01-31~02-01 날짜가 겹친 채원 HOT(`ig-4SmWnilo`), 골든디스크 윤진 '비처럼 음악처럼'(커버)·멤버 없는 직캠·풀캠(`B23bbUxWlU0`), 카운트다운 재팬 공식 스테이지캠(날짜 불명). 02-01 앙코르 서울 2일차는 2월에서 처리.

### 르세라핌 2026-02
- 앙코르 서울(01-31·02-01) 자동 '확실' 29개 중 16개를 담음(02-01은 직접 고른 3개 추가). 13개 보류: 여러 곡 묶음(`cnOSHaiitQE`·`oGudw7B_jKo`·`Z2F-YZEGm78`·`QMEOaV1KeNs`·`ePZclemOnsQ`·`MuzdEts7STI`·`zO_nlSnxANQ`·`jRBthfDWYjs`·`E7vc3UDIFE4`), 행사명이 '2025'로 읽힌 1부 풀버전(`j-JjpDsundA`), 날짜 01-31/02-01이 겹친 채원 HOT(`ig-4SmWnilo`), 곡 판별이 애매한 `9XUtfXLDeLA`·`dVncfwBhYGM`. 다수 영상이 '이 공연 setlist에 없어요' 경고였으나 제목이 분명해 담음(앙코르 공연이라 세트 구성이 투어와 다름, 공연 setlist 보정 필요 여부는 확인 바람).
- 보류: Kawaii·The Great Mermaid·Impurities·Pearlies 단독 직캠 등 미등록 곡, 'SPAGHETTI+DANCE BREAK'·'HOT+Come Over' 묶음, 멤버 없는 전체무대·풀 분할본, 곡 목록 확인이 필요한 So Cynical(채원 `W6ZdqKZtLNk`).

### 르세라핌 2026-03
- 자동 '확실' 0개, '확인 필요' 264개 중 르세라핌 3월 무대 직캠은 찾지 못함(카운트다운 재팬 공식 스테이지캠 `BgaOjtPOhLk`은 날짜 불명, 타 그룹 커버 영상은 제외).

### 르세라핌 2026-04
- 자동 '확실' 48개(뮤직뱅크 04-24·음악중심 04-25·인기가요 04-26·엠카운트다운 04-30, 풀캠 3개 포함) 모두 담고, 직접 고른 인기가요 채원 직캠 1개(`PMD9K39k0Fs`) 추가.
- 보류: 멤버 없는 직캠(M2 8K `sfECs85xhjA`, 현장 촬영 `691rPCr071o`), VR 콘서트 인비테이션 무대인사 직캠(공연이 아니라 상영 행사), 타 그룹 SPAGHETTI 커버(홍대 직캠), 고려대 석탑대동제(5월에서 처리).

### 르세라핌 2026-05
- 자동 '확실' 90개 중 82개를 담고, 직접 고른 11개(인천대 1·숭실대 4·경희대 3·Spotify PURE FLOWERS LIVE 1·엠카운트다운 X 메가콘서트 2) 추가. 8개 보류: 여러 곡 묶음 풀(인천대 `bBR9__AmLdA`, 고려대 `MC3i0vJpRsw`·`hKV7PkKmigE`·`sXsGFzApM0k`·`teh-zhqw32U`·`FjnNVnTGVf0`)과 05-30 같은 날 다른 행사로 갈린 미니 팬미팅 직캠(`em9W5z9LIZ8`)·엠카운트다운 X 메가콘서트 은채(`wLKDMj8mOcU`, 같은 행사 직캠 2개는 직접 담음).
- 보류: 음악중심 미니 팬미팅(05-01·02·30) 직캠·풀, 멤버 없는 직캠·전체무대, 고려대 석탑대동제·KULIMAX 직캠(제목에 날짜 없음, 'UNFORGIVEN & ANTIFRAGILE'·'CELEBRATION+CRAZY' 묶음), 미등록 곡(Fire in the belly·Creatures·Sonder), 연세대 아카라카·세종대 축제 직캠(멤버 없음), 경희대 풀버전·묶음, 곡 표기 없는 멤버 직캠, ILLIT 합동 풀캠.

### 르세라핌 2026-06
- 자동 '확실' 23개 중 21개를 담고 직접 고른 23개(위버스콘 페스티벌 2026 15·서울가요대상 4·iHeartRadio TikTok LIVE in LA 2·엠카운트다운 X 메가콘서트 2) 추가. 2개 보류: 경희대 풀캠 묶음(`jHoqU2rGwh8`)과 서울가요대상 'SPAGETTI + BOOMPALA' 두 곡을 한 곡으로 잘못 읽은 카즈하 영상(`8U3QJWohsHI`). 05-30 엠카운트다운 X 메가콘서트 영상 3개는 이 달 수집에 포함돼 같은 공연(e1346)에 담음(공연 setlist는 CELEBRATION뿐이라 BOOMPALA 경고, 제목 기준으로 담음).
- 보류: 'Born Fire' 류가 아니라 여러 곡 묶음('SPAGHETTI + BOOMPALA', 'CELEBRATION & 이프푸 & CRAZY', 'Smart + Perfect Night', 'Fire in the belly & SMART & Perfect Night'), 위버스콘 풀버전, 서울가요대상 수상소감·단체 엔딩, 멤버 없는 직캠(R0Kyvf7mODA 등), 미등록 곡(CREATURE·Fire in the belly·이프푸), KD K-POP IDOL 직캠(날짜 없음).

### 르세라핌 2026-07
- 자동 '확실' 0개. PUREFLOW 인천(07-11·07-12) 직캠 중 멤버·등록된 곡 하나·날짜가 제목에 있는 12개만 직접 골라 담음.
- 보류: 미등록 신곡(Irony·iffy iffy·Blue Flame·Saki·No Celestial·Creatures·Fire in the belly·Trust Exercise)을 담은 직캠 다수, 여러 곡 묶음(K-PLANET 'CRAZY + SPAGHETTI' 등), 멤버 없는 직캠·전체무대·단체직캠, 날짜가 07-11·12 둘로 적힌 영상(`q63Ks2VgqhY`, `KtfNWtmgnOg`), 공식 Stage Cam(`fsYCvJYQSr8`·`ox9Bw-lmn6s`, 멤버 없음). 새 곡이 많아 곡 목록에 한꺼번에 추가할지 정해 주세요.

### 르세라핌 2026-08
- 자동 '확실' 0개. 2026 K-WORLD DREAM AWARDS(08-27) 13개와 SUMMER SONIC 2026(08-16 도쿄) 사쿠라 2개를 직접 골라 담음(멤버·등록 곡 하나·날짜가 제목에 있는 것만).
- 보류: PUREFLOW 요코하마 D3(08-02) 직캠(coldnadong, 멤버 없음)·미야기 앙코르(`gUE1kA8zPgs`, 멤버 없음), 'BOOMPALA+SPAGHETTI' 묶음(K-PLANET 등), 수상 소감·상 영상, 제목에 날짜가 없는 사쿠라 KWDA 2개(`PlYlTTas93A`·`ufr7Pddwri0`), 08-14 SUMMER SONIC 오사카(`OtC5SVQPtr0`)·채원 08-16(`DxwFW0WdhdQ`)처럼 곡·날짜가 불분명한 영상, 'Saki'·'Irony' 등 미등록 곡, 260809 행사 불명 은채 SMART 2개(`7FjY0jhXREM`·`0AIEA38oQXA`).

### 르세라핌 2026-09
- 자동 '확실' 21개 중 20개를 담음(엠카운트다운 09-17 8, 인기가요 09-20 8·09-21 3, KWDA 1). 업로드일로 날짜를 추정한 사쿠라 KWDA(`PlYlTTas93A`)는 보류. 단, KWDA 허윤진 'BOOMPALA+SPAGHETTI'(`2x69n7cQRQU`)는 두 곡 묶음인데 도구가 그대로 담음(보류 기준과 달라 확인 바람).
- 직접 고른 22개(BlizzCon 2026 18, PUREFLOW 로스앤젤레스 3, 포트워스 1) 추가. BlizzCon은 채원 직캠 위주.
- 보류: 미등록 곡(Irony·Creatures·So Cynical·Saki·Goodbye·Trust Exercise), 풀콘서트·풀스테이지·묶음, 멤버 없는 직캠(iHeartRadio Music Festival 09-19·샌호세 09-23·피닉스·후쿠오카·LA 일부), 1회성 사운드체크.

### 르세라핌 2026-10
- 자동 '확실' 0개. PUREFLOW 북미·유럽 투어(시카고 10-02, 워싱턴 D.C. 10-05, 런던 10-16, 암스테르담 10-18, 파리·코펜하겐 10-22~23) 직캠 중 멤버·등록 곡 하나·날짜가 제목에 있는 3개(시카고·워싱턴 D.C.·올랜도)만 담음.
- 보류: 멤버 없는 직캠(Dukemon 시카고 연작, blckvlvtx 암스테르담 연작, LCY0509 런던, 풀콘서트·풀캠), 미등록 신곡(Irony·Blue Flame·Saki·Need Your Company·Creatures·Sonder·Fire in the belly), 'Smart + Ending' 같은 묶음, 윤진 생일 콘서트 풀(`iWFUVmiAtYs`). 투어 도시 공연이 늘어나므로 곡 목록에 신곡을 한꺼번에 등록하면 상당수를 다시 담을 수 있음.

### 르세라핌 2026-11 (범위 끝 11-13)
- 자동 '확실' 0개. PUREFLOW 마카오(11-07·11-08) 채원 직캠 4개만 직접 골라 담음.
- 보류: 마카오 shingshing 연작(멤버 없음, 곡 다수가 미등록), Troll·Livelylife 등 멤버 없음/미등록 곡(Blue Flame·Irony·Trust Exercise·Sonder·Creatures), 풀퍼포먼스(`WGYmb-xL0t0`), 11-14 타이베이 공연(범위 밖). 신곡을 곡 목록에 등록하면 투어 직캠 상당수를 다시 담을 수 있음.

### 아이브 2024-01
- 담음 16개: 하나 드림콘서트(01-20) 11개, SHOW WHAT I HAVE 방콕(01-27) 5개 (멤버 1명 + 등록 곡 + 날짜가 제목에 있는 직캠).
- 2023-12 영상(SBS 가요대전·MBC 가요대제전)은 범위 밖이라 뺐어요. 2025-01-16 엠카운트다운 4Qwp7J9b-zc, 2025-12-14 뮤직뱅크 글로벌 페스티벌 K8h7AFqEDNE는 날짜 추정이라 뺐어요.
- 보류: 골든디스크(01-06) 직캠은 여러 곡 묶음이거나 멤버 없음(VDCoJxHnMrc, 8lR2Rk4um1w, lyHGtbZ-Sl4, WZ1R5CuCRis, FTQdSyAg-q4, 0_vBJ1jVv50, b3o1z5YO3ng, agpi_6GrWg4). 방콕 직캠 중 미등록 곡(Lips, Royal, Holo, Cherish, Wannabe, Woman Like Me 등)과 멘트는 곡 등록 결정 후. 도무디(01-13) 멤버 없음.

### 아이브 2024-02
- 담음 7개: SHOW WHAT I HAVE 쿠알라룸푸르(02-17) 3개, 싱가포르(02-24) 4개 (멤버 1명 + 등록 곡 + 날짜가 제목에 있는 직캠).
- 자동 2개(2025-01-16 엠카운트다운 레이 8y2AluSRSt8, 2025-12-14 K8h7AFqEDNE)는 날짜 추정이라 뺐어요.
- 보류: 쿠알라룸푸르·싱가포르 직캠 대부분은 미등록 곡(Lips, Royal, Mine, OTT, Cherish, Wannabe, Heroine, Hypnosis, Blue Blood, Woman Like Me, I Want 등)이거나 멤버 없음/여러 멤버/멘트·리허설·풀콘. 2024-02-14 뮤직뱅크 Attitude 타워캠 _QKAenAYorE는 멤버 없음. 오사카 D-2(02-08) 팬캠은 공연이 아니라 리허설 계열이라 뺐어요. 곡 등록 결정 후 다시 담을 수 있어요.

### 아이브 2024-03
- 담음 166개: 타이베이(03-02·03) 21, 2nd FANMEETING 'MAGAZINE IVE'(03-09·10) 115, LA(03-13) 7, 오클랜드(03-16) 9, 애틀랜타(03-24) 4, 시카고(03-26) 3, 뉴어크(03-29) 7 (+포트워스 0). 멤버 1~2명 + 등록 곡 + 날짜가 제목에 있는 직캠. 공연 이름은 도구가 'NMIXX WORLD TOUR ZERO FRONTIER …'로 잘못 읽어 IVE 투어 이름으로 직접 지정했어요.
- 자동 5개(2025-01-16 엠카운트다운 레이·장원영, 2025-08-21 K-WORLD DREAM AWARDS 레이, 2025-12-14, 2025-12-25)는 범위 밖·날짜 추정이라 뺐어요.
- 보류: 멤버 없는 직캠(풀캠·단체·타워캠·VIP 등), 여러 곡 묶음(Baddie + After Like 등), 미등록 곡(Lips, Royal, Mine, OTT, Cherish, Wannabe 등), 사운드체크·리허설, 03-06 인하대 개강공연 Baddie(0p_QYSPzY8I, 행사 이름 불분명), 포트워스(03-20)·애틀랜타 일부는 멤버 없음.

### 아이브 2024-04
- 담은 영상 없음. 자동 4개는 범위 밖·날짜 추정(2025-01-16 엠카운트다운, 2025-12-14, 2025-12-25)이라 뺐고, 검토 후보 중 무대 영상은 없었어요(범죄도시4 시사회 리즈 직캠, SF9 다원 팬미팅 Baddie 멀티포커스는 아이브 무대가 아니에요).

### 아이브 2024-05
- 담음 110개: 뮤직뱅크·인기가요·음악중심·엠카운트다운 Heya/Accendio 활동 직캠, 인천대 축제(05-07), 한국체육대 축제(05-13), 연세대 축제(05-26). 한체대/한국체육대로 나뉘어 읽힌 공연은 '한국체육대 축제' 하나로 합쳤어요.
- 뺀 것: 2025년 날짜 추정 4개(2025-01-16·2025-12-14), 여러 곡 묶음 4개(한체대 4곡 연속·Heya+Kitsch+Love Dive 등).
- 보류: 05-08 멜론 직캠100 아이브 영상(Heya·I Am·Holy Moly 멤버별 약 40개)은 어느 행사로 둘지 정해지지 않았어요(예: '멜론 직캠100' 공연 하나로 담을지). 05-09 엠카운트다운 풀캠은 담았어요. 풀캠·전체 직캠(인천대·한체대·아카라카), 멤버 없는 영상, 멘트·입퇴장 영상, 05-01 BE ORIGINAL 페이스캠(장원영, 행사 불분명)은 보류.

### 아이브 2024-06
- 담음 11개: SHOW WHAT I HAVE 파리·바르셀로나·런던(자동 3), 베를린·산티아고(멤버 1명 + 등록 곡 8). 투어 이름은 도구가 'NMIXX …'로 읽어 IVE 투어 이름으로 직접 지정했어요.
- 뺀 것: 2025-01-16·2025-12-25, 2026-02-23 영상은 범위 밖·날짜 추정.
- 보류: 파리·바르셀로나·베를린·암스테르담·런던·상파울루·산티아고 투어 직캠 대부분은 멤버 없음(팬 채널 단체 직캠), 두 곡 이상 묶음, 유닛(장원영+이서, 안유진+이서) 무대, 미등록 곡(Lips, Royal, Mine, OTT, All Night, Blue Blood, Cherish, Woman Like Me 등), 사운드체크. 멤버를 정해 줄 수 있으면 다시 담을 수 있어요.

### 아이브 2024-07
- 담음 43개: SHOW WHAT I HAVE 홍콩(07-06·07)·마닐라(07-13)·시드니(07-28), SBS 가요대전 SUMMER(07-21). 투어 이름은 도구가 'NMIXX …'로 읽어 IVE 투어 이름으로 직접 지정했고, 'SBS 가요대전'과 'SBS 가요대전 SUMMER'로 갈린 공연은 'SBS 가요대전 SUMMER'로 합쳤어요.
- 보류(결정 필요): 2024 SBS 가요대전 SUMMER 방송분 영상(07-26, 공식 풀캠 + 멤버 직캠 7개, 곡이 'Heya + Accendio' 묶음)은 07-21 녹화와 같은 공연인지 확실하지 않아 담지 않았어요. 같은 공연이면 07-21 공연에 합치고 곡은 Intro + Heya + Accendio 묶음으로 담아야 해요. Heya+Accendio 묶음 영상 07-21 4개도 같은 이유로 뺐어요.
- 뺀 것: 2025년 날짜 추정 영상.
- 보류: 홍콩·멜버른(07-25)·시드니 투어 직캠 대부분은 멤버 없음, 묶음, 미등록 곡(Lips, Royal, OTT, All Night 등), 유닛 무대.

### 아이브 2024-08
- 담음 103개: Lollapalooza Chicago(08-03), SHOW WHAT I HAVE 앙코르 서울(08-10·11), SUMMER SONIC 오사카(08-17), 자카르타(08-24). 투어 이름은 도구가 'NMIXX …'로 읽어 IVE 투어 이름으로 직접 지정했어요. 멤버 1명 + 등록 곡 + 날짜가 제목에 있는 직캠만 담았어요.
- 보류(결정 필요): 07-26 SBS 가요대전 SUMMER 방송분 7개(위 07월 항목과 같은 질문). Love Dive+Kitsch 묶음(안유진 08-10) 1개.
- 보류: 앙코르 서울·자카르타·SUMMER SONIC 도쿄(08-18) 직캠 대부분은 멤버 없음, 묶음, 미등록 곡(All Night, Lips, Royal, WAVE 등), 사운드체크, 팬 멘트·미션.

### 아이브 2024-09
- 담음 17개: 2024 펩시 페스타(09-22) 멤버 1명 + 등록 곡 직캠.
- 자동 4개는 2025년 날짜 추정이라 뺐어요.
- 보류: 펩시 페스타 풀영상·묶음(Heya+Kitsch+I Am+I Want)·I Want 직캠(미등록 곡), 도쿄돔 앙코르(09-04·05, 일본 곡·사운드체크), TGC(09-07)·뮤직스테이션·NTV withMUSIC의 Crush 무대(미등록 곡·같은 날 방송 여러 개).

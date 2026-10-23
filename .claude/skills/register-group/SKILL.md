---
name: register-group
description: 무대 서랍에 아직 없는 아이돌 그룹을 위키백과 등에서 찾아 그룹·멤버·곡을 등록하는 절차. 사용자가 등록 안 된 그룹의 영상을 담아 달라고 하거나, add가 "그룹을 정할 수 없어요"·"멤버를 정할 수 없어요"·"곡 목록에 없어요"로 멈췄거나, "○○ 그룹 추가해줘"라고 할 때 쓴다. scripts/archive.mjs roster로 등록한다.
---

# 그룹 자동 등록

사용자는 그룹 정보를 따로 알려 주지 않아도 돼요. Claude가 자료를 찾아 등록하고 무엇을 등록했는지 보고해요.

## 1. 이미 있는지 확인

```bash
node scripts/archive.mjs status
```

같은 그룹이 다른 표기(한글/영문)로 있으면 새로 만들지 말고 그 그룹을 보강해요(`roster`가 이름·영문명으로 맞춰 줘요).

## 2. 자료 찾기

순서대로 시도해요. 웹 도구(WebFetch·WebSearch)가 있으면 그것을, 없으면 `curl`을 써요.

1. **한국어 위키백과**: 한글 그룹명, 멤버(활동명), 탈퇴·활동 종료 멤버, 음반 목록과 발매일
   - `https://ko.wikipedia.org/wiki/<그룹명>`
   - 정리된 원문이 필요하면 `https://ko.wikipedia.org/w/api.php?action=parse&page=<그룹명>&prop=wikitext&format=json&redirects=1`
   - 같은 이름의 다른 문서가 있으면 `<그룹명> (음악 그룹)`을 시도해요.
2. **영어 위키백과**: 영문 그룹명, 멤버 영문 활동명, 영문 곡명
   - `https://en.wikipedia.org/wiki/<영문명>` 또는 `…/w/api.php?action=parse&page=<영문명>&prop=wikitext&format=json&redirects=1`
3. 보조 자료: `https://namu.wiki/w/<그룹명>`(자세하지만 자동 접속이 막힐 때가 있어요), `https://kprofiles.com/`(멤버 영문 표기)

네트워크가 막혀 실패하면 지어내지 말고, 어느 도메인이 막혔는지 사용자에게 알리고(허용 방법은 `CLAUDE.md` 네트워크 절), 그동안은 사용자에게 멤버·곡을 물어요.

## 3. 무엇을 모으나

| 항목 | 규칙 |
|---|---|
| 그룹 | `name`: 한국어 표기(예: 아이브). `en`: 유튜브 제목에 쓰이는 영문 표기(대개 대문자, 예: IVE) |
| 멤버 순서 | 공식 프로필·위키 멤버 표 순서(보통 데뷔 공식 순서). 라인업의 열 순서가 돼요 |
| 멤버 이름 | `name`: 한국어 활동명. `aliases`: 영문 활동명(대문자·첫 글자만 대문자 둘 다), 본명이 활동명과 다르면 본명, 흔한 다른 표기. 제목 해석에 쓰이니 빠짐없이 |
| 활동 종료 | 탈퇴·계약 종료 멤버는 `"active": false`로 넣어요(옛 영상에 나오니까). 활동 중단(휴식)은 `true` 그대로 |
| 곡 | 최근 1~2년 활동곡(타이틀곡) 중심 + 사용자가 담으려는 영상에 나오는 곡. 사용자가 "전체 곡"을 원하면 디스코그래피 전체 |
| 곡 이름 | `title`: 공식 표기(영문 곡이면 영문 그대로). `aliases`: 한글 음차(예: REBEL HEART → 레벨 하트), 대소문자가 다른 표기 |
| 발매일 | 그 곡이 실린 음반의 발매일 `YYYY-MM-DD`. 모르면 비워요 |
| 색 | 사용자가 말하지 않으면 넣지 않아요(기본 팔레트에서 순서대로) |

**지어내지 않아요.** 자료에 없는 멤버·곡·날짜는 넣지 않아요. 자료끼리 다르면(멤버 순서, 영문 표기) 더 공식적인 쪽(소속사·위키 본문)을 쓰고, 보고에 차이를 적어요. 같은 이름의 그룹이 여럿이면 사용자에게 어느 그룹인지 물어요.

## 4. 등록

자료를 JSON으로 정리해 저장소 밖(스크래치 폴더)에 두고:

```json
{
  "group": { "name": "아이브", "en": "IVE" },
  "members": [
    { "name": "안유진", "aliases": ["YUJIN", "Yujin", "AN YUJIN"] },
    { "name": "가을", "aliases": ["GAEUL", "Gaeul"] }
  ],
  "songs": [
    { "title": "REBEL HEART", "aliases": ["레벨 하트", "Rebel Heart"], "release": "2025-01-13" }
  ],
  "sources": ["https://ko.wikipedia.org/wiki/아이브", "https://en.wikipedia.org/wiki/Ive_(group)"]
}
```

```bash
node scripts/archive.mjs roster /path/group.json --dry-run
node scripts/archive.mjs roster /path/group.json
node scripts/archive.mjs validate
```

- `!` 경고 중 “별칭을 두 멤버가 같이 써요”는 제목 해석이 헷갈리니 그 별칭을 빼요.
- 이미 있는 그룹을 보강할 때 순서까지 공식 순서로 다시 맞추려면 `--reorder`.

## 5. 이어서 담기·보고

원래 부탁이 영상 담기였으면 `add-videos` 스킬로 돌아가 같은 요청을 다시 실행해요. 커밋은 같은 PR에 함께 넣어도 돼요. 메시지: `그룹: <이름> 등록 (멤버 N, 곡 M)`.

보고에는 이것들을 넣어요.
- 등록한 멤버(순서, 영문 별칭, 활동 종료)와 곡(발매일)
- 참고한 자료 주소
- 자료끼리 달랐던 점
- 사용자가 확인하면 좋을 것(예: 멤버 순서가 공식 순서가 맞는지, 빠진 곡이 있는지)

// 상태 화면: 데이터 없음, 필터 결과 없음, JSON 로드 실패
import { html } from '../util.js';
import { DATA_VERSION } from '../model.js';

export function emptyDataHTML() {
  return html`<div class="state" role="status"><h2>아직 담아 둔 영상이 없어요</h2>
    <p>관리 화면에서 그룹을 만들고 첫 공연의 유튜브 링크를 붙여 넣으면 여기에 라인업이 생겨요.</p>
    <div class="row"><a class="btn btn-fill" href="admin.html">+ 담기</a></div></div>`;
}

export function noResultHTML(hasFilters) {
  if (hasFilters) {
    return html`<div class="state" role="status"><h2>조건에 맞는 영상이 없어요</h2>
      <p>걸린 필터를 풀면 다시 보여요.</p>
      <div class="row"><button type="button" class="btn btn-fill" data-act="clearFilters">필터 해제</button></div></div>`;
  }
  return html`<div class="state" role="status"><h2>이 그룹에는 아직 영상이 없어요</h2>
    <p>관리 화면에서 공연과 영상을 담아 보세요.</p><div class="row"><a class="btn btn-fill" href="admin.html">+ 담기</a></div></div>`;
}

export function loadErrorHTML(err) {
  const d = err.detail || {};
  let title, body;
  switch (err.kind) {
    case 'file':
      title = '파일을 직접 열어서 데이터를 못 읽었어요';
      body = html`<p>브라우저는 <code>file://</code>로 연 페이지에서 <code>data/videos.json</code>을 읽지 못하게 막아요. 저장소 폴더에서 <code>python3 -m http.server</code>를 실행하고 <code>http://localhost:8000</code>으로 여세요.</p>`;
      break;
    case 'path':
      title = '데이터 파일을 찾지 못했어요';
      body = html`<p><code>${d.url}</code> 요청이 ${d.status} 응답을 받았어요. 저장소 맨 위에서 서버를 열었는지, <code>data/videos.json</code> 경로와 대소문자가 맞는지 확인하세요.</p>`;
      break;
    case 'syntax':
      title = 'JSON 문법 오류가 있어요';
      body = html`<p><code>${d.url}</code>${d.line ? html`의 <b>${d.line}번째 줄 ${d.col}번째 글자</b> 근처` : ''}에서 읽기를 멈췄어요. 쉼표·따옴표·괄호를 확인하거나 <code>node scripts/validate.mjs</code>로 위치를 확인하세요.</p><p><code>${d.message || ''}</code></p>`;
      break;
    case 'version':
      title = '데이터 형식 버전이 달라요';
      body = html`<p>이 사이트는 version ${DATA_VERSION} 형식을 읽는데 파일은 version ${d.version == null ? '없음' : String(d.version)}이에요. 관리 화면의 가져오기에 파일을 올리면 version ${DATA_VERSION}으로 바꿔 줘요.</p>`;
      break;
    default:
      title = '데이터를 불러오지 못했어요';
      body = html`<p>네트워크 오류로 <code>data/videos.json</code>을 받지 못했어요. 서버가 켜져 있는지 확인하고 새로고침하세요.</p><p><code>${d.message || ''}</code></p>`;
  }
  return html`<div class="state" role="alert"><h2>${title}</h2>${body}
    <div class="row"><button type="button" class="btn" data-act="reload">새로고침</button><a class="btn btn-fill" href="admin.html">관리 화면</a></div></div>`;
}

// 저장: (A) GitHub에 바로 커밋(토큰) (B) 내 컴퓨터 저장소 폴더에 쓰기 (C) 내보내기(JSON + ZIP). 맨 아래 가져오기(고급)
import { html } from '../util.js';
import { validateData } from '../validate-core.js';
import { store, resetChanges, clearFiles, kvGet, kvSet, kvDel } from './store.js';
import { paint, toast, download } from './ui.js';
import { makeZip } from './zip.js';
import { renderImport } from './import.js';

let host = null;
const REPO_KEY = 'sd.repo';
const TOKEN_KEY = 'sd.token';

export function serialize() {
  const clean = JSON.parse(JSON.stringify(store.data, (k, v) => (k.startsWith('_') ? undefined : v)));
  return `${JSON.stringify(clean, null, 2)}\n`;
}

function repoInfo() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(REPO_KEY) || '{}'); } catch { /* 없음 */ }
  if (!saved.owner && /\.github\.io$/.test(location.hostname)) {
    saved.owner = location.hostname.split('.')[0];
    saved.repo = location.pathname.split('/')[1] || `${saved.owner}.github.io`;
  }
  return { owner: saved.owner || '', repo: saved.repo || '', branch: saved.branch || 'main' };
}
// 토큰은 기본으로 이 탭(sessionStorage)에만, "이 기기에 기억"을 켜면 localStorage에
const getToken = () => { try { return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; } };
const remembered = () => { try { return !!localStorage.getItem(TOKEN_KEY); } catch { return false; } };

async function dirHandle() { try { return await kvGet('dir'); } catch { return null; } }

async function paintAll() {
  const errors = validateData(JSON.parse(serialize()));
  const files = [...store.files.keys()].sort();
  const fsOk = 'showDirectoryPicker' in window;
  const dir = fsOk ? await dirHandle() : null;
  const ri = repoInfo();
  paint(host, html`
    <section class="card" aria-labelledby="s-h0"><h2 id="s-h0">저장할 내용</h2>
      <p class="desc">저장하지 않은 변경 <b class="num">${store.changes}</b>개 · 새 이미지·움짤 파일 <b class="num">${files.length}</b>개 · 영상 ${store.data.videos.length} · 공연 ${store.data.events.length} · 움짤 ${store.data.clips.length}</p>
      ${files.length ? html`<details><summary class="hint" style="cursor:pointer">새 파일 목록</summary><ul class="hint" style="margin-top:6px;display:grid;gap:2px">${files.map((f) => html`<li>${f}</li>`)}</ul></details>` : ''}
      ${errors.length ? html`<div class="notice err" style="margin-top:10px" role="alert"><b>검증 오류 ${errors.length}개</b> — 고치기 전에는 폴더 쓰기·커밋을 막아요.<div class="errlist" style="margin-top:6px">${errors.slice(0, 50).map((e) => html`<div>${e.text}</div>`)}</div></div>`
        : html`<p class="hint ok" style="margin-top:6px">검증 통과 (scripts/validate.mjs와 같은 규칙)</p>`}
    </section>

    <section class="card" aria-labelledby="s-hc"><h2 id="s-hc">A. GitHub에 바로 올리기 <span class="hint">권장</span></h2>
      <p class="desc">버튼 한 번으로 data/videos.json과 새 그림 파일을 커밋 하나로 올려요. Pages가 1~2분 뒤 새로 배포해요.</p>
      <div class="form-grid" style="margin-top:4px">
        <label class="field"><span>소유자(owner)</span><input data-repo="owner" value="${ri.owner}" autocomplete="off"></label>
        <label class="field"><span>저장소(repo)</span><input data-repo="repo" value="${ri.repo}" autocomplete="off"></label>
        <label class="field"><span>브랜치</span><input data-repo="branch" value="${ri.branch}" autocomplete="off"></label>
        <label class="field"><span>토큰</span><input type="password" id="s-token" value="${getToken()}" autocomplete="off" spellcheck="false" placeholder="github_pat_…"></label>
      </div>
      <label class="check" style="margin-top:8px"><input type="checkbox" id="s-remember" ${remembered() ? html`checked` : ''}>이 기기에 토큰 기억하기 (개인 기기에서만)</label>
      <div class="row-actions"><button type="button" class="btn btn-fill" data-act="commit" ${errors.length || !store.changes && !files.length ? html`disabled` : ''}>${store.changes || files.length ? `커밋으로 올리기 (변경 ${store.changes}${files.length ? ` · 파일 ${files.length}` : ''})` : '올릴 변경이 없어요'}</button>${getToken() ? html`<button type="button" class="btn btn-sm" data-act="forgetToken">토큰 지우기</button>` : ''}</div>
      <p class="hint" id="s-result"></p>
      <details class="hint" style="margin-top:6px"><summary style="cursor:pointer">토큰 만들기</summary>
        <p style="margin-top:6px">GitHub → Settings → Developer settings → Fine-grained tokens에서 “이 저장소만, Contents 읽기·쓰기” 권한으로 만들어요. 토큰은 주소나 저장소에 넣지 않고 이 브라우저에만 둬요. 공용 컴퓨터에서는 쓰지 말고, 다 쓰면 GitHub에서 지우는 게 안전해요.</p></details>
    </section>

    ${fsOk ? html`<section class="card" aria-labelledby="s-ha"><h2 id="s-ha">B. 내 컴퓨터의 저장소 폴더에 쓰기</h2>
      <p class="desc">Chrome·Edge 데스크톱에서만 돼요. 저장소를 내려받은 폴더(index.html이 있는 곳)를 연결하면 data/videos.json, thumbs/, clips/에 바로 써요. 그다음 직접 커밋·푸시하세요.</p>
      <p class="hint">${dir ? html`연결한 폴더: <b>${dir.name}</b>` : '아직 연결한 폴더가 없어요.'}</p>
      <div class="row-actions">
        <button type="button" class="btn" data-act="pick">${dir ? '다른 폴더 연결' : '저장소 폴더 연결'}</button>
        <button type="button" class="btn" data-act="write" ${dir && !errors.length ? '' : html`disabled`}>폴더에 쓰기</button>
        ${dir ? html`<button type="button" class="btn btn-sm" data-act="forget">연결 끊기</button>` : ''}
      </div></section>` : ''}

    <section class="card" aria-labelledby="s-hb"><h2 id="s-hb">${fsOk ? 'C. ' : 'B. '}파일로 내보내기</h2>
      <p class="desc">videos.json과 새 파일 ZIP을 받아 GitHub 웹에서 직접 올리는 방법이에요. 모든 브라우저에서 돼요.</p>
      <div class="row-actions">
        <button type="button" class="btn" data-act="copy">videos.json 복사</button>
        <button type="button" class="btn" data-act="json">videos.json 다운로드</button>
        <button type="button" class="btn" data-act="zip" ${files.length ? '' : html`disabled`}>새 파일 ZIP 다운로드 (${files.length})</button>
      </div>
      <ol class="steps">
        <li>GitHub 저장소 페이지에서 data/videos.json을 열고 연필(Edit) 또는 Upload files로 받은 videos.json으로 바꿔요.</li>
        <li>ZIP을 풀면 thumbs/, clips/, clips/posters/ 폴더가 나와요. 저장소의 같은 위치에 각 파일을 올려요(Add file → Upload files, 폴더째 끌어다 놓기 가능).</li>
        <li>Commit changes로 커밋하면 GitHub Actions가 검증하고 Pages가 1~2분 뒤 새로 배포해요.</li>
      </ol>
      ${files.length ? html`<button type="button" class="btn btn-sm" data-act="clearFiles">올렸어요 · 임시 파일 비우기</button>` : ''}
    </section>

    <details class="card adm-import"><summary><h2 style="display:inline">가져오기</h2> <span class="hint">고급 · videos.json 전체를 붙여 넣어 바꾸기</span></summary><div id="s-import" style="margin-top:12px"></div></details>`);
  const imp = host.querySelector('#s-import');
  if (imp) renderImport(imp);
}

// ---------- A ----------
async function pick() {
  try {
    const dir = await window.showDirectoryPicker({ id: 'stage-drawer', mode: 'readwrite' });
    let looks = false;
    try { await dir.getFileHandle('index.html'); looks = true; } catch { /* 없음 */ }
    if (!looks) toast('index.html이 없는 폴더예요. 저장소 맨 위 폴더인지 확인하세요.');
    await kvSet('dir', dir);
    paintAll();
  } catch (e) {
    if (e.name !== 'AbortError') toast(`폴더를 연결하지 못했어요 (${e.message}).`);
  }
}

async function writeTo(dir, path, data) {
  const parts = path.split('/');
  let d = dir;
  for (const p of parts.slice(0, -1)) d = await d.getDirectoryHandle(p, { create: true });
  const fh = await d.getFileHandle(parts[parts.length - 1], { create: true });
  const w = await fh.createWritable();
  await w.write(data);
  await w.close();
}

async function writeFolder() {
  const dir = await dirHandle();
  if (!dir) return;
  try {
    let perm = await dir.queryPermission({ mode: 'readwrite' });
    if (perm !== 'granted') perm = await dir.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') { toast('폴더 쓰기 권한이 없어요.'); return; }
    await writeTo(dir, 'data/videos.json', serialize());
    let n = 0;
    for (const [path, blob] of store.files) { await writeTo(dir, path, blob); n++; }
    await clearFiles();
    resetChanges();
    toast(`저장했어요: videos.json${n ? ` + 파일 ${n}개` : ''}. 이제 커밋·푸시하세요.`);
    paintAll();
  } catch (e) {
    toast(`쓰지 못했어요 (${e.message}).`);
  }
}

// ---------- B ----------
async function zipFiles() {
  const list = [...store.files.entries()].map(([name, data]) => ({ name, data }));
  const blob = await makeZip(list);
  download(`stage-drawer-files-${new Date().toISOString().slice(0, 10)}.zip`, blob);
}

// ---------- C ----------
const b64 = (blob) => new Promise((res, rej) => {
  const r = new FileReader();
  r.onload = () => res(String(r.result).split(',')[1]);
  r.onerror = () => rej(r.error);
  r.readAsDataURL(blob);
});

async function tokenCommit() {
  const ri = repoInfo();
  const token = host.querySelector('#s-token').value.trim();
  const out = host.querySelector('#s-result');
  if (!ri.owner || !ri.repo || !token) { toast('owner, repo, 토큰을 모두 넣어 주세요.'); return; }
  try {
    sessionStorage.setItem(TOKEN_KEY, token);
    if (host.querySelector('#s-remember')?.checked) localStorage.setItem(TOKEN_KEY, token); else localStorage.removeItem(TOKEN_KEY);
  } catch { /* 탭 메모리만 */ }
  const api = async (path, opts = {}) => {
    const res = await fetch(`https://api.github.com/repos/${encodeURIComponent(ri.owner)}/${encodeURIComponent(ri.repo)}${path}`, {
      ...opts,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.body ? { 'Content-Type': 'application/json' } : {}) },
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      throw new Error(`${res.status} ${j.message || res.statusText}`);
    }
    return res.json();
  };
  const btn = host.querySelector('[data-act="commit"]');
  btn.disabled = true;
  try {
    out.textContent = '브랜치 확인 중…';
    const ref = await api(`/git/ref/heads/${encodeURIComponent(ri.branch)}`);
    const parent = await api(`/git/commits/${ref.object.sha}`);
    out.textContent = '파일 올리는 중…';
    const tree = [];
    const jsonBlob = await api('/git/blobs', { method: 'POST', body: JSON.stringify({ content: serialize(), encoding: 'utf-8' }) });
    tree.push({ path: 'data/videos.json', mode: '100644', type: 'blob', sha: jsonBlob.sha });
    for (const [path, blob] of store.files) {
      const b = await api('/git/blobs', { method: 'POST', body: JSON.stringify({ content: await b64(blob), encoding: 'base64' }) });
      tree.push({ path, mode: '100644', type: 'blob', sha: b.sha });
    }
    const newTree = await api('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: parent.tree.sha, tree }) });
    const msg = `무대 서랍: 변경 ${store.changes}개${store.files.size ? `, 파일 ${store.files.size}개` : ''}`;
    const c = await api('/git/commits', { method: 'POST', body: JSON.stringify({ message: msg, tree: newTree.sha, parents: [ref.object.sha] }) });
    await api(`/git/refs/heads/${encodeURIComponent(ri.branch)}`, { method: 'PATCH', body: JSON.stringify({ sha: c.sha }) });
    await clearFiles();
    resetChanges();
    toast('커밋했어요. Pages가 곧 새로 배포해요.');
    await paintAll();
    const o2 = host.querySelector('#s-result');
    if (o2) o2.innerHTML = String(html`커밋 <a href="${`https://github.com/${ri.owner}/${ri.repo}/commit/${c.sha}`}" target="_blank" rel="noopener noreferrer">${c.sha.slice(0, 7)}</a>을 만들었어요.`);
  } catch (e) {
    out.textContent = `커밋하지 못했어요: ${e.message}. 토큰 권한(Contents 쓰기)과 owner/repo/브랜치를 확인하세요.`;
    btn.disabled = false;
  }
}

function bind() {
  host.addEventListener('change', (e) => {
    const t = e.target;
    if (t.id === 's-remember' && !t.checked) { try { localStorage.removeItem(TOKEN_KEY); } catch { /* 없음 */ } }
    if (t.dataset.repo) {
      const ri = repoInfo();
      ri[t.dataset.repo] = t.value.trim();
      try { localStorage.setItem(REPO_KEY, JSON.stringify(ri)); } catch { /* 없음 */ }
    }
  });
  host.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.type === 'checkbox' || b.closest('#s-import')) return;
    switch (b.dataset.act) {
      case 'pick': pick(); break;
      case 'write': writeFolder(); break;
      case 'forget': await kvDel('dir'); paintAll(); break;
      case 'copy':
        try { await navigator.clipboard.writeText(serialize()); toast('videos.json 내용을 복사했어요.'); } catch { toast('복사하지 못했어요. 다운로드를 쓰세요.'); }
        break;
      case 'json':
        download('videos.json', new Blob([serialize()], { type: 'application/json' }));
        resetChanges();
        toast(store.files.size ? 'videos.json을 받았어요. 새 파일 ZIP도 받아 함께 올리세요.' : 'videos.json을 받았어요. 저장소에 올리고 커밋하세요.');
        paintAll();
        break;
      case 'zip': zipFiles(); break;
      case 'clearFiles':
        if (b.dataset.armed) { await clearFiles(); toast('임시 파일을 비웠어요.'); paintAll(); }
        else { b.dataset.armed = '1'; b.textContent = '한 번 더 누르면 비워요'; }
        break;
      case 'commit': tokenCommit(); break;
      case 'forgetToken': try { sessionStorage.removeItem(TOKEN_KEY); localStorage.removeItem(TOKEN_KEY); } catch { /* 없음 */ } paintAll(); break;
      default:
    }
  });
}

export function renderSave(el) {
  host = el;
  paintAll();
  bind();
}

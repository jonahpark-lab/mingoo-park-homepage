// =========================================================
// Mingoo Park — 메인 화면 로직
// 데이터는 서버(/api)에서 받고, 권한(방문자/회원/관리자)에 따라 화면을 나눈다.
// =========================================================
import { SECTIONS, VISIBILITY } from './sections.js';

const ICONS = {
  user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  image:    '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  book:     '<path d="M5 4h11a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3z"/><path d="M5 17a3 3 0 0 1 3-3h11M9 8h6"/>',
  folder:   '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  note:     '<path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M14 3v6h6M8 13h8M8 17h5"/>',
  link:     '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/>',
  chat:     '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/>',
  mail:     '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="m3 7 9 6 9-6"/>',
  arrow:    '<path d="M5 12h14M13 6l6 6-6 6"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  trash:    '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  pen:      '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
  lock:     '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  eyeOff:   '<path d="M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.5 7.6A15 15 0 0 0 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  shield:   '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  logout:   '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
};
const VIS_ICON = { public: 'globe', members: 'lock', private: 'eyeOff' };
const ROLE_LABEL = { admin: '관리자', member: '회원', guest: '방문자' };
const icon = (name) => `<svg class="ico" viewBox="0 0 24 24">${ICONS[name]}</svg>`;

// ---------- 상태 ----------
let me = { user: null, googleClientId: null, devLogin: false };
let home = { role: 'guest', profile: {}, stats: {}, sections: [] };
const role = () => home.role;
const isAdmin = () => home.role === 'admin';
const secData = (id) => home.sections.find((s) => s.id === id);

// ---------- 유틸 ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    credentials: 'same-origin',
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `요청 실패 (${res.status})`);
  return data;
}

function defaultAvatar(name) {
  const ch = esc((name || 'M').trim().charAt(0).toUpperCase());
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c8b9ff"/><stop offset="1" stop-color="#8fe3cf"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><text x="50" y="62" font-family="Pretendard,sans-serif" font-size="42" font-weight="700" text-anchor="middle" fill="#fff">${ch}</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
}

// 업로드 이미지를 축소해 용량을 줄인다(JPEG)
function resizeImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s);
      c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- 데이터 ----------
async function refresh() {
  [me, home] = await Promise.all([api('/api/me'), api('/api/home')]);
  renderAll();
}

// ---------- 렌더링 ----------
function renderRole() {
  document.body.classList.remove('role-guest', 'role-member', 'role-admin');
  document.body.classList.add(`role-${role()}`);
  document.querySelectorAll('[data-admin]').forEach((el) => {
    el.dataset.view ??= el.textContent;
    el.textContent = isAdmin() ? el.dataset.admin : el.dataset.view;
  });
  $('#welcomeText').textContent = {
    guest: '자물쇠가 있는 공간은 로그인한 분만 볼 수 있어요. 오른쪽 위 로그인 버튼으로 들어오세요.',
    member: `${me.user?.name || ''}님, 반가워요! 회원에게 공개된 공간까지 모두 볼 수 있어요.`,
    admin: '관리자 모드예요. 각 공간에 내용을 작성하고, 공개 범위(공개·회원·비공개)를 정할 수 있어요.',
  }[role()];
  $('#spacesHint').textContent = isAdmin() ? '버튼을 눌러 내용을 작성하세요' : '버튼을 눌러 내용을 확인하세요';
  $('#avatarBtn').disabled = !isAdmin();
}

function renderProfile() {
  const p = home.profile;
  const avatar = p.avatar || defaultAvatar(p.name);
  $('#avatar').src = avatar;
  $('#navAvatar').src = me.user?.picture || defaultAvatar(me.user?.name);
  $('#profileName').textContent = p.name || 'Mingoo Park';
  $('#profileTagline').textContent = p.tagline || '';
  $('#greetName').textContent = (p.name || 'Mingoo').split(' ')[0];
  $('#statPhotos').textContent = home.stats.photos ?? 0;
  $('#statNotes').textContent = home.stats.notes ?? 0;
  $('#statDays').textContent = home.stats.days ?? 1;
}

function visBadge(visibility) {
  // 관리자에겐 모든 배지, 그 외엔 '회원 전용'만 표시
  if (!isAdmin() && visibility === 'public') return '';
  return `<span class="vis-badge ${visibility}">${icon(VIS_ICON[visibility])}${VISIBILITY[visibility].label}</span>`;
}

function renderTiles() {
  const visible = SECTIONS.filter((s) => secData(s.id));
  $('#tiles').innerHTML = visible.map((s) => {
    const d = secData(s.id);
    const sizes = (s.size || '').split(' ').filter(Boolean).join(' ');
    let body;
    if (d.locked) {
      body = s.type === 'gallery'
        ? `<div class="thumbs"><span class="ph"></span><span class="ph"></span><span class="ph"></span><span class="ph"></span></div>
           <span class="lock-note">${icon('lock')}로그인하면 볼 수 있어요</span>`
        : `<div class="lock-lines"><span></span><span></span><span></span></div>
           <span class="lock-note">${icon('lock')}로그인하면 볼 수 있어요</span>`;
    } else if (s.type === 'gallery') {
      const pics = (d.photos || []).slice(0, 4);
      const cells = pics.map((id) => `<img src="/api/photos/${id}" alt="" loading="lazy" />`);
      while (cells.length < 4) cells.push(`<span class="ph">${cells.length === pics.length && isAdmin() ? icon('plus') : ''}</span>`);
      body = `<div class="thumbs">${cells.join('')}</div>`;
    } else {
      const text = d.text?.trim();
      body = `<p class="tile-preview ${text ? '' : 'empty'}">${esc(text || s.desc)}</p>`;
    }
    return `
      <button class="tile glass tone-${s.tone} ${sizes} ${d.locked ? 'locked' : ''}" data-open="${s.id}"
        data-search="${esc(`${s.title} ${s.en} ${s.desc}`.toLowerCase())}">
        ${visBadge(d.visibility)}
        <div class="tile-row">
          <span class="tile-icon">${icon(d.locked ? 'lock' : s.icon)}</span>
          <div><div class="tile-title">${s.title}</div><div class="tile-en">${s.en}</div></div>
        </div>
        ${body}
        <span class="tile-go">${icon('arrow')}</span>
      </button>`;
  }).join('');
  applySearch();
}

function renderAll() { renderRole(); renderProfile(); renderTiles(); }

// ---------- 인사말 ----------
function renderGreeting() {
  const now = new Date();
  const h = now.getHours();
  $('#greeting').textContent = h < 6 ? '좋은 밤이에요' : h < 12 ? '좋은 아침이에요' : h < 18 ? '좋은 오후예요' : '좋은 저녁이에요';
  $('#today').textContent = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });
  $('#year').textContent = now.getFullYear();
}

// ---------- 검색 ----------
function applySearch() {
  const q = $('#search').value.trim().toLowerCase();
  document.querySelectorAll('.tile').forEach((t) => {
    const text = (secData(t.dataset.open)?.text || '').toLowerCase();
    t.classList.toggle('dim', !!q && !t.dataset.search.includes(q) && !text.includes(q));
  });
}

// ---------- 모달 공통 ----------
const modal = $('#modal');
let current = null;

function openModal({ title, desc, ico, tone, body, foot }) {
  modal.returnValue = '';
  $('#modalTitle').textContent = title;
  $('#modalDesc').textContent = desc;
  const mi = $('#modalIcon');
  mi.className = `tile-icon tone-${tone}`;
  mi.innerHTML = icon(ico);
  $('#modalBody').innerHTML = body;
  $('#modalFoot').innerHTML = foot;
  if (!modal.open) modal.showModal();
}
modal.addEventListener('click', (e) => { if (e.target === modal) modal.close('cancel'); });
modal.addEventListener('close', () => { current = null; });

const visControl = (name, value) => `
  <div class="seg" role="radiogroup" aria-label="공개 범위">
    ${Object.entries(VISIBILITY).map(([v, info]) => `
      <label title="${info.hint}">
        <input type="radio" name="${name}" value="${v}" ${v === value ? 'checked' : ''} />
        <span>${icon(VIS_ICON[v])}${info.label}</span>
      </label>`).join('')}
  </div>`;

// ---------- 공간 열기 ----------
function openSection(id) {
  const s = SECTIONS.find((x) => x.id === id);
  const d = secData(id);
  if (!s) return;
  if (!d || d.locked) {
    if (role() === 'guest') return openLogin(`'${s.title}'은(는) 로그인한 분만 볼 수 있는 공간이에요.`);
    return toast('볼 수 없는 공간이에요');
  }
  current = s;
  if (s.type === 'gallery') renderGalleryModal();
  else if (isAdmin()) renderTextEditor(s, d);
  else renderTextView(s, d);
}

function renderTextView(s, d) {
  const text = d.text?.trim();
  openModal({
    title: s.title, desc: s.desc, ico: s.icon, tone: s.tone,
    body: `<p class="readonly ${text ? '' : 'empty'}">${esc(text || '아직 작성된 내용이 없어요.')}</p>
      ${d.updatedAt ? `<span class="muted small">마지막 수정 · ${new Date(d.updatedAt).toLocaleString('ko-KR')}</span>` : ''}`,
    foot: `<button class="btn btn-glass" value="cancel">닫기</button>`,
  });
}

function renderTextEditor(s, d) {
  openModal({
    title: s.title, desc: s.desc, ico: s.icon, tone: s.tone,
    body: `
      <div class="field">공개 범위 ${visControl('vis', d.visibility)}</div>
      <label class="field">내용
        <textarea id="sectionText" placeholder="${esc(s.placeholder || '')}">${esc(d.text || '')}</textarea>
      </label>
      ${d.updatedAt ? `<span class="muted small">마지막 수정 · ${new Date(d.updatedAt).toLocaleString('ko-KR')}</span>` : ''}`,
    foot: `
      <button class="btn btn-glass" value="cancel">닫기</button>
      <button class="btn btn-violet" type="button" id="btnSave">저장</button>`,
  });
  setTimeout(() => $('#sectionText')?.focus(), 60);
  $('#btnSave').onclick = async () => {
    try {
      await api(`/api/sections/${s.id}`, {
        method: 'PUT',
        body: { text: $('#sectionText').value, visibility: $('#modalBody input[name="vis"]:checked').value },
      });
      modal.close('save');
      toast('저장했어요');
      await refresh();
    } catch (err) { toast(err.message); }
  };
}

function renderGalleryModal() {
  const s = SECTIONS.find((x) => x.id === 'gallery');
  const d = secData('gallery');
  const photos = d.photos || [];
  const admin = isAdmin();
  openModal({
    title: s.title, desc: s.desc, ico: s.icon, tone: s.tone,
    body: `
      ${admin ? `
        <div class="field">공개 범위 ${visControl('vis', d.visibility)}</div>
        <div class="drop" id="drop" role="button" tabindex="0">
          <span class="tile-icon tone-mint">${icon('plus')}</span>
          <strong>사진을 끌어다 놓거나 클릭해서 올리기</strong>
          <span class="muted small">여러 장 선택 가능 · 자동으로 크기 조정돼요</span>
        </div>` : ''}
      <div class="gallery-grid">
        ${photos.map((id, i) => `
          <figure class="gallery-item" style="margin:0">
            <a href="/api/photos/${id}" target="_blank" rel="noopener"><img src="/api/photos/${id}" alt="사진 ${i + 1}" loading="lazy" /></a>
            ${admin ? `<button type="button" data-del="${id}" aria-label="사진 삭제">${icon('trash')}</button>` : ''}
          </figure>`).join('')}
      </div>
      ${photos.length ? '' : '<p class="muted small" style="margin:0;text-align:center">아직 올린 사진이 없어요.</p>'}`,
    foot: `
      <span class="muted small spacer">${photos.length}장</span>
      <button class="btn btn-mint" value="cancel">${admin ? '완료' : '닫기'}</button>`,
  });
  if (!admin) return;

  $('#modalBody').querySelectorAll('input[name="vis"]').forEach((r) => {
    r.onchange = () => setVisibility('gallery', r.value);
  });
  const drop = $('#drop');
  drop.onclick = () => $('#fileInput').click();
  drop.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('#fileInput').click(); } };
  drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); addPhotos(e.dataTransfer.files); };
  $('#modalBody').querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('이 사진을 삭제할까요?')) return;
      try {
        await api(`/api/gallery/${b.dataset.del}`, { method: 'DELETE' });
        await refresh();
        renderGalleryModal();
      } catch (err) { toast(err.message); }
    };
  });
}

async function addPhotos(files) {
  const imgs = [...files].filter((f) => f.type.startsWith('image/'));
  if (!imgs.length || !isAdmin()) return;
  toast(`사진 ${imgs.length}장을 올리는 중…`);
  try {
    for (let i = 0; i < imgs.length; i += 5) {
      const batch = await Promise.all(imgs.slice(i, i + 5).map((f) => resizeImage(f)));
      await api('/api/gallery', { method: 'POST', body: { images: batch } });
    }
    toast(`사진 ${imgs.length}장을 올렸어요`);
  } catch (err) { toast(err.message); }
  await refresh();
  if (modal.open && current?.type === 'gallery') renderGalleryModal();
}

async function setVisibility(id, visibility) {
  try {
    await api(`/api/sections/${id}`, { method: 'PUT', body: { visibility } });
    const t = SECTIONS.find((s) => s.id === id)?.title;
    toast(`'${t}' → ${VISIBILITY[visibility].label}`);
    await refresh();
  } catch (err) { toast(err.message); }
}

// ---------- 관리자: 공개 설정 한눈에 ----------
function openVisibilityPanel() {
  current = { id: 'visibility' };
  openModal({
    title: '공개 설정', desc: '공간마다 누가 볼 수 있는지 정하세요 · 바로 적용돼요', ico: 'shield', tone: 'violet',
    body: `
      <p class="muted small" style="margin:0">
        ${Object.entries(VISIBILITY).map(([v, i]) => `<b>${i.label}</b> ${i.hint}`).join(' · ')}
      </p>
      ${SECTIONS.map((s) => `
        <div class="vis-row">
          <div class="who"><span class="tile-icon tone-${s.tone}">${icon(s.icon)}</span>
            <div><strong>${s.title}</strong><span class="muted small">${s.en}</span></div></div>
          ${visControl(`vis-${s.id}`, secData(s.id)?.visibility)}
        </div>`).join('')}`,
    foot: `<button class="btn btn-violet" value="cancel">완료</button>`,
  });
  SECTIONS.forEach((s) => {
    $('#modalBody').querySelectorAll(`input[name="vis-${s.id}"]`).forEach((r) => {
      r.onchange = () => setVisibility(s.id, r.value);
    });
  });
}

// ---------- 관리자: 프로필 ----------
function openProfile() {
  current = { id: 'profile' };
  const p = home.profile;
  openModal({
    title: '프로필 편집', desc: '이름, 한 줄 소개, 프로필 사진 · 누구에게나 보여요', ico: 'pen', tone: 'violet',
    body: `
      <div class="profile-edit">
        <button type="button" class="avatar-ring" id="avatarPick" aria-label="사진 변경"><img src="${p.avatar || defaultAvatar(p.name)}" alt="" /></button>
        <span class="muted small">사진을 눌러 변경하세요</span>
      </div>
      <label class="field">이름 <input id="pName" value="${esc(p.name)}" maxlength="40" /></label>
      <label class="field">한 줄 소개 <input id="pTagline" value="${esc(p.tagline)}" maxlength="80" /></label>`,
    foot: `
      <button class="btn btn-glass" value="cancel">닫기</button>
      <button class="btn btn-violet" type="button" id="btnSave">저장</button>`,
  });
  $('#avatarPick').onclick = () => $('#avatarInput').click();
  $('#btnSave').onclick = async () => {
    try {
      await api('/api/profile', { method: 'PUT', body: { name: $('#pName').value, tagline: $('#pTagline').value } });
      modal.close('save');
      toast('저장했어요');
      await refresh();
    } catch (err) { toast(err.message); }
  };
}

// ---------- 로그인 / 계정 ----------
let gsiReady = false;
function initGoogle() {
  if (gsiReady || !me.googleClientId || !window.google?.accounts?.id) return gsiReady;
  google.accounts.id.initialize({
    client_id: me.googleClientId,
    callback: onGoogleCredential,
    ux_mode: 'popup',
    auto_select: false,
  });
  gsiReady = true;
  return true;
}

async function onGoogleCredential({ credential }) {
  try {
    const { role: r } = await api('/api/auth/google', { method: 'POST', body: { credential } });
    if (modal.open) modal.close();
    await refresh();
    toast(`${ROLE_LABEL[r]}으로 로그인했어요`);
  } catch (err) { toast(err.message); }
}

function openLogin(reason = '') {
  current = { id: 'login' };
  openModal({
    title: '로그인', desc: 'Google 계정으로 들어오세요', ico: 'user', tone: 'violet',
    body: `
      <div class="login-box">
        <p>${esc(reason || '로그인하면 회원에게 공개된 공간까지 볼 수 있어요.')}</p>
        ${me.googleClientId
          ? '<div class="gsi-slot" id="gsiSlot"><span class="muted small">Google 버튼 불러오는 중…</span></div>'
          : `<div class="notice">구글 로그인이 아직 설정되지 않았어요.<br /><code>.env</code>의 <code>GOOGLE_CLIENT_ID</code>를 채운 뒤 서버를 다시 시작하세요.</div>`}
        ${me.devLogin ? `
          <div class="divider">로컬 테스트용</div>
          <div class="dev-row">
            <button type="button" class="btn btn-glass btn-sm" data-dev="member">회원으로 보기</button>
            <button type="button" class="btn btn-glass btn-sm" data-dev="admin">관리자로 보기</button>
          </div>` : ''}
      </div>`,
    foot: `<button class="btn btn-glass" value="cancel">닫기</button>`,
  });
  $('#modalBody').querySelectorAll('[data-dev]').forEach((b) => {
    b.onclick = async () => {
      await api('/api/auth/dev', { method: 'POST', body: { role: b.dataset.dev } });
      modal.close();
      await refresh();
      toast(`${ROLE_LABEL[b.dataset.dev]}(테스트)으로 로그인했어요`);
    };
  });
  if (!me.googleClientId) return;
  // GSI 스크립트는 async라 아직 안 왔을 수 있다
  const tryRender = (n = 0) => {
    const slot = $('#gsiSlot');
    if (!slot) return;
    if (!initGoogle()) {
      if (n > 50) slot.innerHTML = '<span class="muted small">Google 버튼을 불러오지 못했어요. 새로고침해 보세요.</span>';
      else setTimeout(() => tryRender(n + 1), 100);
      return;
    }
    slot.innerHTML = '';
    google.accounts.id.renderButton(slot, { theme: 'outline', size: 'large', shape: 'pill', text: 'signin_with', locale: 'ko', width: 260 });
  };
  tryRender();
}

function openAccount() {
  const u = me.user;
  if (!u) return openLogin();
  current = { id: 'account' };
  openModal({
    title: '내 계정', desc: '로그인 정보', ico: 'user', tone: 'violet',
    body: `
      <div class="account">
        <img src="${esc(u.picture || defaultAvatar(u.name))}" alt="" referrerpolicy="no-referrer" />
        <div>
          <strong>${esc(u.name)}</strong>
          <span class="muted small">${esc(u.email)}</span><br />
          <span class="role-pill ${u.role}">${ROLE_LABEL[u.role]}</span>
        </div>
      </div>
      ${u.role === 'admin' ? `
        <div class="dev-row">
          <button type="button" class="btn btn-glass btn-sm" id="accVis">${icon('shield')}공개 설정</button>
          <button type="button" class="btn btn-glass btn-sm" id="accProfile">${icon('pen')}프로필 편집</button>
        </div>` : ''}`,
    foot: `
      <button type="button" class="btn btn-danger" id="btnLogout">${icon('logout')}로그아웃</button>
      <span class="spacer"></span>
      <button class="btn btn-glass" value="cancel">닫기</button>`,
  });
  $('#accVis')?.addEventListener('click', openVisibilityPanel);
  $('#accProfile')?.addEventListener('click', openProfile);
  $('#btnLogout').onclick = async () => {
    await api('/api/auth/logout', { method: 'POST', body: {} });
    if (gsiReady) google.accounts.id.disableAutoSelect();
    modal.close();
    await refresh();
    toast('로그아웃했어요');
  };
}

// ---------- 이벤트 ----------
document.addEventListener('click', (e) => {
  const opener = e.target.closest('[data-open]');
  if (opener && !modal.contains(opener)) openSection(opener.dataset.open);
});
$('#btnLogin').onclick = () => openLogin();
$('#btnAccount').onclick = () => openAccount();
$('#btnProfileEdit').onclick = () => openProfile();
$('#btnVisibility').onclick = () => openVisibilityPanel();
$('#avatarBtn').onclick = () => { if (isAdmin()) $('#avatarInput').click(); };
$('#search').addEventListener('input', applySearch);
$('#fileInput').addEventListener('change', (e) => { addPhotos(e.target.files); e.target.value = ''; });
$('#avatarInput').addEventListener('change', async (e) => {
  const f = e.target.files[0];
  e.target.value = '';
  if (!f || !isAdmin()) return;
  try {
    const avatar = await resizeImage(f, 400);
    await api('/api/profile', { method: 'PUT', body: { avatar } });
    toast('프로필 사진을 바꿨어요');
    await refresh();
    const pick = $('#avatarPick img');
    if (pick) pick.src = avatar;
  } catch (err) { toast(err.message); }
});

renderGreeting();
refresh().catch((err) => toast(`서버에 연결하지 못했어요: ${err.message}`));

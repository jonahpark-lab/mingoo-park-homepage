// =========================================================
// Mingoo Park — 메인 화면 로직
// 데이터는 서버(/api)에서 받고, 등급(방문자 0 / 회원 1~7 / 관리자)에 따라 화면을 나눈다.
// =========================================================
import { SECTIONS, VIS_OPTIONS, ADMIN_LEVEL, MAX_LEVEL, AUTO_LEVELS, visLabel, visShort, normVis } from './sections.js';

const ICONS = {
  user:     '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>',
  users:    '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-5.5 6.5-5.5s6.5 2 6.5 5.5"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.6c2.2.6 3.5 2.4 3.5 5.4"/>',
  image:    '<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="9" cy="9" r="2"/><path d="m21 15-5-5L5 21"/>',
  cap:      '<path d="M2 9.5 12 5l10 4.5L12 14z"/><path d="M6 11.5V16c0 1.5 2.7 3 6 3s6-1.5 6-3v-4.5M22 9.5V15"/>',
  briefcase:'<rect x="3" y="7" width="18" height="13" rx="3"/><path d="M8 7V5.5A2.5 2.5 0 0 1 10.5 3h3A2.5 2.5 0 0 1 16 5.5V7M3 13h18"/>',
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
  up:       '<path d="m6 15 6-6 6 6"/>',
  down:     '<path d="m6 9 6 6 6-6"/>',
  lock:     '<rect x="5" y="11" width="14" height="10" rx="3"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  globe:    '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/>',
  eyeOff:   '<path d="M3 3l18 18M10.6 6.1A9 9 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.6 3.2M6.5 7.6A15 15 0 0 0 3 12s4 6 9 6a8.6 8.6 0 0 0 4-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  shield:   '<path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/>',
  logout:   '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l-5-5 5-5M5 12h11"/>',
  star:     '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
};
const ROLE_LABEL = { admin: '관리자', member: '회원', guest: '방문자' };
const icon = (name) => `<svg class="ico" viewBox="0 0 24 24">${ICONS[name]}</svg>`;
const visIcon = (v) => (v === 0 ? 'globe' : v === ADMIN_LEVEL ? 'eyeOff' : 'lock');
const visClass = (v) => (v === 0 ? 'lv-0' : v === ADMIN_LEVEL ? 'lv-8' : 'lv-n');

// ---------- 상태 ----------
let me = { user: null, googleClientId: null, devLogin: false };
let home = { role: 'guest', level: 0, profile: {}, stats: {}, sections: [] };
const role = () => home.role;
const isAdmin = () => home.role === 'admin';
const secData = (id) => home.sections.find((s) => s.id === id);
const secDef = (id) => SECTIONS.find((s) => s.id === id);

// ---------- 유틸 ----------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s = '') => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = (t) => (t ? new Date(t).toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }) : '-');
const fmtTime = (t) => (t ? new Date(t).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-');

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
function toast(msg, ms = 2400) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}
const celebrate = (lv) => toast(`🎉 축하해요! 회원 ${lv}등급이 되었어요`, 4000);

// 잠긴 공간/항목 안내 문구
function lockText(v) {
  if (role() === 'guest') return v <= 1 ? '로그인하면 볼 수 있어요' : `로그인 후 회원 ${v}등급부터 볼 수 있어요`;
  return `회원 ${v}등급부터 볼 수 있어요`;
}

// ---------- 데이터 ----------
async function refresh() {
  [me, home] = await Promise.all([api('/api/me'), api('/api/home')]);
  renderAll();
}

// 회원이면 방문 1회 기록(하루 인정 횟수/간격은 서버가 판단)
async function recordVisit() {
  if (role() !== 'member') return;
  try {
    const { promotedTo } = await api('/api/visit', { method: 'POST', body: {} });
    if (promotedTo) { celebrate(promotedTo); await refresh(); }
  } catch { /* 방문 기록 실패는 조용히 무시 */ }
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
    guest: '자물쇠가 있는 공간은 로그인한 회원만 볼 수 있어요. 방문하고 방명록을 남기면 등급이 올라 더 많은 내용을 볼 수 있어요.',
    member: `${me.user?.name || ''}님, 반가워요! 지금 회원 ${home.level}등급이에요. 오른쪽 위 내 사진을 눌러 다음 등급 조건을 확인하세요.`,
    admin: '관리자 모드예요. 공간과 학력·이력 항목마다 볼 수 있는 등급을 정하고, 회원 등급을 관리할 수 있어요.',
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

function visBadge(v, { always = false } = {}) {
  // 관리자에겐 모든 배지, 그 외엔 공개가 아닌 것만
  if (!always && !isAdmin() && v === 0) return '';
  return `<span class="vis-badge ${visClass(v)}">${icon(visIcon(v))}${visShort(v)}</span>`;
}

function tileBody(s, d) {
  if (d.locked) {
    const ph = s.type === 'gallery'
      ? '<div class="thumbs"><span class="ph"></span><span class="ph"></span><span class="ph"></span><span class="ph"></span></div>'
      : '<div class="lock-lines"><span></span><span></span><span></span></div>';
    return `${ph}<span class="lock-note">${icon('lock')}${lockText(d.visibility)}</span>`;
  }
  if (s.type === 'gallery') {
    const pics = (d.photos || []).slice(0, 4);
    const cells = pics.map((id) => `<img src="/api/photos/${id}" alt="" loading="lazy" />`);
    while (cells.length < 4) cells.push(`<span class="ph">${cells.length === pics.length && isAdmin() ? icon('plus') : ''}</span>`);
    return `<div class="thumbs">${cells.join('')}</div>`;
  }
  if (s.type === 'list') {
    const items = d.items || [];
    if (!items.length && !d.hiddenCount) return `<p class="tile-preview empty">${esc(s.desc)}</p>`;
    return `<ul class="tile-list">${items.slice(0, 3).map((i) => `<li>${esc(i.title)}<span class="muted">${esc(i.period)}</span></li>`).join('')}</ul>
      ${d.hiddenCount ? `<span class="lock-note">${icon('lock')}등급이 오르면 ${d.hiddenCount}개 더 볼 수 있어요</span>` : ''}`;
  }
  if (s.type === 'guestbook') {
    const e = d.entries?.[0];
    const text = e ? `${e.name}: ${e.text}` : d.text?.trim() || s.desc;
    return `<p class="tile-preview ${e || d.text ? '' : 'empty'}">${esc(text)}</p>`;
  }
  const text = d.text?.trim();
  return `<p class="tile-preview ${text ? '' : 'empty'}">${esc(text || s.desc)}</p>`;
}

function renderTiles() {
  $('#tiles').innerHTML = SECTIONS.filter((s) => secData(s.id)).map((s) => {
    const d = secData(s.id);
    const sizes = (s.size || '').split(' ').filter(Boolean).join(' ');
    return `
      <button class="tile glass tone-${s.tone} ${sizes} ${d.locked ? 'locked' : ''}" data-open="${s.id}"
        data-search="${esc(`${s.title} ${s.en} ${s.desc}`.toLowerCase())}">
        ${visBadge(d.visibility)}
        <div class="tile-row">
          <span class="tile-icon">${icon(d.locked ? 'lock' : s.icon)}</span>
          <div><div class="tile-title">${s.title}</div><div class="tile-en">${s.en}</div></div>
        </div>
        ${tileBody(s, d)}
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
    const d = secData(t.dataset.open) || {};
    const text = [d.text, ...(d.items || []).map((i) => `${i.title} ${i.detail}`)].join(' ').toLowerCase();
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

// 공개 등급 선택 상자 (0 전체 공개 ~ 7등급, 8 비공개)
const visSelect = (name, value, cls = '') => {
  const v = normVis(value);
  return `<select class="vis-select ${visClass(v)} ${cls}" ${name ? `name="${name}"` : ''} aria-label="공개 등급">
    ${VIS_OPTIONS.map((o) => `<option value="${o}" ${o === v ? 'selected' : ''}>${visLabel(o)}</option>`).join('')}
  </select>`;
};
document.addEventListener('change', (e) => {
  const sel = e.target.closest('.vis-select');
  if (sel && !sel.classList.contains('user-level')) {
    sel.classList.remove('lv-0', 'lv-n', 'lv-8');
    sel.classList.add(visClass(Number(sel.value)));
  }
});
const sectionVisRow = (d) => `<div class="field-row">이 공간을 볼 수 있는 등급 ${visSelect('vis', d.visibility)}</div>`;
const readVis = () => Number($('#modalBody select[name="vis"]').value);

// ---------- 공간 열기 ----------
function openSection(id) {
  const s = secDef(id);
  const d = secData(id);
  if (!s) return;
  if (!d || d.locked) {
    if (role() === 'guest') return openLogin(d ? `'${s.title}'은(는) ${lockText(d.visibility)}.` : '');
    return toast(d ? `'${s.title}'은(는) ${lockText(d.visibility)} · 지금 ${home.level}등급` : '볼 수 없는 공간이에요', 3200);
  }
  current = s;
  if (s.type === 'gallery') renderGalleryModal();
  else if (s.type === 'list') (isAdmin() ? renderListEditor : renderListView)(s, d);
  else if (s.type === 'guestbook') renderGuestbookModal();
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
      ${sectionVisRow(d)}
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
      await api(`/api/sections/${s.id}`, { method: 'PUT', body: { text: $('#sectionText').value, visibility: readVis() } });
      modal.close('save');
      toast('저장했어요');
      await refresh();
    } catch (err) { toast(err.message); }
  };
}

// ---------- 학력 / 이력 (항목마다 공개 등급) ----------
function renderListView(s, d) {
  const items = d.items || [];
  const hidden = d.hiddenCount
    ? `<div class="hidden-note">${icon('lock')}${role() === 'guest' ? '로그인하고 등급이 오르면' : '등급이 오르면'} 볼 수 있는 항목이 ${d.hiddenCount}개 더 있어요</div>`
    : '';
  openModal({
    title: s.title, desc: s.desc, ico: s.icon, tone: s.tone,
    body: items.length
      ? `<ul class="timeline tone-${s.tone}">${items.map((i) => `
          <li>${i.level > 0 ? visBadge(i.level) : ''}<strong>${esc(i.title)}</strong>
            ${i.period ? `<span class="period">${esc(i.period)}</span>` : ''}
            ${i.detail ? `<p>${esc(i.detail)}</p>` : ''}</li>`).join('')}</ul>${hidden}`
      : `${hidden || '<p class="readonly empty">아직 등록된 항목이 없어요.</p>'}`,
    foot: `<button class="btn btn-glass" value="cancel">닫기</button>`,
  });
}

let draft = [];
function renderListEditor(s, d) {
  draft = (d.items || []).map((i) => ({ ...i }));
  openModal({
    title: `${s.title} 편집`, desc: '항목마다 볼 수 있는 등급을 정할 수 있어요', ico: s.icon, tone: s.tone,
    body: `
      ${sectionVisRow(d)}
      <p class="muted small" style="margin:0">공간을 볼 수 있어도 항목의 등급이 더 높으면 그 항목은 보이지 않아요. 예) 「AAA 대학교 졸업」 → 회원 2등급 이상</p>
      <div id="itemEds" style="display:grid;gap:10px"></div>
      <button type="button" class="add-btn" id="addItem">${icon('plus')}항목 추가</button>`,
    foot: `
      <button class="btn btn-glass" value="cancel">닫기</button>
      <button class="btn btn-violet" type="button" id="btnSave">저장</button>`,
  });
  drawItems(s);
  $('#addItem').onclick = () => {
    syncDraft();
    draft.push({ title: '', period: '', detail: '', level: 0 });
    drawItems(s);
    $('#itemEds .item-ed:last-child .title')?.focus();
  };
  $('#btnSave').onclick = async () => {
    syncDraft();
    try {
      await api(`/api/sections/${s.id}/items`, { method: 'PUT', body: { items: draft } });
      if (readVis() !== d.visibility) await api(`/api/sections/${s.id}`, { method: 'PUT', body: { visibility: readVis() } });
      modal.close('save');
      toast('저장했어요');
      await refresh();
    } catch (err) { toast(err.message); }
  };
}

function syncDraft() {
  document.querySelectorAll('#itemEds .item-ed').forEach((el, i) => {
    Object.assign(draft[i], {
      title: $('.title', el).value,
      period: $('.period', el).value,
      detail: $('.detail', el).value,
      level: Number($('.vis-select', el).value),
    });
  });
}

function drawItems(s) {
  const f = s.fields || {};
  $('#itemEds').innerHTML = draft.length ? draft.map((it, i) => `
    <div class="item-ed">
      <div class="row">
        <input class="title" placeholder="${esc(f.title || '제목')}" value="${esc(it.title)}" maxlength="100" />
        <input class="period" placeholder="${esc(f.period || '기간')}" value="${esc(it.period)}" maxlength="50" />
      </div>
      <textarea class="detail" placeholder="${esc(f.detail || '설명 (선택)')}" maxlength="500">${esc(it.detail)}</textarea>
      <div class="tools">
        ${visSelect('', it.level)}
        <span class="spacer"></span>
        <button type="button" class="mini-btn" data-move="-1" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="위로">${icon('up')}</button>
        <button type="button" class="mini-btn" data-move="1" data-i="${i}" ${i === draft.length - 1 ? 'disabled' : ''} aria-label="아래로">${icon('down')}</button>
        <button type="button" class="mini-btn danger" data-remove="${i}" aria-label="삭제">${icon('trash')}</button>
      </div>
    </div>`).join('') : '<p class="muted small" style="margin:0;text-align:center">아직 항목이 없어요. 아래 버튼으로 추가하세요.</p>';
  $('#itemEds').querySelectorAll('[data-move]').forEach((b) => {
    b.onclick = () => {
      syncDraft();
      const i = Number(b.dataset.i), j = i + Number(b.dataset.move);
      [draft[i], draft[j]] = [draft[j], draft[i]];
      drawItems(s);
    };
  });
  $('#itemEds').querySelectorAll('[data-remove]').forEach((b) => {
    b.onclick = () => { syncDraft(); draft.splice(Number(b.dataset.remove), 1); drawItems(s); };
  });
}

// ---------- 갤러리 ----------
function renderGalleryModal() {
  const s = secDef('gallery');
  const d = secData('gallery');
  const photos = d.photos || [];
  const admin = isAdmin();
  openModal({
    title: s.title, desc: s.desc, ico: s.icon, tone: s.tone,
    body: `
      ${admin ? `
        ${sectionVisRow(d)}
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

  $('#modalBody select[name="vis"]').onchange = (e) => setVisibility('gallery', Number(e.target.value));
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
    toast(`'${secDef(id)?.title}' → ${visLabel(visibility)}`);
    await refresh();
  } catch (err) { toast(err.message); }
}

// ---------- 방명록 ----------
function renderGuestbookModal() {
  const s = secDef('guestbook');
  const d = secData('guestbook');
  const admin = isAdmin();
  const entries = d.entries || [];
  openModal({
    title: s.title, desc: s.desc, ico: s.icon, tone: s.tone,
    body: `
      ${admin ? `
        ${sectionVisRow(d)}
        <label class="field">맨 위 인사말
          <textarea id="gbIntro" style="min-height:70px" placeholder="${esc(s.placeholder)}">${esc(d.text || '')}</textarea>
        </label>
        <div style="display:flex;justify-content:flex-end"><button type="button" class="btn btn-glass btn-sm" id="gbIntroSave">인사말·공개 등급 저장</button></div>`
      : d.text?.trim() ? `<p class="readonly" style="min-height:0">${esc(d.text)}</p>` : ''}
      ${d.canWrite ? `
        <div class="gb-write">
          <label class="field">한마디 남기기
            <textarea id="gbText" maxlength="500" placeholder="반가워요! 응원의 한마디를 남겨 주세요."></textarea>
          </label>
          <div class="row">
            <span class="muted small">${role() === 'member' ? '방명록을 남기면 등급 조건의 “글 작성”으로 인정돼요' : ''}</span>
            <button type="button" class="btn btn-mint btn-sm" id="gbPost">남기기</button>
          </div>
        </div>`
      : `<div class="hidden-note">${icon('lock')}로그인하면 방명록을 남길 수 있어요
           <span class="spacer" style="flex:1"></span><button type="button" class="btn btn-violet btn-sm" id="gbLogin">로그인</button></div>`}
      <div class="gb-list">
        ${entries.map((e) => `
          <div class="gb-entry ${e.mine ? 'mine' : ''}">
            <img src="${esc(e.picture || defaultAvatar(e.name))}" alt="" referrerpolicy="no-referrer" />
            <div><strong>${esc(e.name)}</strong> <span class="muted small">${fmtTime(e.createdAt)}</span><p>${esc(e.text)}</p></div>
            ${e.canDelete ? `<button type="button" class="mini-btn danger" data-gbdel="${e.id}" aria-label="삭제">${icon('trash')}</button>` : '<span></span>'}
          </div>`).join('') || '<p class="muted small" style="margin:0;text-align:center">아직 남겨진 글이 없어요. 첫 글을 남겨 보세요!</p>'}
      </div>`,
    foot: `<span class="muted small spacer">${entries.length}개의 글</span><button class="btn btn-glass" value="cancel">닫기</button>`,
  });
  current = s;
  $('#gbLogin')?.addEventListener('click', () => openLogin('로그인하면 방명록을 남길 수 있어요.'));
  $('#gbIntroSave')?.addEventListener('click', async () => {
    try {
      await api('/api/sections/guestbook', { method: 'PUT', body: { text: $('#gbIntro').value, visibility: readVis() } });
      toast('저장했어요');
      await refresh();
      renderGuestbookModal();
    } catch (err) { toast(err.message); }
  });
  $('#gbPost')?.addEventListener('click', async () => {
    const text = $('#gbText').value.trim();
    if (!text) return toast('내용을 적어 주세요');
    try {
      const { promotedTo } = await api('/api/guestbook', { method: 'POST', body: { text } });
      await refresh();
      renderGuestbookModal();
      if (promotedTo) celebrate(promotedTo); else toast('방명록을 남겼어요');
    } catch (err) { toast(err.message); }
  });
  $('#modalBody').querySelectorAll('[data-gbdel]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('이 글을 삭제할까요?')) return;
      try {
        await api(`/api/guestbook/${b.dataset.gbdel}`, { method: 'DELETE' });
        await refresh();
        renderGuestbookModal();
      } catch (err) { toast(err.message); }
    };
  });
}

// ---------- 관리자: 공개 설정 한눈에 ----------
function openVisibilityPanel() {
  current = { id: 'visibility' };
  openModal({
    title: '공개 설정', desc: '공간마다 볼 수 있는 등급을 정하세요 · 바로 적용돼요', ico: 'shield', tone: 'violet',
    body: `
      <p class="muted small" style="margin:0">전체 공개 = 로그인 없이 · 회원 N등급 이상 = 로그인 + 등급 · 비공개 = 관리자만.
        학력·이력은 항목마다 따로 정할 수 있어요(각 공간 편집 창).</p>
      ${SECTIONS.map((s) => `
        <div class="vis-row">
          <div class="who"><span class="tile-icon tone-${s.tone}">${icon(s.icon)}</span>
            <div><strong>${s.title}</strong><span class="muted small">${s.en}</span></div></div>
          ${visSelect(`vis-${s.id}`, secData(s.id)?.visibility)}
        </div>`).join('')}`,
    foot: `<button class="btn btn-violet" value="cancel">완료</button>`,
  });
  SECTIONS.forEach((s) => {
    $(`#modalBody select[name="vis-${s.id}"]`).onchange = (e) => setVisibility(s.id, Number(e.target.value));
  });
}

// ---------- 관리자: 회원 관리 / 등급 규칙 ----------
async function openMembersPanel(tab = 'users') {
  current = { id: 'members' };
  let users = [], rules = null;
  try {
    [{ users }, rules] = await Promise.all([api('/api/admin/users'), api('/api/admin/rules')]);
  } catch (err) { return toast(err.message); }

  const userRows = users.map((u) => {
    const last = u.history?.at(-1);
    return `
      <div class="member-row">
        <img src="${esc(u.picture || defaultAvatar(u.name))}" alt="" referrerpolicy="no-referrer" />
        <div>
          <strong>${esc(u.name)}</strong> ${u.isAdmin ? '<span class="role-pill">관리자</span>' : `<span class="level-pill ${u.level >= 5 ? 'high' : ''}">${u.level}등급</span>`}
          <span class="meta">${esc(u.email)}</span>
          <span class="meta">방문 ${u.visits}회 · 글 ${u.posts}개 · 가입 ${fmtDate(u.createdAt)} · 최근 로그인 ${fmtDate(u.lastLoginAt)}</span>
          ${last ? `<span class="meta">최근 변경: ${last.from}→${last.to}등급 (${last.by === 'auto' ? '자동' : '관리자'}, ${fmtDate(last.at)})</span>` : ''}
        </div>
        ${u.isAdmin ? '<span></span>' : `
          <select class="vis-select user-level" data-sub="${esc(u.sub)}" aria-label="${esc(u.name)} 등급">
            ${Array.from({ length: MAX_LEVEL }, (_, i) => i + 1).map((n) => `<option value="${n}" ${n === u.level ? 'selected' : ''}>${n}등급${n >= 5 ? ' (승인)' : ''}</option>`).join('')}
          </select>`}
      </div>`;
  }).join('') || '<p class="muted small" style="margin:0;text-align:center">아직 가입한 회원이 없어요.</p>';

  const ruleRows = AUTO_LEVELS.map((lv) => {
    const r = rules.levels[lv];
    return `
      <div class="rule-row" data-lv="${lv}">
        <strong>${lv}등급</strong>
        <label class="check"><input type="checkbox" class="r-auto" ${r.auto ? 'checked' : ''} /> 자동 등업</label>
        <label>방문 (회)<input type="number" class="r-visits" min="0" value="${r.visits}" /></label>
        <label>글 작성 (개)<input type="number" class="r-posts" min="0" value="${r.posts}" /></label>
      </div>`;
  }).join('');

  openModal({
    title: '회원 관리', desc: '회원 등급을 직접 바꾸거나 자동 등업 규칙을 정하세요', ico: 'users', tone: 'violet',
    body: `
      <div class="tabs" role="tablist">
        <button type="button" data-tab="users" class="${tab === 'users' ? 'on' : ''}">회원 ${users.length}명</button>
        <button type="button" data-tab="rules" class="${tab === 'rules' ? 'on' : ''}">등급 규칙</button>
      </div>
      ${tab === 'users' ? `
        <p class="muted small" style="margin:0">모든 등급은 관리자가 직접 올리거나 내릴 수 있어요. 5~7등급은 관리자 승인으로만 올라가요.</p>
        <div style="display:grid;gap:10px">${userRows}</div>` : `
        <p class="muted small" style="margin:0">조건을 모두 채우면 다음 등급으로 자동으로 올라가요(내려가지는 않아요). 글 작성 = 방명록 글 수.</p>
        <div class="rule-row">
          <strong>방문</strong>
          <label>하루 인정 (회)<input type="number" id="rPerDay" min="1" max="20" value="${rules.visitsPerDay}" /></label>
          <label>최소 간격 (분)<input type="number" id="rGap" min="0" max="1440" value="${rules.visitGapMinutes}" /></label>
          <span></span>
        </div>
        <div class="rules">${ruleRows}
          <div class="rule-row locked"><strong>5~7등급</strong><span style="grid-column: span 3">관리자 승인으로만 올라가요</span></div>
        </div>`}`,
    foot: tab === 'users'
      ? `<button class="btn btn-violet" value="cancel">완료</button>`
      : `<button class="btn btn-glass" value="cancel">닫기</button><button class="btn btn-violet" type="button" id="btnSaveRules">규칙 저장</button>`,
  });
  $('#modalBody').querySelectorAll('[data-tab]').forEach((b) => { b.onclick = () => openMembersPanel(b.dataset.tab); });
  $('#modalBody').querySelectorAll('.user-level').forEach((sel) => {
    sel.onchange = async () => {
      try {
        await api(`/api/admin/users/${encodeURIComponent(sel.dataset.sub)}`, { method: 'PUT', body: { level: Number(sel.value) } });
        toast(`${sel.value}등급으로 변경했어요`);
        openMembersPanel('users');
      } catch (err) { toast(err.message); }
    };
  });
  $('#btnSaveRules')?.addEventListener('click', async () => {
    const levels = {};
    document.querySelectorAll('.rule-row[data-lv]').forEach((row) => {
      levels[row.dataset.lv] = {
        auto: $('.r-auto', row).checked,
        visits: Number($('.r-visits', row).value),
        posts: Number($('.r-posts', row).value),
      };
    });
    try {
      await api('/api/admin/rules', { method: 'PUT', body: { visitsPerDay: Number($('#rPerDay').value), visitGapMinutes: Number($('#rGap').value), levels } });
      toast('등급 규칙을 저장했어요');
      openMembersPanel('rules');
    } catch (err) { toast(err.message); }
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

async function afterLogin(msg) {
  if (modal.open) modal.close();
  await refresh();
  toast(msg);
  await recordVisit();
}

async function onGoogleCredential({ credential }) {
  try {
    const { role: r } = await api('/api/auth/google', { method: 'POST', body: { credential } });
    await afterLogin(`${ROLE_LABEL[r]}으로 로그인했어요`);
  } catch (err) { toast(err.message); }
}

function openLogin(reason = '') {
  current = { id: 'login' };
  openModal({
    title: '로그인', desc: 'Google 계정으로 들어오세요', ico: 'user', tone: 'violet',
    body: `
      <div class="login-box">
        <p>${esc(reason || '로그인하면 회원 1등급으로 시작해요. 방문하고 방명록을 남기면 등급이 올라가요.')}</p>
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
      await afterLogin(`${ROLE_LABEL[b.dataset.dev]}(테스트)으로 로그인했어요`);
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

function progressBlock(u) {
  const n = u.next;
  if (!n) return `<div class="progress"><h5>${icon('star')} 최고 등급(7등급)이에요!</h5></div>`;
  if (!n.auto) return `<div class="progress"><h5>다음 ${n.level}등급</h5><span class="muted small">${n.level}등급부터는 관리자 승인으로 올라가요.</span></div>`;
  const bar = (label, have, need) => `
    <div class="bar"><span><b>${label}</b><span>${Math.min(have, need)} / ${need}</span></span>
      <i><b style="width:${need ? Math.min(100, (have / need) * 100) : 100}%"></b></i></div>`;
  const vr = u.visitRule;
  return `
    <div class="progress">
      <h5>다음 ${n.level}등급까지</h5>
      ${bar('방문', u.visits, n.visits)}
      ${bar('방명록 글', u.posts, n.posts)}
      ${vr ? `<span class="muted small">방문은 하루 ${vr.visitsPerDay}회까지${vr.visitGapMinutes ? `, ${vr.visitGapMinutes}분 이상 간격으로` : ''} 인정돼요. 조건을 채우면 자동으로 올라가요.</span>` : ''}
    </div>`;
}

function openAccount() {
  const u = me.user;
  if (!u) return openLogin();
  current = { id: 'account' };
  const pill = u.role === 'admin'
    ? '<span class="role-pill">관리자</span>'
    : `<span class="level-pill ${u.level >= 5 ? 'high' : ''}">${icon('star')}회원 ${u.level}등급</span>`;
  openModal({
    title: '내 계정', desc: '로그인 정보와 등급', ico: 'user', tone: 'violet',
    body: `
      <div class="account">
        <img src="${esc(u.picture || defaultAvatar(u.name))}" alt="" referrerpolicy="no-referrer" />
        <div>
          <strong>${esc(u.name)}</strong>
          <span class="muted small">${esc(u.email)}</span><br />
          ${pill}
          ${u.role === 'member' ? `<span class="muted small">&nbsp;방문 ${u.visits}회 · 글 ${u.posts}개</span>` : ''}
        </div>
      </div>
      ${u.role === 'member' ? progressBlock(u) : ''}
      ${u.role === 'admin' ? `
        <div class="dev-row" style="flex-wrap:wrap">
          <button type="button" class="btn btn-glass btn-sm" id="accMembers">${icon('users')}회원 관리</button>
          <button type="button" class="btn btn-glass btn-sm" id="accVis">${icon('shield')}공개 설정</button>
          <button type="button" class="btn btn-glass btn-sm" id="accProfile">${icon('pen')}프로필 편집</button>
        </div>` : ''}`,
    foot: `
      <button type="button" class="btn btn-danger" id="btnLogout">${icon('logout')}로그아웃</button>
      <span class="spacer"></span>
      <button class="btn btn-glass" value="cancel">닫기</button>`,
  });
  $('#accMembers')?.addEventListener('click', () => openMembersPanel());
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
$('#btnMembers').onclick = () => openMembersPanel();
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
refresh()
  .then(recordVisit)
  .catch((err) => toast(`서버에 연결하지 못했어요: ${err.message}`));

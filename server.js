import express from 'express';
import cookieSession from 'cookie-session';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';
import { SECTIONS, VIS_OPTIONS, AUTO_LEVELS, ADMIN_LEVEL, MAX_LEVEL, canView, normVis } from './public/js/sections.js';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4100; // Railway가 PORT를 주입한다. 로컬은 4100 고정(구글 로그인 허용 주소와 일치해야 함)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
// 테스트 로그인은 로컬 전용 — Railway/production 환경에서는 값이 있어도 꺼진다
const IS_DEPLOYED = Boolean(process.env.RAILWAY_ENVIRONMENT || process.env.RAILWAY_PROJECT_ID) || process.env.NODE_ENV === 'production';
const DEV_LOGIN = process.env.DEV_LOGIN === '1' && !IS_DEPLOYED;
if (process.env.DEV_LOGIN === '1' && IS_DEPLOYED) console.warn('⚠️  배포 환경이라 DEV_LOGIN을 무시합니다. Variables에서 지워 주세요.');

let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('⚠️  SESSION_SECRET이 없어 임시 값을 사용합니다. 서버를 재시작하면 모두 로그아웃됩니다.');
}
if (!GOOGLE_CLIENT_ID) console.warn('⚠️  GOOGLE_CLIENT_ID가 없어 구글 로그인이 비활성화됩니다.');
if (!ADMIN_EMAILS.length) console.warn('⚠️  ADMIN_EMAILS가 비어 있어 관리자가 없습니다.');

const google = new OAuth2Client(GOOGLE_CLIENT_ID);
const app = express();
app.set('trust proxy', 1); // Railway 프록시 뒤에서 https 판별

app.use(express.json({ limit: '25mb' }));
app.use(cookieSession({
  name: 'mp_session',
  keys: [SESSION_SECRET],
  maxAge: 30 * 24 * 60 * 60 * 1000,
  httpOnly: true,
  sameSite: 'lax',
}));
app.use((req, res, next) => {
  req.sessionOptions.secure = req.secure; // https일 때만 secure 쿠키
  next();
});

// 다른 사이트에서 보낸 변경 요청 차단
app.use('/api', (req, res, next) => {
  if (req.method === 'GET' || req.method === 'HEAD') return next();
  const origin = req.get('origin');
  if (!origin) return next();
  let host = '';
  try { host = new URL(origin).host; } catch { /* 'null' 등 */ }
  if (host !== req.get('host')) return res.status(403).json({ error: 'bad origin' });
  next();
});

// ---------- 권한 ----------
// 방문자 level 0, 회원 level 1~7(저장된 등급), 관리자 level 8
const GUEST = { role: 'guest', level: 0 };
const isLocalhost = (req) => ['localhost', '127.0.0.1', '::1'].includes(req.hostname);

function viewer(req) {
  const u = req.session?.user;
  if (!u) return GUEST;
  if (u.dev && !(DEV_LOGIN && isLocalhost(req))) return GUEST;
  const isAdmin = u.dev ? u.devRole === 'admin' : ADMIN_EMAILS.includes(u.email.toLowerCase());
  if (isAdmin) return { ...u, role: 'admin', level: ADMIN_LEVEL };
  const rec = store.getUser(u.sub);
  if (!rec) return GUEST; // 데이터가 초기화된 경우 — 다시 로그인하면 1등급으로 가입
  return { ...u, role: 'member', level: rec.level };
}
function requireAdmin(req, res, next) {
  if (viewer(req).role !== 'admin') return res.status(403).json({ error: '관리자만 할 수 있어요' });
  next();
}
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

// 다음 등급까지 필요한 조건
function nextStep(rec) {
  if (rec.level >= MAX_LEVEL) return null;
  const level = rec.level + 1;
  const r = store.getRules().levels[level];
  if (AUTO_LEVELS.includes(level) && r?.auto) return { level, auto: true, visits: r.visits, posts: r.posts };
  return { level, auto: false };
}

// ---------- 인증 API ----------
app.get('/api/me', (req, res) => {
  const v = viewer(req);
  let user = null;
  if (v.role !== 'guest') {
    user = { name: v.name, email: v.email, picture: v.picture, role: v.role, level: v.level };
    const rec = store.getUser(v.sub);
    if (rec) {
      const { visitsPerDay, visitGapMinutes } = store.getRules();
      Object.assign(user, {
        visits: rec.visits, posts: store.postsOf(v.sub),
        next: v.role === 'member' ? nextStep(rec) : null,
        visitRule: { visitsPerDay, visitGapMinutes },
      });
    }
  }
  res.json({ user, googleClientId: GOOGLE_CLIENT_ID || null, devLogin: DEV_LOGIN && isLocalhost(req) });
});

app.post('/api/auth/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: '구글 로그인이 설정되지 않았어요' });
  let p;
  try {
    const ticket = await google.verifyIdToken({ idToken: String(req.body?.credential || ''), audience: GOOGLE_CLIENT_ID });
    p = ticket.getPayload();
  } catch {
    return res.status(401).json({ error: '로그인 확인에 실패했어요' });
  }
  if (!p?.email || !p.email_verified) return res.status(401).json({ error: '이메일 인증이 필요한 계정이에요' });
  const user = { sub: p.sub, email: p.email, name: p.name || p.email, picture: p.picture || '' };
  await store.upsertUser(user);
  req.session.user = user;
  res.json({ ok: true, role: viewer(req).role });
});

// 로컬 개발용 가짜 로그인 (.env에 DEV_LOGIN=1, localhost에서만)
app.post('/api/auth/dev', async (req, res) => {
  if (!DEV_LOGIN || !isLocalhost(req)) return res.status(404).end();
  const devRole = req.body?.role === 'admin' ? 'admin' : 'member';
  const user = { dev: true, devRole, sub: `dev-${devRole}`, email: `dev-${devRole}@localhost`, name: devRole === 'admin' ? '개발용 관리자' : '개발용 회원', picture: '' };
  await store.upsertUser(user);
  req.session.user = user;
  res.json({ ok: true, role: devRole });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// 방문 기록(회원만) — 페이지를 열 때 한 번 호출
app.post('/api/visit', async (req, res) => {
  const v = viewer(req);
  if (v.role !== 'member') return res.json({ counted: false, promotedTo: null });
  res.json(await store.recordVisit(v.sub));
});

// ---------- 콘텐츠 API ----------
app.get('/api/home', (req, res) => {
  const v = viewer(req);
  const admin = v.role === 'admin';
  const db = store.getDb();
  const sections = [];
  for (const s of SECTIONS) {
    const visibility = store.visibilityOf(s.id);
    if (!canView(v.level, visibility)) {
      if (visibility < ADMIN_LEVEL) sections.push({ id: s.id, visibility, locked: true }); // 비공개는 존재 자체를 숨김
      continue;
    }
    const data = db.sections[s.id] || {};
    const item = { id: s.id, visibility, locked: false, text: data.text || '', updatedAt: data.updatedAt || null };
    if (s.type === 'gallery') item.photos = db.gallery.map((p) => p.id);
    if (s.type === 'list') {
      const all = store.itemsOf(s.id).map((i) => ({ ...i, level: normVis(i.level) }));
      item.items = all.filter((i) => canView(v.level, i.level));
      item.hiddenCount = all.filter((i) => !canView(v.level, i.level) && i.level < ADMIN_LEVEL).length;
    }
    if (s.type === 'guestbook') {
      item.canWrite = v.role !== 'guest';
      item.entries = db.guestbook.slice(0, 200).map((e) => ({
        id: e.id, name: e.name, picture: e.picture, text: e.text, createdAt: e.createdAt,
        mine: e.sub === v.sub, canDelete: admin || e.sub === v.sub,
      }));
    }
    sections.push(item);
  }
  const open = sections.filter((s) => !s.locked);
  res.json({
    role: v.role,
    level: v.level,
    profile: db.profile,
    stats: {
      photos: open.find((s) => s.id === 'gallery')?.photos?.length ?? 0,
      notes: open.filter((s) => s.text?.trim() || s.items?.length).length,
      days: Math.max(1, Math.ceil((Date.now() - db.createdAt) / 86400000)),
    },
    sections,
  });
});

// "data:image/jpeg;base64,..." → Buffer (JPEG만 허용)
function decodeJpeg(dataUrl, maxBytes) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return null;
  const buf = Buffer.from(m[1], 'base64');
  if (buf.length > maxBytes || buf[0] !== 0xff || buf[1] !== 0xd8 || buf[2] !== 0xff) return null;
  return buf;
}
const validVis = (v) => (typeof v === 'number' || (typeof v === 'string' && /^\d$/.test(v))) && VIS_OPTIONS.includes(Number(v));

app.put('/api/profile', requireAdmin, async (req, res) => {
  const { name, tagline, avatar } = req.body || {};
  const patch = {};
  if (typeof name === 'string') patch.name = name.trim().slice(0, 40) || 'Mingoo Park';
  if (typeof tagline === 'string') patch.tagline = tagline.trim().slice(0, 80);
  if (avatar !== undefined) {
    if (avatar === '') patch.avatar = '';
    else if (decodeJpeg(avatar, 600 * 1024)) patch.avatar = avatar;
    else return res.status(400).json({ error: '사진 형식이 올바르지 않아요' });
  }
  res.json(await store.updateProfile(patch));
});

const sectionOf = (id) => SECTIONS.find((s) => s.id === id);

app.put('/api/sections/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!sectionOf(id)) return res.status(404).json({ error: '없는 공간이에요' });
  const { text, visibility } = req.body || {};
  const patch = {};
  if (typeof text === 'string') patch.text = text.slice(0, 50000);
  if (visibility !== undefined) {
    if (!validVis(visibility)) return res.status(400).json({ error: '공개 범위가 올바르지 않아요' });
    patch.visibility = Number(visibility);
  }
  res.json(await store.updateSection(id, patch));
});

// 학력/이력 목록 전체 저장 — 항목마다 공개 등급
app.put('/api/sections/:id/items', requireAdmin, async (req, res) => {
  const s = sectionOf(req.params.id);
  if (s?.type !== 'list') return res.status(404).json({ error: '목록형 공간이 아니에요' });
  const raw = Array.isArray(req.body?.items) ? req.body.items.slice(0, 100) : null;
  if (!raw) return res.status(400).json({ error: '항목 형식이 올바르지 않아요' });
  const items = [];
  for (const i of raw) {
    const title = str(i?.title, 100);
    if (!title) continue; // 제목이 빈 항목은 버린다
    if (!validVis(i.level)) return res.status(400).json({ error: `'${title}'의 공개 등급이 올바르지 않아요` });
    items.push({ id: str(i.id, 32), title, period: str(i.period, 50), detail: str(i.detail, 500), level: Number(i.level) });
  }
  res.json({ items: await store.setItems(s.id, items) });
});

app.post('/api/gallery', requireAdmin, async (req, res) => {
  const images = Array.isArray(req.body?.images) ? req.body.images.slice(0, 10) : [];
  const ids = [];
  for (const img of images) {
    const buf = decodeJpeg(img, 3 * 1024 * 1024);
    if (buf) ids.push(await store.addPhoto(buf));
  }
  if (!ids.length) return res.status(400).json({ error: '올릴 수 있는 사진이 없어요' });
  res.json({ ids });
});

const PHOTO_ID = /^[a-f0-9]{24}$/;

app.delete('/api/gallery/:id', requireAdmin, async (req, res) => {
  if (!PHOTO_ID.test(req.params.id)) return res.status(400).end();
  await store.removePhoto(req.params.id);
  res.json({ ok: true });
});

// 사진 파일 — 갤러리 공개 범위에 따라 접근 제한
app.get('/api/photos/:id', (req, res) => {
  const { id } = req.params;
  if (!PHOTO_ID.test(id) || !store.getDb().gallery.some((p) => p.id === id)) return res.status(404).end();
  if (!canView(viewer(req).level, store.visibilityOf('gallery'))) return res.status(403).end();
  const file = store.photoPath(id);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400');
  res.sendFile(file);
});

// ---------- 방명록 ----------
app.post('/api/guestbook', async (req, res) => {
  const v = viewer(req);
  if (v.role === 'guest') return res.status(401).json({ error: '로그인 후 남길 수 있어요' });
  if (!canView(v.level, store.visibilityOf('guestbook'))) return res.status(403).json({ error: '방명록을 볼 수 있는 등급이 아니에요' });
  const text = str(req.body?.text, 500);
  if (!text) return res.status(400).json({ error: '내용을 적어 주세요' });
  const dayAgo = Date.now() - 86400000;
  if (store.getDb().guestbook.filter((e) => e.sub === v.sub && e.createdAt > dayAgo).length >= 10) {
    return res.status(429).json({ error: '하루에 10개까지 남길 수 있어요' });
  }
  const { promotedTo } = await store.addGuestbook({ sub: v.sub, name: v.name, picture: v.picture, text });
  res.json({ ok: true, promotedTo });
});

app.delete('/api/guestbook/:id', async (req, res) => {
  const v = viewer(req);
  const e = store.getGuestbookEntry(String(req.params.id));
  if (!e) return res.status(404).json({ error: '없는 글이에요' });
  if (v.role !== 'admin' && e.sub !== v.sub) return res.status(403).json({ error: '내가 쓴 글만 지울 수 있어요' });
  await store.removeGuestbook(e.id);
  res.json({ ok: true });
});

// ---------- 관리자: 회원 / 등급 규칙 ----------
app.get('/api/admin/users', requireAdmin, (req, res) => {
  const users = store.listUsers().map((u) => ({
    sub: u.sub, name: u.name, email: u.email, picture: u.picture, level: u.level, visits: u.visits,
    posts: store.postsOf(u.sub), createdAt: u.createdAt, lastLoginAt: u.lastLoginAt, lastVisitAt: u.lastVisitAt,
    isAdmin: u.sub === 'dev-admin' || ADMIN_EMAILS.includes(String(u.email).toLowerCase()),
    history: (u.history || []).slice(-5),
  })).sort((a, b) => (b.lastLoginAt || 0) - (a.lastLoginAt || 0));
  res.json({ users });
});

app.put('/api/admin/users/:sub', requireAdmin, async (req, res) => {
  const level = Number(req.body?.level);
  if (!Number.isInteger(level) || level < 1 || level > MAX_LEVEL) return res.status(400).json({ error: '등급은 1~7 사이예요' });
  const u = await store.setUserLevel(String(req.params.sub), level);
  if (!u) return res.status(404).json({ error: '없는 회원이에요' });
  res.json({ ok: true, level: u.level });
});

app.get('/api/admin/rules', requireAdmin, (req, res) => res.json(store.getRules()));

app.put('/api/admin/rules', requireAdmin, async (req, res) => {
  const b = req.body || {};
  const int = (v, min, max) => { const n = Number(v); return Number.isInteger(n) && n >= min && n <= max ? n : null; };
  const rules = { visitsPerDay: int(b.visitsPerDay, 1, 20), visitGapMinutes: int(b.visitGapMinutes, 0, 1440), levels: {} };
  if (rules.visitsPerDay === null || rules.visitGapMinutes === null) return res.status(400).json({ error: '방문 규칙 값이 올바르지 않아요' });
  for (const lv of AUTO_LEVELS) {
    const r = b.levels?.[lv] || {};
    const visits = int(r.visits, 0, 100000);
    const posts = int(r.posts, 0, 10000);
    if (visits === null || posts === null) return res.status(400).json({ error: `${lv}등급 조건 값이 올바르지 않아요` });
    rules.levels[lv] = { auto: Boolean(r.auto), visits, posts };
  }
  res.json(await store.setRules(rules));
});

// 배포 확인용 — Railway가 넣어 주는 커밋 번호로 지금 어떤 버전이 떠 있는지 알 수 있다
app.get('/api/health', (req, res) => res.json({
  ok: true,
  time: new Date().toISOString(),
  commit: (process.env.RAILWAY_GIT_COMMIT_SHA || 'local').slice(0, 7),
}));

app.use(express.static(path.join(__dirname, 'public')));

await store.init();
app.listen(PORT, () => {
  console.log(`✨ Homepage running → http://localhost:${PORT}`);
});

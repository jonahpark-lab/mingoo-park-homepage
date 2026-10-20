import express from 'express';
import cookieSession from 'cookie-session';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { OAuth2Client } from 'google-auth-library';
import { SECTIONS, VISIBILITY, canView } from './public/js/sections.js';
import * as store from './store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 4100; // Railway가 PORT를 주입한다. 로컬은 4100 고정(구글 로그인 허용 주소와 일치해야 함)
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
const DEV_LOGIN = process.env.DEV_LOGIN === '1';

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
const isLocalhost = (req) => ['localhost', '127.0.0.1', '::1'].includes(req.hostname);

function roleOf(req) {
  const u = req.session?.user;
  if (!u) return 'guest';
  if (u.dev) return DEV_LOGIN && isLocalhost(req) ? u.devRole : 'guest';
  return ADMIN_EMAILS.includes(u.email.toLowerCase()) ? 'admin' : 'member';
}
function requireAdmin(req, res, next) {
  if (roleOf(req) !== 'admin') return res.status(403).json({ error: '관리자만 할 수 있어요' });
  next();
}

// ---------- 인증 API ----------
app.get('/api/me', (req, res) => {
  const role = roleOf(req);
  const u = role === 'guest' ? null : req.session.user;
  res.json({
    user: u ? { name: u.name, email: u.email, picture: u.picture, role } : null,
    googleClientId: GOOGLE_CLIENT_ID || null,
    devLogin: DEV_LOGIN && isLocalhost(req),
  });
});

app.post('/api/auth/google', async (req, res) => {
  if (!GOOGLE_CLIENT_ID) return res.status(503).json({ error: '구글 로그인이 설정되지 않았어요' });
  try {
    const ticket = await google.verifyIdToken({ idToken: String(req.body?.credential || ''), audience: GOOGLE_CLIENT_ID });
    const p = ticket.getPayload();
    if (!p?.email || !p.email_verified) return res.status(401).json({ error: '이메일 인증이 필요한 계정이에요' });
    req.session.user = { sub: p.sub, email: p.email, name: p.name || p.email, picture: p.picture || '' };
    res.json({ ok: true, role: roleOf(req) });
  } catch {
    res.status(401).json({ error: '로그인 확인에 실패했어요' });
  }
});

// 로컬 개발용 가짜 로그인 (.env에 DEV_LOGIN=1, localhost에서만)
app.post('/api/auth/dev', (req, res) => {
  if (!DEV_LOGIN || !isLocalhost(req)) return res.status(404).end();
  const devRole = req.body?.role === 'admin' ? 'admin' : 'member';
  req.session.user = { dev: true, devRole, email: `dev-${devRole}@localhost`, name: devRole === 'admin' ? '개발용 관리자' : '개발용 회원', picture: '' };
  res.json({ ok: true, role: devRole });
});

app.post('/api/auth/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

// ---------- 콘텐츠 API ----------
app.get('/api/home', (req, res) => {
  const role = roleOf(req);
  const db = store.getDb();
  const sections = [];
  for (const s of SECTIONS) {
    const visibility = store.visibilityOf(s.id);
    const visible = canView(role, visibility);
    if (!visible && visibility === 'private') continue; // 비공개는 존재 자체를 숨김
    if (!visible) { sections.push({ id: s.id, visibility, locked: true }); continue; }
    const data = db.sections[s.id] || {};
    const item = { id: s.id, visibility, locked: false, text: data.text || '', updatedAt: data.updatedAt || null };
    if (s.type === 'gallery') item.photos = db.gallery.map((p) => p.id);
    sections.push(item);
  }
  const open = sections.filter((s) => !s.locked);
  res.json({
    role,
    profile: db.profile,
    stats: {
      photos: open.find((s) => s.id === 'gallery')?.photos?.length ?? 0,
      notes: open.filter((s) => s.text?.trim()).length,
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

app.put('/api/sections/:id', requireAdmin, async (req, res) => {
  const { id } = req.params;
  if (!SECTIONS.some((s) => s.id === id)) return res.status(404).json({ error: '없는 공간이에요' });
  const { text, visibility } = req.body || {};
  const patch = {};
  if (typeof text === 'string') patch.text = text.slice(0, 50000);
  if (visibility !== undefined) {
    if (!VISIBILITY[visibility]) return res.status(400).json({ error: '공개 범위가 올바르지 않아요' });
    patch.visibility = visibility;
  }
  res.json(await store.updateSection(id, patch));
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
  if (!canView(roleOf(req), store.visibilityOf('gallery'))) return res.status(403).end();
  const file = store.photoPath(id);
  if (!fs.existsSync(file)) return res.status(404).end();
  res.set('Cache-Control', 'private, max-age=86400');
  res.sendFile(file);
});

app.get('/api/health', (req, res) => res.json({ ok: true, time: new Date().toISOString() }));

app.use(express.static(path.join(__dirname, 'public')));

await store.init();
app.listen(PORT, () => {
  console.log(`✨ Homepage running → http://localhost:${PORT}`);
});

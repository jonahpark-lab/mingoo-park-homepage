// 데이터 저장소 — 지금은 JSON 파일 + 사진 파일.
// 저장 위치: Railway Volume이 붙어 있으면 그 경로(RAILWAY_VOLUME_MOUNT_PATH, Railway가 자동 주입)를
// 우선 사용하고, 없으면 DATA_DIR, 그것도 없으면 ./data.
// 나중에 Postgres로 옮길 때 이 파일의 함수만 교체하면 된다.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { SECTIONS, AUTO_LEVELS, DEFAULT_RULES, MAX_LEVEL, normVis } from './public/js/sections.js';

const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (VOLUME && process.env.DATA_DIR && path.resolve(process.env.DATA_DIR) !== path.resolve(VOLUME)) {
  console.warn(`⚠️  DATA_DIR(${process.env.DATA_DIR})가 Volume 경로(${VOLUME})와 달라 Volume 경로를 사용합니다.`);
}
const DATA_DIR = path.resolve(VOLUME || process.env.DATA_DIR || './data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const clone = (o) => JSON.parse(JSON.stringify(o));
const fresh = () => ({
  createdAt: Date.now(),
  profile: { name: 'Mingoo Park', tagline: '한 줄 소개를 작성해 보세요', avatar: '' },
  sections: {},  // { [id]: { text, updatedAt, visibility, items? } }
  gallery: [],   // [{ id, createdAt }]
  guestbook: [], // [{ id, sub, name, picture, text, createdAt }]
  users: {},     // { [sub]: { sub, email, name, picture, level, visits, ... } }
  settings: { rules: clone(DEFAULT_RULES) },
});

let db;
let writing = Promise.resolve();

export async function init() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    const saved = JSON.parse(await fs.readFile(DB_FILE, 'utf8'));
    const base = fresh();
    db = { ...base, ...saved, settings: { ...base.settings, ...saved.settings } };
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    db = fresh();
    await persist();
  }
  console.log(`📁 Data dir → ${DATA_DIR}`);
}

// 쓰기는 순서대로, 임시파일에 쓴 뒤 교체(중간에 꺼져도 파일이 깨지지 않게)
function persist() {
  writing = writing.then(async () => {
    const tmp = DB_FILE + '.tmp';
    await fs.writeFile(tmp, JSON.stringify(db, null, 2));
    await fs.rename(tmp, DB_FILE);
  });
  return writing;
}

export const getDb = () => db;
const newId = () => crypto.randomBytes(8).toString('hex');

// ---------- 공간 ----------
export function visibilityOf(id) {
  const saved = db.sections[id]?.visibility;
  return normVis(saved ?? SECTIONS.find((s) => s.id === id)?.visibility);
}

export async function updateSection(id, { text, visibility }) {
  const next = { ...(db.sections[id] || {}) };
  if (text !== undefined) { next.text = text; next.updatedAt = Date.now(); }
  if (visibility !== undefined) next.visibility = visibility;
  db.sections[id] = next;
  await persist();
  return next;
}

// 학력/이력 같은 목록 — 항목마다 공개 등급(level)을 가진다
export const itemsOf = (id) => db.sections[id]?.items || [];

export async function setItems(id, items) {
  const prev = new Set(itemsOf(id).map((i) => i.id));
  db.sections[id] = {
    ...(db.sections[id] || {}),
    items: items.map((i) => ({ ...i, id: prev.has(i.id) ? i.id : newId() })),
    updatedAt: Date.now(),
  };
  await persist();
  return db.sections[id].items;
}

export async function updateProfile({ name, tagline, avatar }) {
  if (name !== undefined) db.profile.name = name;
  if (tagline !== undefined) db.profile.tagline = tagline;
  if (avatar !== undefined) db.profile.avatar = avatar;
  await persist();
  return db.profile;
}

// ---------- 갤러리 ----------
export async function addPhoto(buffer) {
  const id = crypto.randomBytes(12).toString('hex');
  await fs.writeFile(path.join(UPLOAD_DIR, `${id}.jpg`), buffer);
  db.gallery.unshift({ id, createdAt: Date.now() });
  await persist();
  return id;
}

export async function removePhoto(id) {
  db.gallery = db.gallery.filter((p) => p.id !== id);
  await fs.rm(path.join(UPLOAD_DIR, `${id}.jpg`), { force: true });
  await persist();
}

export const photoPath = (id) => path.join(UPLOAD_DIR, `${id}.jpg`);

// ---------- 회원 ----------
export const getUser = (sub) => db.users[sub] || null;
export const listUsers = () => Object.values(db.users);
export const postsOf = (sub) => db.guestbook.filter((e) => e.sub === sub).length;
export const getRules = () => db.settings.rules;

// 로그인할 때마다 프로필을 갱신, 처음이면 1등급으로 가입
export async function upsertUser({ sub, email, name, picture }) {
  const now = Date.now();
  const u = db.users[sub] || {
    sub, level: 1, visits: 0, visitDay: '', visitDayCount: 0, lastVisitAt: 0, createdAt: now, history: [],
  };
  Object.assign(u, { email, name, picture, lastLoginAt: now });
  db.users[sub] = u;
  await persist();
  return u;
}

function pushHistory(u, to, by) {
  u.history = [...(u.history || []), { at: Date.now(), from: u.level, to, by }].slice(-20);
  u.level = to;
}

// 조건을 채운 다음 등급으로 차례대로 올린다(내리지는 않는다). 올라간 등급을 돌려준다.
function autoPromote(u) {
  const { levels } = db.settings.rules;
  const posts = postsOf(u.sub);
  let target = u.level;
  for (const lv of AUTO_LEVELS) {
    const r = levels[lv];
    if (lv === target + 1 && r?.auto && u.visits >= r.visits && posts >= r.posts) target = lv;
  }
  if (target === u.level) return null;
  pushHistory(u, target, 'auto');
  return target;
}

const kstDay = (t) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(t);

// 방문 기록: 하루 최대 visitsPerDay회, visitGapMinutes 간격 이상일 때만 인정
export async function recordVisit(sub) {
  const u = db.users[sub];
  if (!u) return null;
  const { visitsPerDay, visitGapMinutes } = db.settings.rules;
  const now = Date.now();
  const day = kstDay(now);
  if (u.visitDay !== day) { u.visitDay = day; u.visitDayCount = 0; }
  const counted = u.visitDayCount < visitsPerDay && now - (u.lastVisitAt || 0) >= visitGapMinutes * 60000;
  if (counted) {
    u.visits += 1;
    u.visitDayCount += 1;
    u.lastVisitAt = now;
  }
  const promotedTo = autoPromote(u);
  if (counted || promotedTo) await persist();
  return { counted, promotedTo };
}

export async function setUserLevel(sub, level) {
  const u = db.users[sub];
  if (!u) return null;
  if (u.level !== level) pushHistory(u, level, 'admin');
  await persist();
  return u;
}

export async function setRules(rules) {
  db.settings.rules = rules;
  for (const u of Object.values(db.users)) autoPromote(u); // 규칙이 완화되면 바로 반영
  await persist();
  return rules;
}

// ---------- 방명록 ----------
export async function addGuestbook({ sub, name, picture, text }) {
  const entry = { id: newId(), sub, name, picture, text, createdAt: Date.now() };
  db.guestbook.unshift(entry);
  const u = db.users[sub];
  const promotedTo = u ? autoPromote(u) : null;
  await persist();
  return { entry, promotedTo };
}

export const getGuestbookEntry = (id) => db.guestbook.find((e) => e.id === id);

export async function removeGuestbook(id) {
  db.guestbook = db.guestbook.filter((e) => e.id !== id);
  await persist();
}

export { MAX_LEVEL };

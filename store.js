// 데이터 저장소 — 지금은 JSON 파일 + 사진 파일.
// 저장 위치: Railway Volume이 붙어 있으면 그 경로(RAILWAY_VOLUME_MOUNT_PATH, Railway가 자동 주입)를
// 우선 사용하고, 없으면 DATA_DIR, 그것도 없으면 ./data.
// 나중에 Postgres로 옮길 때 이 파일의 함수만 교체하면 된다.
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { SECTIONS } from './public/js/sections.js';

const VOLUME = process.env.RAILWAY_VOLUME_MOUNT_PATH;
if (VOLUME && process.env.DATA_DIR && path.resolve(process.env.DATA_DIR) !== path.resolve(VOLUME)) {
  console.warn(`⚠️  DATA_DIR(${process.env.DATA_DIR})가 Volume 경로(${VOLUME})와 달라 Volume 경로를 사용합니다.`);
}
const DATA_DIR = path.resolve(VOLUME || process.env.DATA_DIR || './data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
export const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');

const fresh = () => ({
  createdAt: Date.now(),
  profile: { name: 'Mingoo Park', tagline: '한 줄 소개를 작성해 보세요', avatar: '' },
  sections: {},  // { [id]: { text, updatedAt, visibility } }
  gallery: [],   // [{ id, createdAt }]
});

let db;
let writing = Promise.resolve();

export async function init() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  try {
    db = { ...fresh(), ...JSON.parse(await fs.readFile(DB_FILE, 'utf8')) };
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

export function visibilityOf(id) {
  return db.sections[id]?.visibility || SECTIONS.find((s) => s.id === id)?.visibility || 'private';
}

export async function updateProfile({ name, tagline, avatar }) {
  if (name !== undefined) db.profile.name = name;
  if (tagline !== undefined) db.profile.tagline = tagline;
  if (avatar !== undefined) db.profile.avatar = avatar;
  await persist();
  return db.profile;
}

export async function updateSection(id, { text, visibility }) {
  const cur = db.sections[id] || {};
  const next = { ...cur };
  if (text !== undefined) { next.text = text; next.updatedAt = Date.now(); }
  if (visibility !== undefined) next.visibility = visibility;
  db.sections[id] = next;
  await persist();
  return next;
}

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

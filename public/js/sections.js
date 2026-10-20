// 메인 버튼 정의 — 서버(server.js)와 브라우저(app.js)가 함께 사용한다.
// 순서/크기/색상/기본 공개범위를 여기서 바꾼다.
//
// 공개범위(visibility)는 "볼 수 있는 최소 등급" 숫자다.
//   0 = 전체 공개(로그인 없이), 1~7 = 회원 N등급 이상, 8 = 비공개(관리자만)
// type: 'text'(기본) | 'gallery' | 'list'(항목마다 공개범위) | 'guestbook'(회원이 글 작성)
export const MAX_LEVEL = 7;
export const ADMIN_LEVEL = 8;

export const SECTIONS = [
  { id: 'about',     title: '소개',     en: 'About me',   icon: 'user',     tone: 'violet', size: 'wide',      visibility: 0,
    desc: '나는 어떤 사람인지, 하는 일과 관심사', placeholder: '안녕하세요, 박민구입니다.\n하는 일, 관심사, 좋아하는 것들을 자유롭게 적어 보세요.' },
  { id: 'gallery',   title: '갤러리',   en: 'Gallery',    icon: 'image',    tone: 'mint',   size: 'wide tall', visibility: 0, type: 'gallery',
    desc: '사진을 올리고 모아 보는 공간' },
  { id: 'education', title: '학력',     en: 'Education',  icon: 'cap',      tone: 'indigo', size: 'wide',      visibility: 0, type: 'list',
    desc: '학교, 전공, 졸업 내역',
    fields: { title: 'AAA 대학교 졸업', period: '2010.03 – 2014.02', detail: '전공, 학위, 비고' } },
  { id: 'career',    title: '이력',     en: 'Career',     icon: 'briefcase', tone: 'coral', size: 'wide',      visibility: 0, type: 'list',
    desc: '경력, 활동, 수상 내역',
    fields: { title: 'BBB 주식회사 선임연구원', period: '2018.01 – 현재', detail: '담당 업무, 성과' } },
  { id: 'journal',   title: '일기',     en: 'Journal',    icon: 'book',     tone: 'peach',  visibility: 1,
    desc: '하루의 기록과 생각', placeholder: '오늘 있었던 일, 느낀 점을 적어 보세요.' },
  { id: 'projects',  title: '프로젝트', en: 'Projects',   icon: 'folder',   tone: 'sky',    visibility: 0,
    desc: '진행 중이거나 완료한 작업', placeholder: '프로젝트 이름, 기간, 역할, 결과물을 정리해 보세요.' },
  { id: 'schedule',  title: '일정',     en: 'Schedule',   icon: 'calendar', tone: 'amber',  visibility: 1,
    desc: '다가오는 일정과 계획', placeholder: '10/25  가족 모임\n11/02  프로젝트 마감' },
  { id: 'notes',     title: '메모',     en: 'Notes',      icon: 'note',     tone: 'lime',   visibility: 1,
    desc: '아이디어와 할 일', placeholder: '떠오른 아이디어나 할 일을 빠르게 적어 두세요.' },
  { id: 'links',     title: '링크',     en: 'Links',      icon: 'link',     tone: 'teal',   visibility: 0,
    desc: 'SNS, 블로그, 자주 가는 사이트', placeholder: 'Instagram  https://…\nBlog  https://…' },
  { id: 'guestbook', title: '방명록',   en: 'Guestbook',  icon: 'chat',     tone: 'pink',   visibility: 0, type: 'guestbook',
    desc: '로그인한 회원이 남기는 한마디', placeholder: '방명록 맨 위에 보일 인사말을 적어 두세요.' },
  { id: 'contact',   title: '연락처',   en: 'Contact',    icon: 'mail',     tone: 'lilac',  size: 'full',      visibility: 0,
    desc: '이메일, 연락 방법', placeholder: 'Email  …\n연락 가능한 시간  …' },
];

// 예전 값('public' | 'members' | 'private')도 숫자로 바꿔 읽는다
export function normVis(v) {
  if (v === 'public') return 0;
  if (v === 'members') return 1;
  if (v === 'private') return ADMIN_LEVEL;
  const n = Number(v);
  return Number.isInteger(n) && n >= 0 && n <= ADMIN_LEVEL ? n : ADMIN_LEVEL;
}
export const VIS_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, ADMIN_LEVEL];
export function visLabel(v) {
  v = normVis(v);
  if (v === 0) return '전체 공개';
  if (v === ADMIN_LEVEL) return '비공개 (관리자만)';
  return v === 1 ? '회원 1등급 이상 (로그인)' : `회원 ${v}등급 이상`;
}
export function visShort(v) {
  v = normVis(v);
  return v === 0 ? '공개' : v === ADMIN_LEVEL ? '비공개' : `Lv.${v}+`;
}
// level: 방문자 0, 회원 1~7, 관리자 8
export const canView = (level, visibility) => (level ?? 0) >= normVis(visibility);

// 자동 등업 규칙(관리자 화면에서 바꿀 수 있다). 5~7등급은 관리자 승인만.
export const AUTO_LEVELS = [2, 3, 4];
export const DEFAULT_RULES = {
  visitsPerDay: 2,      // 하루에 인정하는 방문 수
  visitGapMinutes: 30,  // 방문으로 인정하는 최소 간격(분)
  levels: {
    2: { auto: true, visits: 20, posts: 1 },
    3: { auto: true, visits: 40, posts: 2 },
    4: { auto: true, visits: 80, posts: 4 },
  },
};

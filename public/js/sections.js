// 메인 버튼 정의 — 서버(server.js)와 브라우저(app.js)가 함께 사용한다.
// 순서/크기/색상/기본 공개범위를 여기서 바꾼다.
// visibility: 'public'(누구나) | 'members'(로그인 회원) | 'private'(관리자만)
export const SECTIONS = [
  { id: 'about',     title: '소개',     en: 'About me',   icon: 'user',     tone: 'violet', size: 'wide',      visibility: 'public',
    desc: '나는 어떤 사람인지, 하는 일과 관심사', placeholder: '안녕하세요, 박민구입니다.\n하는 일, 관심사, 좋아하는 것들을 자유롭게 적어 보세요.' },
  { id: 'gallery',   title: '갤러리',   en: 'Gallery',    icon: 'image',    tone: 'mint',   size: 'wide tall', visibility: 'public', type: 'gallery',
    desc: '사진을 올리고 모아 보는 공간' },
  { id: 'journal',   title: '일기',     en: 'Journal',    icon: 'book',     tone: 'peach',  visibility: 'members',
    desc: '하루의 기록과 생각', placeholder: '오늘 있었던 일, 느낀 점을 적어 보세요.' },
  { id: 'projects',  title: '프로젝트', en: 'Projects',   icon: 'folder',   tone: 'sky',    visibility: 'public',
    desc: '진행 중이거나 완료한 작업', placeholder: '프로젝트 이름, 기간, 역할, 결과물을 정리해 보세요.' },
  { id: 'schedule',  title: '일정',     en: 'Schedule',   icon: 'calendar', tone: 'amber',  visibility: 'members',
    desc: '다가오는 일정과 계획', placeholder: '10/25  가족 모임\n11/02  프로젝트 마감' },
  { id: 'notes',     title: '메모',     en: 'Notes',      icon: 'note',     tone: 'lime',   visibility: 'members',
    desc: '아이디어와 할 일', placeholder: '떠오른 아이디어나 할 일을 빠르게 적어 두세요.' },
  { id: 'links',     title: '링크',     en: 'Links',      icon: 'link',     tone: 'teal',   visibility: 'public',
    desc: 'SNS, 블로그, 자주 가는 사이트', placeholder: 'Instagram  https://…\nBlog  https://…' },
  { id: 'guestbook', title: '방명록',   en: 'Guestbook',  icon: 'chat',     tone: 'pink',   visibility: 'public',
    desc: '방문자가 남기는 한마디', placeholder: '방문자 메시지는 API 연결 후 실제로 받을 수 있어요.\n지금은 환영 인사를 적어 두세요.' },
  { id: 'contact',   title: '연락처',   en: 'Contact',    icon: 'mail',     tone: 'lilac',  size: 'full',      visibility: 'public',
    desc: '이메일, 연락 방법', placeholder: 'Email  …\n연락 가능한 시간  …' },
];

export const VISIBILITY = {
  public:  { label: '공개',   hint: '누구나 볼 수 있어요' },
  members: { label: '회원',   hint: '로그인한 사람만 볼 수 있어요' },
  private: { label: '비공개', hint: '관리자만 볼 수 있어요' },
};

const RANK = { guest: 0, member: 1, admin: 2 };
const NEED = { public: 0, members: 1, private: 2 };
export const canView = (role, visibility) => RANK[role ?? 'guest'] >= NEED[visibility ?? 'private'];

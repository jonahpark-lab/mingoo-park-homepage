# Mingoo Park's Homepage

밝은 톤의 리퀴드 글래스 디자인 개인 홈페이지.
Google 로그인 + 공간별 공개 범위(공개 / 회원 / 비공개)를 지원한다.

## 로컬 실행

```bash
npm install
cp .env.example .env   # 값 채우기
npm run dev            # http://localhost:4100
```

## 환경 변수

| 이름 | 설명 |
|---|---|
| `GOOGLE_CLIENT_ID` | Google OAuth 클라이언트 ID (웹 애플리케이션) |
| `ADMIN_EMAILS` | 관리자 이메일, 쉼표로 여러 개 |
| `SESSION_SECRET` | 로그인 쿠키 서명용 임의 문자열 |
| `DATA_DIR` | 글·사진 저장 위치 (Railway에서는 Volume 경로) |
| `DEV_LOGIN` | `1`이면 localhost에서 테스트 로그인 버튼 표시 — 배포 환경에는 넣지 않는다 |

## 구조

- `server.js` — Express 서버, 인증·권한·콘텐츠 API
- `store.js` — 데이터 저장 (JSON 파일 + 사진 파일)
- `public/` — 화면 (HTML/CSS/JS), `public/js/sections.js`는 서버와 공유하는 버튼 정의

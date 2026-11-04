# 제18대 학생회 <Duet> 인수인계 포털 보안 정책 및 운영 가이드 (Netlify + Firebase)

본 문서는 **고려대학교 자유전공학부 D반 제18대 학생회 `<Duet>` 인수인계 포털**의 보안 아키텍처와 환경변수 설정 절차를 안내합니다.

---

## 1. 적용된 다중 계층(Defense-in-Depth) 보안 아키텍처

1. **정적 데이터 노출 원천 차단 (`scripts/build_public.mjs`)**:
   - 배포 디렉터리(`public/`)에는 UI 껍데기(`index.html`, `css/style.css`, `js/app.js`, `js/firebase-config.js`, `assets/`, `robots.txt`)만 포함됩니다.
   - 대외비 구글 드라이브 링크와 연락처·회의록이 담긴 `js/data.js`, `js/sections_data.js`, `js/config.local.js`는 정적 배포본 및 Git 커밋 대상(`.gitignore`)에서 완전히 제외되며 `backup_local/`에만 로컬 보관됩니다.
2. **Netlify Serverless Functions 기반 인증 및 브루트포스 방어 (`netlify/functions/auth-role.mts`)**:
   - 직위별 비밀번호(`duet_pres`, `duet_head`, `next_pres`, `next_head`)는 클라이언트에 해시나 솔트로 존재하지 않으며, 오직 **Netlify 환경변수**에만 저장됩니다.
   - `crypto.timingSafeEqual`을 통해 타이밍 공격을 방지하며, 동일 IP에서 **5회 연속 실패 시 15분간 접속을 차단(HTTP 429)**합니다.
   - 인증 성공 시 `firebase-admin` SDK로 서명된 **Firebase Custom Token**(`claims: { role, canEdit }`)을 발급합니다.
3. **Cloud Firestore 역할 기반 보안 규칙 (`firestore.rules`)**:
   - 비인증 사용자는 어떠한 컬렉션도 읽거나 쓸 수 없습니다.
   - `drive_links/{linkId}`: 문서 내 `roles` 배열에 본인의 `request.auth.token.role`이 포함된 경우에만 읽기가 허용됩니다. (`19대 국장단`이나 `18대 국장단`은 회장단 전용 대외비 드라이브 링크를 DB 쿼리로도 조회 불가)
   - `sections/{tabId}`: `presidency` 문서는 `duet_pres` 및 `next_pres`에게만 읽기가 허용됩니다.
   - 모든 쓰기(`create`, `update`, `delete`)는 `duet_pres`(18대 학생회장단 관리자)에게만 허용됩니다.
4. **노션 API 서버 프록시 (`netlify/functions/notion-sync.mts`)**:
   - 노션 통합 토큰(`NOTION_TOKEN`)을 브라우저에 입력하거나 `localStorage`에 저장하지 않고, 관리자 Firebase ID 토큰 검증 후 서버에서 직접 Notion API를 호출해 Firestore `calendar_events`를 갱신합니다.
5. **보안 응답 헤더 및 XSS 방어 (`netlify.toml` & DOMPurify)**:
   - `Referrer-Policy: no-referrer`: 포털 내부에서 대외비 구글 드라이브 링크 클릭 시 외부로 포털 URL이 유출되지 않습니다.
   - `X-Robots-Tag: noindex, nofollow, noarchive` 및 `robots.txt`: 검색엔진 색인을 완전히 차단합니다.
   - `Content-Security-Policy` 및 `DOMPurify.sanitize()`를 통해 XSS 공격을 차단합니다.

---

## 2. 배포 및 초기 설정 절차

### Step 1. 로컬 데이터를 Cloud Firestore로 마이그레이션
1. `.env.example`을 복사해 `.env` 파일을 생성하고 Firebase 서비스 계정 정보(`FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`)를 입력합니다.
2. 아래 명령어를 실행해 로컬의 기존 데이터를 Firestore로 일괄 업로드합니다:
   ```bash
   npm install
   npm run migrate:firestore
   ```
3. Firestore 보안 규칙을 배포합니다:
   ```bash
   npx firebase-tools deploy --only firestore:rules
   ```

### Step 2. Netlify 환경변수 설정
Netlify 대시보드 (`Site configuration > Environment variables`)에 아래 변수를 등록합니다 (`Secret` 체크 권장):
- `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
- `FIREBASE_WEB_API_KEY`, `FIREBASE_WEB_AUTH_DOMAIN`, `FIREBASE_WEB_PROJECT_ID`, `FIREBASE_WEB_STORAGE_BUCKET`, `FIREBASE_WEB_MESSAGING_SENDER_ID`, `FIREBASE_WEB_APP_ID`
- `ROLE_PWD_DUET_PRES`, `ROLE_PWD_DUET_HEAD`, `ROLE_PWD_NEXT_PRES`, `ROLE_PWD_NEXT_HEAD`
- `NOTION_TOKEN`, `NOTION_DATABASE_ID`
- (선택) `ADMIN_ALLOWED_EMAILS`: Google 로그인으로 관리자 인증을 허용할 이메일 목록(쉼표 구분)

### Step 3. 빌드 및 보안 무결성 검증
```bash
npm run build
npm run verify:security
```

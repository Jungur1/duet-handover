# 고려대학교 자유전공학부 D반 제18대 학생회 <Duet> 인수인계 포털

> **공식 라이브 웹사이트**: [https://duet-handover.netlify.app](https://duet-handover.netlify.app)  
> **기술 스택**: Vanilla HTML/CSS/JS + Netlify Functions (Serverless) + Firebase (Auth / Firestore)

---

## 📁 프로젝트 디렉터리 구조

```text
Duet_handover/
├── assets/                     # 브랜드 로고, 행사 사진, 공고문, 홍보 포스터 등 정적 이미지
├── css/
│   └── style.css               # 에디토리얼 아카이브 테마 스타일시트 (반응형 지원)
├── js/
│   ├── app.js                  # 메인 웹 애플리케이션 로직 (RBAC 권한 제어, Firestore 연동)
│   ├── firebase-config.js      # 클라이언트용 Firebase SDK 설정
│   ├── data.js                 # [대외비 원본] 캘린더/행사/드라이브 링크 데이터 (Git 제외)
│   ├── sections_data.js        # [대외비 원본] 국서별 업무 인수인계 상세 내용 (Git 제외)
│   └── config.local.js         # [대외비 로컬] 로컬 환경설정 및 노션 토큰 (Git 제외)
├── netlify/
│   ├── functions/
│   │   ├── auth-role.mts       # 직위별 비밀번호 검증 & Firebase Custom Token 발급 함수
│   │   └── notion-sync.mts     # 노션 API 일정 동기화 서버리스 프록시 함수
│   └── lib/
│       └── firebase-admin.mts  # Netlify 함수용 Firebase Admin 초기화 유틸
├── scripts/
│   ├── build_public.mjs        # Netlify 배포용 안전 정적 빌드 스크립트 (대외비 원천 차단)
│   ├── migrate_to_firestore.mjs# 로컬 데이터 -> Cloud Firestore 일괄 마이그레이션/시드
│   └── verify_security.mjs     # 정적 배포본 민감 정보 누출 검사 및 보안 무결성 검증
├── backup_local/               # 로컬 원본 데이터(js/data.js 등) 안전 백업 폴더 (Git 제외)
├── public/                     # 배포용 정적 빌드 산출물 (npm run build 생성, Git 제외)
├── firestore.rules             # Cloud Firestore 다중 계층 역할 기반 접근 제어(RBAC) 보안 규칙
├── firebase.json               # Firebase 프로젝트 설정
├── netlify.toml                # Netlify 빌드 및 보안 응답 헤더(CSP, Referrer-Policy 등) 설정
├── package.json                # 프로젝트 의존성 및 실행 스크립트 정의
├── SECURITY.md                 # 포털 보안 정책 및 환경변수 설정 운영 가이드
└── 깃허브_업로드_실행.bat          # 윈도우 원클릭 깃 커밋 & 푸시 자동화 배치 파일
```

---

## 🛠️ 주요 명령어 (Scripts)

```bash
# 1. 안전한 정적 배포 번들 빌드 (public/ 디렉터리 생성)
npm run build

# 2. 로컬 백업 데이터를 Cloud Firestore로 일괄 업로드 (시드/마이그레이션)
npm run migrate:firestore
# (동일 명령: npm run seed:firestore)

# 3. 배포 전 보안 무결성 검증 (민감 정보 노출 및 보안 규칙 점검)
npm run verify:security

# 4. 로컬 Netlify 개발 서버 실행
npm run dev
```

---

## 🔒 보안 및 데이터 관리 안내

1. **대외비 원본 데이터 분리 (`js/data.js`, `js/sections_data.js`)**:
   - 구글 드라이브 URL, 연락처, 세부 회의록이 담긴 원본 데이터는 GitHub 공개 저장소에 절대 커밋되지 않습니다(`.gitignore` 적용).
   - 배포 시에는 `npm run build`를 통해 `public/` 디렉터리에 UI 껍데기만 복사되며, 실제 대외비 데이터는 Netlify Serverless Function 인증을 거쳐 **Cloud Firestore**를 통해서만 안전하게 로드됩니다.
2. **세부 보안 가이드**: 자세한 내용은 [`SECURITY.md`](SECURITY.md) 문서를 참조하세요.

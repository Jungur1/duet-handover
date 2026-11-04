// ============================================================================
// [Duet 인수인계 포털] Firebase Web SDK 설정
// Netlify 빌드 시 환경변수(FIREBASE_WEB_*)가 있으면 scripts/build_public.mjs가
// 자동으로 주입하며, 직접 아래 객체를 채워 넣으셔도 됩니다.
// (참고: Firebase Web Config는 프로젝트 식별자이며, 실제 데이터 접근 통제는
//  Netlify Functions의 Custom Token 서명과 Firestore Security Rules가 수행합니다.)
// ============================================================================
window.DUET_FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};

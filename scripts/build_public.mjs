/**
 * [Duet 인수인계 포털] 안전한 정적 배포 디렉터리(public/) 생성 스크립트
 *
 * - UI 껍데기(index.html, css/style.css, js/app.js, js/firebase-config.js, assets/, robots.txt)만
 *   public/ 폴더로 복사합니다.
 * - 대외비 데이터 파일(js/data.js, js/sections_data.js, js/config.local.js)은
 *   절대 public/에 복사하지 않아 정적 파일 노출을 원천 차단합니다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

function copyRecursiveSync(src, dest) {
  if (!fs.existsSync(src)) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function buildPublic() {
  // 1. 로컬 원본 데이터(js/data.js, js/sections_data.js)가 루트에 있다면 backup_local/로 안전 백업
  const backupDir = path.join(rootDir, "backup_local");
  fs.mkdirSync(backupDir, { recursive: true });

  for (const sensitiveFile of ["data.js", "sections_data.js", "config.local.js"]) {
    const srcPath = path.join(rootDir, "js", sensitiveFile);
    const destBackup = path.join(backupDir, sensitiveFile);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destBackup);
    }
  }

  // 2. 기존 public/ 초기화 후 재생성
  if (fs.existsSync(publicDir)) {
    fs.rmSync(publicDir, { recursive: true, force: true });
  }
  fs.mkdirSync(publicDir, { recursive: true });
  fs.mkdirSync(path.join(publicDir, "js"), { recursive: true });
  fs.mkdirSync(path.join(publicDir, "css"), { recursive: true });

  // 3. 안전한 정적 에셋만 복사
  copyRecursiveSync(path.join(rootDir, "index.html"), path.join(publicDir, "index.html"));
  copyRecursiveSync(path.join(rootDir, "robots.txt"), path.join(publicDir, "robots.txt"));
  copyRecursiveSync(path.join(rootDir, ".nojekyll"), path.join(publicDir, ".nojekyll"));
  copyRecursiveSync(path.join(rootDir, "css", "style.css"), path.join(publicDir, "css", "style.css"));
  copyRecursiveSync(path.join(rootDir, "js", "app.js"), path.join(publicDir, "js", "app.js"));
  copyRecursiveSync(path.join(rootDir, "assets"), path.join(publicDir, "assets"));
  copyRecursiveSync(path.join(rootDir, "D반 학생회칙.pdf"), path.join(publicDir, "D반 학생회칙.pdf"));

  // 4. Firebase Web SDK 설정 생성 (환경변수 FIREBASE_WEB_* 우선 적용, 없으면 js/firebase-config.js 복사)
  const webConfigFromEnv = {
    apiKey: process.env.FIREBASE_WEB_API_KEY || "",
    authDomain: process.env.FIREBASE_WEB_AUTH_DOMAIN || "",
    projectId: process.env.FIREBASE_WEB_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || "",
    storageBucket: process.env.FIREBASE_WEB_STORAGE_BUCKET || "",
    messagingSenderId: process.env.FIREBASE_WEB_MESSAGING_SENDER_ID || "",
    appId: process.env.FIREBASE_WEB_APP_ID || "",
  };

  const targetFbCfgPath = path.join(publicDir, "js", "firebase-config.js");
  if (webConfigFromEnv.apiKey && webConfigFromEnv.projectId) {
    const content = `window.DUET_FIREBASE_CONFIG = ${JSON.stringify(webConfigFromEnv, null, 2)};\n`;
    fs.writeFileSync(targetFbCfgPath, content, "utf8");
  } else {
    copyRecursiveSync(path.join(rootDir, "js", "firebase-config.js"), targetFbCfgPath);
  }

  console.log("✅ public/ 정적 배포 디렉터리 빌드가 완료되었습니다. (대외비 데이터 파일 제외됨)");
}

buildPublic();

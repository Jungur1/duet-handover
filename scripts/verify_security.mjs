/**
 * [Duet 인수인계 포털] 정적 배포본(public/) 보안 무결성 자동 검증 스크립트
 *
 * 검증 항목:
 * 1. public/js/ 내에 data.js, sections_data.js, config.local.js가 존재하지 않는지 확인
 * 2. public/ 내 모든 HTML/JS 파일에 과거 하드코딩된 비밀번호 주석(duet18pres!, duet19pres! 등),
 *    RBAC_SALT, 대외비 구글 드라이브 폴더 ID, 개인 휴대폰 번호가 노출되지 않는지 전수 검사
 * 3. firestore.rules 및 netlify.toml 필수 보안 설정 존재 확인
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const publicDir = path.join(rootDir, "public");

const FORBIDDEN_FILES = [
  "js/data.js",
  "js/sections_data.js",
  "js/config.local.js",
  ".env",
];

const FORBIDDEN_PATTERNS = [
  { label: "하드코딩된 솔트(duet_rbac_salt_2026_)", regex: /duet_rbac_salt_2026_/ },
  { label: "과거 비밀번호 주석(duet18pres!)", regex: /duet18pres!/ },
  { label: "과거 비밀번호 주석(duet18head!)", regex: /duet18head!/ },
  { label: "과거 비밀번호 주석(duet19pres!)", regex: /duet19pres!/ },
  { label: "과거 비밀번호 주석(duet19head!)", regex: /duet19head!/ },
  { label: "대외비 전체 자료실 드라이브 폴더 ID 노출", regex: /1dVID6Wpjr1SBMLi9YLT8YweFGgUIOjdw/ },
  { label: "대외비 구글폼 드라이브 폴더 ID 노출", regex: /1f28UMiGSBPcXvv-VkQqwTwWB2OZMLxQa/ },
  { label: "정적 HTML/JS 내 개인 전화번호 평문 노출", regex: /010-3516-3561|010-2015-3344/ },
  { label: "sessionStorage 권한 우회 취약 코드", regex: /sessionStorage\.getItem\(SESSION_ROLE_KEY\)/ },
];

let failed = false;

function fail(msg) {
  console.error(`❌ [보안 검증 실패] ${msg}`);
  failed = true;
}

function pass(msg) {
  console.log(`✅ [통과] ${msg}`);
}

if (!fs.existsSync(publicDir)) {
  fail("public/ 디렉터리가 존재하지 않습니다. 먼저 `npm run build`를 실행하세요.");
  process.exit(1);
}

// 1. 금지된 정적 데이터 파일 존재 여부 확인
for (const rel of FORBIDDEN_FILES) {
  const full = path.join(publicDir, rel);
  if (fs.existsSync(full)) {
    fail(`public/${rel} 파일이 배포 폴더에 포함되어 있습니다!`);
  } else {
    pass(`public/${rel} 미포함 확인`);
  }
}

// 2. public/ 내 모든 .html, .js 파일 텍스트 스캔
function scanFiles(dir) {
  for (const entry of fs.readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      scanFiles(full);
    } else if (/\.(html|js|mjs|json)$/i.test(entry)) {
      const content = fs.readFileSync(full, "utf8");
      const rel = path.relative(publicDir, full);
      for (const pat of FORBIDDEN_PATTERNS) {
        if (pat.regex.test(content)) {
          fail(`${rel} 파일에서 금지된 민감 패턴 발견: ${pat.label}`);
        }
      }
    }
  }
}

scanFiles(publicDir);
if (!failed) {
  pass("public/ 내 모든 HTML/JS 파일에서 민감 정보(비밀번호 해시·주석·드라이브URL·연락처) 0건 확인");
}

// 3. netlify.toml 및 firestore.rules 검증
const netlifyTomlPath = path.join(rootDir, "netlify.toml");
if (!fs.existsSync(netlifyTomlPath)) {
  fail("netlify.toml 파일이 없습니다.");
} else {
  const toml = fs.readFileSync(netlifyTomlPath, "utf8");
  if (toml.includes("Referrer-Policy") && toml.includes("Content-Security-Policy") && toml.includes("X-Frame-Options")) {
    pass("netlify.toml 필수 보안 헤더(CSP, Referrer-Policy, X-Frame-Options) 설정 확인");
  } else {
    fail("netlify.toml에 필수 보안 헤더가 누락되었습니다.");
  }
}

const rulesPath = path.join(rootDir, "firestore.rules");
if (!fs.existsSync(rulesPath)) {
  fail("firestore.rules 파일이 아직 생성되지 않았습니다.");
} else {
  pass("firestore.rules 존재 확인");
}

if (failed) {
  process.exit(1);
} else {
  console.log("\n🎉 모든 보안 무결성 검증을 완벽히 통과했습니다!");
}

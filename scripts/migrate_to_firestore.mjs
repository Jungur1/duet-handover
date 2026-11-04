/**
 * [Duet 제18대 학생회 인수인계 포털]
 * 로컬 백업 데이터(data.js, sections_data.js) -> Cloud Firestore 일괄 마이그레이션 스크립트
 *
 * 실행 방법:
 *   1. .env 파일(또는 환경변수)에 FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY 설정
 *   2. npm run migrate:firestore
 */
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");

function loadDotEnvIfPresent() {
  const envPath = path.join(rootDir, ".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = val;
    }
  }
}

function resolveSourceFile(relPath) {
  const backupPath = path.join(rootDir, "backup_local", path.basename(relPath));
  if (fs.existsSync(backupPath)) return backupPath;
  const directPath = path.join(rootDir, relPath);
  if (fs.existsSync(directPath)) return directPath;
  throw new Error(`원본 데이터 파일을 찾을 수 없습니다: ${relPath}`);
}

function evaluateWindowScript(filePath, globalProp) {
  const code = fs.readFileSync(filePath, "utf8");
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  if (!sandbox.window[globalProp]) {
    throw new Error(`${path.basename(filePath)}에서 window.${globalProp}를 찾을 수 없습니다.`);
  }
  return sandbox.window[globalProp];
}

async function main() {
  loadDotEnvIfPresent();

  let credential = null;
  const candidateSet = new Set(["serviceAccountKey.json", "firebase-adminsdk.json"]);
  for (const entry of fs.readdirSync(rootDir)) {
    if ((entry.includes("adminsdk") || entry.includes("serviceAccount")) && entry.endsWith(".json")) {
      candidateSet.add(entry);
    }
  }

  for (const candidate of candidateSet) {
    const candidatePath = path.join(rootDir, candidate);
    if (fs.existsSync(candidatePath)) {
      try {
        const sa = JSON.parse(fs.readFileSync(candidatePath, "utf8"));
        if (sa.project_id && sa.private_key && sa.client_email) {
          console.log(`🔑 Firebase 서비스 계정 키 파일 감지: ${candidate}`);
          credential = cert(sa);
          break;
        }
      } catch (e) {
        // Continue checking other candidates
      }
    }
  }

  if (!credential) {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !rawPrivateKey) {
      console.error(
        "[오류] Firebase 서비스 계정 JSON 파일이 없거나 환경변수(FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)가 누락되었습니다 (.env 확인)."
      );
      process.exit(1);
    }

    credential = cert({
      projectId,
      clientEmail,
      privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
    });
  }

  const app = initializeApp({ credential });
  const db = getFirestore(app);

  const dataJsPath = resolveSourceFile("js/data.js");
  const sectionsJsPath = resolveSourceFile("js/sections_data.js");

  console.log(`📂 데이터 로드 중: ${dataJsPath}, ${sectionsJsPath}`);
  const defaultData = evaluateWindowScript(dataJsPath, "DUET_DEFAULT_DATA");
  const sectionsData = evaluateWindowScript(sectionsJsPath, "DUET_SECTIONS");

  // 1. portal_data/meta (메타 정보 및 월간보고 슬라이드)
  console.log("⏳ 1/4: portal_data/meta 및 custom_edits 업로드 중...");
  await db.collection("portal_data").doc("meta").set({
    meta: defaultData.meta || {},
    monthlyReports: defaultData.monthlyReports || [],
    updatedAt: Date.now(),
  });

  if (defaultData.customEdits) {
    await db.collection("portal_data").doc("custom_edits").set({
      ...defaultData.customEdits,
      updatedAt: Date.now(),
    });
  }

  // 2. drive_links/{linkId} (직위별 허용 roles 포함)
  console.log("⏳ 2/4: drive_links 컬렉션 업로드 중...");
  const driveLinks = Array.isArray(defaultData.driveLinks) ? defaultData.driveLinks : [];
  for (let i = 0; i < driveLinks.length; i++) {
    const dl = driveLinks[i];
    await db
      .collection("drive_links")
      .doc(dl.id)
      .set({
        ...dl,
        order: i,
        roles: Array.isArray(dl.roles)
          ? dl.roles
          : dl.category === "executive"
          ? ["duet_pres", "next_pres"]
          : ["duet_pres", "duet_head", "next_pres", "next_head"],
      });
  }

  // 3. sections/{tabId} (탭별 인수인계 문서)
  console.log("⏳ 3/4: sections 컬렉션 업로드 중...");
  const tabKeys = Object.keys(sectionsData);
  for (const tabKey of tabKeys) {
    await db.collection("sections").doc(tabKey).set({
      tabId: tabKey,
      content: sectionsData[tabKey],
      updatedAt: Date.now(),
    });
  }

  // 4. calendar_events/{eventId} (500건 단위 배치 처리)
  const events = Array.isArray(defaultData.calendarEvents) ? defaultData.calendarEvents : [];
  console.log(`⏳ 4/4: calendar_events 컬렉션 (${events.length}건) 업로드 중...`);
  const CHUNK_SIZE = 400;
  for (let i = 0; i < events.length; i += CHUNK_SIZE) {
    const chunk = events.slice(i, i + CHUNK_SIZE);
    const batch = db.batch();
    for (const ev of chunk) {
      const ref = db.collection("calendar_events").doc(String(ev.id));
      batch.set(ref, ev);
    }
    await batch.commit();
  }

  console.log("✅ Firestore 데이터 마이그레이션이 100% 완료되었습니다!");
}

main().catch((err) => {
  console.error("❌ 마이그레이션 실패:", err);
  process.exit(1);
});

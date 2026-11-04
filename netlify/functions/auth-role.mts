import type { Config, Context } from "@netlify/functions";
import crypto from "node:crypto";
import { getEnv, getFirebaseAdmin, JSON_SECURITY_HEADERS } from "../lib/firebase-admin.mts";

const VALID_ROLES = ["duet_pres", "duet_head", "next_pres", "next_head"] as const;
type RoleId = (typeof VALID_ROLES)[number];

const ROLE_ENV_KEYS: Record<RoleId, string> = {
  duet_pres: "ROLE_PWD_DUET_PRES",
  duet_head: "ROLE_PWD_DUET_HEAD",
  next_pres: "ROLE_PWD_NEXT_PRES",
  next_head: "ROLE_PWD_NEXT_HEAD",
};

const MAX_ATTEMPTS = 5;
const LOCKOUT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Warm-instance fallback rate limit store
const memoryRateLimit = new Map<string, { count: number; lockedUntil: number; lastAttempt: number }>();

function sha256Buffer(input: string): Buffer {
  return crypto.createHash("sha256").update(input, "utf8").digest();
}

function timingSafePasswordMatch(inputPwd: string, expectedPwd: string): boolean {
  const a = sha256Buffer("duet_const_time_" + inputPwd.trim());
  const b = sha256Buffer("duet_const_time_" + expectedPwd.trim());
  return crypto.timingSafeEqual(a, b);
}

function hashClientIp(ip: string): string {
  return crypto.createHash("sha256").update("duet_ip_salt_" + ip, "utf8").digest("hex").slice(0, 32);
}

export default async (req: Request, context: Context) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: JSON_SECURITY_HEADERS,
    });
  }

  const clientIp = context.ip || "unknown";
  const ipHash = hashClientIp(clientIp);
  const now = Date.now();

  // 1. Check in-memory rate limit first
  const memEntry = memoryRateLimit.get(ipHash);
  if (memEntry && memEntry.lockedUntil > now) {
    const remainMin = Math.ceil((memEntry.lockedUntil - now) / 60000);
    return new Response(
      JSON.stringify({
        ok: false,
        error: `비밀번호 입력 실패 횟수(${MAX_ATTEMPTS}회)를 초과하여 ${remainMin}분간 접속이 제한됩니다.`,
      }),
      { status: 429, headers: JSON_SECURITY_HEADERS }
    );
  }

  let body: { roleId?: string; password?: string; googleIdToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "잘못된 요청 형식입니다." }), {
      status: 400,
      headers: JSON_SECURITY_HEADERS,
    });
  }

  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const attemptRef = adminDb.collection("auth_attempts").doc(ipHash);

    // 2. Check Firestore persistent rate limit
    const attemptSnap = await attemptRef.get();
    const attemptData = attemptSnap.exists ? attemptSnap.data() || {} : {};
    const lockedUntil = Number(attemptData.lockedUntil || 0);

    if (lockedUntil > now) {
      memoryRateLimit.set(ipHash, {
        count: Number(attemptData.count || MAX_ATTEMPTS),
        lockedUntil,
        lastAttempt: now,
      });
      const remainMin = Math.ceil((lockedUntil - now) / 60000);
      return new Response(
        JSON.stringify({
          ok: false,
          error: `비밀번호 입력 실패 횟수(${MAX_ATTEMPTS}회)를 초과하여 ${remainMin}분간 접속이 제한됩니다.`,
        }),
        { status: 429, headers: JSON_SECURITY_HEADERS }
      );
    }

    // Mode A: Google OAuth Admin Verification (Optional)
    if (body.googleIdToken) {
      const decoded = await adminAuth.verifyIdToken(body.googleIdToken);
      const email = (decoded.email || "").toLowerCase().trim();
      const allowedRaw = getEnv("ADMIN_ALLOWED_EMAILS") || "";
      const allowedEmails = allowedRaw
        .split(",")
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean);

      if (!email || !allowedEmails.includes(email)) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "허용된 제18대 학생회장단(관리자) 구글 계정이 아닙니다.",
          }),
          { status: 403, headers: JSON_SECURITY_HEADERS }
        );
      }

      const customToken = await adminAuth.createCustomToken(`admin_${decoded.uid}`, {
        role: "duet_pres",
        canEdit: true,
        authMethod: "google_oauth",
      });

      return new Response(
        JSON.stringify({
          ok: true,
          role: "duet_pres",
          canEdit: true,
          customToken,
        }),
        { status: 200, headers: JSON_SECURITY_HEADERS }
      );
    }

    // Mode B: Role + Password Authentication
    const roleId = String(body.roleId || "").trim() as RoleId;
    const inputPwd = String(body.password || "").trim();

    if (!VALID_ROLES.includes(roleId) || !inputPwd) {
      return new Response(
        JSON.stringify({ ok: false, error: "직위와 비밀번호를 모두 입력해 주세요." }),
        { status: 400, headers: JSON_SECURITY_HEADERS }
      );
    }

    const envKey = ROLE_ENV_KEYS[roleId];
    const expectedPwd = getEnv(envKey);

    if (!expectedPwd) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `서버에 해당 직위(${roleId})의 비밀번호 환경변수가 아직 설정되지 않았습니다.`,
        }),
        { status: 500, headers: JSON_SECURITY_HEADERS }
      );
    }

    const isMatch = timingSafePasswordMatch(inputPwd, expectedPwd);

    if (!isMatch) {
      const prevCount =
        attemptData.lastAttempt && now - Number(attemptData.lastAttempt) < LOCKOUT_WINDOW_MS
          ? Number(attemptData.count || 0)
          : 0;
      const nextCount = prevCount + 1;
      const nextLock = nextCount >= MAX_ATTEMPTS ? now + LOCKOUT_WINDOW_MS : 0;

      await attemptRef.set(
        {
          count: nextCount,
          lastAttempt: now,
          lockedUntil: nextLock,
        },
        { merge: true }
      );

      memoryRateLimit.set(ipHash, {
        count: nextCount,
        lockedUntil: nextLock,
        lastAttempt: now,
      });

      const remainTries = Math.max(0, MAX_ATTEMPTS - nextCount);
      const errMsg =
        remainTries > 0
          ? `비밀번호가 일치하지 않습니다. (남은 시도 횟수: ${remainTries}회)`
          : `비밀번호 ${MAX_ATTEMPTS}회 연속 오류로 15분간 접속이 차단되었습니다.`;

      return new Response(JSON.stringify({ ok: false, error: errMsg }), {
        status: nextLock > 0 ? 429 : 401,
        headers: JSON_SECURITY_HEADERS,
      });
    }

    // Success: Clear failed attempts
    if (attemptSnap.exists) {
      await attemptRef.delete();
    }
    memoryRateLimit.delete(ipHash);

    const canEdit = roleId === "duet_pres";
    const uid = `duet_role_${roleId}`;
    const customToken = await adminAuth.createCustomToken(uid, {
      role: roleId,
      canEdit,
      issuedAtMs: now,
    });

    return new Response(
      JSON.stringify({
        ok: true,
        role: roleId,
        canEdit,
        customToken,
      }),
      { status: 200, headers: JSON_SECURITY_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "서버 인증 처리 중 오류가 발생했습니다.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_SECURITY_HEADERS,
    });
  }
};

export const config: Config = {
  path: "/api/auth-role",
  method: "POST",
};

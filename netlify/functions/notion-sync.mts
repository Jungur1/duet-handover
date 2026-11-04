import type { Config } from "@netlify/functions";
import { getEnv, getFirebaseAdmin, JSON_SECURITY_HEADERS } from "../lib/firebase-admin.mts";

function extractNotionDbId(rawInput: string): string {
  const clean = (rawInput || "").trim();
  const match = clean.match(/([a-fA-F0-9]{32})/);
  if (match) return match[1].toLowerCase();
  const dashed = clean.replace(/-/g, "").match(/([a-fA-F0-9]{32})/);
  return dashed ? dashed[1].toLowerCase() : clean;
}

function inferCategoryFromNotionText(text: string): { cat: string; label: string } {
  const t = (text || "").toLowerCase();
  if (t.includes("기획") || t.includes("스터디") || t.includes("친해져도") || t.includes("mt") || t.includes("고연전")) {
    return { cat: "plan", label: "기획국" };
  }
  if (t.includes("복지") || t.includes("생활") || t.includes("간식") || t.includes("반실") || t.includes("대여")) {
    return { cat: "welf", label: "복지국" };
  }
  if (t.includes("홍보") || t.includes("월간보고") || t.includes("피드백") || t.includes("카드뉴스")) {
    return { cat: "pr", label: "홍보국" };
  }
  if (t.includes("반운위") || t.includes("확운위") || t.includes("총회") || t.includes("선거") || t.includes("의결")) {
    return { cat: "gov", label: "의결기구" };
  }
  return { cat: "pres", label: "학생회장단" };
}

export default async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ ok: false, error: "Method Not Allowed" }), {
      status: 405,
      headers: JSON_SECURITY_HEADERS,
    });
  }

  const authHeader = req.headers.get("authorization") || "";
  const idToken = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";

  if (!idToken) {
    return new Response(JSON.stringify({ ok: false, error: "인증 토큰이 필요합니다." }), {
      status: 401,
      headers: JSON_SECURITY_HEADERS,
    });
  }

  try {
    const { adminAuth, adminDb } = getFirebaseAdmin();
    const decoded = await adminAuth.verifyIdToken(idToken);

    if (decoded.role !== "duet_pres") {
      return new Response(
        JSON.stringify({ ok: false, error: "18대 학생회장단(관리자) 권한만 노션 동기화를 실행할 수 있습니다." }),
        { status: 403, headers: JSON_SECURITY_HEADERS }
      );
    }

    const notionToken = getEnv("NOTION_TOKEN");
    const rawDbId = getEnv("NOTION_DATABASE_ID");

    if (!notionToken || !rawDbId) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Netlify 서버 환경변수(NOTION_TOKEN, NOTION_DATABASE_ID)가 설정되지 않았습니다.",
        }),
        { status: 500, headers: JSON_SECURITY_HEADERS }
      );
    }

    const dbId = extractNotionDbId(rawDbId);
    const targetUrl = `https://api.notion.com/v1/databases/${dbId}/query`;

    interface NotionPage {
      id: string;
      properties?: Record<string, unknown>;
    }

    let pages: NotionPage[] = [];
    let hasMore = true;
    let startCursor: string | undefined = undefined;

    while (hasMore) {
      const payload: Record<string, unknown> = { page_size: 100 };
      if (startCursor) payload.start_cursor = startCursor;

      const res = await fetch(targetUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${notionToken}`,
          "Notion-Version": "2022-06-28",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Notion API 오류 (${res.status}): ${errText.slice(0, 140)}`);
      }

      const data = (await res.json()) as {
        results?: NotionPage[];
        has_more?: boolean;
        next_cursor?: string;
      };
      pages = pages.concat(data.results || []);
      hasMore = Boolean(data.has_more);
      startCursor = data.next_cursor || undefined;
    }

    const existingSnap = await adminDb.collection("calendar_events").get();
    const existingIds = new Set<string>();
    existingSnap.forEach((doc) => existingIds.add(doc.id));

    let addedCount = 0;
    let updatedCount = 0;
    const batch = adminDb.batch();

    for (const page of pages) {
      const props = (page.properties || {}) as Record<
        string,
        {
          type?: string;
          title?: Array<{ plain_text: string }>;
          date?: { start?: string; end?: string };
          status?: { name?: string };
          select?: { name?: string };
          multi_select?: Array<{ name: string }>;
          rich_text?: Array<{ plain_text: string }>;
        }
      >;

      let title = "";
      let startDate = "";
      let endDate = "";
      let statusName = "";
      const deptNames: string[] = [];
      let descText = "";

      for (const key of Object.keys(props)) {
        const p = props[key];
        if (!p) continue;
        if (p.type === "title" && Array.isArray(p.title)) {
          title = p.title.map((x) => x.plain_text).join("").trim();
        } else if (p.type === "date" && p.date?.start) {
          startDate = p.date.start.slice(0, 10);
          if (p.date.end) endDate = p.date.end.slice(0, 10);
        } else if (p.type === "status" && p.status?.name) {
          statusName = p.status.name;
        } else if (p.type === "select" && p.select?.name) {
          deptNames.push(p.select.name);
        } else if (p.type === "multi_select" && Array.isArray(p.multi_select)) {
          p.multi_select.forEach((x) => deptNames.push(x.name));
        } else if (p.type === "rich_text" && Array.isArray(p.rich_text)) {
          const rt = p.rich_text.map((x) => x.plain_text).join("").trim();
          if (rt) descText += (descText ? "\n" : "") + rt;
        }
      }

      if (!title || !startDate) continue;
      if (startDate >= "2026-12-01") continue; // 제18대 임기 외 일정 제외

      const notionEvId = "notion_" + page.id.replace(/-/g, "");
      const year = Number(startDate.slice(0, 4));
      const month = Number(startDate.slice(5, 7));
      const day = Number(startDate.slice(8, 10)) || 1;
      const endDay =
        endDate && endDate.slice(0, 7) === startDate.slice(0, 7)
          ? Number(endDate.slice(8, 10)) || day
          : day;
      const monthKey = startDate.slice(0, 7);
      let displayDate = startDate.replace(/-/g, ".");
      if (endDate && endDate !== startDate) {
        displayDate += " ~ " + endDate.slice(5).replace(/-/g, ".");
      }

      const deptStr = deptNames.length > 0 ? deptNames.join(", ") : "";
      const inferred = inferCategoryFromNotionText(deptStr + " " + title);
      const finalDept = deptStr || inferred.label;
      const deptLabel = statusName ? `${finalDept} (${statusName})` : finalDept;

      const docRef = adminDb.collection("calendar_events").doc(notionEvId);

      if (existingIds.has(notionEvId)) {
        batch.set(
          docRef,
          {
            title,
            date: displayDate,
            status: statusName,
            deptLabel,
          },
          { merge: true }
        );
        updatedCount++;
      } else {
        const noticeText =
          descText ||
          `[노션(Notion) 캘린더 일정 기록]\n• 일정명: ${title}\n• 일시: ${displayDate}\n• 담당 국서: ${finalDept}${
            statusName ? `\n• 진행 상태: ${statusName}` : ""
          }`;
        batch.set(docRef, {
          id: notionEvId,
          notionPageId: page.id,
          year,
          month,
          day,
          endDay,
          monthKey,
          date: displayDate,
          category: inferred.cat,
          deptLabel,
          status: statusName,
          title,
          summary: "",
          images: [],
          noticeText,
          thought:
            "• 노션(Notion) 캘린더 데이터베이스에서 동기화된 제18대 학생회 Duet 공식 일정입니다. 관리자 모드에서 [코멘트/공지 편집]을 켜면 세부 코멘트를 자유롭게 추가하실 수 있습니다.",
        });
        addedCount++;
      }
    }

    if (addedCount > 0 || updatedCount > 0) {
      await batch.commit();
    }

    return new Response(
      JSON.stringify({
        ok: true,
        totalNotionPages: pages.length,
        addedCount,
        updatedCount,
      }),
      { status: 200, headers: JSON_SECURITY_HEADERS }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "노션 동기화 중 서버 오류가 발생했습니다.";
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: JSON_SECURITY_HEADERS,
    });
  }
};

export const config: Config = {
  path: "/api/notion-sync",
  method: "POST",
};

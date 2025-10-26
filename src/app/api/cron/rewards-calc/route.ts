// src/app/api/cron/rewards-calc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getKSTDateString } from "@/lib/dateUtil";

export const dynamic = "force-dynamic";

// 허용 규칙: x-vercel-cron || user-agent: vercel-cron || 테스트 토큰
function isAllowed(req: NextRequest) {
  const hv = req.headers.get("x-vercel-cron");
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const key = req.nextUrl.searchParams.get("cron_key");
  if (hv) return true;
  if (ua.includes("vercel-cron")) return true;
  if (key && process.env.CRON_TEST_KEY && key === process.env.CRON_TEST_KEY) return true;
  if (process.env.NODE_ENV !== "production") return true; // 로컬 편의(원치 않으면 제거)
  return false;
}

// 절대 URL 생성: 환경변수 우선, 없으면 Host 헤더 사용
function baseUrlFrom(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("host");
  return `https://${host}`;
}

async function handle(req: NextRequest) {
  if (!isAllowed(req)) {
    console.warn("[cron] rewards-calc unauthorized", {
      ua: req.headers.get("user-agent"),
      hasVercelCronHeader: !!req.headers.get("x-vercel-cron"),
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const date = getKSTDateString();
  const base = baseUrlFrom(req);

  const res = await fetch(`${base}/api/admin/payouts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date, commit: false }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[cron] rewards-calc", { status: res.status, date });

  return NextResponse.json({
    ok: res.ok,
    step: "rewards-calc",
    date,
    status: res.status,
    data,
  });
}

// Vercel 대시보드 Run(=GET) / 실제 스케줄(=POST) 모두 지원
export async function GET(req: NextRequest) {
  try { return await handle(req); }
  catch (e: any) {
    console.error("[cron] rewards-calc GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { return await handle(req); }
  catch (e: any) {
    console.error("[cron] rewards-calc POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

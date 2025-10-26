// src/app/api/cron/rewards-calc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getKSTDateString } from "@/lib/dateUtil";

export const dynamic = "force-dynamic";

function assertFromVercelCron(req: NextRequest) {
  // Vercel Cron/Run 호출에만 붙는 헤더
  if (!req.headers.get("x-vercel-cron")) {
    throw new Error("Unauthorized (Not from Vercel Cron)");
  }
}

// 절대 URL 생성: 환경변수 우선, 없으면 Host 헤더 사용
function baseUrlFrom(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("host");
  return `https://${host}`;
}

async function handle(req: NextRequest) {
  assertFromVercelCron(req);

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

// Vercel 대시보드의 Run 버튼(=GET)도 같은 로직 실행
export async function GET(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e: any) {
    console.error("[cron] rewards-calc GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

// 정기 실행(=POST)도 지원
export async function POST(req: NextRequest) {
  try {
    return await handle(req);
  } catch (e: any) {
    console.error("[cron] rewards-calc POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

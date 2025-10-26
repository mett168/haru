import { NextRequest, NextResponse } from "next/server";
import { getKSTDateString } from "@/lib/dateUtil";

export const dynamic = "force-dynamic";

// 허용: x-vercel-cron || UA=vercel-cron || cron_key(옵션) || (개발환경)
function isAllowed(req: NextRequest) {
  const hv = req.headers.get("x-vercel-cron");
  const ua = (req.headers.get("user-agent") || "").toLowerCase();
  const key = req.nextUrl.searchParams.get("cron_key");
  if (hv) return true;
  if (ua.includes("vercel-cron")) return true;
  if (key && process.env.CRON_TEST_KEY && key === process.env.CRON_TEST_KEY) return true;
  if (process.env.NODE_ENV !== "production") return true;
  return false;
}

function baseUrlFrom(req: NextRequest) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = req.headers.get("host");
  return `https://${host}`;
}

async function handle(req: NextRequest) {
  if (!isAllowed(req)) {
    console.warn("[cron] payouts-deposit unauthorized", {
      ua: req.headers.get("user-agent"),
      hasVercelCronHeader: !!req.headers.get("x-vercel-cron"),
    });
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const date = getKSTDateString();
  const base = baseUrlFrom(req);

  const res = await fetch(`${base}/api/admin/payouts/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }), // ✅ 송금 단계
  });

  const data = await res.json().catch(() => ({}));
  console.log("[cron] payouts-deposit", { status: res.status, date });

  return NextResponse.json({
    ok: res.ok,
    step: "payouts-deposit",
    date,
    status: res.status,
    data,
  });
}

export async function GET(req: NextRequest) {
  try { return await handle(req); }
  catch (e: any) {
    console.error("[cron] payouts-deposit GET error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try { return await handle(req); }
  catch (e: any) {
    console.error("[cron] payouts-deposit POST error:", e);
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 500 });
  }
}

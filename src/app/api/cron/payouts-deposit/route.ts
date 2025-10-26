import { NextRequest, NextResponse } from "next/server";
import { getKSTDateString } from "@/lib/dateUtil";

export const dynamic = "force-dynamic";

function assertFromVercelCron(req: NextRequest) {
  if (!req.headers.get("x-vercel-cron")) throw new Error("Unauthorized (Not from Vercel Cron)");
}
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

  const res = await fetch(`${base}/api/admin/payouts/deposit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ date }),
  });

  const data = await res.json().catch(() => ({}));
  console.log("[cron] payouts-deposit", { status: res.status, date });
  return NextResponse.json({ ok: res.ok, step: "payouts-deposit", date, status: res.status, data });
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

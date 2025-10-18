import { NextRequest, NextResponse } from "next/server";
import { getKSTDateString } from "@/lib/dateUtil"; // 이미 사용 중인 유틸

export const dynamic = "force-dynamic";

function assertFromVercelCron(req: NextRequest) {
  if (!req.headers.get("x-vercel-cron")) {
    throw new Error("Unauthorized (Not from Vercel Cron)");
  }
}

export async function POST(req: NextRequest) {
  try {
    assertFromVercelCron(req);
    const date = getKSTDateString();

    const res = await fetch(`/api/admin/payouts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, commit: false }),
    });

    const data = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: res.ok, step: "rewards-calc", date, status: res.status, data });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message ?? String(e) }, { status: 401 });
  }
}

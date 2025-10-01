// /src/app/api/admin/investments/create/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

function addDaysKST(yyyy_mm_dd: string, days: number) {
  // KST 기준으로 날짜 계산
  const d = new Date(`${yyyy_mm_dd}T00:00:00+09:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

export async function POST(req: Request) {
  try {
    const { ref_code, invest_amount_usdt, invest_date, memo } = await req.json();

    if (!ref_code || !invest_amount_usdt || !invest_date) {
      return NextResponse.json({ ok: false, error: "필수 값 누락" }, { status: 400 });
    }

    const maturity_date = addDaysKST(invest_date, 365); // ✅ 만기일 계산

    const { error } = await supabase.from("investments").insert({
      ref_code,
      invest_amount_usdt,
      invest_date,
      maturity_date,                 // ✅ 함께 저장
      memo: memo ?? null,
      created_at: new Date().toISOString(),
    });

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
  }
}

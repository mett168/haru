import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") || new Date(Date.now() + 9*3600*1000).toISOString().slice(0,10);

    // 오늘 원금 상환
    const { data: repay } = await supabase
      .from("repayments")
      .select("ref_code, amount")
      .eq("repay_date", date);
    const repayMap = new Map<string, number>();
    (repay||[]).forEach(r=>{
      repayMap.set(r.ref_code, (repayMap.get(r.ref_code)||0) + Number(r.amount||0));
    });

    // 오늘 이자
    const { data: interests } = await supabase
      .from("daily_interests")
      .select("ref_code, user_interest")
      .eq("interest_date", date);
    const intMap = new Map<string, number>();
    (interests||[]).forEach(r=>{
      intMap.set(r.ref_code, Number(r.user_interest||0));
    });

    // 합산
    const rows: any[] = [];
    const allKeys = new Set([...repayMap.keys(), ...intMap.keys()]);
    allKeys.forEach(code=>{
      const today_repay = repayMap.get(code)||0;
      const today_interest = intMap.get(code)||0;
      rows.push({
        ref_code: code,
        today_repay,
        today_interest,
        today_total: today_repay + today_interest,
      });
    });

    return NextResponse.json({ date, data: rows });
  } catch (err: any) {
    return NextResponse.json({ error: String(err.message || err) }, { status: 500 });
  }
}

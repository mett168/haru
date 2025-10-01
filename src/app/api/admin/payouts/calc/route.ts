// /app/api/admin/payouts/calc/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { date, commit = true } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // 1) 오늘 유효한 투자 조회 (투자일 ≤ date ≤ 만기일)
    const { data: invs, error: eInv } = await supabase
      .from("investments")
      .select("ref_code, invest_amount_usdt, invest_date, maturity_date");
    if (eInv) throw eInv;

    const repayByRef = new Map<string, number>();
    const interestByRef = new Map<string, number>();

    for (const r of invs ?? []) {
      if (r.invest_date <= date && r.maturity_date >= date) {
        const principal = Number(r.invest_amount_usdt || 0);

        // 규칙 적용
        const today_repay = principal / 365;
        const today_interest = principal * 0.6 / 365;

        repayByRef.set(r.ref_code, (repayByRef.get(r.ref_code) || 0) + today_repay);
        interestByRef.set(r.ref_code, (interestByRef.get(r.ref_code) || 0) + today_interest);
      }
    }

    // 2) 유저별 집계
    const rows: any[] = [];
    const allCodes = new Set([...repayByRef.keys(), ...interestByRef.keys()]);
    for (const code of allCodes) {
      const today_repay = repayByRef.get(code) || 0;
      const today_interest = interestByRef.get(code) || 0;
      rows.push({
        ref_code: code,
        transfer_date: date,
        today_repay,
        today_interest,
        total_amount: today_repay + today_interest,
        status: "pending",
      });
    }

    if (!commit) {
      const sum = (k: string) => rows.reduce((a, b) => a + Number(b[k] || 0), 0);
      return NextResponse.json({
        date,
        count: rows.length,
        sums: {
          repay: sum("today_repay"),
          interest: sum("today_interest"),
          total: sum("total_amount"),
        },
        sample: rows.slice(0, 10),
      });
    }

    // 3) payout_transfers upsert
    if (rows.length) {
      const { error: eUp } = await supabase
        .from("payout_transfers")
        .upsert(rows, { onConflict: "ref_code,transfer_date" });
      if (eUp) throw eUp;
    }

    return NextResponse.json({ date, committed: true, upserted: rows.length });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

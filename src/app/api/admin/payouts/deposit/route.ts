import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/**
 * POST /api/admin/payouts/deposit
 * body: { date: "YYYY-MM-DD" }
 */
export async function POST(req: NextRequest) {
  try {
    const { date } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // 1) 당일 지급 대상
    const { data: payouts, error: ePayout } = await supabase
      .from("payout_transfers")
      .select("ref_code, today_repay, total_amount")
      .eq("transfer_date", date);
    if (ePayout) throw ePayout;

    const targets = (payouts ?? []).filter((r: any) => Number(r.today_repay || 0) > 0);

    let totalLogUpserts = 0;
    let totalRepayUpdated = 0;
    let totalLedgerUpserts = 0;

    for (const p of targets) {
      const ref = String(p.ref_code);
      const repayToday = +Number(p.today_repay || 0).toFixed(6);
      const depositAmount = +Number(p.total_amount || 0).toFixed(6);

      // 유저의 active 원금 목록 가져와 분배
      const { data: reps, error: eReps } = await supabase
        .from("repayments")
        .select("id, investment_id, principal_remaining, daily_amount")
        .eq("ref_code", ref)
        .eq("status", "active")
        .order("daily_amount", { ascending: false }); // 필요시 start_date ASC
      if (eReps) throw eReps;

      let remain = repayToday;
      const updates: { id: string; principal_remaining: number }[] = [];
      const logs: Array<{
        ref_code: string;
        investment_id: string;
        amount: number;
        repay_date: string;
        status: string;
        source: string;
      }> = [];

      for (const r of reps ?? []) {
        if (remain <= 0) break;

        const rowRem = +Number(r.principal_remaining || 0).toFixed(6);
        if (rowRem <= 0) continue;

        const cap = Number(r.daily_amount || remain);
        const portion = Math.min(rowRem, remain, cap);
        if (portion <= 0) continue;

        updates.push({
          id: r.id,
          principal_remaining: +(rowRem - portion).toFixed(6),
        });

        logs.push({
          ref_code: ref,
          investment_id: r.investment_id,
          amount: +portion.toFixed(6),
          repay_date: date,
          status: "paid",
          source: "payout",
        });

        remain = +(remain - portion).toFixed(6);
      }

      // 2-1) 원금 차감 업데이트: 행별 update (upsert 아님)
      if (updates.length > 0) {
        const tasks = updates.map((u) =>
          supabase
            .from("repayments")
            .update({ principal_remaining: u.principal_remaining })
            .eq("id", u.id)
        );
        const results = await Promise.all(tasks);
        for (const r of results) {
          if (r.error) throw r.error;
        }
        totalRepayUpdated += updates.length;
      }

      // 2-2) 상환 로그 기록 (멱등 upsert: 유니크 제약 필요)
      if (logs.length > 0) {
        const { data: ins, error: eIns } = await supabase
          .from("repayment_logs")
          .upsert(logs, { onConflict: "ref_code,investment_id,repay_date,source" })
          .select();
        if (eIns) throw eIns;
        totalLogUpserts += ins?.length ?? 0;
      }

      // 3) 보유자산 적립 (asset_ledger upsert)
      if (depositAmount > 0) {
        const { data: up2, error: eUp2 } = await supabase
          .from("asset_ledger")
          .upsert(
            [{ ref_code: ref, amount: depositAmount, reason: "payout", transfer_date: date }],
            { onConflict: "ref_code,transfer_date,reason" }
          )
          .select();
        if (eUp2) throw eUp2;
        totalLedgerUpserts += up2?.length ?? 0;
      }
    }

    return NextResponse.json({
      message: "송금 완료: 원금 차감 + 상환로그 기록 + 보유자산 적립",
      logs_upserted: totalLogUpserts,
      repayments_updated: totalRepayUpdated,
      ledger_upserted: totalLedgerUpserts,
      date,
    });
  } catch (e: any) {
    console.error("[deposit] failed:", e?.message ?? e);
    return NextResponse.json({ error: e?.message || "서버 오류" }, { status: 500 });
  }
}

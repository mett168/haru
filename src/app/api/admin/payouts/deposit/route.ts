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

    // 1) 지급 대상 조회 (pending 상태만)
    const { data: payouts, error: ePayout } = await supabase
      .from("payout_transfers")
      .select("id, ref_code, today_repay, total_amount")
      .eq("transfer_date", date)
      .eq("status", "pending");
    if (ePayout) throw ePayout;

    const targets = (payouts ?? []).filter((r: any) => Number(r.today_repay || 0) > 0);

    let totalLogUpserts = 0;
    let totalRepayUpdated = 0;
    let totalLedgerUpserts = 0;
    let totalStatusUpdated = 0;

    for (const p of targets) {
      const ref = String(p.ref_code);
      const repayToday = +Number(p.today_repay || 0).toFixed(6);
      const depositAmount = +Number(p.total_amount || 0).toFixed(6);

      // ── 2) 유저의 active 원금 목록 가져오기
      const { data: reps, error: eReps } = await supabase
        .from("repayments")
        .select("id, investment_id, principal_remaining, daily_amount")
        .eq("ref_code", ref)
        .eq("status", "active")
        .order("daily_amount", { ascending: false });
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

      // ── 2-1) 원금 차감 & 상환 로그 준비
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

      // ── 2-2) repayments 업데이트
      if (updates.length > 0) {
        const results = await Promise.all(
          updates.map((u) =>
            supabase.from("repayments")
              .update({ principal_remaining: u.principal_remaining })
              .eq("id", u.id)
          )
        );
        results.forEach((r) => { if (r.error) throw r.error; });
        totalRepayUpdated += updates.length;
      }

      // ── 2-3) 상환 로그 기록
      if (logs.length > 0) {
        const { data: ins, error: eIns } = await supabase
          .from("repayment_logs")
          .upsert(logs, { onConflict: "ref_code,investment_id,repay_date,source" })
          .select();
        if (eIns) throw eIns;
        totalLogUpserts += ins?.length ?? 0;
      }

      // ── 3) 보유자산 적립 (asset_ledger)
      if (depositAmount > 0) {
        const { data: up2, error: eUp2 } = await supabase
          .from("asset_ledger")
          .upsert(
            [{
              ref_code: ref,
              amount: depositAmount,
              reason: "payout",
              transfer_date: date,
              created_at: new Date().toISOString(),
            }],
            { onConflict: "ref_code,transfer_date,reason" }
          )
          .select();
        if (eUp2) throw eUp2;
        totalLedgerUpserts += up2?.length ?? 0;
      }

      // ── 4) payout_transfers → success 처리
      const { error: eUpd } = await supabase
        .from("payout_transfers")
        .update({ status: "success" })
        .eq("id", p.id);
      if (eUpd) throw eUpd;
      totalStatusUpdated++;
    }

    return NextResponse.json({
      message: "송금 완료: 원금 차감 + 상환로그 기록 + 보유자산 적립 + 상태 갱신",
      logs_upserted: totalLogUpserts,
      repayments_updated: totalRepayUpdated,
      ledger_upserted: totalLedgerUpserts,
      status_updated: totalStatusUpdated,
      date,
    });
  } catch (e: any) {
    console.error("[deposit] failed:", e?.message ?? e);
    return NextResponse.json({ error: e?.message || "서버 오류" }, { status: 500 });
  }
}

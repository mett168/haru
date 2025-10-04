import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

function nowKSTISOString(): string {
  const now = new Date();
  return new Date(now.getTime() + 9 * 60 * 60 * 1000).toISOString();
}

/**
 * POST /api/admin/payouts/deposit
 * body:
 *  - date: "YYYY-MM-DD" (필수)
 *  - settleOnly?: boolean (선택)  ← true면 상태변경만 수행
 *  - refCodes?: string[]         ← 부분 처리시 사용(선택, settleOnly 모드에서만)
 *
 * 기본(= settleOnly 미지정 또는 false):
 *   원금 차감 + 상환로그 기록 + 보유자산 적립 + payout_transfers(status: pending 유지)
 *
 * settleOnly === true:
 *   payout_transfers (해당 날짜, pending) → status: 'success', processed_at 기록
 *   (원금 차감/로그/자산적립은 수행하지 않음)
 */
export async function POST(req: NextRequest) {
  try {
    const { date, settleOnly, refCodes } = await req.json();

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // ──────────────────────────────────────────────────────────────
    // A) settleOnly 모드: 상태변경만
    // ──────────────────────────────────────────────────────────────
    if (settleOnly === true) {
      let q = supabase
        .from("payout_transfers")
        .update({ status: "success", processed_at: nowKSTISOString() })
        .eq("transfer_date", date)
        .eq("status", "pending");

      if (Array.isArray(refCodes) && refCodes.length > 0) {
        q = q.in("ref_code", refCodes);
      }

      const { data, error } = await q.select("id, ref_code, user_name, total_amount");
      if (error) throw error;

      return NextResponse.json({
        ok: true,
        mode: "settleOnly",
        updated: data?.length ?? 0,
        rows: data ?? [],
        date,
      });
    }

    // ──────────────────────────────────────────────────────────────
    // B) 기존 로직(원금 차감 + 상환로그 + 보유자산 적립 + status는 pending 유지)
    // ──────────────────────────────────────────────────────────────

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
    // status는 여기서 success로 바꾸지 않음(기존 동작 유지)

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
            supabase
              .from("repayments")
              .update({ principal_remaining: u.principal_remaining })
              .eq("id", u.id)
          )
        );
        results.forEach((r) => {
          if (r.error) throw r.error;
        });
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
            [
              {
                ref_code: ref,
                amount: depositAmount,
                reason: "payout",
                transfer_date: date,
                created_at: nowKSTISOString(),
              },
            ],
            { onConflict: "ref_code,transfer_date,reason" }
          )
          .select();
        if (eUp2) throw eUp2;
        totalLedgerUpserts += up2?.length ?? 0;
      }

      // ✅ 주의: 여기서는 payout_transfers.status를 success로 바꾸지 않음
      // (송금 버튼에서 settleOnly=true로 별도 처리)
    }

    return NextResponse.json({
      ok: true,
      mode: "deposit",
      message: "원금 차감 + 상환로그 기록 + 보유자산 적립 (상태는 pending 유지)",
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

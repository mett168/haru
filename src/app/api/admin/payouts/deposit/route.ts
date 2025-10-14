import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getKSTISOString } from "@/lib/dateUtil";

export const dynamic = "force-dynamic";

type PTStatus = "pending" | "sent" | "success" | "failed";

function isYYYYMMDD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(s);
}

export async function POST(req: NextRequest) {
  try {
    const { date, settleOnly = false } = await req.json();

    if (!date || !isYYYYMMDD(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // 1) 해당 일자의 지급 대상 불러오기
    const { data: rows, error: eSelect } = await supabase
      .from("payout_transfers")
      .select("id, ref_code, total_amount, today_repay, today_interest, status")
      .eq("transfer_date", date);

    if (eSelect) throw eSelect;

    const targets = (rows ?? []).filter((r: any) => Number(r.total_amount || 0) > 0);

    if (targets.length === 0) {
      return NextResponse.json({ ok: true, message: "지급 대상 없음", count: 0 });
    }

    // 2) settleOnly 모드 (상태만 변경)
    if (settleOnly) {
      const { error: eUp } = await supabase
        .from("payout_transfers")
        .update({ status: "sent" as PTStatus })
        .eq("transfer_date", date)
        .gt("total_amount", 0);

      if (eUp) throw eUp;

      return NextResponse.json({
        ok: true,
        message: "[settleOnly] 상태만 sent로 업데이트",
        count: targets.length,
      });
    }

    const nowISO = getKSTISOString();

    // 3) 대상별 처리
    let okCount = 0;
    const results: Array<{ ref_code: string; amount: number; ok: boolean; reason?: string }> = [];

    for (const r of targets) {
      const ref = r.ref_code as string;
      const amount = Number(r.total_amount || 0);

      // 3-1) asset_ledger insert (asset_history 기록 제거)
      const { error: eLedger } = await supabase.from("asset_ledger").insert([
        {
          ref_code: ref,
          amount,
          reason: "payout", // 원장의 목적
          transfer_date: date, // YYYY-MM-DD
          created_at: nowISO,
          // memo: `repay=${r.today_repay||0}, interest=${r.today_interest||0}`,
        },
      ]);

      if (eLedger) {
        results.push({ ref_code: ref, amount, ok: false, reason: `asset_ledger: ${eLedger.message}` });
        await supabase
          .from("payout_transfers")
          .update({ status: "failed" as PTStatus })
          .eq("ref_code", ref)
          .eq("transfer_date", date);
        continue;
      }

      // 3-2) ledger 성공 시 상태 갱신
      const { error: eUp } = await supabase
        .from("payout_transfers")
        .update({ status: "sent" as PTStatus })
        .eq("ref_code", ref)
        .eq("transfer_date", date);

      if (eUp) {
        results.push({ ref_code: ref, amount, ok: false, reason: `status update: ${eUp.message}` });
        continue;
      }

      results.push({ ref_code: ref, amount, ok: true });
      okCount += 1;
    }

    // 4) 최종 결과 반환
    return NextResponse.json({
      ok: true,
      date,
      totalTargets: targets.length,
      successCount: okCount,
      results,
    });
  } catch (err: any) {
    console.error("[payouts/deposit] error:", err?.message || err);
    return NextResponse.json({ error: err?.message || String(err) }, { status: 500 });
  }
}

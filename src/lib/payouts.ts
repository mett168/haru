// src/lib/payouts.ts
import { supabase } from "@/lib/supabaseClient";

const DAILY_RATE_TOTAL = 1.2 / 365; // 투자자60 + 추천36 + 센터24 = 120%/연 -> 일 이율

/** 주의: date는 'YYYY-MM-DD' 문자열 (KST 기준 권장) */
export async function calculateAndSavePayouts(date: string, commit = true) {
  // 1) 전체 투자건 로드 후 '활성(투자일 ≤ date ≤ 만기일)'만 합산
  const { data: invs, error: eInv } = await supabase
    .from("investments")
    .select("ref_code, invest_amount_usdt, invest_date, maturity_date");
  if (eInv) throw eInv;

  const principalByRef = new Map<string, number>();
  for (const row of invs ?? []) {
    if (row.invest_date <= date && row.maturity_date >= date) {
      principalByRef.set(
        row.ref_code,
        (principalByRef.get(row.ref_code) || 0) + Number(row.invest_amount_usdt || 0)
      );
    }
  }

  // 2) 당일 원금상환 합계(유저별)
  const { data: repays, error: eRep } = await supabase
    .from("repayments")
    .select("ref_code, amount")
    .eq("repay_date", date);
  if (eRep) throw eRep;

  const repayByRef = new Map<string, number>();
  for (const r of repays ?? []) {
    repayByRef.set(r.ref_code, (repayByRef.get(r.ref_code) || 0) + Number(r.amount || 0));
  }

  // 3) 유저별 지급행 생성 (하루 한 줄)
  const refs = new Set<string>([...principalByRef.keys(), ...repayByRef.keys()]);
  const rows = Array.from(refs).map((ref) => {
    const principal = principalByRef.get(ref) || 0;
    const today_interest = principal * DAILY_RATE_TOTAL; // 세 파트 합계 이자
    const today_repay = repayByRef.get(ref) || 0;
    const total_amount = today_interest + today_repay;

    return {
      ref_code: ref,
      transfer_date: date,          // 'YYYY-MM-DD'
      today_repay,
      today_interest,
      total_amount,
      status: "pending",
      created_at: new Date().toISOString(),
    };
  });

  // 4) 저장 (원하면 시뮬레이션만 하려면 commit=false)
  if (commit && rows.length) {
    const { error: eUp } = await supabase
      .from("payout_transfers")
      .upsert(rows, { onConflict: "ref_code,transfer_date" });
    if (eUp) throw eUp;
  }
  return rows;
}

/** 하루치 지급행 조회 */
export async function fetchPayoutRows(date: string) {
  const { data, error } = await supabase
    .from("payout_transfers")
    .select("ref_code, transfer_date, today_repay, today_interest, total_amount, status")
    .eq("transfer_date", date)
    .order("ref_code", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** 하루치 지급 확정 (pending -> completed) */
export async function commitPayouts(date: string) {
  const { error } = await supabase
    .from("payout_transfers")
    .update({ status: "completed" })
    .eq("transfer_date", date)
    .eq("status", "pending");
  if (error) throw error;
}

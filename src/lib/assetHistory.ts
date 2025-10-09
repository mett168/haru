import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString, getKSTISOString } from "@/lib/dateUtil";

/** 보유자산 이력 타입 */
export type AssetChangeType =
  | "haru_deposit"        // 하루머니 입금 (in)
  | "reinvest_withdraw"   // 보충(재투자) 출금 (out)
  | "cash_withdraw";      // 현금교환 출금 (out)

export type AssetDirection = "in" | "out";

export function labelOf(t: AssetChangeType) {
  switch (t) {
    case "haru_deposit":
      return "하루머니 입금";
    case "reinvest_withdraw":
      return "보충 출금(재투자)";
    case "cash_withdraw":
      return "현금교환 출금";
  }
}

/** change_type 기본 방향 매핑 */
const TYPE_DEFAULT_DIRECTION: Record<AssetChangeType, AssetDirection> = {
  haru_deposit: "in",
  reinvest_withdraw: "out",
  cash_withdraw: "out",
};

/** 금액 정규화: 절대값 + 소수 2자리 반올림 */
function normalizeAmount(n: number): number {
  const v = Math.abs(Number(n) || 0);
  return Math.round(v * 100) / 100;
}

/** 방향 보정: 주어진 direction이 없거나 잘못되면 change_type 기준으로 강제 */
function resolveDirection(
  change_type: AssetChangeType,
  direction?: AssetDirection
): AssetDirection {
  if (direction === "in" || direction === "out") return direction;
  return TYPE_DEFAULT_DIRECTION[change_type];
}

/** 단일 기록 */
export async function addAssetHistory(params: {
  ref_code: string;
  change_type: AssetChangeType;
  direction?: AssetDirection;     // 선택: 생략 시 change_type에 맞춰 자동
  amount: number;                 // 양수/음수 상관없음 → 내부에서 절대값+반올림
  memo?: string;
  balance_after?: number;         // 선택
}) {
  const {
    ref_code,
    change_type,
    direction,
    amount,
    memo,
    balance_after,
  } = params;

  const finalAmount = normalizeAmount(amount);
  if (finalAmount === 0) {
    // 0원 기록은 무시 (원하면 throw로 바꿔도 됨)
    return { inserted: false, reason: "amount_zero" as const };
  }

  const finalDirection = resolveDirection(change_type, direction);

  const payload = {
    ref_code,
    change_type,
    direction: finalDirection,
    amount: finalAmount,
    memo: memo ?? labelOf(change_type),
    balance_after: typeof balance_after === "number" ? balance_after : null,
    created_at: getKSTISOString(),
    kst_date: getKSTDateString(),
  };

  const { data, error } = await supabase
    .from("asset_history")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw error;

  return { inserted: true as const, id: data?.id ?? null };
}

/** 여러 건 한 번에 기록 */
export async function addAssetHistoryBatch(items: Array<{
  ref_code: string;
  change_type: AssetChangeType;
  direction?: AssetDirection;
  amount: number;
  memo?: string;
  balance_after?: number;
}>) {
  const rows = items
    .map((x) => {
      const amt = normalizeAmount(x.amount);
      if (amt === 0) return null;

      return {
        ref_code: x.ref_code,
        change_type: x.change_type,
        direction: resolveDirection(x.change_type, x.direction),
        amount: amt,
        memo: x.memo ?? labelOf(x.change_type),
        balance_after:
          typeof x.balance_after === "number" ? x.balance_after : null,
        created_at: getKSTISOString(),
        kst_date: getKSTDateString(),
      };
    })
    .filter(Boolean) as any[];

  if (rows.length === 0) return { inserted: 0 };

  const { error, count } = await supabase
    .from("asset_history")
    .insert(rows, { count: "exact" });

  if (error) throw error;
  return { inserted: count ?? rows.length };
}

/** 합계(총 입금/총 출금/잔액) */
export async function getAssetHistoryTotals(ref_code: string) {
  const { data, error } = await supabase
    .from("asset_history")
    .select("direction, amount")
    .eq("ref_code", ref_code);

  if (error) throw error;

  let totalIn = 0;
  let totalOut = 0;

  (data ?? []).forEach((r: any) => {
    const v = Number(r.amount || 0);
    if (r.direction === "in") totalIn += v;
    else if (r.direction === "out") totalOut += v;
  });

  totalIn = Math.round(totalIn * 100) / 100;
  totalOut = Math.round(totalOut * 100) / 100;

  return {
    totalIn,
    totalOut,
    balance: Math.round((totalIn - totalOut) * 100) / 100,
  };
}

/** 리스트 조회(최신순) */
export async function fetchAssetHistoryByRef(ref_code: string) {
  const { data, error } = await supabase
    .from("asset_history")
    .select("id,kst_date,direction,change_type,amount,memo")
    .eq("ref_code", ref_code)
    .order("kst_date", { ascending: false })
    .order("id", { ascending: false });

  if (error) throw error;
  return (data ?? []) as Array<{
    id: string;
    kst_date: string;
    direction: AssetDirection;
    change_type: AssetChangeType;
    amount: number;
    memo: string | null;
  }>;
}

/* ──────────────────────────────
 * 편의 함수 3종 (현장 코드에서 간단 호출)
 * ────────────────────────────── */

/** 하루머니 입금 (+) */
export async function addHaruDeposit(params: {
  ref_code: string;
  amount: number;
  memo?: string;
  balance_after?: number;
}) {
  return addAssetHistory({
    ref_code: params.ref_code,
    change_type: "haru_deposit",
    direction: "in",
    amount: params.amount,
    memo: params.memo ?? "하루머니 입금",
    balance_after: params.balance_after,
  });
}

/** 보충(재투자) 출금 (-) */
export async function addReinvestWithdraw(params: {
  ref_code: string;
  amount: number;
  memo?: string;
  balance_after?: number;
}) {
  return addAssetHistory({
    ref_code: params.ref_code,
    change_type: "reinvest_withdraw",
    direction: "out",
    amount: params.amount,
    memo: params.memo ?? "보충 출금(재투자)",
    balance_after: params.balance_after,
  });
}

/** 현금교환 출금 (-) */
export async function addCashWithdraw(params: {
  ref_code: string;
  amount: number;
  memo?: string;
  balance_after?: number;
}) {
  return addAssetHistory({
    ref_code: params.ref_code,
    change_type: "cash_withdraw",
    direction: "out",
    amount: params.amount,
    memo: params.memo ?? "현금교환 출금",
    balance_after: params.balance_after,
  });
}

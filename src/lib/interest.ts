// /src/lib/interest.ts
import { supabase } from "@/lib/supabaseClient";

/** YYYY-MM-DD (KST) */
export function getKSTDateString(dateInput?: string | Date) {
  const d = dateInput ? new Date(dateInput) : new Date();
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
}

/** 소수점 2자리까지만 '자르기'(반올림 X) */
export function truncate2(n: number) {
  return Math.floor(Number(n) * 100) / 100;
}

export type ActiveRates = { user: number; referral: number; center: number };

/** 유저별 오버라이드 > 전역 기본 (asOf 일자에 유효한 연이율 %) */
export async function getActiveRates(asOf: string, refCode?: string): Promise<ActiveRates> {
  const { data: globalRates, error: e1 } = await supabase
    .from("interest_rates")
    .select("role, annual_rate, start_date, end_date");
  if (e1) throw e1;

  let overrides: any[] = [];
  if (refCode) {
    const { data: userRates, error: e2 } = await supabase
      .from("user_interest_rates")
      .select("role, annual_rate, start_date, end_date")
      .eq("ref_code", refCode);
    if (e2) throw e2;
    overrides = userRates || [];
  }

  const pick = (role: "user" | "referral" | "center") => {
    const candUser = overrides
      .filter(r => r.role === role && r.start_date <= asOf && (!r.end_date || r.end_date >= asOf))
      .sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
    if (candUser.length) return Number(candUser.at(-1).annual_rate);

    const candGlobal = (globalRates || [])
      .filter(r => r.role === role && r.start_date <= asOf && (!r.end_date || r.end_date >= asOf))
      .sort((a, b) => (a.start_date > b.start_date ? 1 : -1));
    if (candGlobal.length) return Number(candGlobal.at(-1).annual_rate);

    const current = (globalRates || []).find(r => r.role === role && !r.end_date);
    if (current) return Number(current.annual_rate);

    throw new Error(`이자율 없음: ${role}`);
  };

  return { user: pick("user"), referral: pick("referral"), center: pick("center") };
}

/** asOf(YYYY-MM-DD KST) 기준 잔여 원금 = 투자-상환 → 소수점2자리 자르기 */
export async function getOutstandingPrincipal(refCode: string, asOf: string) {
  const dayEnd = asOf + " 23:59:59+09";

  const { data: inv, error: e1 } = await supabase
    .from("investments").select("amount, created_at")
    .eq("ref_code", refCode).lte("created_at", dayEnd);
  if (e1) throw e1;

  const { data: rep, error: e2 } = await supabase
    .from("repayments").select("amount, created_at")
    .eq("ref_code", refCode).lte("created_at", dayEnd);
  if (e2) throw e2;

  const invested = (inv || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const repaid   = (rep || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  return truncate2(invested - repaid);
}

/** ISO → YYYY-MM-DD in KST (created_at 등을 일자 필터링할 때 사용) */
export function toKSTDateStringFromISO(iso: string) {
  const d = new Date(iso);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const kst = new Date(utc + 9 * 60 * 60000);
  return kst.toISOString().slice(0, 10);
}

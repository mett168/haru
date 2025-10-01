import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export const dynamic = "force-dynamic";

const T_USERS = "users";           // ref_code, name, ref_by, center_id
const T_INV   = "investments";     // ref_code, amount, invest_date
const T_REP   = "repayments";      // ref_code, amount, repay_date
const T_RATE  = "interest_rates";  // role in ('user','referral','center'), annual_rate, end_date
const T_OUT   = "daily_interests"; // 여기에 1일 1행 저장

const FALLBACK = { user: 60, referral: 36, center: 24 };
const dRate = (annualPct: number) => Number(annualPct || 0) / 365;

async function getCols(table: string) {
  const { data } = await supabase.from(table).select("*").limit(1);
  return new Set<string>(data?.length ? Object.keys(data[0]) : []);
}

export async function POST(req: NextRequest) {
  try {
    const { date, commit = false } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    const cols = await getCols(T_OUT);

    // 1) 유저 + 이름
    const { data: users, error: eUsers } = await supabase
      .from(T_USERS)
      .select("ref_code,name,ref_by,center_id");
    if (eUsers) throw eUsers;

    // 2) 투자/상환(해당일 포함 누적)
    const { data: inv, error: eInv } = await supabase
      .from(T_INV).select("ref_code,amount").lte("invest_date", date);
    if (eInv) throw eInv;

    const { data: rep, error: eRep } = await supabase
      .from(T_REP).select("ref_code,amount").lte("repay_date", date);
    if (eRep) throw eRep;

    // 3) 이율(테이블 → 없으면 fallback)
    const { data: rates } = await supabase
      .from(T_RATE).select("role,annual_rate").is("end_date", null);
    const rate = (role: "user" | "referral" | "center") =>
      Number(rates?.find(r => r.role === role)?.annual_rate ?? FALLBACK[role]);

    const rUser = rate("user");
    const rRef  = rate("referral");
    const rCtr  = rate("center");

    // 4) 합계 맵
    const sumBy = (rows: any[], key: string) => {
      const m = new Map<string, number>();
      for (const r of rows || []) m.set(r[key], (m.get(r[key]) || 0) + Number(r.amount || 0));
      return m;
    };
    const invMap = sumBy(inv || [], "ref_code");
    const repMap = sumBy(rep || [], "ref_code");

    // 5) 계산/업서트 준비
    const preview: any[] = [];
    const upserts: any[] = [];

    for (const u of users || []) {
      const ref = u.ref_code;
      const investSum = invMap.get(ref) || 0;
      const repaySum  = repMap.get(ref) || 0;
      const principal = Math.max(investSum - repaySum, 0);
      if (principal <= 0) continue;

      const userInt = principal * dRate(rUser);
      const refInt  = principal * dRate(rRef);
      const ctrInt  = principal * dRate(rCtr);
      const total   = userInt + refInt + ctrInt;

      // 미리보기(기본 저장 필드 포함)
      preview.push({
        ref_code: ref,
        user_name: u.name ?? null,
        interest_date: date,
        invest_sum: investSum,
        principal_base: principal,
        rate_user: rUser, rate_referral: rRef, rate_center: rCtr,
        user_interest: userInt, referral_interest: refInt, center_interest: ctrInt,
        total_interest: total,
        ref_by: u.ref_by || null, center_id: u.center_id || null,
      });

      // 저장 행(존재 컬럼만 채움) — “초대코드/이름/투자금”은 항상 시도
      const row: any = { ref_code: ref, interest_date: date };
      if (cols.has("user_name"))       row.user_name = u.name ?? null;
      if (cols.has("invest_sum"))      row.invest_sum = investSum;
      if (cols.has("principal_base"))  row.principal_base = principal;

      if (cols.has("rate_user"))       row.rate_user = rUser;
      if (cols.has("rate_referral"))   row.rate_referral = rRef;
      if (cols.has("rate_center"))     row.rate_center = rCtr;

      if (cols.has("user_interest"))       row.user_interest = userInt;
      if (cols.has("referral_interest"))   row.referral_interest = refInt;
      if (cols.has("center_interest"))     row.center_interest = ctrInt;
      if (cols.has("total_interest"))      row.total_interest = total;

      // 구(舊) 스키마 호환: annual_rate/amount만 있을 때(본인 이자만 기록)
      if (!cols.has("user_interest") && cols.has("annual_rate")) row.annual_rate = rUser;
      if (!cols.has("user_interest") && cols.has("amount"))      row.amount = userInt;

      upserts.push(row);
    }

    if (!commit) {
      const sum = (k: string) => preview.reduce((a, b) => a + Number(b[k] || 0), 0);
      return NextResponse.json({
        date,
        rows: preview.length,
        sums: {
          invest_sum: sum("invest_sum"),
          principal_base: sum("principal_base"),
          user_interest: sum("user_interest"),
          referral_interest: sum("referral_interest"),
          center_interest: sum("center_interest"),
          total_interest: sum("total_interest"),
        },
        sample: preview.slice(0, 20),
      });
    }

    if (upserts.length) {
      const { error } = await supabase
        .from(T_OUT)
        .upsert(upserts, { onConflict: "ref_code,interest_date" });
      if (error) throw error;
    }

    return NextResponse.json({
      date,
      committed: true,
      upserted: upserts.length,
    });
  } catch (err: any) {
    return NextResponse.json({ error: String(err?.message || err) }, { status: 500 });
  }
}

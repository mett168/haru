import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

// GET: 저장된 지급 데이터 조회
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("payout_transfers")
      .select("ref_code, today_repay, today_interest, total_amount, status")
      .eq("transfer_date", date)
      .order("ref_code");
    if (error) throw error;

    // 이름 매핑
    const refCodes = (data ?? []).map(r => r.ref_code);
    let nameMap = new Map<string, string | null>();
    if (refCodes.length) {
      const { data: users } = await supabase
        .from("users")
        .select("ref_code, name")
        .in("ref_code", refCodes);
      (users ?? []).forEach(u => nameMap.set(u.ref_code, u.name ?? null));
    }

    const rows = (data ?? []).map(r => ({
      ref_code: r.ref_code,
      user_name: nameMap.get(r.ref_code) ?? null,
      today_repay: Number(r.today_repay ?? 0),
      today_interest: Number(r.today_interest ?? 0),
      total_amount: Number(r.total_amount ?? 0),
      status: r.status ?? "pending",
    }));

    const sums = {
      repay_sum: rows.reduce((a, b) => a + b.today_repay, 0),
      interest_sum: rows.reduce((a, b) => a + b.today_interest, 0),
      total_sum: rows.reduce((a, b) => a + b.total_amount, 0),
    };

    return NextResponse.json({ data: rows, sums });
  } catch (e: any) {
    console.error("[GET payouts]", e);
    return NextResponse.json({ error: e.message ?? "SERVER_ERROR" }, { status: 500 });
  }
}

// POST: 지급 계산(미리보기) 또는 저장
export async function POST(req: NextRequest) {
  try {
    const { date, commit = false } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // 1) 활성 투자 조회
    const { data: invs, error: eInv } = await supabase
      .from("investments")
      .select("ref_code, invest_amount_usdt, invest_date, maturity_date");
    if (eInv) throw eInv;

    const repayByRef = new Map<string, number>();
    const interestByRef = new Map<string, number>();

    for (const r of invs ?? []) {
      if (r.invest_date <= date && r.maturity_date >= date) {
        const principal = Number(r.invest_amount_usdt || 0);

        // 원금상환 = 투자금 / 365
        const today_repay = principal / 365;

        // 이자 = 투자금 * 0.6 / 365
        const today_interest = principal * 0.6 / 365;

        repayByRef.set(r.ref_code, (repayByRef.get(r.ref_code) ?? 0) + today_repay);
        interestByRef.set(r.ref_code, (interestByRef.get(r.ref_code) ?? 0) + today_interest);
      }
    }

    const refSet = new Set<string>([
      ...Array.from(repayByRef.keys()),
      ...Array.from(interestByRef.keys()),
    ]);

    // 유저 이름 매핑
    let nameMap = new Map<string, string | null>();
    if (refSet.size) {
      const { data: users } = await supabase
        .from("users")
        .select("ref_code, name")
        .in("ref_code", Array.from(refSet));
      (users ?? []).forEach(u => nameMap.set(u.ref_code, u.name ?? null));
    }

    // 행 구성
    const rows = Array.from(refSet).map(ref_code => {
      const today_repay = Number(repayByRef.get(ref_code) ?? 0);
      const today_interest = Number(interestByRef.get(ref_code) ?? 0);
      return {
        ref_code,
        user_name: nameMap.get(ref_code) ?? null,
        transfer_date: date,
        today_repay,
        today_interest,
        total_amount: today_repay + today_interest,
        status: "pending",
        created_at: new Date().toISOString(),
      };
    });

    const sums = {
      repay_sum: rows.reduce((a, b) => a + b.today_repay, 0),
      interest_sum: rows.reduce((a, b) => a + b.today_interest, 0),
      total_sum: rows.reduce((a, b) => a + b.total_amount, 0),
    };

    if (!commit) {
      return NextResponse.json({ preview: rows, sums });
    }

    // 저장: payout_transfers upsert
    const upserts = rows.map(r => ({
      ref_code: r.ref_code,
      transfer_date: r.transfer_date,
      today_repay: r.today_repay,
      today_interest: r.today_interest,
      total_amount: r.total_amount,
      status: "pending",
    }));

    const { error: eSave } = await supabase
      .from("payout_transfers")
      .upsert(upserts, { onConflict: "ref_code,transfer_date" });
    if (eSave) throw eSave;

    return NextResponse.json({ upserted: upserts.length, sums });
  } catch (e: any) {
    console.error("[POST payouts]", e);
    return NextResponse.json({ error: e.message ?? "SERVER_ERROR" }, { status: 500 });
  }
}

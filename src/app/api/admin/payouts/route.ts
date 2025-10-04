import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

/** GET: 저장된 지급 데이터 조회 (payout_transfers 기준) */
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date") ?? "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    const { data: rowsPT, error: ePT } = await supabase
      .from("payout_transfers")
      .select("ref_code, user_name, transfer_date, today_repay, today_interest, total_amount, status")
      .eq("transfer_date", date)
      .order("ref_code");
    if (ePT) throw ePT;

    const rows = (rowsPT ?? []).map((r) => ({
      ref_code: r.ref_code,
      user_name: r.user_name ?? null,
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
    console.error("[GET /api/admin/payouts]", e);
    return NextResponse.json({ error: e?.message ?? "SERVER_ERROR" }, { status: 500 });
  }
}

/** POST: 지급 계산(daily_aggregates 저장) 또는 지급 실행(payout_transfers 저장) */
export async function POST(req: NextRequest) {
  try {
    const { date, commit = false } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // 0) 유저 매핑 (ref_code → name, ref_by, center_id)
    const { data: users, error: eUsers } = await supabase
      .from("users")
      .select("ref_code, name, ref_by, center_id");
    if (eUsers) throw eUsers;

    const nameMap = new Map<string, string | null>();
    const refByMap = new Map<string, string | null>();
    const centerMap = new Map<string, string | null>();
    (users ?? []).forEach((u) => {
      nameMap.set(u.ref_code, u.name ?? null);
      refByMap.set(u.ref_code, u.ref_by ?? null);
      centerMap.set(u.ref_code, u.center_id ?? null);
    });

    // 1) 활성 투자 조회
    const { data: invs, error: eInv } = await supabase
      .from("investments")
      .select("id, ref_code, invest_amount_usdt, invest_date, maturity_date");
    if (eInv) throw eInv;

    // 비율 (%/년)
    const SELF_RATE = 60.0;
    const INV_RATE  = 12.0;
    const CTR_RATE  = 24.0;

    const rawRows: any[] = [];
    const repayByRc = new Map<string, number>();    // 미리보기용(수취인 기준)
    const interestByRc = new Map<string, number>(); // 미리보기용(수취인 기준)

    // 2) per-investment 계산 → daily_aggregates 원시 로우
    for (const r of invs ?? []) {
      if (!r.invest_date || !r.maturity_date) continue;
      if (!(r.invest_date <= date && date <= r.maturity_date)) continue;

      const owner = r.ref_code;
      const principal = Number(r.invest_amount_usdt || 0);
      if (principal <= 0) continue;

      const repay = principal / 365;
      const selfI = (principal * (SELF_RATE / 100)) / 365;
      const invI  = (principal * (INV_RATE  / 100)) / 365;
      const ctrI  = (principal * (CTR_RATE  / 100)) / 365;

      const inviter = refByMap.get(owner) ?? null;
      const center  = centerMap.get(owner) ?? null;

      rawRows.push({
        agg_date: date,
        investment_id: r.id,
        ref_code: owner,
        invest_amount: principal,
        today_repay: repay,
        self_rate: SELF_RATE,
        inviter_rate: INV_RATE,
        center_rate: CTR_RATE,
        self_interest: selfI,
        inviter_code: inviter,
        inviter_interest: inviter ? invI : 0,
        center_code: center,
        center_interest: center ? ctrI : 0,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 미리보기 누적 — "수취인" 기준으로 분배
      repayByRc.set(owner, (repayByRc.get(owner) ?? 0) + repay);
      interestByRc.set(owner, (interestByRc.get(owner) ?? 0) + selfI);
      if (inviter) interestByRc.set(inviter, (interestByRc.get(inviter) ?? 0) + invI);
      if (center)  interestByRc.set(center,  (interestByRc.get(center)  ?? 0) + ctrI);
    }

    // 3) commit:false → daily_aggregates upsert + preview
    if (!commit) {
      if (rawRows.length) {
        const { error: eUp } = await supabase
          .from("daily_aggregates")
          .upsert(rawRows, { onConflict: "agg_date,investment_id" });
        if (eUp) throw eUp;
      }

      const recipients = new Set<string>([
        ...repayByRc.keys(),
        ...interestByRc.keys(),
      ]);
      const preview = Array.from(recipients).map((rc) => {
        const today_repay = Number(repayByRc.get(rc) ?? 0);
        const today_interest = Number(interestByRc.get(rc) ?? 0);
        return {
          ref_code: rc,
          user_name: nameMap.get(rc) ?? null,
          transfer_date: date,
          today_repay,
          today_interest,
          total_amount: today_repay + today_interest,
          status: "pending",
        };
      });
      const sums = {
        repay_sum: preview.reduce((a, b) => a + b.today_repay, 0),
        interest_sum: preview.reduce((a, b) => a + b.today_interest, 0),
        total_sum: preview.reduce((a, b) => a + b.total_amount, 0),
      };

      return NextResponse.json({ inserted: rawRows.length, preview, sums });
    }

    // 4) commit:true → daily_aggregates 집계(수취인 기준 분배) → payout_transfers INSERT
    const { data: aggRows, error: eAgg } = await supabase
      .from("daily_aggregates")
      .select("ref_code, inviter_code, center_code, today_repay, self_interest, inviter_interest, center_interest")
      .eq("agg_date", date);
    if (eAgg) throw eAgg;

    // 수취인 기준 누적 맵
    const repayBy = new Map<string, number>();
    const interestBy = new Map<string, number>();

    for (const r of aggRows ?? []) {
      const owner = r.ref_code as string;
      const inviter = (r as any).inviter_code as string | null;
      const center  = (r as any).center_code as string | null;

      // 본인에게: 원금상환 + 본인이자
      repayBy.set(owner, (repayBy.get(owner) ?? 0) + Number(r.today_repay ?? 0));
      interestBy.set(owner, (interestBy.get(owner) ?? 0) + Number(r.self_interest ?? 0));

      // 초대자에게: 초대 이자만
      if (inviter) {
        interestBy.set(inviter, (interestBy.get(inviter) ?? 0) + Number(r.inviter_interest ?? 0));
      }
      // 센터에게: 센터 이자만
      if (center) {
        interestBy.set(center, (interestBy.get(center) ?? 0) + Number(r.center_interest ?? 0));
      }
    }

    const recipients = new Set<string>([...repayBy.keys(), ...interestBy.keys()]);
    const inserts = Array.from(recipients).map((rc) => {
      const today_repay = Number(repayBy.get(rc) ?? 0);
      const today_interest = Number(interestBy.get(rc) ?? 0);
      return {
        ref_code: rc,
        user_name: nameMap.get(rc) ?? null,   // 이름 저장
        transfer_date: date,
        today_repay,
        today_interest,
        total_amount: today_repay + today_interest,
        status: "pending",                    // 제약에 맞춤
        created_at: new Date().toISOString(),
      };
    });

    if (inserts.length) {
      const { error: eIns } = await supabase.from("payout_transfers").insert(inserts); // 누적 저장
      if (eIns) throw eIns;
    }

    const sums = {
      repay_sum: inserts.reduce((a, b) => a + b.today_repay, 0),
      interest_sum: inserts.reduce((a, b) => a + b.today_interest, 0),
      total_sum: inserts.reduce((a, b) => a + b.total_amount, 0),
    };

    return NextResponse.json({ inserted: inserts.length, sums });
  } catch (e: any) {
    console.error("[POST /api/admin/payouts]", e);
    return NextResponse.json({ error: e?.message ?? "SERVER_ERROR" }, { status: 500 });
  }
}

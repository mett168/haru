// /src/app/api/payouts/run/route.ts

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { getContract, prepareContractCall, sendAndConfirmTransaction } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { polygon } from "thirdweb/chains";
import { client } from "@/lib/client";

// ✅ 환경변수에 관리자 프라이빗키를 넣어야 합니다
// .env.local 또는 Vercel → Settings → Environment Variables
// ADMIN_PRIVATE_KEY=0xabcdef.... (0x 포함)
const adminAccount = privateKeyToAccount({
  client,
  privateKey: process.env.ADMIN_PRIVATE_KEY!,
});

// ✅ 전송할 토큰 주소 (Polygon USDT)
const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

// 소수점 USDT → 6자리 단위 변환 함수
function toUSDT6(amount: number) {
  return BigInt(Math.floor(amount * 1_000_000));
}

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { date, commit = true } = await req.json();
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: "date(YYYY-MM-DD) 필요" }, { status: 400 });
    }

    // ✅ 유저 목록 (이름 포함)
    const { data: users, error: eUsers } = await supabase
      .from("users")
      .select("ref_code, name, wallet_address");
    if (eUsers) throw eUsers;

    const nameMap = new Map<string, string>();
    const addrMap = new Map<string, string>();
    (users || []).forEach((u) => {
      nameMap.set(u.ref_code, u.name || "");
      if (u.wallet_address) addrMap.set(u.ref_code, u.wallet_address);
    });

    // ✅ 오늘 지급할 금액 계산 (예시: payouts 테이블 기준)
    const { data: payouts, error: ePayouts } = await supabase
      .from("payouts")
      .select("ref_code, amount_usdt")
      .eq("payout_date", date);

    if (ePayouts) throw ePayouts;

    if (!payouts || payouts.length === 0) {
      return NextResponse.json({ ok: true, msg: "오늘 지급할 내역 없음" });
    }

    // ✅ 계약 인스턴스
    const contract = getContract({
      client,
      chain: polygon,
      address: USDT_ADDRESS,
    });

    const results: any[] = [];

    for (const r of payouts) {
      try {
        const to = addrMap.get(r.ref_code);
        if (!to) {
          results.push({ ref_code: r.ref_code, error: "지갑주소 없음" });
          continue;
        }

        const amount6 = toUSDT6(Number(r.amount_usdt));

        const transaction = prepareContractCall({
          contract,
          method: "function transfer(address to, uint256 value) returns (bool)",
          params: [to, amount6],
        });

        // ✅ 실제 전송 (commit=true 일 때만)
        let txHash = null;
        if (commit) {
          const tx = await sendAndConfirmTransaction({
            account: adminAccount,
            transaction,
          });
          txHash = tx.transactionHash;
        }

        results.push({
          ref_code: r.ref_code,
          name: nameMap.get(r.ref_code),
          to,
          amount_usdt: r.amount_usdt,
          txHash,
        });
      } catch (err: any) {
        results.push({
          ref_code: r.ref_code,
          error: String(err?.message || err),
        });
      }
    }

    return NextResponse.json({ ok: true, results });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 });
  }
}

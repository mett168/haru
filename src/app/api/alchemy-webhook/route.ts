// ✅ 실제 알림 수신 처리
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";

const USDT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const activities = body.event?.activity || [];

  for (const act of activities) {
    const {
      rawContract: { address: contractAddress },
      toAddress,
      value,
      hash,
    } = act;

    if (
      !toAddress ||
      !value ||
      !hash ||
      contractAddress.toLowerCase() !== USDT.toLowerCase()
    )
      continue;

    const usdtAmount = parseFloat(value);

    // ✅ 중복 트랜잭션 해시 체크
    const { data: existing } = await supabase
      .from("usdt_history")
      .select("id")
      .eq("tx_hash", hash)
      .maybeSingle();

    if (existing) {
      console.log("⚠️ 중복 트랜잭션 해시. 기록 생략:", hash);
      continue;
    }

    const { data: user } = await supabase
      .from("users")
      .select("ref_code")
      .eq("wallet_address", toAddress.toLowerCase())
      .maybeSingle();

    if (!user?.ref_code) continue;

    await supabase.from("usdt_history").insert({
      wallet_address: toAddress.toLowerCase(),
      ref_code: user.ref_code,
      direction: "in",
      purpose: "external",
      amount: usdtAmount,
      tx_hash: hash,
      status: "completed",
    });

    console.log("✅ 외부입금 기록:", toAddress, usdtAmount, hash);
  }

  return NextResponse.json({ ok: true });
}

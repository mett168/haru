// 📁 src/app/api/manual-send-rewards/route.ts
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
import { sendUSDT } from "@/lib/sendUSDT";
import { getKSTISOString } from "@/lib/dateUtil";

export async function GET(req: NextRequest) {
  const date = req.nextUrl.searchParams.get("date");
  if (!date) {
    return NextResponse.json({ error: "날짜가 없습니다" }, { status: 400 });
  }

  console.log("✅ [MANUAL SEND] 실행됨:", getKSTISOString());
  console.log("📆 지정 날짜:", date);

  const { data: transfers, error } = await supabase
    .from("reward_transfers")
    .select("ref_code, wallet_address, total_amount")
    .eq("reward_date", date)
    .eq("status", "failed"); // ✅ failed만 처리

  if (error || !transfers) {
    console.error("❌ 송금 대상 조회 실패:", error);
    return NextResponse.json({ error: "송금 대상 조회 실패", detail: error }, { status: 500 });
  }

  console.log("📌 송금 대상 수:", transfers.length);

  const results: any[] = [];
  for (const entry of transfers) {
    const total = Number(entry.total_amount);
    if (isNaN(total) || total <= 0 || !entry.wallet_address) {
      console.warn("⚠️ 잘못된 송금 대상:", entry.ref_code, entry.total_amount);
      results.push({ ...entry, status: "skipped", reason: "금액 또는 주소 오류" });
      continue;
    }

    let status = "failed";
    let tx_hash = null;
    let error_message = "";

    try {
      const { transactionHash } = await sendUSDT(entry.wallet_address, total);
      tx_hash = transactionHash;
      status = "completed";
      console.log("✅ 송금 성공:", tx_hash);
    } catch (err: any) {
      status = "failed";
      error_message = err.message || "송금 중 오류";
      console.error("❌ 송금 실패:", entry.wallet_address, error_message);
    }

    await supabase
      .from("reward_transfers")
      .update({
        tx_hash,
        status,
        error_message,
        executed_at: getKSTISOString(),
      })
      .eq("ref_code", entry.ref_code)
      .eq("reward_date", date);

    results.push({ ...entry, tx_hash, status });
  }

  return NextResponse.json({ success: true, count: results.length, results });
}

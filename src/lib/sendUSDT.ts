import { client } from "@/lib/client";
import { polygon } from "thirdweb/chains";
import { getContract, prepareContractCall, sendTransaction } from "thirdweb";
import { privateKeyToAccount } from "thirdweb/wallets";
import { balanceOf } from "thirdweb/extensions/erc20";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString, getKSTISOString } from "@/lib/dateUtil";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

const USDT_ABI = [
  {
    name: "transfer",
    type: "function",
    stateMutability: "nonpayable",
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    outputs: [
      { name: "success", type: "bool" }
    ]
  }
] as const;

export async function sendUSDT(to: string, amount: number) {
  console.log("🚀 [sendUSDT] 호출됨");
  console.log("📌 수신자 주소:", to);
  console.log("📌 송금 금액:", amount);

  if (!to || amount <= 0) {
    console.error("❌ 잘못된 주소 또는 금액:", to, amount);
    throw new Error("잘못된 주소 또는 금액");
  }

  try {
    const adminWallet = privateKeyToAccount({
      client,
      privateKey: process.env.ADMIN_PRIVATE_KEY!,
    });

    const adminAddress = adminWallet.address;
    console.log("✅ 관리자 지갑 주소:", adminAddress);

    const balance = await balanceOf({
      contract: {
        address: USDT_ADDRESS,
        chain: polygon,
        client,
      },
      address: adminAddress,
    });

    console.log("💰 관리자 지갑 USDT 잔액:", Number(balance) / 1e6, "USDT");

    const parsedAmount = BigInt(Math.round(amount * 1_000_000));
    console.log("🔢 전송할 금액 (정수):", parsedAmount.toString());

    const contract = getContract({
      address: USDT_ADDRESS,
      chain: polygon,
      client,
      abi: USDT_ABI,
    });

    const transaction = prepareContractCall({
      contract,
      method: "transfer",
      params: [to, parsedAmount],
    });

    const result = await sendTransaction({
      transaction,
      account: adminWallet,
    });

    const txHash = result.transactionHash;
    if (!txHash) {
      throw new Error("트랜잭션 해시 없음 → 전송 실패");
    }

    console.log("🎉 USDT 전송 성공! 트랜잭션 해시:", txHash);

    const today = getKSTDateString();

    const { data: user, error: userError } = await supabase
      .from("users")
      .select("ref_code")
      .eq("wallet_address", to.toLowerCase())
      .maybeSingle();

    if (userError) {
      console.warn("⚠️ 유저 조회 오류:", userError.message);
    }

    const refCode = user?.ref_code || "unknown";

    // ✅ USDT 출금 내역 기록 (리워드 목적)
    const { error: insertError } = await supabase.from("usdt_history").insert({
      ref_code: refCode,
      wallet_address: to.toLowerCase(),
      direction: "in", // ✅ 리워드는 입금 처리
      purpose: "reward", // ✅ 목적 명시
      amount,
      tx_hash: txHash,
      status: "completed",
      reward_date: today,
    });

    if (insertError) {
      console.warn("⚠️ usdt_history 저장 오류:", insertError.message);
    }

    // ✅ reward_transfers 상태 업데이트
    if (refCode !== "unknown") {
      const { error: updateError } = await supabase
        .from("reward_transfers")
        .update({
          status: "success",
          executed_at: getKSTISOString(),
          tx_hash: txHash,
        })
        .eq("ref_code", refCode)
        .eq("reward_date", today);

      if (updateError) {
        console.warn("⚠️ reward_transfers 업데이트 오류:", updateError.message);
      } else {
        console.log("✅ reward_transfers 상태 업데이트 완료");
      }
    } else {
      console.warn("⚠️ ref_code를 찾을 수 없어 reward_transfers 업데이트 생략됨");
    }

    return { transactionHash: txHash };
  } catch (error: any) {
    const errMsg = error?.message || "알 수 없는 오류";
    console.error("❌ [송금 실패]", errMsg);
    throw new Error("USDT 전송 중 오류 발생: " + errMsg);
  }
}

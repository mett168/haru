"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { supabase } from "@/lib/supabaseClient";
import { client } from "@/lib/client";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // Polygon USDT(6 decimals)
const ADMIN_ADDRESS = "0xFa0614c4E486c4f5eFF4C8811D46A36869E8aEA1"; // 관리자 지갑

export default function SwapClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();

  const usdtFromCard = searchParams.get("usdt");
  const balance = Number(usdtFromCard ?? "0");
  const displayBalance = isNaN(balance) ? "0.00" : balance.toFixed(3);

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!account?.address) {
      alert("지갑 연결 후 진행하세요.");
      return;
    }
    const amt = Number(amount || "0");
    if (!amt || amt <= 0) {
      alert("교환 수량을 입력하세요.");
      return;
    }
    if (amt > balance) {
      alert("보유 잔액을 초과했습니다.");
      return;
    }

    setLoading(true);
    let requestId: string | null = null;

    try {
      const { data: inserted, error: insertErr } = await supabase
        .from("swap_requests")
        .insert({
          ref_code: null,
          wallet_address: account.address.toLowerCase(),
          amount_usdt: amt,
          status: "pending",
        })
        .select("id")
        .single();

      if (insertErr) throw new Error(`신청 저장 실패: ${insertErr.message}`);
      requestId = inserted.id as string;

      const contract = getContract({ client, chain: polygon, address: USDT_ADDRESS });
      const value = BigInt(Math.round(amt * 1_000_000));

      const tx = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 value) returns (bool)",
        params: [ADMIN_ADDRESS, value],
      });

      const { transactionHash } = await sendTransaction({
        account,
        transaction: tx,
      });
      await waitForReceipt({ client, chain: polygon, transactionHash });

      await supabase
        .from("swap_requests")
        .update({ status: "sent", tx_hash: transactionHash })
        .eq("id", requestId);

      router.push("/home/swap/complete");
    } catch (err: any) {
      if (requestId) {
        await supabase
          .from("swap_requests")
          .update({ status: "failed", fail_reason: String(err?.message || err) })
          .eq("id", requestId);
      }
      console.error("교환 신청 실패:", err);
      alert(`교환 신청 실패: ${err?.message || err}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="px-4 pt-4">
        <div className="bg-white rounded-2xl p-4 shadow border">
          <h2 className="text-lg font-bold mb-4">USDT 교환</h2>

          <div className="flex justify-between items-center mb-4">
            <div className="flex items-center gap-2">
              <img src="/icons/usdt.png" alt="usdt" className="w-6 h-6" />
              <span className="font-semibold text-lg">USDT</span>
            </div>
            <span className="text-sm text-gray-500">보유: {displayBalance} USDT</span>
          </div>

          <div className="mb-4">
            <label className="text-sm text-gray-600">교환 수량</label>
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full mt-2 text-right text-2xl font-bold border-b border-gray-200 py-2 focus:outline-none"
              placeholder="0"
              min={0}
              max={balance}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading || !amount || Number(amount) <= 0}
            className="w-full mt-4 bg-gradient-to-r from-cyan-200 to-blue-400 text-white py-3 rounded-full font-bold disabled:opacity-40"
          >
            {loading ? "처리 중..." : "교환 신청"}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

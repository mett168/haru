"use client";

import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString, getKSTISOString } from "@/lib/dateUtil";

export default function SwapClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();

  // 보유 자산(가상 잔액) – 홈에서 전달
  const usdtFromCard = searchParams.get("usdt");
  const balance = Number(usdtFromCard ?? "0");
  const displayBalance = isNaN(balance) ? "0.00" : balance.toFixed(3);

  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!account?.address) {
      alert("지갑 연결 후 진행해 주세요.");
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
    try {
      // 0) 유저 조회
      const { data: user, error: uerr } = await supabase
        .from("users")
        .select("ref_code, wallet_address")
        .ilike("wallet_address", account.address)
        .maybeSingle();
      if (uerr) throw uerr;
      if (!user?.ref_code) throw new Error("ref_code를 찾을 수 없습니다.");

      const todayKST = getKSTDateString(new Date());

      // 1) 현금교환 이력 저장 (pending)
      const { error: insErr } = await supabase.from("cash_exchanges").insert({
        ref_code: user.ref_code,
        wallet_address: account.address.toLowerCase(),
        amount_usdt: amt,
        status: "pending",
        request_date: todayKST,
        memo: "사용자 신청",
        created_at: getKSTISOString(),
      });
      if (insErr) throw insErr;

      // 2) 보유자산에서 차감 (asset_ledger: reason='cashout', 음수 누적)
      const reason = "cashout";
      const { data: exist } = await supabase
        .from("asset_ledger")
        .select("amount")
        .eq("ref_code", user.ref_code)
        .eq("transfer_date", todayKST)
        .eq("reason", reason)
        .maybeSingle();

      const newAmount = Number(exist?.amount ?? 0) - amt;

      const { error: upErr } = await supabase
        .from("asset_ledger")
        .upsert(
          [{ ref_code: user.ref_code, amount: newAmount, reason, transfer_date: todayKST }],
          { onConflict: "ref_code,transfer_date,reason" }
        );
      if (upErr) throw upErr;

      // 완료 페이지 이동 (또는 토스트/알림)
      router.push("/home/swap/complete");
    } catch (err: any) {
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
          <h2 className="text-lg font-bold mb-4">USDT 현금 교환</h2>

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

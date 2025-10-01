// src/app/bot/withdraw/page.tsx  (경로는 현재 파일 위치에 맞게 사용하세요)
"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
} from "thirdweb";
import { polygon } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc20";
import { client } from "@/lib/client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString, getKSTISOString } from "@/lib/dateUtil";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

export default function WithdrawPage() {
  const router = useRouter();
  const account = useActiveAccount();

  const [balance, setBalance] = useState("0.00");
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("1.0");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [showDepositInfo, setShowDepositInfo] = useState(false); // ✅ 입금 안내창 표시 여부 (기존 유지)

  const contract = useMemo(() => {
    return getContract({
      client,
      chain: polygon,
      address: USDT_ADDRESS,
    });
  }, []);

  const fetchBalance = async () => {
    if (!account?.address) return;
    try {
      const result = await balanceOf({ contract, address: account.address });
      const formatted = (Number(result) / 1e6).toFixed(2);
      setBalance(formatted);
      localStorage.setItem("usdt_balance", formatted);
    } catch (err) {
      console.error("❌ 잔액 조회 실패:", err);
      setBalance("0.00");
    }
  };

  useEffect(() => {
    fetchBalance();
  }, [account]); // eslint-disable-line react-hooks/exhaustive-deps

  // =============================
  // ✅ 추가: DB 보조 유틸 함수들
  // =============================

  // users 테이블에서 지갑주소(소문자)로 유저 찾기
  async function findUserByWalletLower(addrLower: string) {
    const { data, error } = await supabase
      .from("users")
      .select("ref_code, wallet_address")
      .eq("wallet_address", addrLower)
      .maybeSingle();
    if (error) throw error;
    return data ?? null;
  }

  // usdt_history에 한 줄 기록 (예외 throw)
  async function insertUsdtHistory(row: {
    ref_code: string;
    direction: "in" | "out";
    amount: number;
    tx_hash: string;
    status: "pending" | "completed" | "failed";
    wallet_address: string | null;
    purpose: "user" | "reward" | "external" | null;
    reward_date: string; // KST 'YYYY-MM-DD'
  }) {
    const { error } = await supabase.from("usdt_history").insert(row);
    if (error) throw error;
  }

  // =============================
  // ✅ 수정: 출금 처리
  // =============================
  const handleWithdraw = async () => {
    if (!account?.address) {
      setStatus("❌ 로그인 후 이용해 주세요.");
      return;
    }

    if (!toAddress || !/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      setStatus("❌ 받는 주소를 확인하세요");
      return;
    }

    const amountNumber = Number(amount);
    if (isNaN(amountNumber) || amountNumber <= 0) {
      setStatus("❌ 금액을 다시 입력하세요");
      return;
    }

    setLoading(true);
    setStatus("출금 처리 중...");

    try {
      const senderWallet = account.address.toLowerCase();
      const receiverWallet = toAddress.toLowerCase();
      const amountInWei = BigInt(Math.floor(amountNumber * 10 ** 6));

      // ====== 온체인 전송 ======
      const tx = prepareContractCall({
        contract,
        method: "function transfer(address _to, uint256 _value) returns (bool)",
        params: [receiverWallet, amountInWei], // 주소도 소문자로 정규화
      });

      const result = await sendTransaction({
        account,
        transaction: tx,
      });

      const txHash = result.transactionHash;
      console.log("✅ 트랜잭션 성공:", txHash);
      setStatus(`✅ 출금 성공! TX: ${txHash}`);

      const today = getKSTDateString();
      const now = getKSTISOString(); // 현재는 미사용이지만 기존 import 유지

      // ====== 보낸 사람 ref_code 조회 ======
      let senderRef = "unknown";
      try {
        const { data: me } = await supabase
          .from("users")
          .select("ref_code")
          .eq("wallet_address", senderWallet)
          .maybeSingle();
        if (me?.ref_code) senderRef = me.ref_code;
      } catch (e) {
        console.warn("❌ ref_code 조회 실패(보낸사람):", e);
      }

      // ====== 항상 출금자(out) 기록 ======
      // 외부 전송이면 purpose를 "external"로 바꾸고 싶다면 아래 줄을 "external"로 바꾸세요.
      let outPurpose: "user" | "external" = "user";

      // 수신자가 내부 유저인지 먼저 조회 (에러 무시하고 null 처리)
      let receiverRef: string | null = null;
      try {
        const internalUser = await findUserByWalletLower(receiverWallet);
        receiverRef = internalUser?.ref_code ?? null;
        if (!receiverRef) outPurpose = "external";
      } catch (e) {
        console.warn("수신자 조회 실패:", e);
        outPurpose = "external";
      }

      await insertUsdtHistory({
        ref_code: senderRef, // 가능하면 users에 항상 존재하도록 보장
        direction: "out",
        amount: amountNumber,
        tx_hash: txHash, // 해시 그대로 사용 (“-recv” 같은 접미사 제거)
        status: "completed",
        wallet_address: senderWallet,
        purpose: outPurpose,
        reward_date: today,
      });
      console.log("[✅ 출금(out) 기록 성공]");

      // ====== 내부 유저인 경우에만 입금(in) 기록 ======
      if (receiverRef) {
        try {
          await insertUsdtHistory({
            ref_code: receiverRef, // FK 존재 보장
            direction: "in",
            amount: amountNumber,
            tx_hash: txHash,
            status: "completed",
            wallet_address: receiverWallet,
            purpose: "user",
            reward_date: today,
          });
          console.log("✅ 유저간 입금(in) 기록 성공");
        } catch (e: any) {
          console.warn("❌ 유저간 입금(in) 기록 실패:", e?.message || e);
        }
      } else {
        console.info("[외부 지갑] in 기록 생략");
      }

      // ====== 잔액 갱신 ======
      setTimeout(() => {
        fetchBalance();
      }, 1500);
    } catch (err: any) {
      console.error("[X] 출금 오류:", err);
      setStatus(`❌ 실패: ${err.details || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7fa] pb-10">
      <div className="flex items-center px-4 py-3 bg-white border-b">
        <button onClick={() => router.back()}>
          <ChevronLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="ml-2 text-base font-semibold text-gray-800">USDT 출금</h1>
      </div>

      <div className="max-w-md mx-auto px-4 pt-6 space-y-6">
        {/* ✅ 나의 자산 */}
        <div className="space-y-1">
          <p className="text-sm font-bold text-gray-800">현재 잔액</p>
          <div className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-4 py-3">
            <div className="flex items-center space-x-2">
              <img src="/tether-icon.png" alt="Tether" className="w-6 h-6" />
              <span className="text-sm font-medium text-gray-700">Tether</span>
            </div>
            <span className="text-base font-bold text-gray-800">{balance} USDT</span>
          </div>
        </div>

        {/* ✅ 출금 안내 박스 */}
        <div className="bg-white border border-blue-200 rounded-xl px-4 py-4 space-y-2">
          <p className="text-sm font-bold text-gray-800">출금 안내</p>
          <p className="text-xs text-gray-600">
            해당 주소는 <strong>POLYGON</strong> 네트워크만 지원합니다. <br />
            다른 네트워크로 입금 시 자산 복구가 <span className="text-red-500 font-semibold">불가능</span>합니다.
          </p>
        </div>

        {/* ✅ 출금 입력 */}
        <div>
          <label className="block text-sm font-bold text-gray-800 mb-1">주소 입력</label>
          <input
            type="text"
            placeholder="주소를 입력하세요."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-bold text-gray-800 mb-1">출금 수량</label>
          <div className="relative">
            <input
              type="number"
              placeholder="출금 수량을 입력하세요."
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm pr-16 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => setAmount(balance)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-blue-600"
            >
              전부
            </button>
          </div>
        </div>

        <button
          onClick={handleWithdraw}
          disabled={loading}
          className={`w-full py-3 rounded-xl text-white font-semibold ${
            loading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
          }`}
        >
          {loading ? "처리 중..." : "출금하기"}
        </button>

        {status && (
          <div
            className={`p-3 rounded text-sm ${
              status.includes("✅")
                ? "bg-green-100 text-green-800"
                : "bg-red-100 text-red-800"
            }`}
          >
            {status}
          </div>
        )}
      </div>
    </main>
  );
}

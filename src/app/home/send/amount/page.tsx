"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SendAmountPage() {
  const router = useRouter();
  const [recipient, setRecipient] = useState<string>("");
  const [balance, setBalance] = useState<number>(0);
  const [amount, setAmount] = useState<string>("");

  // 최근에 저장한 받는 주소 / 보유 USDT 불러오기
  useEffect(() => {
    if (typeof window === "undefined") return;
    const addr = localStorage.getItem("recipient_address") || "";
    setRecipient(addr);

    const bal = Number(localStorage.getItem("usdt_balance") || "0");
    setBalance(isNaN(bal) ? 0 : bal);
  }, []);

  const maxFill = () => setAmount(balance.toString());

  const onNext = () => {
    const n = Number(amount || "0");
    if (!recipient) return alert("받는 분 주소가 없습니다.");
    if (!n || n <= 0) return alert("보낼 수량을 입력하세요.");
    if (n > balance) return alert("보유 잔액을 초과했습니다.");

    // 다음 단계에서 사용할 값 저장
    localStorage.setItem("send_amount", String(n));
    router.push("/home/send/review"); // 다음 단계(검토 페이지)로 이동
  };

  return (
    <div className="min-h-screen bg-white pb-24">

      <div className="px-5 pt-5">
        <h1 className="text-lg font-bold mb-4">보낼 수량 입력</h1>

        {/* 받는 분 주소 요약 */}
        <div className="rounded-2xl border shadow-sm p-4 mb-4">
          <p className="text-xs text-gray-500 mb-1">받는 분</p>
          <p className="font-mono text-sm break-all">{recipient || "-"}</p>
        </div>

        {/* 보유 잔액 / 수량 입력 */}
        <div className="rounded-2xl border shadow-sm p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">USDT</p>
            <p className="text-xs text-gray-500">보유: {balance.toFixed(3)} USDT</p>
          </div>

          <div className="mt-3 flex items-center gap-2">
            <input
              type="number"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="flex-1 text-right text-3xl font-bold border-b border-gray-200 py-2 focus:outline-none"
            />
            <button
              onClick={maxFill}
              className="shrink-0 px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-600 font-semibold"
            >
              MAX
            </button>
          </div>

          {/* 빠른 선택 */}
          <div className="mt-3 flex gap-2">
            {[0.1, 0.5, 1].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="px-3 py-1 rounded-full border text-sm text-gray-700"
              >
                +{v}
              </button>
            ))}
          </div>
        </div>

        {/* 하단 버튼 */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => router.back()}
            className="flex-1 py-3 rounded-full border text-gray-700"
          >
            이전
          </button>
          <button
            onClick={onNext}
            disabled={!amount || Number(amount) <= 0}
            className="flex-1 py-3 rounded-full text-white bg-gradient-to-r from-cyan-200 to-blue-400 disabled:opacity-40"
          >
            다음
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          * 수량과 주소를 다시 확인하세요. 잘못 전송된 자산은 복구가 어려울 수 있습니다.
        </p>
      </div>
    </div>
  );
}

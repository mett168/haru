"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { client } from "@/lib/client";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // Polygon USDT(6decimals)

export default function RecipientConfirmPage() {
  const router = useRouter();
  const account = useActiveAccount();

  const [recipient, setRecipient] = useState("");
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // 초기값 로딩: 주소 & 보유 USDT
  useEffect(() => {
    if (typeof window === "undefined") return;
    const addr = localStorage.getItem("recipient_address") || "";
    setRecipient(addr);

    const bal = Number(localStorage.getItem("usdt_balance") || "0");
    setBalance(isNaN(bal) ? 0 : bal);
  }, []);

  const maxFill = () => setAmount(balance.toString());

  // ✅ 송금 실행 (USDT transfer)
  const onSend = async () => {
    if (!account?.address) return;
    const n = Number(amount || "0");
    if (!recipient) return;
    if (!n || n <= 0) return;
    if (n > balance) return;

    try {
      setLoading(true);

      const contract = getContract({ client, chain: polygon, address: USDT_ADDRESS });
      const value = BigInt(Math.round(n * 1_000_000)); // USDT 6 decimals

      const tx = prepareContractCall({
        contract,
        method: "function transfer(address to, uint256 value) returns (bool)",
        params: [recipient, value],
      });

      const { transactionHash } = await sendTransaction({ account, transaction: tx });
      await waitForReceipt({ client, chain: polygon, transactionHash });

      // 완료 페이지에서 보여줄 수 있도록 저장(선택)
      if (typeof window !== "undefined") {
        localStorage.setItem("last_send_hash", transactionHash);
        localStorage.setItem("last_send_amount", String(n));
        localStorage.setItem("last_send_recipient", recipient);
      }

      router.push("/home/send/complete");
    } catch (e) {
      console.error("송금 실패:", e);
      // 실패 시 머무르기 (별도 토스트/메시지는 UI 정책에 맞춰 추가 가능)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">

      <div className="px-5 pt-5">
        <h1 className="text-lg font-bold mb-4">받는 분 확인 및 송금</h1>

        {/* 주소 카드 */}
        <div className="rounded-2xl border shadow-sm p-4">
          <label className="text-sm text-gray-500">지갑 주소</label>

          {editing ? (
            <input
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full mt-2 px-3 py-2 border rounded-lg text-sm"
            />
          ) : (
            <p className="mt-2 font-mono text-sm break-all">{recipient || "-"}</p>
          )}

          <div className="flex gap-2 mt-4">
            <button
              onClick={() => setEditing((v) => !v)}
              className="flex-1 py-2 rounded-full border text-gray-700"
            >
              {editing ? "수정 완료" : "수정"}
            </button>
            <button
              onClick={() => navigator.clipboard?.writeText(recipient)}
              className="flex-1 py-2 rounded-full border text-gray-700"
            >
              복사
            </button>
          </div>
        </div>

        {/* 수량 입력 */}
        <div className="rounded-2xl border shadow-sm p-4 mt-4">
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
              min={0}
              max={balance}
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
            onClick={onSend}
            disabled={!recipient || !amount || Number(amount) <= 0 || Number(amount) > balance || loading}
            className="flex-1 py-3 rounded-full text-white bg-gradient-to-r from-cyan-200 to-blue-400 disabled:opacity-40"
          >
            {loading ? "전송 중..." : "송금"}
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-3">
          * 주소와 수량을 다시 확인하세요. 잘못 전송된 자산은 복구가 어려울 수 있습니다.
        </p>
      </div>
    </div>
  );
}

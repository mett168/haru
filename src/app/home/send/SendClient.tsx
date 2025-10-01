"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import {
  getContract,
  prepareContractCall,
  sendTransaction,
  waitForReceipt,
} from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { polygon } from "thirdweb/chains";
import { client } from "@/lib/client";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // Polygon USDT(6)

export default function SendClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const account = useActiveAccount();

  // ====== 잔액을 홈카드와 '동일한 방식'으로 계산/표시 ======
  const usdtContract = useMemo(
    () => getContract({ client, chain: polygon, address: USDT_ADDRESS }),
    []
  );
  const [balanceStr, setBalanceStr] = useState("0.000"); // 표시용 문자열(소수 3자리)
  const [balanceNum, setBalanceNum] = useState(0);       // 비교/검증용 숫자

  useEffect(() => {
    // 1) 쿼리로 넘어온 값 우선 사용 (홈카드에서 전달)
    const fromQuery = searchParams.get("usdt");
    const numFromQuery = Number(fromQuery ?? "NaN");

    if (!Number.isNaN(numFromQuery)) {
      const fixed = numFromQuery.toFixed(3);
      setBalanceStr(fixed);
      setBalanceNum(numFromQuery);
      if (typeof window !== "undefined") {
        sessionStorage.setItem("usdt_balance", String(numFromQuery));
        localStorage.setItem("usdt_balance", String(numFromQuery));
      }
      return; // 쿼리 있으면 체인조회로 덮지 않음
    }

    // 2) 쿼리 없으면 체인조회
    const fetchBalance = async () => {
      if (!account?.address) return;
      try {
        const result = await balanceOf({
          contract: usdtContract,
          address: account.address as any,
        });
        const formatted = (Number(result) / 1e6).toFixed(3);
        setBalanceStr(formatted);
        setBalanceNum(Number(formatted));
      } catch (err) {
        console.error("❌ USDT 잔액 조회 실패(체인):", err);
        setBalanceStr("0.000");
        setBalanceNum(0);
      }
    };
    fetchBalance();
  }, [account, usdtContract, searchParams]);
  // =====================================================

  const [recipient, setRecipient] = useState("");
  const [recentList, setRecentList] = useState<string[]>([]);
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);

  // 최근 내역 로드
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem("recent_recipients");
    if (stored) {
      try {
        setRecentList(JSON.parse(stored));
      } catch {
        setRecentList([]);
      }
    }
    const savedRecipient = localStorage.getItem("recipient_address");
    if (savedRecipient) setRecipient(savedRecipient);
  }, []);

  const addRecent = (addr: string) => {
    const list = [addr, ...recentList.filter((a) => a !== addr)].slice(0, 5);
    setRecentList(list);
    localStorage.setItem("recent_recipients", JSON.stringify(list));
  };

  const maxFill = () => setAmount(String(balanceNum));

  // 송금
  const onSend = async () => {
    const n = Number(amount || "0");
    if (!account?.address) return;
    if (!recipient) return;
    if (!n || n <= 0) return;
    if (n > balanceNum) return;

    try {
      setLoading(true);

      // USDT 6 decimals
      const value = BigInt(Math.round(n * 1_000_000));

      const tx = prepareContractCall({
        contract: usdtContract,
        method: "function transfer(address to, uint256 value) returns (bool)",
        params: [recipient, value],
      });

      const { transactionHash } = await sendTransaction({
        account,
        transaction: tx,
      });
      await waitForReceipt({ client, chain: polygon, transactionHash });

      if (typeof window !== "undefined") {
        addRecent(recipient);
        localStorage.setItem("last_send_hash", transactionHash);
        localStorage.setItem("last_send_amount", String(n));
        localStorage.setItem("last_send_recipient", recipient);
        const newBal = Math.max(0, balanceNum - n);
        sessionStorage.setItem("usdt_balance", String(newBal));
        localStorage.setItem("usdt_balance", String(newBal));
      }

      router.push("/home/send/complete");
    } catch (e) {
      console.error("송금 실패:", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white pb-24">

      <div className="px-5 pt-5">
        <h1 className="text-lg font-bold mb-4">USDT 보내기</h1>

        {/* 주소 입력 */}
        <div className="rounded-2xl border shadow-sm p-4">
          <label className="text-sm text-gray-500">받는 분 지갑주소</label>
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full mt-2 px-3 py-2 border rounded-lg text-sm bg-gray-50 placeholder-gray-400"
          />

          {recentList.length > 0 && (
            <>
              <p className="mt-5 text-xs font-semibold text-gray-400">최근 내역</p>
              {recentList.map((addr, idx) => (
                <button
                  key={idx}
                  onClick={() => setRecipient(addr)}
                  className="mt-2 w-full text-left text-sm font-mono text-gray-700 truncate hover:underline"
                  type="button"
                >
                  {addr}
                </button>
              ))}
            </>
          )}
        </div>

        {/* 수량 입력 */}
        <div className="rounded-2xl border shadow-sm p-4 mt-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">USDT</p>
            <p className="text-xs text-gray-500">보유: {balanceStr} USDT</p>
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
              max={balanceNum}
            />
            <button
              onClick={maxFill}
              className="shrink-0 px-3 py-1 text-sm rounded-full bg-blue-100 text-blue-600 font-semibold"
              type="button"
            >
              MAX
            </button>
          </div>

          <div className="mt-3 flex gap-2">
            {[0.1, 0.5, 1].map((v) => (
              <button
                key={v}
                onClick={() => setAmount(String(v))}
                className="px-3 py-1 rounded-full border text-sm text-gray-700"
                type="button"
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
            type="button"
          >
            이전
          </button>
          <button
            onClick={onSend}
            disabled={
              !recipient ||
              !amount ||
              Number(amount) <= 0 ||
              Number(amount) > balanceNum ||
              loading
            }
            className="flex-1 py-3 rounded-full text-white bg-gradient-to-r from-cyan-200 to-blue-400 disabled:opacity-40"
            type="button"
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

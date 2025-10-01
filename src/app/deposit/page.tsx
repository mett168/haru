// src/app/deposit/page.tsx
"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, Copy } from "lucide-react";
import { useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { balanceOf } from "thirdweb/extensions/erc20";
import { client } from "@/lib/client";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";

export default function DepositPage() {
  const router = useRouter();
  const account = useActiveAccount();
  const [copied, setCopied] = useState(false);
  const [balance, setBalance] = useState("0.00");

  const depositAddress = account?.address || "0x000...000";

  const contract = useMemo(() => {
    return getContract({
      client,
      chain: polygon,
      address: USDT_ADDRESS,
    });
  }, []);

  useEffect(() => {
    const fetchBalance = async () => {
      if (!account?.address) return;
      try {
        const result = await balanceOf({ contract, address: account.address });
        const formatted = (Number(result) / 1e6).toFixed(2);
        setBalance(formatted);
      } catch (err) {
        console.error("❌ USDT 잔액 조회 실패:", err);
        setBalance("0.00");
      }
    };

    fetchBalance();
  }, [account]);

  const handleCopy = async () => {
    if (depositAddress) {
      await navigator.clipboard.writeText(depositAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <main className="min-h-screen bg-[#eef2f6] pb-10">

      <div className="max-w-md mx-auto mt-5 px-4">
        {/* 상단 자산 박스 */}
        <div className="bg-white rounded-xl shadow p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/tether-icon.png" alt="USDT" className="w-7 h-7" />
            <span className="text-gray-700 font-semibold">Tether</span>
          </div>
          <span className="text-gray-900 font-bold">{balance} USDT</span>
        </div>

        {/* 주소 박스 */}
        <div className="bg-white rounded-xl shadow mt-4 px-4 py-3 text-center">
          <p className="text-xs text-gray-600 break-all">{depositAddress}</p>
          <p className="text-[12px] text-gray-500 mt-2">
            해당 주소는 <strong>POLYGON</strong> 네트워크를 지원합니다.
            <br />
            그 외 네트워크로는 자산 입금이{" "}
            <span className="text-red-500 font-semibold">불가능</span>합니다.
          </p>
          <button
            onClick={handleCopy}
            className="mt-3 w-full py-2 rounded-md bg-blue-500 text-white text-sm font-semibold hover:bg-blue-600"
          >
            주소 복사하기
          </button>
        </div>

        {/* 복사 확인 */}
        {copied && (
          <div className="mt-5 w-full bg-gray-700 text-white text-sm font-medium py-2 rounded-full text-center">
            복사가 완료되었습니다
          </div>
        )}
      </div>
    </main>
  );
}

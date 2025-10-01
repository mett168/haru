"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";

export default function UsdtHistoryPage() {
  const account = useActiveAccount();
  const router = useRouter();
  const [refCode, setRefCode] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ 유저의 추천코드 가져오기
  useEffect(() => {
    const fetchRefCode = async () => {
      if (!account?.address) return;
      const { data, error } = await supabase
        .from("users")
        .select("ref_code")
        .eq("wallet_address", account.address.toLowerCase())
        .single();

      if (error || !data) {
        console.error("❌ ref_code 조회 실패:", error);
        return;
      }

      setRefCode(data.ref_code);
    };

    fetchRefCode();
  }, [account]);

  // ✅ usdt_history 조회
  useEffect(() => {
    if (!refCode) return;

    const fetchHistory = async () => {
      const { data, error } = await supabase
        .from("usdt_history")
        .select("*")
        .eq("ref_code", refCode)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("❌ usdt_history 조회 실패:", error);
      } else {
        setHistory(data || []);
      }

      setLoading(false);
    };

    fetchHistory();
  }, [refCode]);

  return (
    <main className="p-4">
      <div className="flex items-center mb-4">
        <ChevronLeft className="mr-2 cursor-pointer" onClick={() => router.back()} />
        <h1 className="text-xl font-bold">USDT 입출금 내역</h1>
      </div>

      {loading ? (
        <p>⏳ 불러오는 중...</p>
      ) : history.length === 0 ? (
        <p>📭 내역이 없습니다.</p>
      ) : (
        <ul className="space-y-3">
          {history.map((item) => (
            <li
              key={item.id}
              className="p-3 rounded-xl border bg-white shadow-sm"
            >
              <div className="flex justify-between">
                <span className="font-semibold">
                  {item.direction === "in" ? "입금" : "출금"}{" "}
                  ({item.purpose === "external"
                    ? "외부"
                    : item.purpose === "reward"
                    ? "리워드"
                    : item.purpose === "user"
                    ? "유저간"
                    : "기타"})
                </span>
                <span className="text-sm text-gray-500">
                  {new Date(item.created_at).toLocaleString("ko-KR", {
                    timeZone: "Asia/Seoul",
                  })}
                </span>
              </div>
              <div className="mt-1">💰 금액: {item.amount} USDT</div>
              <div>📦 상태: {item.status}</div>
              {item.tx_hash && (
                <div className="text-sm text-blue-600 mt-1">
                  <a
                    href={`https://polygonscan.com/tx/${item.tx_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    🔗 TxHash 보기
                  </a>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

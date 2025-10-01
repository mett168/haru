"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function SendCompletePage() {
  const router = useRouter();

  const [hash, setHash] = useState("");
  const [to, setTo] = useState("");
  const [amt, setAmt] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const h = localStorage.getItem("last_send_hash") || "";
    const r = localStorage.getItem("last_send_recipient") || "";
    const a = localStorage.getItem("last_send_amount") || "";

    setHash(h);
    setTo(r);
    setAmt(a);

    // 완료 페이지 진입 시 한 번만 정리(필요하면 주석 처리)
    // localStorage.removeItem("last_send_hash");
    // localStorage.removeItem("last_send_recipient");
    // localStorage.removeItem("last_send_amount");
  }, []);

  const openExplorer = () => {
    if (!hash) return;
    // Polygon 메인넷 기준
    const url = `https://polygonscan.com/tx/${hash}`;
    window.open(url, "_blank");
  };

  return (
    <div className="min-h-screen bg-white pb-24">

      <div className="px-5 pt-8">
        <h1 className="text-xl font-bold mb-4">송금 완료</h1>

        <div className="rounded-2xl border shadow-sm p-5">
          <div className="text-center">
            <img
              src="/icons/check-circle.png"
              alt="success"
              className="w-14 h-14 mx-auto mb-3"
              onError={(e) => ((e.currentTarget.style.display = "none"))}
            />
            <p className="text-lg font-semibold">전송이 성공적으로 처리되었습니다.</p>
          </div>

          <div className="mt-5 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">보낸 수량</span>
              <span className="font-bold">{amt || "-"} USDT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">받는 지갑</span>
              <span className="font-mono break-all text-right">{to || "-"}</span>
            </div>
            <div className="flex justify-between items-start text-sm">
              <span className="text-gray-500">트랜잭션 해시</span>
              <span className="font-mono break-all text-right">{hash || "-"}</span>
            </div>
          </div>

          <div className="mt-5 flex gap-2">
            <button
              onClick={() => router.push("/home")}
              className="flex-1 py-3 rounded-full text-white bg-gradient-to-r from-cyan-200 to-blue-400"
            >
              홈으로
            </button>
            <button
              onClick={openExplorer}
              disabled={!hash}
              className="flex-1 py-3 rounded-full border text-gray-700 disabled:opacity-40"
            >
              Polygonscan 보기
            </button>
          </div>

          <p className="mt-4 text-xs text-gray-400">
            * 네트워크 상황에 따라 탐색기 반영에는 시간이 걸릴 수 있습니다.
          </p>
        </div>
      </div>
    </div>
  );
}

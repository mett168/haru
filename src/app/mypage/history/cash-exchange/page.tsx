"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";

type Row = {
  id: string;
  ref_code: string;
  wallet_address: string | null;
  amount_usdt: number | null;
  status: string | null;
  request_date: string | null;   // date
  processed_at: string | null;   // timestamptz
  memo: string | null;
};

export default function CashExchangeHistoryPage() {
  const router = useRouter();
  const account = useActiveAccount();

  const [refCode, setRefCode] = useState<string>("");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  // 포맷터
  const fmtDate = (d?: string | null) => {
    if (!d) return "-";
    try {
      const isDate = /^\d{4}-\d{2}-\d{2}$/.test(d);
      return isDate
        ? new Date(d + "T00:00:00Z").toLocaleDateString("ko-KR", { timeZone: "Asia/Seoul" })
        : new Date(d!).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
    } catch {
      return d as string;
    }
  };
  const n = (v?: number | null) => (typeof v === "number" ? v : Number(v ?? 0));
  const nf = (v?: number | null) => n(v).toLocaleString("ko-KR");

  useEffect(() => {
    const run = async () => {
      if (!account?.address) return;

      // ref_code 조회
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("ref_code")
        .eq("wallet_address", account.address.toLowerCase())
        .maybeSingle();

      if (meErr || !me?.ref_code) {
        router.back();
        return;
      }
      setRefCode(me.ref_code);

      // 이력 조회
      const { data } = await supabase
        .from("cash_exchanges")
        .select("*")
        .eq("ref_code", me.ref_code)
        .order("request_date", { ascending: false })
        .limit(200);

      setRows((data || []) as Row[]);
      setLoading(false);
    };

    run();
  }, [account?.address, router]);

  // 요약
  const summary = useMemo(() => {
    const sum = (status?: string) =>
      rows
        .filter((r) => (status ? r.status === status : true))
        .reduce((acc, r) => acc + n(r.amount_usdt), 0);

    return {
      total: sum(),
      pending: sum("pending"),
      success: sum("success"),
      count: rows.length,
    };
  }, [rows]);

  if (!account) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <p className="text-gray-500 text-sm">지갑 주소 불러오는 중...</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <p className="text-gray-500 text-sm">불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] pb-12">
      <div className="max-w-[500px] mx-auto px-4 pt-3">
        {/* ── 헤더(참고 화면처럼) */}
        <div className="flex items-center gap-1 mb-3">
          <button
            onClick={() => router.push("/harumoney")}
            className="p-1 rounded-full text-gray-700 hover:bg-gray-100"
            aria-label="뒤로가기"
          >
            <ChevronLeft size={22} />
          </button>
          <h1 className="text-base font-semibold">현금 교환 신청 이력</h1>
        </div>

        {/* ── 요약 카드 (모양만 비슷하게 정리) */}
        <div className="bg-white rounded-xl shadow border p-4 mb-3">
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">총 신청 건수</span>
              <span className="font-semibold">{summary.count.toLocaleString("ko-KR")} 건</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">총 신청 합계</span>
              <span className="font-semibold">{nf(summary.total)} USDT</span>
            </div>
          </div>
          <div className="text-[11px] text-gray-400 mt-2">ref_code: {refCode}</div>
        </div>

        {/* ── 거래 내역 카드(표 스타일로 모양 맞춤) */}
        <div className="bg-white rounded-xl shadow border">
          <div className="px-4 py-3 border-b">
            <h2 className="text-sm font-semibold text-gray-800">거래 내역</h2>
          </div>

          {rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">신청 이력이 없습니다.</div>
          ) : (
            <div className="overflow-hidden">
              {/* 헤더 행 */}
              <div className="px-4 py-2 text-xs text-gray-500 grid grid-cols-12">
                <div className="col-span-5">신청 일자</div>
                <div className="col-span-4 text-right">신청 금액(USDT)</div>
                <div className="col-span-3 text-right pr-1">메모</div>
              </div>
              {/* 데이터 행들 */}
              <ul className="divide-y">
                {rows.map((r) => (
                  <li key={r.id} className="px-4 py-3 grid grid-cols-12 items-center text-sm">
                    <div className="col-span-5 text-gray-800">{fmtDate(r.request_date)}</div>
                    <div className="col-span-4 text-right font-medium">
                      {nf(r.amount_usdt)}
                    </div>
                    <div className="col-span-3 text-right text-gray-500 truncate">
                      {r.memo || "-"}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString } from "@/lib/dateUtil";

type TodayMoneyRow = {
  today_repay: number | null;
  today_interest: number | null;
  total_amount: number | null;
  status: string | null;
};

type Props = {
  refCode: string;
  payoutTimeNote?: string;
  showKRW?: boolean;
  krwPerUsdt?: number;
};

export default function TodayMoneyCard({
  refCode,
  payoutTimeNote = "매일 10:00 KST 전",
  showKRW = true,
  krwPerUsdt = 1500,
}: Props) {
  const [row, setRow] = useState<TodayMoneyRow | null>(null);
  const [loading, setLoading] = useState(false);
  const transferDate = getKSTDateString();

  useEffect(() => {
    const fetchData = async () => {
      if (!refCode) return setRow(null);
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("payout_transfers")
          .select("today_repay, today_interest, total_amount, status")
          .eq("ref_code", refCode)
          .eq("transfer_date", transferDate)
          .order("created_at", { ascending: false })
          .limit(1);
        if (error) throw error;
        setRow(data?.[0] ?? null);
      } catch (e) {
        console.error(e);
        setRow(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [refCode, transferDate]);

  const repay = Number(row?.today_repay ?? 0);
  const interest = Number(row?.today_interest ?? 0);
  const total = Number(row?.total_amount ?? 0);

  const toKRW = (v: number) => Math.round(v * krwPerUsdt);
  const fmtUSDT = (v: number) =>
    v.toLocaleString("ko-KR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtKRW = (n: number) => `₩ ${n.toLocaleString("ko-KR")}`;

  const totalKRW = useMemo(() => toKRW(total), [total, krwPerUsdt]);
  const repayKRW = useMemo(() => toKRW(repay), [repay, krwPerUsdt]);
  const interestKRW = useMemo(() => toKRW(interest), [interest, krwPerUsdt]);

  return (
    <div className="w-full rounded-2xl bg-white shadow p-4 mt-3">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">오늘의 머니</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {transferDate} · {payoutTimeNote}
          </p>
        </div>
      </div>

      {/* 본문 */}
      <div className="mt-3 space-y-2">
        {/* ===== 1) 총 금액: 한 줄 ===== */}
        <div className="flex items-end justify-between gap-3">
          {/* 좌: 총 USDT */}
          <div className="min-w-0 flex items-baseline gap-2 whitespace-nowrap">
            <span className="text-xl font-extrabold text-gray-900">
              {loading ? "…" : fmtUSDT(total)}
            </span>
            <span className="text-xs text-gray-500 mb-1 shrink-0">USDT</span>
          </div>

          {/* 우: 총 KRW */}
          {showKRW && (
            <div className="text-xl font-semibold text-gray-800 whitespace-nowrap shrink-0">
              {loading ? "…" : fmtKRW(totalKRW)}
            </div>
          )}
        </div>

        {/* 구분선(옵션) */}
        <div className="h-px bg-gray-100" />

        {/* ===== 2) 원금 상환 / 수익: 아래 두 줄 ===== */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">원금 상환</span>
          <span className="font-semibold text-gray-800 whitespace-nowrap">
            {loading ? "…" : `${fmtUSDT(repay)} USDT`}
            {showKRW && (
              <span className="text-[14px] text-gray-500 ml-1">
                ({loading ? "…" : fmtKRW(repayKRW)})
              </span>
            )}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-500">수익</span>
          <span className="font-semibold text-gray-800 whitespace-nowrap">
            {loading ? "…" : `${fmtUSDT(interest)} USDT`}
            {showKRW && (
              <span className="text-[14px] text-gray-500 ml-1">
                ({loading ? "…" : fmtKRW(interestKRW)})
              </span>
            )}
          </span>
        </div>
      </div>

      {/* 상세보기 버튼 */}
      <div className="mt-4">
        <Link
          href={`/harumoney/deposits?ref=${encodeURIComponent(refCode)}`}
          className="block w-full text-center rounded-xl bg-blue-600 text-white py-2 font-semibold hover:bg-blue-700 transition"
        >
          상세보기
        </Link>
      </div>
    </div>
  );
}

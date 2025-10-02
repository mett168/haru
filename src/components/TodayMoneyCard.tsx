"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString } from "@/lib/dateUtil";

type TodayMoneyRow = {
  today_repay: number | null;
  today_interest: number | null;
  total_amount: number | null;
  status: string | null; // pending | sent | success | failed ...
};

type Props = {
  refCode: string;
  /** 우측 상단 날짜 라벨 옆에 보일 안내 문구 (기본: "매일 10:00 KST 전") */
  payoutTimeNote?: string;
};

export default function TodayMoneyCard({
  refCode,
  payoutTimeNote = "매일 10:00 KST 전",
}: Props) {
  const [row, setRow] = useState<TodayMoneyRow | null>(null);
  const [loading, setLoading] = useState(false);

  const transferDate = getKSTDateString(); // 오늘 날짜 (KST 기준)

  useEffect(() => {
    const fetchData = async () => {
      if (!refCode) {
        setRow(null);
        return;
      }
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
      } catch (err) {
        console.error("오늘의 머니 조회 실패:", err);
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

  return (
    <div className="w-full rounded-2xl bg-white shadow p-4 mt-3">
      {/* 헤더 (배지 제거) */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-700">오늘의 머니</p>
          <p className="text-[11px] text-gray-500 mt-0.5">
            {transferDate} · {payoutTimeNote}
          </p>
        </div>
      </div>

      {/* 본문 */}
      <div className="mt-3 flex items-end justify-between">
        {/* 합계 */}
        <div>
          <div className="text-3xl font-extrabold text-gray-900">
            {loading ? "…" : total.toLocaleString(undefined, { maximumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">USDT</div>
        </div>

        {/* 오른쪽 원금/수익 */}
        <div className="text-right">
          <div className="flex items-center justify-end gap-3">
            <span className="text-xs text-gray-500">원금 상환</span>
            <span className="text-sm font-semibold text-gray-800">
              {loading ? "…" : repay.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
            </span>
          </div>
          <div className="mt-1 flex items-center justify-end gap-3">
            <span className="text-xs text-gray-500">수익</span>
            <span className="text-sm font-semibold text-gray-800">
              {loading ? "…" : interest.toLocaleString(undefined, { maximumFractionDigits: 2 })} USDT
            </span>
          </div>
        </div>
      </div>

      {/* 상세보기 버튼 (카드 내부) */}
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

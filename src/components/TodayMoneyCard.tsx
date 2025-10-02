"use client";

import { useEffect, useState } from "react";
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

export default function TodayMoneyCard({ refCode, payoutTimeNote = "매일 10:00 KST 전" }: Props) {
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
  const rawStatus = (row?.status ?? "pending").toLowerCase();
  const isPaid = rawStatus === "sent" || rawStatus === "success";

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
        <span
          className={`text-[11px] px-2 py-1 rounded-full ${
            isPaid
              ? "bg-green-100 text-green-700"
              : rawStatus === "failed"
              ? "bg-red-100 text-red-700"
              : "bg-yellow-100 text-yellow-700"
          }`}
        >
          {isPaid ? "지급완료" : rawStatus === "failed" ? "실패" : "미지급"}
        </span>
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
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";
import { Suspense } from "react";

const fmt2 = (v: number) =>
  (Math.floor(v * 100) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type Row = {
  repay_date: string;
  amount: number;
};

function RepaymentLogsContent() {
  const sp = useSearchParams();
  const router = useRouter();
  const ref = sp.get("ref") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // 총 합계
  const totalUSDT = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    [rows]
  );

  useEffect(() => {
    const fetchList = async () => {
      if (!ref) return;
      setLoading(true);
      try {
        // ref_code 기준으로 repayment_logs 불러오기
        const { data, error } = await supabase
          .from("repayment_logs")
          .select("repay_date, amount")
          .eq("ref_code", ref)
          .order("repay_date", { ascending: false });
        if (error) throw error;

        // 같은 날짜 여러 건 → 합산
        const map = new Map<string, number>();
        (data ?? []).forEach((r: any) => {
          const d = r.repay_date;
          const amt = Number(r.amount ?? 0);
          map.set(d, (map.get(d) ?? 0) + amt);
        });

        const merged: Row[] = Array.from(map.entries())
          .sort((a, b) => (a[0] > b[0] ? -1 : 1)) // 최신일자 우선
          .map(([repay_date, amount]) => ({ repay_date, amount }));

        setRows(merged);
      } finally {
        setLoading(false);
      }
    };
    fetchList();
  }, [ref]);

  return (
    <main className="w-full min-h-screen bg-[#f5f7fa] pb-20">
      {/* 헤더 */}
      <div className="max-w-[500px] mx-auto px-3 py-3 flex items-center gap-2">
        <button
          onClick={() => router.back()}
          className="rounded-xl p-2 hover:bg-gray-100"
          aria-label="뒤로"
        >
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-bold text-gray-800">원금 상환 이력</p>
      </div>

      {/* 총 합계 */}
      <div className="max-w-[500px] mx-auto px-3">
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">총 원금 상환</div>
            <div className="text-xl font-extrabold">{fmt2(totalUSDT)} USDT</div>
          </div>
        </div>
      </div>

      {/* 날짜별 리스트 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-2xl bg-white shadow divide-y">
          {loading && (
            <div className="p-4 text-sm text-gray-600">불러오는 중…</div>
          )}
          {!loading && rows.length === 0 && (
            <div className="p-6 text-sm text-gray-600 text-center">
              이력이 없습니다.
            </div>
          )}
          {rows.map((r) => (
            <div
              key={r.repay_date}
              className="p-4 flex items-center justify-between"
            >
              <span className="text-sm text-gray-700">{r.repay_date}</span>
              <span className="text-base font-bold">
                {fmt2(r.amount)} USDT
              </span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

// ✅ Suspense 적용 + 프리렌더 에러 방지
export const dynamic = "force-dynamic";

export default function RepaymentLogsPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">불러오는 중…</div>}>
      <RepaymentLogsContent />
    </Suspense>
  );
}

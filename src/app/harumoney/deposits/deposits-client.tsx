"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";

type Row = { transfer_date: string; amount: number };

const fmt2 = (v: number) =>
  (Math.floor(v * 100) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  });

export default function DepositsClient() {
  const sp = useSearchParams();
  const router = useRouter();
  const ref = sp.get("ref") ?? "";

  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const total = useMemo(
    () => rows.reduce((s, r) => s + Number(r.amount || 0), 0),
    [rows]
  );

  useEffect(() => {
    const fetchList = async () => {
      if (!ref) return;
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("asset_ledger")
          .select("transfer_date, amount, reason")
          .eq("ref_code", ref)
          .eq("reason", "payout")
          .order("transfer_date", { ascending: false });

        if (error) throw error;

        // 날짜별 합산
        const map = new Map<string, number>();
        (data ?? []).forEach((r: any) => {
          const d = r.transfer_date;
          const amt = Number(r.amount ?? 0);
          map.set(d, (map.get(d) ?? 0) + amt);
        });

        const merged: Row[] = Array.from(map.entries())
          .sort((a, b) => (a[0] > b[0] ? -1 : 1))
          .map(([transfer_date, amount]) => ({ transfer_date, amount }));

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
        <button onClick={() => router.back()} className="rounded-xl p-2 hover:bg-gray-100">
          <ChevronLeft size={20} />
        </button>
        <p className="text-base font-bold text-gray-800">오늘의 머니 · 입금 내역</p>
      </div>

      {/* 총 합계 */}
      <div className="max-w-[500px] mx-auto px-3">
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">총 입금 합계</div>
            <div className="text-xl font-extrabold">{fmt2(total)} USDT</div>
          </div>
        </div>
      </div>

      {/* 날짜별 리스트 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-2xl bg-white shadow divide-y">
          {loading && <div className="p-4 text-sm text-gray-600">불러오는 중…</div>}
          {!loading && rows.length === 0 && (
            <div className="p-6 text-sm text-gray-600 text-center">이력이 없습니다.</div>
          )}
          {rows.map((r) => (
            <div key={r.transfer_date} className="p-4 flex items-center justify-between">
              <span className="text-sm text-gray-700">{r.transfer_date}</span>
              <span className="text-base font-bold">{fmt2(r.amount)} USDT</span>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}

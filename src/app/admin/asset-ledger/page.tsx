"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";

function AssetLedgerInner() {
  const router = useRouter();
  const sp = useSearchParams();
  const initialRef = sp.get("ref") ?? "";

  const [ref, setRef] = useState(initialRef);
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => setRef(initialRef), [initialRef]);

  useEffect(() => {
    if (!ref) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("asset_ledger")
          .select("id, ref_code, transfer_date, reason, amount, created_at")
          .eq("ref_code", ref)
          .order("transfer_date", { ascending: false })
          .order("created_at", { ascending: false });

        if (error) throw error;
        if (mounted) setRows(data ?? []);
      } catch (e) {
        console.error("asset_ledger 로드 실패:", e);
        if (mounted) setRows([]);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [ref]);

  const reasonLabel = (r: string) => {
    switch (r) {
      case "payout":
        return "하루머니 입금";
      case "cashout":
        return "현금교환 출금";
      case "topup":
        return "보충 출금";
      default:
        return "자산 변동";
    }
  };

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter(
      (r) =>
        r.transfer_date.toLowerCase().includes(key) ||
        reasonLabel(r.reason).toLowerCase().includes(key) ||
        String(r.amount).includes(key)
    );
  }, [rows, q]);

  const totalIn = filtered
    .filter((r) => r.amount > 0)
    .reduce((s, r) => s + r.amount, 0);
  const totalOut = filtered
    .filter((r) => r.amount < 0)
    .reduce((s, r) => s + Math.abs(r.amount), 0);
  const balance = totalIn - totalOut;

  return (
    <main className="min-h-screen bg-[#f5f7fb]">
      <div className="max-w-[900px] mx-auto px-4 py-6">
        <div className="flex items-center gap-2 mb-4">
          <button
            onClick={() => router.back()}
            className="p-2 rounded hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ChevronLeft size={18} />
          </button>
          <h1 className="text-xl font-bold">자산이력</h1>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            value={ref}
            onChange={(e) => setRef(e.target.value.trim())}
            placeholder="ref_code"
            className="w-52 border rounded-lg px-3 py-2"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="이력 검색(날짜/라벨/금액)"
            className="flex-1 border rounded-lg px-3 py-2"
          />
        </div>

        <div className="rounded-2xl bg-white shadow p-4 mb-3">
          <div className="flex justify-between">
            <span>총 입금</span>
            <b>{totalIn.toFixed(2)} USDT</b>
          </div>
          <div className="flex justify-between mt-1">
            <span>총 출금</span>
            <b>{totalOut.toFixed(2)} USDT</b>
          </div>
          <div className="flex justify-between mt-1">
            <span>잔액</span>
            <b>{balance.toFixed(2)} USDT</b>
          </div>
        </div>

        <div className="rounded-2xl bg-white shadow">
          {loading && <div className="p-4 text-center">불러오는 중...</div>}
          {!loading &&
            filtered.map((r) => (
              <div
                key={r.id}
                className="flex justify-between px-4 py-3 border-b last:border-b-0"
              >
                <div>
                  <div className="text-sm text-gray-600">{r.transfer_date}</div>
                  <div className="text-xs text-gray-400">{reasonLabel(r.reason)}</div>
                </div>
                <div
                  className={`font-semibold ${
                    r.amount >= 0 ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {r.amount >= 0 ? "+" : "-"}
                  {Math.abs(r.amount).toFixed(2)} USDT
                </div>
              </div>
            ))}
        </div>
      </div>
    </main>
  );
}

// ✅ Suspense로 감싸기
export default function AdminAssetLedgerPage() {
  return (
    <Suspense fallback={<div className="p-6 text-center">로딩 중...</div>}>
      <AssetLedgerInner />
    </Suspense>
  );
}

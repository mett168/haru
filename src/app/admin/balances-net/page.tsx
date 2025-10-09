"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export const dynamic = "force-dynamic";

type Row = {
  ref_code: string;
  name: string | null;
  total_in_deposit: number;
  total_out_reinvest: number;
  total_out_cash: number;
  balance_net: number;
};

export default function AdminBalancesNetPage() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("asset_ledger_totals_v")
          .select(
            "ref_code,name,total_in_deposit,total_out_reinvest,total_out_cash,balance_net"
          )
          .order("balance_net", { ascending: false });
        if (error) throw error;
        setRows((data || []) as Row[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const key = q.trim().toLowerCase();
    if (!key) return rows;
    return rows.filter(
      (r) =>
        (r.ref_code || "").toLowerCase().includes(key) ||
        (r.name || "").toLowerCase().includes(key)
    );
  }, [rows, q]);

  const totalUsers = filtered.length;
  const totalNet = useMemo(
    () => filtered.reduce((s, r) => s + Number(r.balance_net || 0), 0),
    [filtered]
  );

  const toCSV = () => {
    const header =
      "ref_code,name,total_in_deposit,total_out_reinvest,total_out_cash,balance_net\n";
    const body = filtered
      .map((r) =>
        [
          r.ref_code,
          r.name ?? "",
          Number(r.total_in_deposit).toFixed(2),
          Number(r.total_out_reinvest).toFixed(2),
          Number(r.total_out_cash).toFixed(2),
          Number(r.balance_net).toFixed(2),
        ].join(",")
      )
      .join("\n");
    const blob = new Blob([header + body], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "balances_net.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  // ✅ 자산이력 페이지로 이동
  const goLedgerHistory = (refCode: string) => {
    router.push(`/admin/asset-ledger?ref=${encodeURIComponent(refCode)}`);
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb]">
      <div className="max-w-[900px] mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold">유저별 보유자산(실제)</h1>
          <div className="text-sm text-gray-600">
            총 {totalUsers.toLocaleString()}명 · 합계{" "}
            <b>{totalNet.toFixed(2)} USDT</b>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-3">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="ref_code / 이름 검색"
            className="flex-1 border rounded-lg px-3 py-2"
          />
          <button
            onClick={toCSV}
            className="px-3 py-2 rounded-lg bg-gray-800 text-white text-sm"
          >
            CSV
          </button>
        </div>

        <div className="rounded-2xl bg-white shadow overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">ref_code</th>
                <th className="text-left px-4 py-3">이름</th>
                <th className="text-right px-4 py-3">입금 합계</th>
                <th className="text-right px-4 py-3">보충 출금</th>
                <th className="text-right px-4 py-3">현금교환 출금</th>
                <th className="text-right px-4 py-3">보유 자산(실제)</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-gray-500"
                  >
                    불러오는 중…
                  </td>
                </tr>
              )}
              {!loading && filtered.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-6 text-center text-gray-400"
                  >
                    데이터 없음
                  </td>
                </tr>
              )}
              {!loading &&
                filtered.map((r) => (
                  <tr key={r.ref_code} className="border-t">
                    <td className="px-4 py-3 font-mono">{r.ref_code}</td>
                    <td className="px-4 py-3">{r.name ?? "-"}</td>
                    <td className="px-4 py-3 text-right">
                      {Number(r.total_in_deposit).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(r.total_out_reinvest).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {Number(r.total_out_cash).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-blue-600">
                      {Number(r.balance_net).toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <a
                          href={`/harumoney/investments?ref=${encodeURIComponent(
                            r.ref_code
                          )}`}
                          className="px-2 py-1 rounded bg-blue-600 text-white text-xs"
                        >
                          투자내역
                        </a>
                        <button
                          onClick={() => goLedgerHistory(r.ref_code)}
                          className="px-2 py-1 rounded bg-gray-700 text-white text-xs"
                        >
                          자산이력
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}

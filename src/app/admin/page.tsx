"use client";

import { useEffect, useState } from "react";

type Row = {
  ref_code: string;
  user_name: string | null;
  today_repay: number;
  today_interest: number;
  total_amount: number;
  status: string;
};

function toKST() {
  const t = new Date(Date.now() + 9 * 3600 * 1000);
  return t.toISOString().slice(0, 10);
}

export default function AdminPayoutsPage() {
  const [date, setDate] = useState(toKST());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ repay: number; interest: number; total: number } | null>(null);

  // --- 데이터 조회 (GET /api/admin/payouts?date=...)
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts?date=${date}`);
      const json = await res.json();
      if (res.ok) {
        setRows(json.data || []);
        setSummary({
          repay: Number(json.sums?.repay_sum || 0),
          interest: Number(json.sums?.interest_sum || 0),
          total: Number(json.sums?.total_sum || 0),
        });
      } else {
        alert(json.error || "조회 에러");
      }
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  // --- 지급 계산 (commit=false)
  const runCalc = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, commit: false }),
      });
      const json = await res.json();
      if (res.ok) {
        setRows(json.preview || []);
        setSummary({
          repay: Number(json.sums?.repay_sum || 0),
          interest: Number(json.sums?.interest_sum || 0),
          total: Number(json.sums?.total_sum || 0),
        });
      } else {
        alert(json.error || "계산 에러");
      }
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  // --- 지급 실행 (commit=true → payout_transfers 저장)
  const runExecute = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, commit: true }),
      });
      const json = await res.json();
      if (res.ok) {
        alert(`저장 완료: ${json.upserted}건`);
        await fetchData();
      } else {
        alert(json.error || "저장 에러");
      }
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  // --- 송금(보유자산 원장 적립) : /api/admin/payouts/deposit
  const runDeposit = async () => {
    if (!date) return alert("날짜를 선택하세요.");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const json = await res.json();
      if (res.ok) {
        const inserted = Number(json.inserted ?? 0);
        alert(`송금(보유자산 적립) 완료: ${inserted}건`);
        await fetchData();
      } else {
        alert(json.error || "송금(적립) 에러");
      }
    } catch (e: any) {
      alert(e?.message || "네트워크 오류");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="max-w-[960px] mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">지급 관리</h1>

      {/* 날짜 선택 + 버튼들 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1 border rounded"
          title="해당 날짜의 저장된 지급 데이터 조회"
        >
          조회
        </button>
        <button
          onClick={runCalc}
          disabled={loading}
          className="px-3 py-1 bg-yellow-500 text-white rounded"
          title="미리보기(저장 안 함)"
        >
          지급 계산
        </button>
        <button
          onClick={runExecute}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded"
          title="payout_transfers 저장"
        >
          지급 실행
        </button>
        {/* ✅ 신규: 송금 버튼 (asset_ledger 적립) */}
        <button
          onClick={runDeposit}
          disabled={loading}
          className="px-3 py-1 bg-emerald-600 text-white rounded"
          title="해당 날짜 지급 합계를 보유자산에 적립"
        >
          송금
        </button>
      </div>

      {/* 합계 박스 */}
      {summary && (
        <div className="bg-gray-50 border rounded p-3 text-sm">
          <p>오늘 원금 상환 합계: {summary.repay.toLocaleString()}</p>
          <p>오늘 수익금 합계: {summary.interest.toLocaleString()}</p>
          <p className="font-bold">오늘 총 지급액: {summary.total.toLocaleString()}</p>
        </div>
      )}

      {/* 테이블 */}
      <div className="overflow-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">코드</th>
              <th className="border px-2 py-1">이름</th>
              <th className="border px-2 py-1">오늘 원금상환</th>
              <th className="border px-2 py-1">오늘 수익금</th>
              <th className="border px-2 py-1">합계</th>
              <th className="border px-2 py-1">상태</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="text-center">
                <td className="border px-2 py-1">{r.ref_code}</td>
                <td className="border px-2 py-1">{r.user_name || "-"}</td>
                <td className="border px-2 py-1">{Number(r.today_repay ?? 0).toLocaleString()}</td>
                <td className="border px-2 py-1">{Number(r.today_interest ?? 0).toLocaleString()}</td>
                <td className="border px-2 py-1 font-semibold">
                  {Number(r.total_amount ?? 0).toLocaleString()}
                </td>
                <td className="border px-2 py-1">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="border px-2 py-3 text-center text-gray-500" colSpan={6}>
                  데이터가 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

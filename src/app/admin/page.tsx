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
  const [summary, setSummary] = useState<any>(null);

  // --- 데이터 조회 (GET /api/admin/payouts?date=...)
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts?date=${date}`);
      const json = await res.json();
      if (res.ok) {
        setRows(json.data || []);
        setSummary({
          repay: json.sums?.repay_sum || 0,
          interest: json.sums?.interest_sum || 0,
          total: json.sums?.total_sum || 0,
        });
      } else {
        alert(json.error || "조회 에러");
      }
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
          repay: json.sums?.repay_sum || 0,
          interest: json.sums?.interest_sum || 0,
          total: json.sums?.total_sum || 0,
        });
      } else {
        alert(json.error || "계산 에러");
      }
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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  return (
    <div className="max-w-[960px] mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">지급 관리</h1>

      {/* 날짜 선택 + 버튼 */}
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
        >
          조회
        </button>
        <button
          onClick={runCalc}
          disabled={loading}
          className="px-3 py-1 bg-yellow-500 text-white rounded"
        >
          지급 계산
        </button>
        <button
          onClick={runExecute}
          disabled={loading}
          className="px-3 py-1 bg-blue-600 text-white rounded"
        >
          지급 실행
        </button>
      </div>

      {/* 합계 */}
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
                <td className="border px-2 py-1">{r.today_repay?.toLocaleString()}</td>
                <td className="border px-2 py-1">{r.today_interest?.toLocaleString()}</td>
                <td className="border px-2 py-1 font-semibold">
                  {r.total_amount?.toLocaleString()}
                </td>
                <td className="border px-2 py-1">{r.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

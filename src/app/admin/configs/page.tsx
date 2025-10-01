"use client";

import { useEffect, useState } from "react";


type Row = {
  ref_code: string;
  user_name?: string | null;
  interest_date: string;
  invest_sum?: number | null;
  principal_base?: number | null;
  user_interest?: number | null;
  referral_interest?: number | null;
  center_interest?: number | null;
  total_interest?: number | null;
};

export default function AdminInterestsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/interests?date=${date}`);
      const json = await res.json();
      if (res.ok) setRows(json.data || []);
      else alert(json.error || "에러 발생");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [date]);

  const sum = (key: keyof Row) =>
    rows.reduce((a, b) => a + Number(b[key] || 0), 0);

  return (
    <div className="max-w-[960px] mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">📊 일일 수익 현황</h1>

      {/* 날짜 선택 */}
      <div className="flex items-center gap-3">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-3 py-2"
        />
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-4 py-2 border rounded bg-blue-600 text-white"
        >
          조회
        </button>
      </div>

      {/* 합계 */}
      <div className="bg-gray-50 border rounded p-3 text-sm">
        <p>총 투자금: {sum("invest_sum").toLocaleString()} </p>
        <p>총 원금: {sum("principal_base").toLocaleString()} </p>
        <p>투자자 이자: {sum("user_interest").toLocaleString()} </p>
        <p>추천인 이자: {sum("referral_interest").toLocaleString()} </p>
        <p>센터 이자: {sum("center_interest").toLocaleString()} </p>
        <p className="font-bold">총 수익금: {sum("total_interest").toLocaleString()} </p>
      </div>

      {/* 테이블 */}
      <div className="overflow-auto">
        <table className="w-full text-sm border border-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-2 py-1 border">코드</th>
              <th className="px-2 py-1 border">이름</th>
              <th className="px-2 py-1 border">투자금</th>
              <th className="px-2 py-1 border">원금</th>
              <th className="px-2 py-1 border">투자자이자</th>
              <th className="px-2 py-1 border">추천인이자</th>
              <th className="px-2 py-1 border">센터이자</th>
              <th className="px-2 py-1 border">총수익</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, idx) => (
              <tr key={idx} className="text-center">
                <td className="border px-2 py-1">{r.ref_code}</td>
                <td className="border px-2 py-1">{r.user_name || "-"}</td>
                <td className="border px-2 py-1">{r.invest_sum?.toLocaleString()}</td>
                <td className="border px-2 py-1">{r.principal_base?.toLocaleString()}</td>
                <td className="border px-2 py-1">{r.user_interest?.toLocaleString()}</td>
                <td className="border px-2 py-1">{r.referral_interest?.toLocaleString()}</td>
                <td className="border px-2 py-1">{r.center_interest?.toLocaleString()}</td>
                <td className="border px-2 py-1 font-semibold">{r.total_interest?.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


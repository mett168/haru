"use client";
import { useEffect, useState } from "react";

type Row = {
  ref_code: string;
  today_repay: number | null;
  today_interest: number | null;
  total_amount: number | null;   // ✅ 백엔드/DB와 일치
};

// 안전한 KST yyyy-mm-dd
function getKSTDate() {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date()) // sv-SE -> 'YYYY-MM-DD'
    .slice(0, 10);
}

const nf = (v: number | null | undefined) =>
  Number(v ?? 0).toLocaleString("ko-KR", { maximumFractionDigits: 3 });

export default function AdminHaruMoneyPage() {
  const [date, setDate] = useState(getKSTDate());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/harumoney?date=${date}`);
      const json = await res.json();
      if (res.ok) {
        // 백엔드가 total_amount 대신 today_total을 준다면 아래 매핑으로 보정
        const data: Row[] = (json.data || []).map((r: any) => ({
          ref_code: r.ref_code,
          today_repay: Number(r.today_repay ?? 0),
          today_interest: Number(r.today_interest ?? 0),
          total_amount: Number(
            r.total_amount ?? r.today_total ?? // 둘 중 하나만 와도 동작
              (Number(r.today_repay ?? 0) + Number(r.today_interest ?? 0))
          ),
        }));
        setRows(data);
      } else {
        alert(json.error || "에러");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  const sum = (key: keyof Row) =>
    rows.reduce((a, b) => a + Number(b[key] ?? 0), 0);

  return (
    <div className="max-w-[900px] mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">오늘의 하루머니 현황</h1>

      <div className="flex gap-2 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button
          onClick={fetchData}
          disabled={loading}
          className="px-3 py-1 border rounded bg-blue-600 text-white"
        >
          조회
        </button>
      </div>

      {/* 합계 */}
      <div className="bg-gray-50 border rounded p-3 text-sm">
        <p>오늘 원금 상환 합계: {nf(sum("today_repay"))}</p>
        <p>오늘 수익금 합계: {nf(sum("today_interest"))}</p>
        <p className="font-bold">오늘 하루머니 총합: {nf(sum("total_amount"))}</p>
      </div>

      {/* 테이블 */}
      <div className="overflow-auto">
        <table className="w-full text-sm border">
          <thead className="bg-gray-100">
            <tr>
              <th className="border px-2 py-1">코드</th>
              <th className="border px-2 py-1">오늘 원금상환</th>
              <th className="border px-2 py-1">오늘 수익금</th>
              <th className="border px-2 py-1">합계</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="text-center">
                <td className="border px-2 py-1">{r.ref_code}</td>
                <td className="border px-2 py-1">{nf(r.today_repay)}</td>
                <td className="border px-2 py-1">{nf(r.today_interest)}</td>
                <td className="border px-2 py-1 font-semibold">
                  {nf(r.total_amount)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={4} className="text-center p-3 text-gray-500">
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

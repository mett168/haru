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

  // ====== 수동 입금 모달 상태 ======
  const [manualOpen, setManualOpen] = useState(false);
  const [manualRefCode, setManualRefCode] = useState("");
  const [manualAmount, setManualAmount] = useState<string>("");
  const [manualMemo, setManualMemo] = useState("");
  const [manualMsg, setManualMsg] = useState<string | null>(null);
  const [manualBusy, setManualBusy] = useState(false);

  const resetManual = () => {
    setManualRefCode("");
    setManualAmount("");
    setManualMemo("");
    setManualMsg(null);
  };

  // --- 데이터 조회
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

  // --- 지급 실행 (commit=true)
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

  // --- 송금(보유자산 적립)
  const runDeposit = async () => {
    if (!date) return alert("날짜를 선택하세요.");
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payouts/deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date })
      });
      const json = await res.json();

      if (res.ok && json?.ok) {
        const total = Number(json.totalTargets ?? 0);
        const success = Number(json.successCount ?? 0);
        const failures = Array.isArray(json.results)
          ? json.results.filter((r: any) => r?.ok === false)
          : [];

        if (failures.length > 0) {
          const first = failures[0];
          const msg =
            `송금(보유자산 적립) 완료: ${success}/${total}건\n` +
            `실패 ${failures.length}건 → 첫 건: ${first?.ref_code || "-"} / ${first?.reason || ""}`;
          alert(msg);
        } else {
          alert(`송금(보유자산 적립) 완료: ${success}/${total}건`);
        }

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

  // --- 수동 입금 실행
  const runManualDeposit = async () => {
    setManualMsg(null);
    const amt = Number(manualAmount);
    if (!manualRefCode || !amt || !isFinite(amt) || amt <= 0) {
      setManualMsg("코드와 양수 금액을 입력하세요.");
      return;
    }
    setManualBusy(true);
    try {
      const res = await fetch(`/api/admin/payouts/manual-deposit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref_code: manualRefCode.trim(), amount: amt, memo: manualMemo }),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setManualMsg("수동 입금 완료!");
        await fetchData();
        resetManual();
        setManualOpen(false);
      } else {
        setManualMsg(json?.error || "수동 입금 실패");
      }
    } catch (e: any) {
      setManualMsg(e?.message || "네트워크 오류");
    } finally {
      setManualBusy(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date]);

  return (
    <div className="max-w-[960px] mx-auto p-4 space-y-4">
      <h1 className="text-xl font-semibold">지급 관리</h1>

      {/* 날짜 + 버튼들 */}
      <div className="flex flex-wrap gap-2 items-center">
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="border rounded px-2 py-1"
        />
        <button onClick={fetchData} disabled={loading} className="px-3 py-1 border rounded">
          조회
        </button>
        <button onClick={runCalc} disabled={loading} className="px-3 py-1 bg-yellow-500 text-white rounded">
          지급 계산
        </button>
        <button onClick={runExecute} disabled={loading} className="px-3 py-1 bg-blue-600 text-white rounded">
          지급 실행
        </button>
        <button onClick={runDeposit} disabled={loading} className="px-3 py-1 bg-emerald-600 text-white rounded">
          송금
        </button>
        <button
          onClick={() => setManualOpen(true)}
          disabled={loading}
          className="px-3 py-1 bg-gray-700 text-white rounded"
          title="누락 보정: 특정 코드에 수동 입금"
        >
          수동 입금
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
                <td className="border px-2 py-1">{Number(r.today_repay ?? 0).toLocaleString()}</td>
                <td className="border px-2 py-1">{Number(r.today_interest ?? 0).toLocaleString()}</td>
                <td className="border px-2 py-1 font-semibold">{Number(r.total_amount ?? 0).toLocaleString()}</td>
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

      {/* 수동 입금 모달 */}
      {manualOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-[420px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-3 text-lg font-semibold">수동 입금 (누락 보정)</div>

            <label className="mb-1 block text-sm text-gray-600">코드 (ref_code)</label>
            <input
              value={manualRefCode}
              onChange={(e) => setManualRefCode(e.target.value)}
              className="mb-3 w-full rounded border px-3 py-2"
              placeholder="예: HM1001"
            />

            <label className="mb-1 block text-sm text-gray-600">금액 (USDT)</label>
            <input
              value={manualAmount}
              onChange={(e) => setManualAmount(e.target.value)}
              className="mb-3 w-full rounded border px-3 py-2"
              placeholder="예: 25.5"
              inputMode="decimal"
            />

            <label className="mb-1 block text-sm text-gray-600">메모 (선택)</label>
            <input
              value={manualMemo}
              onChange={(e) => setManualMemo(e.target.value)}
              className="mb-4 w-full rounded border px-3 py-2"
              placeholder="예: 누락 보정"
            />

            {manualMsg && <div className="mb-3 text-sm text-emerald-700">{manualMsg}</div>}

            <div className="flex justify-end gap-2">
              <button
                className="rounded px-3 py-2 text-gray-600 hover:bg-gray-100"
                onClick={() => { resetManual(); setManualOpen(false); }}
                disabled={manualBusy}
              >
                닫기
              </button>
              <button
                onClick={runManualDeposit}
                disabled={manualBusy}
                className="rounded bg-gray-800 px-4 py-2 text-white hover:bg-gray-900 disabled:opacity-60"
              >
                {manualBusy ? "처리 중..." : "입금"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

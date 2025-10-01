"use client";

import { useState } from "react";

export default function ManualRewardPanel() {
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [isError, setIsError] = useState(false);

  const handleSend = async () => {
    if (!date) {
      alert("날짜를 선택해주세요.");
      return;
    }

    setLoading(true);
    setResult("");
    setIsError(false);

    try {
      const res = await fetch(`/api/manual-send-rewards?date=${date}`);
      const json = await res.json();

      if (!res.ok) {
        setIsError(true);
        setResult(json.error || "❌ 송금 중 오류 발생");
      } else {
        setIsError(false);
        setResult(json.message || "✅ 송금 완료");
      }
    } catch (e) {
      console.error("❌ 에러:", e);
      setIsError(true);
      setResult("❌ 송금 중 예외 발생");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white p-5 border rounded shadow space-y-4">
      <h3 className="text-lg font-bold text-gray-800">📅 지정 날짜 리워드 수동 송금</h3>

      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="border px-3 py-1 rounded w-full max-w-xs"
      />

      <button
        onClick={handleSend}
        disabled={loading}
        className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "송금 중..." : "리워드 송금 실행"}
      </button>

      {result && (
        <p className={`text-sm ${isError ? "text-red-600" : "text-green-600"}`}>
          {result}
        </p>
      )}
    </div>
  );
}

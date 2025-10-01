"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString, truncate2 } from "@/lib/interest";

type UserRow = { ref_code: string; name?: string | null };

type InvestmentRow = {
  id: string;
  ref_code: string;
  invest_date: string | null;
  maturity_date: string | null;
  invest_amount_usdt: number;     // ✅ 실제 DB 컬럼명
  created_at: string | null;
  memo?: string | null;
  // 표시용
  name?: string | null;
};

// 이미 KST로 저장되어 있을 수 있으니 강제 +9h 하지 않고 타임존 지정만
function fmtTimeKST(iso?: string | null) {
  if (!iso) return "-";
  try {
    return new Date(iso).toLocaleTimeString("ko-KR", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      timeZone: "Asia/Seoul",
    });
  } catch {
    return "-";
  }
}

export default function AdminInvestmentsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [rows, setRows] = useState<InvestmentRow[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [amount, setAmount] = useState("");
  const [memo, setMemo] = useState("");
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  // 이름 매핑
  const nameMap = useMemo(() => {
    const m = new Map<string, string | null>();
    users.forEach((u) => m.set(u.ref_code, u.name ?? null));
    return m;
  }, [users]);

  // 초기 로드: 유저 목록 + 투자 목록
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const [uRes, iRes] = await Promise.all([
          supabase.from("users").select("ref_code, name").order("ref_code"),
          supabase
            .from("investments")
            .select(
              "id, ref_code, invest_date, maturity_date, invest_amount_usdt, created_at, memo"
            )
            .order("created_at", { ascending: false }),
        ]);

        if (!uRes.error && uRes.data) setUsers(uRes.data as UserRow[]);

        if (!iRes.error && iRes.data) {
          const withName = (iRes.data as InvestmentRow[]).map((r) => ({
            ...r,
            name: null, // 표시 단계에서 nameMap으로 채움
          }));
          setRows(withName);
        }

        if (uRes.error) setMsg(uRes.error.message);
        if (iRes.error) setMsg(iRes.error.message);
      } catch (e: any) {
        setMsg(e?.message || "로딩 에러");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 표시용 rows (name 매핑)
  const displayRows = useMemo(
    () =>
      rows.map((r) => ({
        ...r,
        name: r.name ?? nameMap.get(r.ref_code) ?? null,
      })),
    [rows, nameMap]
  );

  // 투자 추가
  const submit = async () => {
    try {
      setMsg("");
      if (!selectedRef) throw new Error("초대코드를 선택하세요.");
      const amt = truncate2(Number(amount || 0));
      if (!amt || amt <= 0) throw new Error("금액을 입력하세요.");

      const investDate = getKSTDateString();

      // API 라우트에서 만기일 계산/동시 처리하도록 위임
      const r = await fetch("/api/admin/investments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref_code: selectedRef,
          invest_amount_usdt: amt, // ✅ DB 컬럼명과 일치
          invest_date: investDate,
          memo: memo || undefined,
        }),
      });

      const ct = r.headers.get("content-type") || "";
      const isJSON = ct.includes("application/json");
      const body = isJSON ? await r.json() : await r.text();
      if (!r.ok || (isJSON && body?.ok === false)) {
        throw new Error((isJSON ? body?.error : body) || "저장 실패");
      }

      // 방금 추가분 재조회
      const { data: newRow, error } = await supabase
        .from("investments")
        .select(
          "id, ref_code, invest_date, maturity_date, invest_amount_usdt, created_at, memo"
        )
        .eq("ref_code", selectedRef)
        .eq("invest_date", investDate)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;

      if (newRow) {
        setRows((prev) => [
          { ...(newRow as InvestmentRow), name: nameMap.get(selectedRef) ?? null },
          ...prev,
        ]);
      }

      setAmount("");
      setMemo("");
      setMsg("저장 완료");
    } catch (e: any) {
      setMsg(e.message || "에러");
    }
  };

  return (
    <div className="max-w-[1200px] mx-auto p-6 space-y-6">
      <h1 className="text-xl font-bold">관리자 — 투자 현황</h1>

      {/* 입력 박스 */}
      <div className="rounded-2xl bg-white shadow p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600 w-20">초대코드</label>
          <select
            className="border rounded px-3 py-2 w-60"
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value)}
          >
            <option value="">-- 선택 --</option>
            {users.map((u) => (
              <option key={u.ref_code} value={u.ref_code}>
                {u.ref_code}
                {u.name ? ` / ${u.name}` : ""}
              </option>
            ))}
          </select>
        </div>

        <input
          className="border rounded px-3 py-2 w-40"
          type="number"
          step="0.01"
          inputMode="decimal"
          placeholder="금액(USDT)"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          onBlur={() => {
            const n = truncate2(Number(amount || 0));
            setAmount(n ? String(n) : "");
          }}
        />
        <input
          className="border rounded px-3 py-2 flex-1"
          placeholder="메모(선택)"
          value={memo}
          onChange={(e) => setMemo(e.target.value)}
        />
        <button
          onClick={submit}
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
          disabled={loading}
        >
          추가 투자
        </button>
        {msg && <div className="text-sm text-gray-600 ml-auto">{msg}</div>}
      </div>

      {/* 투자 내역 테이블 */}
      <div className="rounded-2xl bg-white shadow overflow-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr className="text-left">
              <th className="px-4 py-3 w-36">Ref Code</th>
              <th className="px-4 py-3 w-40">이름</th>
              <th className="px-4 py-3 w-36">투자일</th>
              <th className="px-4 py-3 w-36">만기일</th>
              <th className="px-4 py-3 w-32">투자시간</th>
              <th className="px-4 py-3 w-40 text-right">금액(USDT)</th>
              <th className="px-4 py-3">메모</th>
            </tr>
          </thead>
          <tbody>
            {displayRows.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-center text-gray-500" colSpan={7}>
                  데이터가 없습니다.
                </td>
              </tr>
            ) : (
              displayRows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="px-4 py-2 font-mono">{r.ref_code}</td>
                  <td className="px-4 py-2">{r.name || "-"}</td>
                  <td className="px-4 py-2">{r.invest_date || "-"}</td>
                  <td className="px-4 py-2">{r.maturity_date || "-"}</td>
                  <td className="px-4 py-2">{fmtTimeKST(r.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    {Number(r.invest_amount_usdt || 0).toLocaleString(undefined, {
                      maximumFractionDigits: 2,
                    })}
                  </td>
                  <td className="px-4 py-2">{r.memo || ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

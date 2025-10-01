"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString, getKSTISOString } from "@/lib/dateUtil";

type UserRow = { ref_code: string; name?: string | null };

/** 상환 내역(로그) */
type RepaymentLogRow = {
  id: string;
  ref_code: string;
  investment_id: string | null;
  amount: number;
  repay_date: string;   // date
  status: string | null;
  created_at: string;   // timestamptz
};

/** 투자 합계 계산용 */
type InvestRow = { invest_amount_usdt: number };

/** 현황(투자별 1행) – 참고/요약용 */
type RepaymentStatusRow = {
  investment_id: string;
  ref_code: string;
  principal_initial: number;
  principal_remaining: number;
  daily_amount: number;
  start_date: string;
  last_paid_date: string | null;
  status: string;
};

export default function AdminRepaymentsPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [selectedRef, setSelectedRef] = useState<string>("");
  const [repayDate, setRepayDate] = useState<string>(getKSTDateString());
  const [amount, setAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // 화면 데이터
  const [logs, setLogs] = useState<RepaymentLogRow[]>([]);
  const [investSum, setInvestSum] = useState<number>(0);
  const [repaySum, setRepaySum] = useState<number>(0);
  const [statuses, setStatuses] = useState<RepaymentStatusRow[]>([]); // 투자별 현황(선택)

  // 유저 목록
  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from("users")
        .select("ref_code, name")
        .order("ref_code", { ascending: true });
      if (!error && data) setUsers(data as UserRow[]);
    })();
  }, []);

  // 선택 변경 시 데이터 로드
  useEffect(() => {
    if (!selectedRef) return;
    (async () => {
      await Promise.all([
        loadInvestSum(selectedRef),
        loadRepaymentLogs(selectedRef),
        loadRepaymentStatuses(selectedRef),
      ]);
    })();
  }, [selectedRef]);

  const selectedUserName = useMemo(() => {
    const u = users.find((u) => u.ref_code === selectedRef);
    return u?.name || "";
  }, [users, selectedRef]);

  // 잔여 원금(집계) = 총투자 - 총상환 (간단 집계용)
  const principal = useMemo(() => {
    return Math.max(0, Number((investSum - repaySum).toFixed(2)));
  }, [investSum, repaySum]);

  /** 총 투자금 (investments.invest_amount_usdt 합계) */
  async function loadInvestSum(ref: string) {
    const { data, error } = await supabase
      .from("investments")
      .select("invest_amount_usdt")
      .eq("ref_code", ref);

    if (error || !data) {
      setInvestSum(0);
      return;
    }
    const total = (data as InvestRow[]).reduce(
      (acc, cur) => acc + Number(cur.invest_amount_usdt || 0),
      0
    );
    setInvestSum(Number(total.toFixed(2)));
  }

  /** 상환 내역(로그) 불러오기 – 날짜별 목록 */
  async function loadRepaymentLogs(ref: string) {
    const { data, error } = await supabase
      .from("repayment_logs") // ✅ 로그 테이블에서 읽기
      .select("*")
      .eq("ref_code", ref)
      .order("repay_date", { ascending: false })
      .limit(200);

    if (error || !data) {
      setLogs([]);
      setRepaySum(0);
      return;
    }
    const rows = data as RepaymentLogRow[];
    setLogs(rows);
    const total = rows.reduce((acc, cur) => acc + Number(cur.amount || 0), 0);
    setRepaySum(Number(total.toFixed(2)));
  }

  /** 현황(투자별 1행) – repayments 테이블 조회 (선택: 요약 카드 보강/검증용) */
  async function loadRepaymentStatuses(ref: string) {
    const { data, error } = await supabase
      .from("repayments")
      .select(
        "investment_id, ref_code, principal_initial, principal_remaining, daily_amount, start_date, last_paid_date, status"
      )
      .eq("ref_code", ref)
      .order("start_date", { ascending: true });

    if (!error && data) setStatuses(data as RepaymentStatusRow[]);
    else setStatuses([]);
  }

  /** 상환 저장 – 기본: 로그에 insert (또는 RPC로도 가능) */
  async function handleSave() {
    if (!selectedRef) return alert("유저(초대코드)를 선택하세요.");
    const val = Number(amount);
    if (!val || val <= 0) return alert("상환 금액을 올바르게 입력하세요.");
    if (!repayDate) return alert("상환일을 선택하세요.");

    // 잔여 원금 초과 경고(간단 집계 기준)
    if (val > principal) {
      const ok = confirm(
        `입력 금액이 잔여 원금(${principal.toLocaleString()})을 초과합니다. 그대로 저장할까요?`
      );
      if (!ok) return;
    }

    setLoading(true);
    try {
      // 가장 최근 투자 한 건에 묶고 싶다면 investment_id를 선택해서 넘기세요.
      // 지금은 선택하지 않고 null로 둡니다. (필요하면 UI에 투자선택 드롭다운 추가)
      const payload = {
        ref_code: selectedRef,
        investment_id: null as string | null,
        amount: val,
        repay_date: repayDate,
        status: "completed",
        created_at: getKSTISOString(),
      };

      const { error } = await supabase.from("repayment_logs").insert(payload); // ✅ 로그에 저장
      if (error) throw error;

      setAmount("");
      await Promise.all([
        loadInvestSum(selectedRef),
        loadRepaymentLogs(selectedRef),
        loadRepaymentStatuses(selectedRef),
      ]);
      alert("원금 상환이 저장되었습니다.");
    } catch (e: any) {
      console.error(e);
      alert(`저장 중 오류: ${e?.message || e}`);
    } finally {
      setLoading(false);
    }
  }

  /** 상환 내역 삭제 – 로그에서 삭제 */
  async function handleDelete(id: string) {
    const ok = confirm("이 상환 내역을 삭제할까요?");
    if (!ok) return;
    const { error } = await supabase.from("repayment_logs").delete().eq("id", id);
    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }
    await loadRepaymentLogs(selectedRef);
    await loadInvestSum(selectedRef);
    await loadRepaymentStatuses(selectedRef);
  }

  return (
    <div className="max-w-[960px] mx-auto px-4 py-5">
      <h1 className="text-xl font-bold mb-4">원금 상환 관리</h1>

      {/* 선택 영역 */}
      <div className="grid md:grid-cols-3 gap-3 mb-4">
        {/* 유저 선택 */}
        <div className="bg-white rounded-2xl shadow p-4">
          <label className="text-sm font-semibold text-gray-700">유저 선택(초대코드 / 이름)</label>
          <select
            className="w-full mt-2 border rounded-lg p-2"
            value={selectedRef}
            onChange={(e) => setSelectedRef(e.target.value)}
          >
            <option value="">— 선택하세요 —</option>
            {users.map((u) => (
              <option key={u.ref_code} value={u.ref_code}>
                {u.ref_code} {u.name ? ` / ${u.name}` : ""}
              </option>
            ))}
          </select>

          {selectedRef && (
            <p className="text-xs text-gray-500 mt-2">
              선택: <span className="font-semibold">{selectedRef}</span>
              {selectedUserName ? ` / ${selectedUserName}` : ""}
            </p>
          )}
        </div>

        {/* 상환 입력 */}
        <div className="bg-white rounded-2xl shadow p-4">
          <label className="text-sm font-semibold text-gray-700">상환일</label>
          <input
            type="date"
            className="w-full mt-2 border rounded-lg p-2"
            value={repayDate}
            onChange={(e) => setRepayDate(e.target.value)}
          />

          <label className="text-sm font-semibold text-gray-700 mt-4 block">상환 금액</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            placeholder="예) 500"
            className="w-full mt-2 border rounded-lg p-2"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />

          <button
            onClick={handleSave}
            disabled={loading || !selectedRef}
            className="w-full mt-4 rounded-xl bg-blue-600 text-white py-2.5 font-semibold disabled:opacity-60"
          >
            {loading ? "저장 중..." : "상환 저장"}
          </button>
        </div>

        {/* 요약 카드 (간단 집계) */}
        <div className="bg-white rounded-2xl shadow p-4">
          <p className="text-sm font-semibold text-gray-700">요약</p>
          <div className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">총 투자</span>
              <span className="font-semibold">
                {investSum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">총 상환</span>
              <span className="font-semibold">
                {repaySum.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">잔여 원금</span>
              <span className="font-semibold">
                {principal.toLocaleString(undefined, { maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <p className="text-[11px] text-gray-400 mt-3">* 상환 저장 시 KST 기준으로 기록됩니다.</p>
        </div>
      </div>

      {/* (선택) 투자별 현황 테이블 */}
      {selectedRef && statuses.length > 0 && (
        <div className="bg-white rounded-2xl shadow p-4 mb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">투자별 현황</p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">투자ID</th>
                  <th className="py-2 pr-3 text-right">초기 원금</th>
                  <th className="py-2 pr-3 text-right">잔여 원금</th>
                  <th className="py-2 pr-3 text-right">일일 상환금</th>
                  <th className="py-2 pr-3">시작일</th>
                  <th className="py-2 pr-3">마지막 상환일</th>
                  <th className="py-2 pr-3">상태</th>
                </tr>
              </thead>
              <tbody>
                {statuses.map((s) => (
                  <tr key={s.investment_id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-mono">{s.investment_id.slice(0, 8)}…</td>
                    <td className="py-2 pr-3 text-right">
                      {Number(s.principal_initial).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {Number(s.principal_remaining).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {Number(s.daily_amount).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3">{s.start_date}</td>
                    <td className="py-2 pr-3">{s.last_paid_date || "-"}</td>
                    <td className="py-2 pr-3">{s.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 상환 내역 리스트 (repayment_logs) */}
      <div className="bg-white rounded-2xl shadow p-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-gray-700">상환 내역</p>
          {selectedRef && (
            <span className="text-xs text-gray-500">
              {selectedRef} {selectedUserName ? ` / ${selectedUserName}` : ""}
            </span>
          )}
        </div>

        {!selectedRef ? (
          <p className="text-sm text-gray-500">좌측에서 유저를 먼저 선택하세요.</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-gray-500">상환 내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="py-2 pr-3">상환일</th>
                  <th className="py-2 pr-3 text-right">금액</th>
                  <th className="py-2 pr-3">상태</th>
                  <th className="py-2">처리시각(KST)</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2 pr-3">{r.repay_date}</td>
                    <td className="py-2 pr-3 text-right">
                      {Number(r.amount).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                    </td>
                    <td className="py-2 pr-3">{r.status || "-"}</td>
                    <td className="py-2 pr-3">
                      {new Date(r.created_at).toLocaleString("ko-KR")}
                    </td>
                    <td className="py-2">
                      <button
                        onClick={() => handleDelete(r.id)}
                        className="text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="font-semibold">
                  <td className="py-2 pr-3">합계</td>
                  <td className="py-2 pr-3 text-right">
                    {logs
                      .reduce((acc, cur) => acc + Number(cur.amount || 0), 0)
                      .toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={3}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { getKSTDateString } from "@/lib/dateUtil";

type Row = {
  id: string;
  created_at: string | null;     // timestamptz (UTC)
  created_at_kst: string | null; // text ("YYYY-MM-DDTHH:mm:ss+09:00")
  tuition: number | null;
  pass_expired_at: string | null;
  pass_type: string | null;
  quantity: number | null;
};

const MAX = 5;

// 신청일 + 1년(월말 보정)
function addOneYearKST(base: Date) {
  const d = new Date(base);
  const m = d.getMonth();
  d.setFullYear(d.getFullYear() + 1);
  if (d.getMonth() !== m) d.setDate(0);
  return d;
}

export default function MySubscriptionsCard() {
  const account = useActiveAccount();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const formatCreated = (row: Row) => {
    if (row.created_at_kst) return row.created_at_kst.slice(0, 10);
    if (row.created_at) return getKSTDateString(new Date(row.created_at));
    return "-";
  };
  const formatExpired = (row: Row) => {
    const created = row.created_at_kst
      ? new Date(row.created_at_kst)
      : row.created_at
      ? new Date(row.created_at)
      : new Date();
    return getKSTDateString(addOneYearKST(created));
  };
  const formatAmount = (row: Row) =>
    row.tuition != null ? `${Number(row.tuition).toLocaleString()} USDT` : "-";
  const isActive = (row: Row) => {
    const todayKST = getKSTDateString(new Date());
    return todayKST <= formatExpired(row);
  };

  useEffect(() => {
    if (!account?.address) return;
    (async () => {
      setLoading(true);
      try {
        const { data: user, error: userErr } = await supabase
          .from("users")
          .select("ref_code")
          .eq("wallet_address", account.address.toLowerCase())
          .maybeSingle();
        if (userErr || !user?.ref_code) {
          setRows([]);
          return;
        }
        const { data, error } = await supabase
          .from("enrollments")
          .select("id, created_at, created_at_kst, tuition, pass_expired_at, pass_type, quantity")
          .eq("ref_code", user.ref_code)
          .order("created_at", { ascending: false });
        if (error) throw error;
        setRows((data ?? []) as Row[]);
      } catch (e) {
        console.error("내 구독 조회 실패:", e);
        setRows([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [account?.address]);

  // ✅ 화면에 쓸 목록은 여기서 딱 잘라서 결정
  const visibleRows = useMemo(
    () => (showAll ? rows : rows.slice(0, MAX)),
    [rows, showAll]
  );
  const hasAny = rows.length > 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-blue-600">내 구독 내역</h3>
        {loading ? (
          <span className="text-xs text-gray-400">불러오는 중…</span>
        ) : hasAny ? null : (
          <span className="text-xs text-gray-400">구독 내역이 없습니다</span>
        )}
      </div>

      {hasAny && (
        <div className="space-y-2">
          {/* 헤더 */}
          <div className="grid grid-cols-3 gap-2 text-xs text-gray-500 px-2">
            <div>구독일</div>
            <div className="text-right">결제 금액</div>
            <div className="text-right">만료일</div>
          </div>

          {/* ✅ 항상 visibleRows만 map */}
          {visibleRows.map((r) => (
            <div
              key={r.id}
              className="grid grid-cols-3 gap-2 items-center bg-gray-50 rounded-xl px-3 py-2"
            >
              <div className="text-sm">
                <div className="font-medium">{formatCreated(r)}</div>
                <div className="text-[11px] text-gray-500">
                  {r.pass_type ?? "멤버십"}{r.quantity && r.quantity > 1 ? ` ×${r.quantity}` : ""}
                </div>
              </div>

              <div className="text-sm text-right font-semibold">{formatAmount(r)}</div>

              <div className="flex items-center justify-end gap-2">
                <div className="text-sm">{formatExpired(r)}</div>
                {isActive(r) ? (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">구독중</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">만료</span>
                )}
              </div>
            </div>
          ))}

          {/* 더보기/접기 토글 */}
          {rows.length > MAX && (
            <div className="mt-2 flex justify-center">
              <button
                onClick={() => setShowAll((v) => !v)}
                className="text-[12px] font-semibold px-3 py-1 rounded-full bg-gray-100 text-blue-600 hover:bg-gray-200"
              >
                {showAll ? "접기" : `상세보기 (${rows.length - MAX}개 더 보기)`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

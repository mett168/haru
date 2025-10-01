"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";

type InvestRow = {
  id: string;
  ref_code: string;
  name: string | null;
  invest_date: string;
  invest_amount_usdt: number;
  maturity_date: string | null;
  status: string | null;
};

const KRW_PER_USDT = 1500;

/**
 * 실제 클라이언트 로직 분리 (Suspense 내부에서만 실행)
 */
function InvestmentsClient() {
  const router = useRouter();
  const sp = useSearchParams();
  const refFromQuery = sp.get("ref") ?? "";

  const [refCode, setRefCode] = useState<string>(refFromQuery);
  const [rows, setRows] = useState<InvestRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [userName, setUserName] = useState<string>("");

  // ref_code 조회
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (!refFromQuery) {
          const { data: me } = await supabase
            .from("users")
            .select("ref_code, name")
            .limit(1)
            .maybeSingle();
          if (me?.ref_code) {
            setRefCode(me.ref_code);
            setUserName(me.name ?? "");
          }
        } else {
          setRefCode(refFromQuery);
          const { data: userByRef } = await supabase
            .from("users")
            .select("name")
            .eq("ref_code", refFromQuery)
            .maybeSingle();
          setUserName(userByRef?.name ?? "");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, [refFromQuery]);

  // 투자 내역 불러오기
  useEffect(() => {
    if (!refCode) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from("investments")
          .select("id, ref_code, name, invest_date, invest_amount_usdt, maturity_date")
          .eq("ref_code", refCode)
          .order("invest_date", { ascending: false });
        if (error) throw error;
        setRows((data ?? []) as InvestRow[]);
      } finally {
        setLoading(false);
      }
    })();
  }, [refCode]);

  const totals = useMemo(() => {
    const usdt = rows.reduce((s, r) => s + Number(r.invest_amount_usdt ?? 0), 0);
    return { usdt, krw: usdt * KRW_PER_USDT };
  }, [rows]);

  const fmt = (d?: string | null) => (d ? d : "-");

  return (
    <main className="mx-auto w-full max-w-[500px] bg-[#f5f7fa] min-h-screen pb-16">
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-2 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="rounded-full p-1 hover:bg-gray-100"
            aria-label="뒤로"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-base font-bold">총 투자 금액 상세</h1>
        </div>
      </div>

      <div className="px-4 pt-3 space-y-3">
        {/* 요약 */}
        <div className="rounded-2xl bg-white shadow p-4">
          <p className="text-sm text-gray-500">
            {userName ? `${userName}님의 누적 투자` : "누적 투자"}
          </p>

          {/* USDT + 원화 한 줄 */}
          <div className="mt-1 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold">
                {totals.usdt.toLocaleString()}
              </span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <span className="text-2xl font-semibold text-gray-600">
              ₩ {totals.krw.toLocaleString()}
            </span>
          </div>
        </div>

        {/* 거래 내역 */}
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-sm font-semibold">거래 내역</p>
            {loading && <span className="text-xs text-gray-400">불러오는 중…</span>}
          </div>

          {rows.length === 0 ? (
            <p className="text-sm text-gray-400">내역이 없습니다.</p>
          ) : (
            <div className="space-y-2">
              {/* 헤더 */}
              <div className="grid grid-cols-3 gap-2 text-[11px] text-gray-500 px-1">
                <div>투자 날짜</div>
                <div className="text-right">투자 금액(USDT)</div>
                <div className="text-right">만기일</div>
              </div>

              {rows.map((r) => (
                <div
                  key={r.id}
                  className="grid grid-cols-3 gap-2 items-center bg-gray-50 rounded-xl px-3 py-2"
                >
                  <div className="text-sm">{fmt(r.invest_date)}</div>
                  <div className="text-sm text-right font-semibold">
                    {Number(r.invest_amount_usdt ?? 0).toLocaleString()}
                  </div>
                  <div className="text-sm text-right">{fmt(r.maturity_date)}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

/**
 * Suspense로 감싼 Page 컴포넌트
 */
export default function InvestmentsDetailPage() {
  return (
    <Suspense fallback={<div>로딩 중...</div>}>
      <InvestmentsClient />
    </Suspense>
  );
}

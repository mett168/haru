"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function InviteDetailClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const refCode = searchParams.get("code");

  const [name, setName] = useState("");
  const [membership, setMembership] = useState<any | null>(null);
  const [history, setHistory] = useState<{ date: string; amount: number }[]>([]);

  // KST(UTC+9) YYYY-MM-DD 포맷터
  const toKSTDate = (d?: string | Date | null) => {
    if (!d) return null;
    const t = typeof d === "string" ? new Date(d) : d;
    if (Number.isNaN(t.getTime())) return null;
    const k = new Date(t.getTime() + 9 * 60 * 60 * 1000);
    const y = k.getFullYear();
    const m = String(k.getMonth() + 1).padStart(2, "0");
    const day = String(k.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // 다양한 컬럼명 대응
  const pickPurchaseAt = (m: any) =>
    m?.started_at ??
    m?.start_at ??
    m?.start_date ??
    m?.purchase_at ??
    m?.purchased_at ??
    m?.created_at ??
    null;

  const pickExpireAt = (m: any) =>
    m?.expired_at ??
    m?.expire_at ??
    m?.end_at ??
    m?.end_date ??
    m?.pass_expired_at ??     // 🔹 스키마에 있는 컬럼도 후보로 추가
    null;

  // (선택) 만료일 없으면 구입일 + 31일
  const addDays = (dateLike: string | Date | null, days: number) => {
    if (!dateLike) return null;
    const d = new Date(dateLike);
    if (Number.isNaN(d.getTime())) return null;
    d.setDate(d.getDate() + days);
    return d.toISOString();
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!refCode) return;

      // 유저 name 조회
      const { data: user } = await supabase
        .from("users")
        .select("name")
        .eq("ref_code", refCode)
        .maybeSingle();

      if (user?.name) setName(user.name);

      // ✅ 멤버십 가입현황 조회 (started_at 정렬 제거 → created_at 최신만)
      const { data: enrollments, error: enrollErr } = await supabase
        .from("enrollments")
        .select("*")
        .eq("ref_code", refCode)
        .order("created_at", { ascending: false })
        .limit(1);

      if (enrollErr) {
        console.error("❌ enrollments 조회 실패:", enrollErr.message);
      }
      setMembership(enrollments?.[0] ?? null);

      // 리워드 내역 조회
      const { data: historyData, error: historyError } = await supabase
        .from("reward_transfers")
        .select("created_at, total_amount")
        .eq("ref_code", refCode)
        .order("created_at", { ascending: false });

      if (historyError) {
        console.error("❌ 리워드 기록 조회 실패:", historyError.message);
      }

      if (historyData) {
        const formatted = historyData.map((item: any) => {
          const kst = new Date(new Date(item.created_at).getTime() + 9 * 60 * 60 * 1000);
          const dateStr = `${kst.getFullYear()}. ${kst.getMonth() + 1}. ${kst.getDate()}.`;
          return { date: dateStr, amount: item.total_amount };
        });
        setHistory(formatted);
      }
    };

    fetchData();
  }, [refCode]);

  // 표시용 파생값
  const membershipTitle =
    membership?.product_name ??
    membership?.plan_name ??
    membership?.pass_type ??      // 🔹 스키마의 pass_type 사용
    "100 프라 멤버십";

  const purchaseAtRaw = pickPurchaseAt(membership);
  const expireAtRaw =
    pickExpireAt(membership) ?? addDays(pickPurchaseAt(membership), 31);

  const purchaseAt = toKSTDate(purchaseAtRaw);
  const expireAt = toKSTDate(expireAtRaw);

  return (
    <main className="min-h-screen bg-[#f5f7fa] pb-24">
      {/* 상단바 */}
      <div className="w-full py-3 flex items-center px-2">
        <button onClick={() => router.push("/invite")} className="mr-3">
          <img src="/icon-back.png" alt="뒤로가기" className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">
          {name || "상세정보"}
        </h1>
      </div>

      <div className="max-w-md mx-auto px-4 pt-2">
        {/* 멤버십 가입 현황 */}
        <h2 className="font-semibold text-sm text-gray-700 mb-2 pl-2">
          {name ? `${name} 님의 프라 멤버십 현황` : "프라 멤버십 현황"}
        </h2>

        <div className="bg-white rounded-xl shadow p-4 flex flex-col space-y-2">
          {membership ? (
            <div className="border rounded-xl border-blue-200 p-4">
              <p className="text-sm font-semibold text-gray-900 mb-1">
                {membershipTitle}
              </p>
              <p className="text-xs text-gray-600">구입일: {purchaseAt ?? "-"}</p>
              <p className="text-xs text-gray-600">유효기간: ~{expireAt ?? "-"}</p>
            </div>
          ) : (
            <div className="text-center text-sm text-gray-500 py-8">
              구독중인 프라멤버십이 없어요
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

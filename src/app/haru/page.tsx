"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";

import BottomNav from "@/components/BottomNav";
import PassPurchaseModal from "@/components/PassPurchaseModal";
import TodayMoneyCard from "@/components/TodayMoneyCard";
import WelcomeCard from "@/components/WelcomeCard";

import { supabase } from "@/lib/supabaseClient";
import { Bell, Settings } from "lucide-react";

// ===== 상수 =====
const KRW_PER_USDT = 1500;

// 화면에서 쓰는 타입만 남김
type SelectedPass = { name: string; period: string; price: number; image: string };

export default function HomePage() {
  const router = useRouter();
  const account = useActiveAccount();

  // ===== 화면 표시용 상태 =====
  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState("");

  // 보유 자산(= asset_ledger 합계)
  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [selectedPass, setSelectedPass] = useState<SelectedPass | null>(null);

  // 총 투자 금액
  const [totalInvestUSDT, setTotalInvestUSDT] = useState(0);
  const totalInvestKRW = useMemo(
    () => Math.round(totalInvestUSDT * KRW_PER_USDT),
    [totalInvestUSDT]
  );

  // 로그인 안되어 있으면 리다이렉트
  useEffect(() => {
    if (!account?.address) router.replace("/");
  }, [account?.address, router]);

  // 유저 정보(ref_code, name) 로드 후 관련 카드 데이터 조회
  useEffect(() => {
    if (!account?.address) return;
    loadUserAndCards(account.address.toLowerCase());
  }, [account?.address]);

  // ===== 함수: 데이터 로드 =====
  const loadUserAndCards = async (wallet: string) => {
    // 1) 유저 ref_code & 이름
    const { data: user } = await supabase
      .from("users")
      .select("ref_code, name")
      .eq("wallet_address", wallet)
      .maybeSingle();

    const rc = user?.ref_code ?? "";
    setRefCode(rc);
    setName(user?.name ?? "");

    if (!rc) {
      // ref_code 없으면 카드 값 0으로 초기화
      setTotalInvestUSDT(0);
      setUsdtBalance("0.00");
      return;
    }

    // 2) 총 투자 금액
    await fetchTotalInvestments(rc);

    // 3) 보유 자산 = asset_ledger 합계
    await fetchVirtualBalance(rc);
  };

  const fetchTotalInvestments = async (rc: string) => {
    try {
      const { data, error } = await supabase
        .from("investments")
        .select("invest_amount_usdt")
        .eq("ref_code", rc);
      if (error) throw error;

      const sum = (data ?? []).reduce(
        (acc: number, row: any) => acc + Number(row.invest_amount_usdt ?? 0),
        0
      );
      setTotalInvestUSDT(sum);
    } catch {
      setTotalInvestUSDT(0);
    }
  };

  // ✅ 보유 자산(가상) = asset_ledger 합계
  const fetchVirtualBalance = async (rc: string) => {
    try {
      const { data, error } = await supabase
        .from("asset_ledger")
        .select("amount")
        .eq("ref_code", rc);
      if (error) throw error;

      const sum = (data ?? []).reduce(
        (acc: number, r: any) => acc + Number(r.amount ?? 0),
        0
      );
      setUsdtBalance(sum.toFixed(2));
    } catch {
      setUsdtBalance("0.00");
    }
  };

  // ===== 이벤트 핸들러 =====
  const handleFundingClick = () => {
    setSelectedPass({
      name: "1000",
      period: "1년",
      price: 10, // 예시
      image: "/pass-1000.png",
    });
  };

  const goSwap = () => {
    // 보유 자산(가상 잔액)을 교환 화면으로 전달
    const raw = parseFloat(usdtBalance) || 0;
    if (typeof window !== "undefined") {
      sessionStorage.setItem("usdt_balance", String(raw));
    }
    router.push(`/home/swap?usdt=${raw}`);
  };

  const handlePassPurchased = async () => {
    setSelectedPass(null);
    if (account?.address) await loadUserAndCards(account.address.toLowerCase());
  };

  // ===== UI =====
  return (
    <main className="w-full min-h-screen bg-[#f5f7fa] pt-0 pb-20">
      {/* 헤더 */}
      <div className="max-w-[500px] mx-auto px-3 pt-3 flex items-center justify-between">
        <p className="text-base font-bold text-gray-800">하루머니</p>
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => alert("알림 기능 준비중입니다")}
            className="text-gray-500 hover:text-gray-700"
            aria-label="알림"
          >
            <Bell size={18} />
          </button>
          <button
            type="button"
            onClick={() => router.push("/mypage")}
            className="text-gray-500 hover:text-gray-700"
            aria-label="마이페이지"
          >
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* 환영 카드 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <WelcomeCard userName={name} />
      </div>

      {/* 총 투자 금액 카드 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-800">총 투자 금액</p>
          </div>

          {/* USDT + 원화 같은 줄 */}
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold tracking-tight">
                {totalInvestUSDT.toLocaleString()}
              </span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-gray-800">
                ₩ {totalInvestKRW.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="mt-4">
            <button
              onClick={() => router.push(`/harumoney/investments?ref=${refCode || ""}`)}
              className="w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white"
            >
              상세보기
            </button>
          </div>
        </div>
      </div>

      {/* 오늘의 머니 카드 (payout_transfers에서 직접 조회) */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <TodayMoneyCard refCode={refCode} payoutTimeNote="매일 10:00 KST 전" />
      </div>

{/* 보유 자산 (하루머니/원금상환과 동일 스타일) */}
<div className="max-w-[500px] mx-auto px-3 pt-2">
  <section className="bg-gradient-to-r from-cyan-400 to-indigo-400 text-white rounded-2xl p-5 shadow-lg">
    <div className="text-sm font-semibold mb-1">보유 자산</div>
    <div className="text-3xl font-bold mb-5 tracking-wide flex items-center gap-1">
      {usdtBalance} <span className="text-lg font-semibold">USDT</span>
    </div>
    <div className="flex justify-between text-sm font-semibold gap-2">
      <button
        type="button"
        onClick={handleFundingClick}
        className="flex-1 bg-white text-cyan-700 rounded-full px-4 py-2 shadow-md border border-cyan-200 font-bold"
      >
        보충
      </button>
      <button
        type="button"
        onClick={goSwap}
        className="flex-1 bg-white text-cyan-600 rounded-full px-4 py-2 shadow-md border border-cyan-200"
      >
        현금교환
      </button>
    </div>
  </section>
</div>


      {/* 결제 모달 */}
      {selectedPass && (
        <PassPurchaseModal
          selected={selectedPass}
          usdtBalance={parseFloat(usdtBalance) || 0}
          onClose={() => setSelectedPass(null)}
          onPurchased={handlePassPurchased}
        />
      )}

      <BottomNav />
    </main>
  );
}

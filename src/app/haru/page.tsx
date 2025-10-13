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

// 🔄 ledger 이력 표시용 타입
type LedgerViewRow = {
  id: string;
  date: string;                   // transfer_date
  direction: "in" | "out";        // 계산된 방향
  amount: number;                 // 표시용 절댓값
  label: string;                  // reason 라벨
};

function reasonLabel(reason: string) {
  switch (reason) {
    case "payout":
      return "하루머니 입금";
    case "topup":
      return "보충 출금";
    case "cashout":
      return "현금교환 출금";
    default:
      return "자산 변동";
  }
}

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

  // 보유자산 이력 보기 토글
  const [showHistory, setShowHistory] = useState(false);
  const [historyRows, setHistoryRows] = useState<LedgerViewRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

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

  // ===== 보유자산 이력 (asset_ledger 기준) =====
  const fetchAssetHistory = async () => {
    if (!refCode) return;
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase
        .from("asset_ledger")
        .select("id, transfer_date, amount, reason, created_at")
        .eq("ref_code", refCode)
        .order("transfer_date", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;

      const rows: LedgerViewRow[] = (data ?? []).map((r: any) => {
        const amt = Number(r.amount ?? 0);
        const isOut = r.reason === "cashout" || r.reason === "topup" || amt < 0;
        return {
          id: r.id,
          date: r.transfer_date,
          direction: isOut ? "out" : "in",
          amount: Math.abs(amt),
          label: reasonLabel(r.reason),
        };
      });

      setHistoryRows(rows);
    } finally {
      setLoadingHistory(false);
    }
  };

  // 합계(ledger 기준)
  const totalIn = useMemo(
    () => historyRows.filter(r => r.direction === "in")
      .reduce((s, r) => s + r.amount, 0),
    [historyRows]
  );
  const totalOut = useMemo(
    () => historyRows.filter(r => r.direction === "out")
      .reduce((s, r) => s + r.amount, 0),
    [historyRows]
  );
  const balanceCalc = useMemo(() => totalIn - totalOut, [totalIn, totalOut]);

  // ===== 이벤트 핸들러 =====
  const handleFundingClick = () => {
    setSelectedPass({
      name: "1000",
      period: "1년",
      price: 1000, // 예시
      image: "/pass-1000.png",
    });
  };

  const goSwap = () => {
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

  const toggleHistory = async () => {
    if (showHistory) {
      setShowHistory(false);
    } else {
      await fetchAssetHistory();
      setShowHistory(true);
    }
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
        <div className="rounded-xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-800">총 투자 금액</p>
          </div>

          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-extrabold tracking-tight">
                {totalInvestUSDT.toLocaleString()}
              </span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-gray-800">
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

      {/* 오늘의 머니 카드 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <TodayMoneyCard refCode={refCode} payoutTimeNote="매일 10:00 KST 전" />
      </div>

{/* 보유 자산 */}
<div className="max-w-[500px] mx-auto px-3 pt-2">
  <section className="bg-gradient-to-r from-cyan-400 to-indigo-400 text-white rounded-2xl p-5 shadow-lg">
    <div className="text-sm font-semibold mb-2">보유 자산</div>

    {/* ① USDT + KRW 한 줄로 표시 */}
    <div className="flex items-end justify-between gap-3 mb-5">
      {/* 좌: USDT */}
      <div className="flex items-baseline gap-2 whitespace-nowrap">
        <span className="text-xl font-bold tracking-wide">
          {Number(usdtBalance).toLocaleString("ko-KR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}
        </span>
        <span className="text-sm font-semibold">USDT</span>
      </div>

      {/* 우: KRW */}
      <div className="text-xl font-semibold opacity-95 whitespace-nowrap">
        ₩ {(Number(usdtBalance) * 1500).toLocaleString("ko-KR")}
      </div>
    </div>

    {/* ② 버튼 2개 */}
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


      {/* 보유자산 이력 보기 토글 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-xl bg-white shadow p-4">
          <div className="flex items-center justify-between">
            <p className="text-lg font-bold">보유자산 이력 보기</p>
            <button
              onClick={toggleHistory}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-sky-400 to-indigo-400 text-white shadow"
            >
              {showHistory ? "닫기" : "열기"}
            </button>
          </div>
        </div>
      </div>

      {/* 이력 목록 */}
      {showHistory && (
        <div className="max-w-[500px] mx-auto px-3 mt-3 mb-6">
          <div className="rounded-2xl bg-white shadow p-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-600">총 입금 합계</span>
              <span className="font-semibold">{totalIn.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-600">총 출금 합계</span>
              <span className="font-semibold">{totalOut.toFixed(2)} USDT</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-gray-600">잔액</span>
              <span className="font-bold">{balanceCalc.toFixed(2)} USDT</span>
            </div>
          </div>

          <div className="rounded-2xl bg-white shadow mt-3">
            {loadingHistory && <div className="p-4 text-center text-gray-500">불러오는 중…</div>}
            {!loadingHistory && historyRows.length === 0 && (
              <div className="p-4 text-center text-gray-400">이력이 없습니다.</div>
            )}
            {!loadingHistory &&
              historyRows.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between px-4 py-3 border-b last:border-b-0"
                >
                  <div>
                    <div className="text-sm text-gray-500">{r.date}</div>
                    <div className="text-xs text-gray-400">{r.label}</div>
                  </div>
                  <div
                    className={`font-semibold ${
                      r.direction === "in" ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {r.direction === "in" ? "+" : "-"}
                    {r.amount.toFixed(2)} USDT
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

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

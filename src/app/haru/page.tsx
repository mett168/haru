"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { polygon } from "thirdweb/chains";

import BottomNav from "@/components/BottomNav";
import PassPurchaseModal from "@/components/PassPurchaseModal";
import TodayMoneyCard from "@/components/TodayMoneyCard";
import WelcomeCard from "@/components/WelcomeCard";

import { client } from "@/lib/client";
import { supabase } from "@/lib/supabaseClient";
import { getKSTISOString } from "@/lib/dateUtil";

import { Bell, Settings } from "lucide-react";


// ===== 상수 =====
const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const KRW_PER_USDT = 1500;

// 화면에서 쓰는 타입만 남김
type RTStatus = "pending" | "sent" | "failed" | "success";
type RewardRow = { total_amount: number | null; status: RTStatus };
type SelectedPass = { name: string; period: string; price: number; image: string };

export default function HomePage() {
  const router = useRouter();
  const account = useActiveAccount();
  const balanceCalled = useRef(false);

  // ===== 화면 표시용 상태 =====
  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState("");

  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [selectedPass, setSelectedPass] = useState<SelectedPass | null>(null);

  // 총 투자 금액
  const [totalInvestUSDT, setTotalInvestUSDT] = useState(0);
  const totalInvestKRW = useMemo(
    () => Math.round(totalInvestUSDT * KRW_PER_USDT),
    [totalInvestUSDT]
  );

  // 오늘의 머니
  const [todayAmount, setTodayAmount] = useState(0);
  const [todayStatus, setTodayStatus] = useState<"unpaid" | "paid">("unpaid");
  const [todayDailyReward, setTodayDailyReward] = useState(0);
  const [todayDateKST, setTodayDateKST] = useState("");

  // thirdweb USDT 컨트랙트
  const usdtContract = useMemo(
    () => getContract({ client, chain: polygon, address: USDT_ADDRESS }),
    []
  );

  // 로그인 안되어 있으면 리다이렉트
  useEffect(() => {
    if (!account?.address) router.replace("/");
  }, [account?.address, router]);

  // 오늘 날짜(KST)
  useEffect(() => {
    setTodayDateKST(getKSTISOString().slice(0, 10));
  }, []);

  // 잔액 1회 조회
  useEffect(() => {
    if (!account?.address || balanceCalled.current) return;
    balanceCalled.current = true;
    fetchUSDTBalance();
  }, [account?.address]);

  // 유저 정보(ref_code, name) 로드 후 관련 카드 데이터 조회
  useEffect(() => {
    if (!account?.address) return;
    loadUserAndCards(account.address.toLowerCase());
  }, [account?.address]);

  // ===== 함수: 데이터 로드 =====
  const fetchUSDTBalance = async () => {
    try {
      const result = await balanceOf({ contract: usdtContract, address: account!.address! });
      setUsdtBalance((Number(result) / 1e6).toFixed(2));
    } catch {
      setUsdtBalance("0.00");
    }
  };

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
      setTodayAmount(0);
      setTodayStatus("unpaid");
      setTodayDailyReward(0);
      return;
    }

    // 2) 총 투자 금액
    await fetchTotalInvestments(rc);

    // 3) 오늘의 머니 (지급 합계/상태)
    await fetchTodayMoney(rc);

    // 4) 활성 패스의 일일 리워드
    await fetchDailyReward(rc);
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

  const fetchTodayMoney = async (rc: string) => {
    try {
      const today = getKSTISOString().slice(0, 10);
      const { data } = await supabase
        .from("reward_transfers")
        .select("total_amount, status")
        .eq("ref_code", rc)
        .eq("reward_date", today);

      const rows = (data ?? []) as RewardRow[];
      const total = rows.reduce((s, r) => s + (r.total_amount ?? 0), 0);
      setTodayAmount(total);

      const paid = rows.some((r) => r.status === "sent" || r.status === "success");
      setTodayStatus(paid ? "paid" : "unpaid");
    } catch {
      setTodayAmount(0);
      setTodayStatus("unpaid");
    }
  };

  const fetchDailyReward = async (rc: string) => {
    try {
      const { data } = await supabase
        .from("harumoney_passes")
        .select("daily_reward_usdt")
        .eq("ref_code", rc)
        .eq("is_active", true)
        .maybeSingle();

      setTodayDailyReward(Number(data?.daily_reward_usdt ?? 0));
    } catch {
      setTodayDailyReward(0);
    }
  };

  // ===== 이벤트 핸들러 =====
  const handleDetailClick = () => {
    if (!refCode) {
      alert("내 초대코드를 찾을 수 없어요. 로그인/지갑을 확인해 주세요.");
      return;
    }
    router.push(`/rewards/transfers?range=30d&ref=${refCode}`);
  };

  const handleFundingClick = () => {
    setSelectedPass({
      name: "1000",
      period: "1년",
      price: 1, // 예시: 1 USDT / 1년
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

      {/* 오늘의 머니 카드 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <TodayMoneyCard
          dateKST={todayDateKST}
          scheduleText="매일 10:00 KST 전"
          amount={todayAmount}
          dailyRewardUSDT={todayDailyReward}
          status={todayStatus}
          onClickDetail={handleDetailClick}
        />
      </div>

      {/* 보유 자산 + 버튼 2개 (대여/교환) */}
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
              대여
            </button>
            <button
              type="button"
              onClick={goSwap}
              className="flex-1 bg-white text-cyan-600 rounded-full px-4 py-2 shadow-md border border-cyan-200"
            >
              교환
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

"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { getContract } from "thirdweb";
import { balanceOf } from "thirdweb/extensions/erc20";
import { polygon } from "thirdweb/chains";

import BottomNav from "@/components/BottomNav";
import PassPurchaseModal from "@/components/PassPurchaseModal";
import WelcomeCard from "@/components/WelcomeCard";

import { client } from "@/lib/client";
import { supabase } from "@/lib/supabaseClient";
import { getKSTISOString } from "@/lib/dateUtil";
import { Bell, Settings } from "lucide-react";

const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const KRW_PER_USDT = 1500;

// 소수 2자리 '절삭(버림)' 유틸
const trunc2 = (v: number) => (v >= 0 ? Math.floor(v * 100) / 100 : Math.ceil(v * 100) / 100);
const fmt2 = (v: number) =>
  trunc2(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

type RTStatus = "pending" | "sent" | "failed" | "success";
type RewardRow = { total_amount: number | null; status: RTStatus };

export default function HomePage() {
  const account = useActiveAccount();
  const router = useRouter();
  const balanceCalled = useRef(false);

  const [name, setName] = useState("");
  const [refCode, setRefCode] = useState("");

  const [usdtBalance, setUsdtBalance] = useState("0.00");
  const [selectedPass, setSelectedPass] = useState<{
    name: string; period: string; price: number; image: string;
  } | null>(null);

  // 총 투자
  const [investLoading, setInvestLoading] = useState(false);
  const [totalInvestUSDT, setTotalInvestUSDT] = useState(0);
  const totalInvestKRW = useMemo(
    () => Math.trunc(totalInvestUSDT * KRW_PER_USDT),
    [totalInvestUSDT]
  );

  // 원금 상환(계산 뷰 기반)
  const [repayLoading, setRepayLoading] = useState(false);
  const [todayAmount, setTodayAmount] = useState(0);              // 오늘 상환 실제(보내준 금액)
  const [todayStatus, setTodayStatus] = useState<"unpaid"|"paid">("unpaid");
  const [todayPlanned, setTodayPlanned] = useState(0);            // 일일 상환 예정(뷰)
  const [deductedCumUSDT, setDeductedCumUSDT] = useState(0);      // 누적 상환(뷰)
  const [remainingUSDT, setRemainingUSDT] = useState(0);          // 잔여 원금(뷰)

  // ⬇️ 표시용 잔여(미상환이면 오늘 예정액을 되돌려서 표시)
  const displayedRemainingUSDT = useMemo(() => {
    const v = todayStatus === "paid" ? remainingUSDT : (remainingUSDT + todayPlanned);
    return trunc2(v);
  }, [remainingUSDT, todayPlanned, todayStatus]);

  const displayedRemainingKRW = useMemo(
    () => Math.trunc(displayedRemainingUSDT * KRW_PER_USDT),
    [displayedRemainingUSDT]
  );

  const [todayDateKST, setTodayDateKST] = useState("");

  const usdtContract = useMemo(
    () => getContract({ client, chain: polygon, address: USDT_ADDRESS }),
    []
  );

  useEffect(() => {
    if (!account?.address) router.replace("/");
  }, [account?.address, router]);

  useEffect(() => {
    setTodayDateKST(getKSTISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (account?.address && !balanceCalled.current) {
      balanceCalled.current = true;
      fetchUSDTBalance();
      loadUser(account.address.toLowerCase());
    }
  }, [account?.address]);

  useEffect(() => {
    if (!refCode) return;
    fetchTotalInvestments(refCode);
    fetchRepaymentSummary(refCode);         // 누적/잔여/예정치
    fetchTodayMoney(refCode);               // 오늘 지급 여부/금액
    const ch = supabase
      .channel("investments_realtime_sum")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investments", filter: `ref_code=eq.${refCode}` },
        () => {
          fetchTotalInvestments(refCode);
          fetchRepaymentSummary(refCode);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refCode]);

  async function fetchUSDTBalance() {
    try {
      const result = await balanceOf({ contract: usdtContract, address: account!.address! });
      setUsdtBalance(fmt2(Number(result) / 1e6));
    } catch {
      setUsdtBalance("0.00");
    }
  }

  async function loadUser(wallet: string) {
    const { data: user } = await supabase
      .from("users").select("ref_code, name")
      .eq("wallet_address", wallet).maybeSingle();
    setRefCode(user?.ref_code ?? "");
    setName(user?.name ?? "");
  }

  // 총 투자 합계
  async function fetchTotalInvestments(rc: string) {
    setInvestLoading(true);
    try {
      const { data, error } = await supabase
        .from("investments")
        .select("invest_amount_usdt")
        .eq("ref_code", rc);
      if (error) throw error;
      const usdt = (data ?? []).reduce((s: number, r: any) => s + Number(r.invest_amount_usdt ?? 0), 0);
      setTotalInvestUSDT(usdt);
    } catch {
      setTotalInvestUSDT(0);
    } finally {
      setInvestLoading(false);
    }
  }

  // 계산 뷰에서 누적/잔여/일일예정 가져오기
  async function fetchRepaymentSummary(rc: string) {
    setRepayLoading(true);
    try {
      const { data, error } = await supabase
        .from("investments_repayment_calc")
        .select("today_amount_usdt, deducted_cum_usdt, remaining_usdt")
        .eq("ref_code", rc);
      if (error) throw error;

      const arr = (data ?? []) as any[];
      const planned   = arr.reduce((s, r) => s + Number(r.today_amount_usdt ?? 0), 0);
      const deducted  = arr.reduce((s, r) => s + Number(r.deducted_cum_usdt ?? 0), 0);
      const remaining = arr.reduce((s, r) => s + Number(r.remaining_usdt ?? 0), 0);

      setTodayPlanned(planned);
      setDeductedCumUSDT(deducted);
      setRemainingUSDT(remaining);
    } catch {
      setTodayPlanned(0);
      setDeductedCumUSDT(0);
      setRemainingUSDT(0);
    } finally {
      setRepayLoading(false);
    }
  }

  // 오늘 실제 지급/상태 (reward_transfers)
  async function fetchTodayMoney(rc: string) {
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
      setTodayStatus(
        rows.some((r) => r.status === "sent" || r.status === "success") ? "paid" : "unpaid"
      );
    } catch {
      setTodayAmount(0);
      setTodayStatus("unpaid");
    }
  }

  const goSwap = () => {
    const raw = parseFloat(usdtBalance.replace(/,/g, "")) || 0;
    if (typeof window !== "undefined") sessionStorage.setItem("usdt_balance", String(raw));
    router.push(`/home/swap?usdt=${raw}`);
  };

  const handleDetailClick = () => {
    if (!refCode) { alert("내 초대코드를 찾을 수 없어요."); return; }
    router.push(`/rewards/transfers?range=30d&ref=${refCode}`);
  };

  const handleFundingClick = () => {
    setSelectedPass({ name: "1000", period: "1년", price: 1, image: "/pass-1000.png" });
  };

  return (
    <main className="w-full min-h-screen bg-[#f5f7fa] pt-0 pb-20">
      {/* 헤더 */}
      <div className="max-w-[500px] mx-auto px-3 pt-3 flex items-center justify-between">
        <p className="text-base font-bold text-gray-800">원금상환</p>
        <div className="flex items-center space-x-3">
          <button onClick={() => alert("알림 기능 준비중입니다")} className="text-gray-500 hover:text-gray-700" aria-label="알림">
            <Bell size={18} />
          </button>
          <button onClick={() => router.push("/mypage")} className="text-gray-500 hover:text-gray-700" aria-label="마이페이지">
            <Settings size={18} />
          </button>
        </div>
      </div>

      {/* 환영 카드 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <WelcomeCard userName={name} />
      </div>

      {/* 총 투자 금액 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-800">총 투자 금액</p>
            {investLoading && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">불러오는 중</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold tracking-tight">{fmt2(totalInvestUSDT)}</span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-gray-800">₩ {totalInvestKRW.toLocaleString()}</span>
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

      {/* 잔여 원금 (표시용: 미상환이면 오늘 예정액을 되돌려서 표시) */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-800">잔여 원금</p>
            {repayLoading && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">계산 중</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-2xl font-extrabold tracking-tight">{fmt2(displayedRemainingUSDT)}</span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <div>
              <span className="text-2xl font-extrabold tracking-tight text-gray-800">₩ {displayedRemainingKRW.toLocaleString()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 오늘의 원금 상환 + 누적 상환 표시 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-2xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">오늘의 원금 상환</p>
              <p className="text-xs text-gray-500 mt-0.5">매일 10:00 KST 전</p>
            </div>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                todayStatus === "paid" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-600"
              }`}
            >
              {todayStatus === "paid" ? "상환 완료" : "미상환"}
            </span>
          </div>

          {/* 오늘 실제 상환 / 일일 예정 / 누적 상환 */}
          <div className="mt-3">
            <div className="flex items-baseline justify-between">
              <div>
                <span className="text-2xl font-extrabold tracking-tight">{fmt2(todayAmount)}</span>
                <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
              </div>
              <div className="text-sm font-semibold text-gray-600">
              </div>
            </div>

            <div className="mt-2 text-xs text-gray-500 text-right">
              누적 상환 {fmt2(deductedCumUSDT)} USDT
            </div>
          </div>

          <div className="mt-4">
            <button onClick={handleDetailClick} className="w-full rounded-full bg-blue-600 py-3 text-sm font-bold text-white">
              상세보기
            </button>
          </div>
        </div>
      </div>

      {/* 보유 자산 */}
      <div className="max-w-[500px] mx-auto px-3 pt-2">
        <section className="bg-gradient-to-r from-cyan-400 to-indigo-400 text-white rounded-2xl p-5 shadow-lg">
          <div className="text-sm font-semibold mb-1">보유 자산</div>
          <div className="text-3xl font-bold mb-5 tracking-wide flex items-center gap-1">
            {usdtBalance} <span className="text-lg font-semibold">USDT</span>
          </div>
          <div className="flex justify-between text-sm font-semibold gap-2">
            <button type="button" onClick={handleFundingClick} className="flex-1 bg-white text-cyan-700 rounded-full px-4 py-2 shadow-md border border-cyan-200 font-bold">
              보충
            </button>
            <button type="button" onClick={() => goSwap()} className="flex-1 bg-white text-cyan-600 rounded-full px-4 py-2 shadow-md border border-cyan-200">
              현금교환
            </button>
          </div>
        </section>
      </div>

      {selectedPass && (
        <PassPurchaseModal
          selected={selectedPass}
          usdtBalance={parseFloat(usdtBalance.replace(/,/g, "")) || 0}
          onClose={() => setSelectedPass(null)}
          onPurchased={() => {
            setSelectedPass(null);
            if (refCode) {
              fetchTotalInvestments(refCode);
              fetchRepaymentSummary(refCode);
              fetchTodayMoney(refCode);
            }
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

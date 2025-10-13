"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
// (온체인 잔액은 미사용이므로 필요 없으면 아래 import 3개는 제거해도 됩니다.)
// import { getContract } from "thirdweb";
// import { balanceOf } from "thirdweb/extensions/erc20";
// import { polygon } from "thirdweb/chains";

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

type RTStatus = "pending" | "sent" | "failed" | "success" | "completed";

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

  // 상환 관련
  const [repayLoading, setRepayLoading] = useState(false);
  const [todayAmount, setTodayAmount] = useState(0);          // 오늘 원금 상환 (payout_transfers.today_repay 합계)
  const [todayStatus, setTodayStatus] = useState<"unpaid"|"paid">("unpaid");
  const [todayPlanned, setTodayPlanned] = useState(0);        // (참고) 계산뷰 예정액
  const [deductedCumUSDT, setDeductedCumUSDT] = useState(0);  // 누적 원금 상환 (payout_transfers.today_repay 합계)
  const [remainingUSDT, setRemainingUSDT] = useState(0);      // (참고) 계산뷰 잔여
  const [remainingFromTable, setRemainingFromTable] = useState(0); // 잔여 원금(테이블 합계)

  // 표시용(기존 로직 유지 – 참고)
  const displayedRemainingUSDT = useMemo(() => {
    const v = todayStatus === "paid" ? remainingUSDT : (remainingUSDT + todayPlanned);
    return trunc2(v);
  }, [remainingUSDT, todayPlanned, todayStatus]);

  const displayedRemainingKRW = useMemo(
    () => Math.trunc(displayedRemainingUSDT * KRW_PER_USDT),
    [displayedRemainingUSDT]
  );

  const [todayDateKST, setTodayDateKST] = useState("");

  // (온체인 잔액 미사용: 필요 시 복원)
  // const usdtContract = useMemo(
  //   () => getContract({ client, chain: polygon, address: USDT_ADDRESS }),
  //   []
  // );

  useEffect(() => {
    if (!account?.address) router.replace("/");
  }, [account?.address, router]);

  useEffect(() => {
    setTodayDateKST(getKSTISOString().slice(0, 10));
  }, []);

  useEffect(() => {
    if (account?.address && !balanceCalled.current) {
      balanceCalled.current = true;
      // 유저 로드 → ref_code 로 카드 데이터 로드
      loadUser(account.address.toLowerCase());
    }
  }, [account?.address]);

  useEffect(() => {
    if (!refCode) return;

    fetchTotalInvestments(refCode);
    fetchRepaymentSummary(refCode);           // (참고) 계산뷰
    fetchTodayMoneyFromPayouts(refCode);      // 오늘 원금 상환
    fetchCumulativeRepayFromPayouts(refCode); // 누적 원금 상환
    fetchRemainingFromRepayments(refCode);    // 잔여 원금
    fetchVirtualBalance(refCode);             // ✅ 보유자산 = asset_ledger 합계

    const ch = supabase
      .channel("investments_realtime_sum")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "investments", filter: `ref_code=eq.${refCode}` },
        () => {
          fetchTotalInvestments(refCode);
          fetchRepaymentSummary(refCode);
          fetchRemainingFromRepayments(refCode);
          fetchVirtualBalance(refCode);
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [refCode]);

  // ✅ 보유 자산(가상) = asset_ledger 합계
  async function fetchVirtualBalance(rc: string) {
    try {
      const { data, error } = await supabase
        .from("asset_ledger")
        .select("amount")
        .eq("ref_code", rc);
      if (error) throw error;

      const sum = (data ?? []).reduce(
        (acc: number, r: any) => acc + Number(r?.amount ?? 0),
        0
      );
      setUsdtBalance(fmt2(sum)); // 소수 2자리 + 천단위
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
      const usdt = (data ?? []).reduce((s: number, r: any) => s + Number(r?.invest_amount_usdt ?? 0), 0);
      setTotalInvestUSDT(usdt);
    } catch {
      setTotalInvestUSDT(0);
    } finally {
      setInvestLoading(false);
    }
  }

  // (참고) 계산뷰
  async function fetchRepaymentSummary(rc: string) {
    setRepayLoading(true);
    try {
      const { data, error } = await supabase
        .from("investments_repayment_calc")
        .select("today_amount_usdt, deducted_cum_usdt, remaining_usdt")
        .eq("ref_code", rc);
      if (error) throw error;

      const arr = (data ?? []) as any[];
      const planned   = arr.reduce((s, r) => s + Number(r?.today_amount_usdt ?? 0), 0);
      const deducted  = arr.reduce((s, r) => s + Number(r?.deducted_cum_usdt ?? 0), 0);
      const remaining = arr.reduce((s, r) => s + Number(r?.remaining_usdt ?? 0), 0);

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

  // ▶ 오늘 원금 상환: payout_transfers에서 오늘 날짜의 today_repay 합계
  async function fetchTodayMoneyFromPayouts(rc: string) {
    try {
      const today = getKSTISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("payout_transfers")
        .select("today_repay,status")
        .eq("ref_code", rc)
        .eq("transfer_date", today);
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const principalSum = rows.reduce((s: number, r: any) => s + Number(r?.today_repay ?? 0), 0);
      setTodayAmount(principalSum);

      const paid = rows.some((r: any) => {
        const st = String(r?.status ?? "").toLowerCase();
        return st === "sent" || st === "success" || st === "completed";
      });
      setTodayStatus(paid ? "paid" : "unpaid");
    } catch {
      setTodayAmount(0);
      setTodayStatus("unpaid");
    }
  }

  // ▶ 누적 원금 상환: payout_transfers에서 today_repay 누적 합계
  async function fetchCumulativeRepayFromPayouts(rc: string) {
    try {
      const { data, error } = await supabase
        .from("payout_transfers")
        .select("today_repay,status,ref_code")
        .eq("ref_code", rc);
      if (error) throw error;

      const rows = (data ?? []) as any[];

      // 완료 건 우선 합계(없으면 전체 폴백)
      let done = rows.filter((r: any) => {
        const st = String(r?.status ?? "").toLowerCase();
        return st === "sent" || st === "success" || st === "completed";
      });
      if (!done.length) done = rows;

      const cum = done.reduce((s: number, r: any) => s + Number(r?.today_repay ?? 0), 0);
      setDeductedCumUSDT(cum);
    } catch {
      setDeductedCumUSDT(0);
    }
  }

  // ▶ 잔여 원금: repayments 테이블의 principal_remaining 합계(상태=active 우선, 없으면 전체)
  async function fetchRemainingFromRepayments(rc: string) {
    if (!rc) {
      setRemainingFromTable(0);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("repayments")
        .select("principal_remaining,status")
        .eq("ref_code", rc);
      if (error) throw error;

      const rows = (data ?? []) as any[];
      const norm = rows.map((r) => ({
        status: String(r?.status ?? "").toLowerCase().trim(),
        remaining: Number(r?.principal_remaining ?? 0),
      }));

      const active = norm.filter((r) => r.status === "active");
      let sum = active.reduce((s, r) => s + (isFinite(r.remaining) ? r.remaining : 0), 0);
      if (!active.length || sum === 0) {
        sum = norm.reduce((s, r) => s + (isFinite(r.remaining) ? r.remaining : 0), 0);
      }
      setRemainingFromTable(sum);
    } catch {
      setRemainingFromTable(0);
    }
  }

  const goSwap = () => {
    const raw = parseFloat(usdtBalance.replace(/,/g, "")) || 0; // fmt2 콤마 제거 후 숫자 변환
    if (typeof window !== "undefined") sessionStorage.setItem("usdt_balance", String(raw));
    router.push(`/home/swap?usdt=${raw}`);
  };

  // ▶ 상세보기: 원금 상환 이력 페이지로 이동
  const handleDetailClick = () => {
    if (!refCode) { alert("내 초대코드를 찾을 수 없어요."); return; }
    router.push(`/harumoney/repayments?ref=${refCode}`);
  };

  const handleFundingClick = () => {
    setSelectedPass({ name: "1000", period: "1년", price: 1000, image: "/pass-1000.png" });
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
              <span className="text-xl font-extrabold tracking-tight">{fmt2(totalInvestUSDT)}</span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-gray-800">₩ {totalInvestKRW.toLocaleString()}</span>
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

      {/* 잔여 원금 (repayments 합계) */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-gray-800">잔여 원금</p>
            {repayLoading && (
              <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">계산 중</span>
            )}
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <div>
              <span className="text-xl font-extrabold tracking-tight">{fmt2(remainingFromTable)}</span>
              <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
            </div>
            <div>
              <span className="text-xl font-extrabold tracking-tight text-gray-800">
                ₩ {(Math.trunc(remainingFromTable * KRW_PER_USDT)).toLocaleString()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 오늘의 원금 상환 + 누적 상환 */}
      <div className="max-w-[500px] mx-auto px-3 mt-3">
        <div className="rounded-xl bg-white shadow p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-800">오늘의 원금 상환</p>
              <p className="text-xs text-gray-500 mt-0.5">매일 10:00 KST 전</p>
            </div>
            <div /> {/* 상태 배지 미표시 */}
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify_between">
              <div>
                <span className="text-xl font-extrabold tracking-tight">{fmt2(todayAmount)}</span>
                <span className="ml-1 text-sm font-semibold text-gray-500">USDT</span>
              </div>
              <div className="text-sm font-semibold text-gray-600"></div>
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
          <div className="text-xl font-bold mb-5 tracking-wide flex items-center gap-1">
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
              fetchTodayMoneyFromPayouts(refCode);
              fetchCumulativeRepayFromPayouts(refCode);
              fetchRemainingFromRepayments(refCode);
              fetchVirtualBalance(refCode);
            }
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

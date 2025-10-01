'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useActiveAccount } from 'thirdweb/react';
import { getContract } from 'thirdweb';
import { balanceOf } from 'thirdweb/extensions/erc20';
import { polygon } from 'thirdweb/chains';

import AdBanner from '@/components/AdBanner';
import BottomNav from '@/components/BottomNav';
import TodayMoneyCard from '@/components/TodayMoneyCard';
import { client } from '@/lib/client';
import { supabase } from '@/lib/supabaseClient';
import { getKSTISOString } from '@/lib/dateUtil';

const USDT_ADDRESS = '0xc2132D05D31c914a87C6611C10748AEb04B58e8F';

// DB에서 읽는 행 타입 (컬럼명 주의: total_amount)
type RTStatus = 'pending' | 'sent' | 'failed' | 'success';
type RewardRow = {
  total_amount: number | null;
  status: RTStatus;
};

// 패스 최소 필드
type PassRow = {
  price_usdt: number | null;
  pass_code?: string | null;
  is_active?: boolean | null;
  activated_at?: string | null;
};

export default function WalletPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [usdtBalance, setUsdtBalance] = useState('0.000');

  // 오늘의 머니(표시 금액/상태)
  const [todayAmount, setTodayAmount] = useState<number>(0);
  const [todayStatus, setTodayStatus] = useState<'unpaid' | 'paid'>('unpaid');
  const [todayDateKST, setTodayDateKST] = useState<string>('');

  // 내 ref_code / 패스 가격 / 일일 리워드
  const [refCode, setRefCode] = useState<string | null>(null);
  const [passPrice, setPassPrice] = useState<number | null>(null);
  const [todayDailyReward, setTodayDailyReward] = useState<number>(0);

  const usdtContract = useMemo(
    () => getContract({ client, chain: polygon, address: USDT_ADDRESS }),
    []
  );

  useEffect(() => {
    setTodayDateKST(getKSTISOString().slice(0, 10)); // YYYY-MM-DD
  }, []);

  // 지갑 USDT 잔액
  useEffect(() => {
    const fetchUSDTBalance = async () => {
      if (!account?.address) return;
      try {
        const result = await balanceOf({ contract: usdtContract, address: account.address });
        const formatted = (Number(result) / 1e6).toFixed(3);
        setUsdtBalance(formatted);
      } catch (err) {
        console.error('❌ USDT 잔액 불러오기 실패:', err);
        setUsdtBalance('0.000');
      }
    };
    fetchUSDTBalance();
  }, [account, usdtContract]);

  // 오늘의 머니(송금 집계, 상태 계산)
  useEffect(() => {
    const fetchTodayMoney = async () => {
      if (!account?.address) return;

      try {
        // 1) 내 ref_code
        const { data: userRow, error: userErr } = await supabase
          .from('users')
          .select('ref_code')
          .eq('wallet_address', account.address.toLowerCase())
          .maybeSingle();

        if (userErr || !userRow?.ref_code) {
          setTodayAmount(0);
          setTodayStatus('unpaid');
          setRefCode(null);
          return;
        }
        setRefCode(userRow.ref_code);

        const today = getKSTISOString().slice(0, 10);

        // 2) 오늘 reward_transfers (컬럼: total_amount)
        const { data: rewards, error: rewErr } = await supabase
          .from('reward_transfers')
          .select('total_amount, status')
          .eq('ref_code', userRow.ref_code)
          .eq('reward_date', today);

        if (rewErr) {
          console.error('❌ 오늘의 리워드 로드 실패:', rewErr.message);
          setTodayAmount(0);
          setTodayStatus('unpaid');
          return;
        }

        const rows = (rewards ?? []) as RewardRow[];

        // 합계
        const total = rows.reduce((sum, r) => sum + (r.total_amount || 0), 0);
        setTodayAmount(total);

        // 상태: sent 또는 success → 지급완료, failed → 미지급
        const hasPaid = rows.some((r) => r.status === 'sent' || r.status === 'success');
        setTodayStatus(hasPaid ? 'paid' : 'unpaid');
      } catch (e) {
        console.error('❌ 오늘의 머니 처리 오류:', e);
        setTodayAmount(0);
        setTodayStatus('unpaid');
        setRefCode(null);
      }
    };

    fetchTodayMoney();
  }, [account]);

  // 패스 가격
  useEffect(() => {
    const fetchPassPrice = async () => {
      if (!refCode) {
        setPassPrice(null);
        return;
      }
      try {
        const { data, error } = await supabase
          .from('harumoney_passes')
          .select('price_usdt, pass_code, is_active, activated_at')
          .eq('ref_code', refCode)
          .eq('is_active', true)
          .order('activated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (error) {
          console.error('❌ 패스 가격 로드 실패:', error.message);
          setPassPrice(null);
          return;
        }
        const row = (data ?? null) as PassRow | null;
        setPassPrice(row?.price_usdt ?? null);
      } catch (e) {
        console.error('❌ 패스 가격 처리 오류:', e);
        setPassPrice(null);
      }
    };
    fetchPassPrice();
  }, [refCode]);

  // 일일 리워드(daily_reward_usdt)
  useEffect(() => {
    const fetchDaily = async () => {
      if (!refCode) {
        setTodayDailyReward(0);
        return;
      }
      try {
        const { data } = await supabase
          .from('harumoney_passes')
          .select('daily_reward_usdt')
          .eq('ref_code', refCode)
          .eq('is_active', true)
          .maybeSingle();

        setTodayDailyReward(Number(data?.daily_reward_usdt ?? 0));
      } catch (e) {
        console.error('❌ daily_reward_usdt 로드 실패:', e);
        setTodayDailyReward(0);
      }
    };
    fetchDaily();
  }, [refCode]);

  // ✅ 상세보기 클릭 → 최신 refCode로 바로 이동
  const handleDetailClick = () => {
    if (!refCode) {
      alert('내 초대코드를 찾을 수 없어요. 로그인/지갑을 확인해 주세요.');
      return;
    }
    router.push(`/rewards/transfers?range=30d&ref=${refCode}`);
  };

  // ✅ 교환 버튼 클릭 시: 잔액을 쿼리와 세션에 함께 전달
  const goSwap = () => {
    const raw = Number(usdtBalance || '0');
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('usdt_balance', String(raw));
    }
    router.push(`/home/swap?usdt=${raw}`);
  };

  return (
    <div className="min-h-screen bg-[#f5f7fa] pb-28">
      {/* 상단바 */}

      {/* COINW 홍보 배너 */}
      <div className="px-0 mt-2">
        <AdBanner />
      </div>

      <div className="px-4 mt-4 space-y-6">
        {/* 오늘의 머니 카드박스 */}
        <TodayMoneyCard
          dateKST={todayDateKST}
          scheduleText="매일 10:00 KST 전"
          amount={todayAmount}                 // fallback
          dailyRewardUSDT={todayDailyReward}   // 큰 숫자 자리에 표시
          status={todayStatus}                 // 'unpaid' | 'paid'
          onClickDetail={handleDetailClick}    // ✅ 여기만 넘기면 동작
        />

        {/* USDT 자산 카드 */}
        <section className="bg-gradient-to-r from-cyan-400 to-indigo-400 text-white rounded-2xl p-5 shadow-lg">
          <div className="text-sm font-semibold mb-1 text-white/100">보유 자산</div>
          <div className="text-3xl font-bold mb-5 tracking-wide flex items-center gap-1">
            {usdtBalance} <span className="text-lg font-semibold">USDT</span>
          </div>
          <div className="flex justify-between text-sm font-semibold gap-2">
            <button
              onClick={goSwap}
              className="flex-1 bg-white text-cyan-600 rounded-full px-5 py-2 shadow-md border border-cyan-200 transition hover:-translate-y-0.5 active:shadow-inner"
            >
              교환
            </button>
            <button
              onClick={() => router.push('/home/send')}
              className="flex-1 bg-white text-cyan-600 rounded-full px-5 py-2 shadow-md border border-cyan-200 transition hover:-translate-y-0.5 active:shadow-inner"
            >
              보내기
            </button>
          </div>
        </section>

        {/* 보유 PASS 카드 박스 */}
        <section className="bg-white rounded-xl shadow overflow-hidden">
          <h3 className="text-base font-bold text-blue-600 px-4 pt-4">보유 패스</h3>
          <div className="mt-3">
            <img src="/pass.png" alt="PASS 카드" className="w-full h-auto object-cover" />
          </div>
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-base">하루머니 패스</div>
              <div className="text-sm font-bold text-gray-700">
                {typeof passPrice === 'number' ? passPrice : '--'} USDT
              </div>
            </div>
          </div>
        </section>
      </div>

      <BottomNav />
    </div>
  );
}

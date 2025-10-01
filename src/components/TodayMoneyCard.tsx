'use client';

import { ReactNode } from 'react';

type Status = 'unpaid' | 'paid';

export interface TodayMoneyCardProps {
  dateKST: string;            // 예: "2025-08-27"
  scheduleText: string;       // 예: "매일 08:00 KST"
  amount: number;             // fallback 값 (dailyRewardUSDT 없을 때 사용)
  status: Status;             // 'unpaid' | 'paid'
  onClickDetail?: () => void; // 상세보기 버튼 클릭(있으면 사용)
  rightSlot?: ReactNode;      // (옵션) 우측 상단 추가영역 (넘기면 내부 배지는 숨김)
  dailyRewardUSDT?: number;   // 오늘의 일일 리워드(우선 표시)
  detailHref?: string;        // ⭐ 기본 상세 링크
}

const STATUS_LABEL: Record<Status, string> = {
  unpaid: '미지급',
  paid: '지급완료',
};

const statusStyle: Record<Status, string> = {
  unpaid: 'bg-yellow-100 text-yellow-700',
  paid: 'bg-green-100 text-green-700',
};

export default function TodayMoneyCard({
  dateKST,
  scheduleText,
  amount,
  status,
  onClickDetail,
  rightSlot,
  dailyRewardUSDT,
  // ✅ 상세보기 → 최근 30일 송금 이력 페이지로 이동
  detailHref = '/rewards/transfers?range=30d',
}: TodayMoneyCardProps) {
  // 표시 우선순위: dailyRewardUSDT → amount
  const displayValue =
    typeof dailyRewardUSDT === 'number' && Number.isFinite(dailyRewardUSDT)
      ? dailyRewardUSDT
      : amount;

  const formatted =
    Number.isFinite(displayValue)
      ? new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(displayValue)
      : '--';

  const handleDetailClick = () => {
    if (onClickDetail) {
      onClickDetail();
    } else {
      // onClickDetail이 없으면 기본 링크로 이동
      window.location.href = detailHref;
    }
  };

  return (
    <section
      aria-label="오늘의 머니 카드"
      className="w-full rounded-2xl bg-white shadow-md p-5"
    >
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-semibold text-[#2b2c2d]">오늘의 머니</h3>

        <div className="flex items-center gap-2">
          {rightSlot ?? (
            <span
              aria-label={`상태: ${STATUS_LABEL[status]}`}
              className={`px-2 py-0.5 text-[12px] rounded-full ${statusStyle[status]}`}
            >
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
      </div>

      {/* 날짜/주기 */}
      <p className="mt-1 text-[12px] text-[#6b7280]">
        {dateKST} · {scheduleText}
      </p>

      {/* 금액(일일 리워드 우선 표시) */}
      <div className="mt-4 flex items-end gap-2">
        <div className="text-[40px] leading-none font-extrabold tracking-tight text-[#111827]">
          {formatted}
        </div>
        <div className="pb-1 text-[14px] text-[#6b7280] font-medium">USDT</div>
      </div>

      {/* 버튼 */}
      <button
        type="button"
        onClick={handleDetailClick}
        className="mt-5 w-full h-12 rounded-full bg-[#2563eb] text-white text-[15px] font-semibold active:scale-[0.99] transition"
        aria-label="오늘의 머니 상세보기"
      >
        상세보기
      </button>
    </section>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { getKSTISOString, getKSTDateString } from "@/lib/dateUtil";

/* --------------------------- 성공 모달 --------------------------- */
function TopupSuccessModal({
  amount,
  qty,
  onClose,
}: {
  amount: number;
  qty: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-[#f5f9fc] w-80 rounded-2xl px-6 py-10 text-center shadow-xl relative">
        <button
          onClick={onClose}
          className="absolute top-3 right-4 text-gray-400 hover:text-gray-600 text-xl"
        >
          ×
        </button>
        <div className="w-16 h-16 mx-auto bg-blue-500 rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414L8.414 15l-4.121-4.121a1 1 0 011.414-1.414L8.414 12.172l7.879-7.879a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        </div>
        <h2 className="mt-4 text-lg font-semibold text-gray-800">보충(투자) 성공</h2>
        <p className="mt-1 text-sm text-blue-600 font-bold">
          {amount.toLocaleString()} USDT <span className="text-gray-500">({qty}개)</span>
        </p>
        <p className="text-sm text-gray-600 mt-1">투자 등록이 완료되었습니다</p>
      </div>
    </div>
  );
}

/* --------------------------- Props --------------------------- */
interface PassPurchaseModalProps {
  selected: {
    name: string;    // 상품명 (예: "1000 패스")
    period: string;  // "1년" 등 (만기 계산 참고용)
    price: number;   // 단가(USDT)
    image: string;   // 썸네일
  };
  /** 보유 USDT는 보여주기만, 실제 잔액 체크/전송은 하지 않음 */
  usdtBalance: number;
  onClose: () => void;
  onPurchased?: () => void; // 완료 후 상위에서 새로고침용
}

/* --------------------------- 기간 계산 유틸 --------------------------- */
function addMonthsAndDays(base: Date, months: number, days: number): Date {
  const d = new Date(base);
  const targetMonth = d.getMonth() + months;
  const targetYear = d.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;

  const originalDate = d.getDate();
  const endOfTargetMonth = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  const finalDate = Math.min(originalDate, endOfTargetMonth);

  const afterMonths = new Date(
    targetYear,
    normalizedMonth,
    finalDate,
    d.getHours(),
    d.getMinutes(),
    d.getSeconds(),
    d.getMilliseconds()
  );
  afterMonths.setDate(afterMonths.getDate() + days);
  return afterMonths;
}

/* ------------------------------------------------------------------------------------------------ */

export default function PassPurchaseModal({
  selected,
  usdtBalance,
  onClose,
  onPurchased,
}: PassPurchaseModalProps) {
  const account = useActiveAccount();

  // 수량/총액
  const [quantity, setQuantity] = useState<number>(1);
  const totalPrice = useMemo(
    () => Math.max(1, quantity) * (selected?.price ?? 0),
    [quantity, selected?.price]
  );

  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // 만기일 프리뷰: 기본 정책 = 오늘(KST) + 12개월 - 1일
  const previewMaturity = useMemo(() => {
    const base = new Date();
    const maturity = addMonthsAndDays(base, 12, -1);
    return getKSTDateString(maturity);
  }, []);

  // 보충(=투자 등록 + 보유자산 차감 + 보충 이력 기록)
  const handleTopup = async () => {
    if (!account?.address) {
      alert("지갑이 연결되지 않았습니다.");
      return;
    }

    // 화면상의 보유자산이 부족하면 차단(선택)
    if (usdtBalance < totalPrice) {
      alert("보유 자산이 부족합니다. (자산 카드 합계 < 보충 금액)");
      return;
    }

    setLoading(true);
    try {
      // 0) 유저 조회
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("ref_code, name, wallet_address")
        .ilike("wallet_address", account.address)
        .maybeSingle();
      if (userError) throw userError;
      if (!user?.ref_code) throw new Error("내 초대코드(ref_code)를 찾을 수 없습니다.");

      // KST 날짜들
      const investDateKST = getKSTDateString(new Date());
      const maturity = addMonthsAndDays(new Date(), 12, -1);
      const maturityDateKST = getKSTDateString(maturity);

      // 1) investments INSERT (id 회수)
      const { data: investRow, error: insertErr } = await supabase
        .from("investments")
        .insert({
          ref_code: user.ref_code,
          name: user.name ?? null,
          invest_date: investDateKST,
          invest_amount_usdt: totalPrice,
          maturity_date: maturityDateKST,
          memo: "보충",
          created_at: getKSTISOString(),
        })
        .select("id")
        .single();
      if (insertErr) throw insertErr;

      // 2) 보충 이력 저장 (topup_logs)
      const { error: logErr } = await supabase.from("topup_logs").insert({
        ref_code: user.ref_code,
        amount_usdt: totalPrice,
        quantity,
        pass_type: selected.name,
        period_text: selected.period,
        invest_id: investRow.id,
        invest_date: investDateKST,
        maturity_date: maturityDateKST,
        memo: "보충 → 투자 등록",
        topup_date: investDateKST,
        created_at: getKSTISOString(),
      });
      if (logErr) throw logErr;

      // 3) 보유자산 차감 (asset_ledger: reason='topup' 음수로 누적 upsert)
      const reason = "topup";
      // 오늘 같은 키가 있으면 누적
      const { data: exist } = await supabase
        .from("asset_ledger")
        .select("amount")
        .eq("ref_code", user.ref_code)
        .eq("transfer_date", investDateKST)
        .eq("reason", reason)
        .maybeSingle();

      const newAmount = Number(exist?.amount ?? 0) - totalPrice;

      const { error: upErr } = await supabase
        .from("asset_ledger")
        .upsert(
          [{ ref_code: user.ref_code, amount: newAmount, reason, transfer_date: investDateKST }],
          { onConflict: "ref_code,transfer_date,reason" }
        );
      if (upErr) throw upErr;

      // 성공 모달 노출 및 상위 새로고침
      setShowSuccessModal(true);
      onPurchased?.();
    } catch (err: any) {
      console.error("❌ 투자(보충) 등록 실패:", err);
      alert(`등록에 실패했습니다. ${err?.message ?? ""}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // 수량 조절
  const dec = () => setQuantity((q) => Math.max(1, q - 1));
  const inc = () => setQuantity((q) => Math.min(99, q + 1));
  const onChangeQty = (v: string) => {
    const n = Number(v.replace(/[^\d]/g, ""));
    if (Number.isNaN(n)) return;
    setQuantity(Math.min(99, Math.max(1, n)));
  };

  return (
    <>
      {showSuccessModal && (
        <TopupSuccessModal
          amount={totalPrice}
          qty={quantity}
          onClose={() => {
            setShowSuccessModal(false);
            onClose();
          }}
        />
      )}

      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 backdrop-blur-sm">
        <div className="w-full max-w-[500px] bg-white rounded-t-3xl p-5 relative">
          {/* 닫기 */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>

          {/* 제목 */}
          <div className="text-center mb-2 text-lg font-bold">보충하기</div>
          <div className="text-sm text-gray-600 mb-1">주문정보</div>

          {/* 주문 카드 */}
          <div className="flex items-center space-x-3 p-3 border rounded-xl my-2">
            <img src={selected.image} className="w-12 h-12 rounded-lg" alt={selected.name} />
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="text-xs text-gray-500">
                {selected.period} · 예상 만기: {previewMaturity}
              </p>
            </div>
          </div>

          {/* 수량 */}
          <div className="mt-2 flex items-center justify-between">
            <span className="text-sm text-gray-700 font-medium">수량</span>
            <div className="flex items-center gap-2">
              <button
                onClick={dec}
                className="w-8 h-8 rounded-md bg-gray-100 hover:bg-gray-200 text-lg leading-none"
                aria-label="decrease quantity"
              >
                −
              </button>
              <input
                value={quantity}
                onChange={(e) => onChangeQty(e.target.value)}
                inputMode="numeric"
                pattern="[0-9]*"
                className="w-14 h-8 text-center border rounded-md"
              />
              <button
                onClick={inc}
                className="w-8 h-8 rounded-md bg-gray-100 hover:bg-gray-200 text-lg leading-none"
                aria-label="increase quantity"
              >
                +
              </button>
            </div>
          </div>

          {/* 금액 영역 */}
          <div className="flex justify-between text-sm mt-3">
            <span className="text-gray-700 font-medium">
              보충 금액 <span className="text-gray-400">({selected.price.toLocaleString()}×{quantity})</span>
            </span>
            <span className="font-bold">{totalPrice.toLocaleString()} USDT</span>
          </div>

          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">표시용 보유 USDT</span>
            <span className="text-gray-600">{usdtBalance} USDT</span>
          </div>

          {/* 보충(투자 등록) 버튼 */}
          <button
            onClick={handleTopup}
            disabled={loading}
            className={`mt-4 w-full py-2 rounded-md text-white font-semibold text-sm ${
              loading ? "bg-blue-100 text-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "등록 중..." : "보충하기"}
          </button>

          <div onClick={onClose} className="mt-3 text-center text-sm text-gray-400 cursor-pointer">
            닫기
          </div>
        </div>
      </div>
    </>
  );
}

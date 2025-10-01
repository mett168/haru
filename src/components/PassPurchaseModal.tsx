"use client";

import { useEffect, useMemo, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { getContract, prepareContractCall, sendTransaction, waitForReceipt } from "thirdweb";
import { polygon } from "thirdweb/chains";
import { client } from "@/lib/client";
import { supabase } from "@/lib/supabaseClient";
import { getKSTISOString, getKSTDateString } from "@/lib/dateUtil";

/* --------------------------- 성공 모달 --------------------------- */
function PurchaseSuccessModal({
  amount,
  qty,
  onClose,
}: {
  amount: number;
  qty: number;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
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
        <h2 className="mt-4 text-lg font-semibold text-gray-800">수강신청 성공</h2>
        <p className="mt-1 text-sm text-blue-600 font-bold">
          {amount.toLocaleString()} USDT <span className="text-gray-500">({qty}개)</span>
        </p>
        <p className="text-sm text-gray-600 mt-1">결제가 완료되었습니다</p>
      </div>
    </div>
  );
}

/* --------------------------- Props --------------------------- */
interface PassPurchaseModalProps {
  selected: {
    name: string;    // 상품명 (예: "1000 프라 멤버십")
    period: string;  // "1년" / "3개월 + 7일" / "무제한" 등
    price: number;   // 단가(USDT)
    image: string;   // 썸네일
  };
  usdtBalance: number; // 보유 USDT
  onClose: () => void;
  onPurchased?: () => void;
}

/* --------------------------- 상수 --------------------------- */
const USDT_ADDRESS = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F";
const RECEIVER = "0xD90D074d1F2a58CA591601430b8cA35C116fF6C9";

/* ------------------------------------------------------------------------------------------------
   기간 파싱/계산 유틸 (추가 증정 기간 포함)
-------------------------------------------------------------------------------------------------*/
function parsePeriod(period: string): { unlimited: boolean; months: number; days: number } {
  const raw = (period ?? "").toString().normalize("NFKC");
  const txt = raw.replace(/[\s\u00A0\u200B\u200C\u200D]+/g, ""); // 모든 공백/제로폭 제거
  if (txt.includes("무제한")) return { unlimited: true, months: 0, days: 0 };

  let months = 0;
  let days = 0;

  const monthRegex = /(\d+)개월/g;
  const dayRegex = /(\d+)일/g;

  let m: RegExpExecArray | null;
  while ((m = monthRegex.exec(txt)) !== null) months += Number(m[1]);
  while ((m = dayRegex.exec(txt)) !== null) days += Number(m[1]);

  return { unlimited: false, months, days };
}

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

function computeExpiry(period: string, base = new Date()): Date {
  const { unlimited, months, days } = parsePeriod(period);
  if (unlimited) {
    const d = new Date(base);
    d.setFullYear(2099);
    return d;
  }
  return addMonthsAndDays(base, months, days);
}

/* ------------------------------------------------------------------------------------------------ */

export default function PassPurchaseModal({
  selected,
  usdtBalance,
  onClose,
  onPurchased,
}: PassPurchaseModalProps) {
  const account = useActiveAccount();

  // ✅ 수량/총액
  const [quantity, setQuantity] = useState<number>(1);
  const totalPrice = useMemo(() => Math.max(1, quantity) * (selected?.price ?? 0), [quantity, selected?.price]);

  const insufficient = usdtBalance < totalPrice;

  const [loading, setLoading] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [gasStepMsg, setGasStepMsg] = useState<string>("");

  const contract = useMemo(() => {
    return getContract({ client, chain: polygon, address: USDT_ADDRESS });
  }, []);

  // 가스 지원 (최초 구매 대비)
  async function ensureGasIfNeeded(address: string) {
    setGasStepMsg("가스 지급 준비 중...");
    const res = await fetch("/api/grant-gas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ walletAddress: address }),
    });
    const data = await res.json();

    if (!res.ok || !data.ok) throw new Error(data?.error || "grant-gas failed");
    if (data.skipped) {
      setGasStepMsg("");
      return;
    }
    if (!data.tx) {
      setGasStepMsg("");
      throw new Error("grant-gas: tx hash missing");
    }

    setGasStepMsg("가스 트랜잭션 확정 대기 중...");
    await waitForReceipt({ client, chain: polygon, transactionHash: data.tx });
    setGasStepMsg("");
  }

  // 만료일 프리뷰
  const previewExpired = useMemo(() => {
    const meta = parsePeriod(selected.period);
    if (meta.unlimited) return "무제한";
    const d = computeExpiry(selected.period);
    return getKSTDateString(d);
  }, [selected.period]);

  const handlePurchase = async () => {
    if (!account?.address) {
      alert("지갑이 연결되지 않았습니다.");
      return;
    }
    if (insufficient) {
      alert("잔액이 부족합니다.");
      return;
    }

    setLoading(true);
    try {
      // 1) 가스 지원
      await ensureGasIfNeeded(account.address);

      // 2) USDT 전송(총액)
      const amount = BigInt(Math.floor(totalPrice * 1e6)); // 6 decimals
      const tx = prepareContractCall({
        contract,
        method: "function transfer(address _to, uint256 _value) returns (bool)",
        params: [RECEIVER, amount],
      });
      const result = await sendTransaction({ account, transaction: tx });

      setTxHash(result.transactionHash);
      setShowSuccessModal(true);

      // 3) 유저 조회
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("ref_code, ref_by, center_id, name, inviter_name, wallet_address")
        .ilike("wallet_address", account.address)
        .maybeSingle();
      if (userError) console.error("❌ 유저 정보 조회 실패:", userError);

      // 4) 기간 계산
      const expired = computeExpiry(selected.period, new Date());
      const startDateKST = getKSTDateString(new Date());
      const expiredDateKST = getKSTDateString(expired);

      // 5) enrollments 저장 (수량 포함) ➜ id 반환
      const { data: inserted, error: insertError } = await supabase
        .from("enrollments")
        .insert({
          ref_code: user?.ref_code ?? null,
          ref_by: user?.ref_by ?? null,
          center_id: user?.center_id ?? null,
          name: user?.name ?? null,
          inviter_name: user?.inviter_name ?? null,
          pass_type: selected.name,
          pass_expired_at: expiredDateKST,
          tuition: totalPrice,                // 총액
          quantity: quantity,                 // ✅ 수량
          memo: `결제 완료 (수량 ${quantity}개)`,
          created_at_kst: getKSTISOString(),
        })
        .select("id")
        .single();

      if (insertError) {
        console.error("❌ enrollments insert error:", insertError);
      } else {
        const enrollmentId = inserted!.id as string;

        // 6) 회수별 인스턴스 + 일자별 현황 백필 (서버 함수)
        const { error: rpcErr } = await supabase.rpc("backfill_enrollment_items", {
          p_enrollment_id: enrollmentId,
          p_ref_code: user?.ref_code ?? null,
          p_pass_type: selected.name,
          p_quantity: quantity,
          p_start_date: startDateKST,
          p_expired_at: expiredDateKST,
          p_memo: "purchase",
        });
        if (rpcErr) console.error("❌ backfill_enrollment_items error:", rpcErr);
      }

      onPurchased?.();
    } catch (err: any) {
      console.error("❌ 결제 실패:", err);
      alert(`결제에 실패했습니다. ${err?.message ?? ""}`);
    } finally {
      setGasStepMsg("");
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
        <PurchaseSuccessModal
          amount={totalPrice}
          qty={quantity}
          onClose={() => {
            setShowSuccessModal(false);
            onClose();
          }}
        />
      )}

      <div className="fixed inset-0 z-40 flex items-end justify-center bg-black bg-opacity-40 backdrop-blur-sm">
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
          <div className="text-center mb-2 text-lg font-bold">결제하기</div>
          <div className="text-sm text-gray-600 mb-1">주문정보</div>

          {/* 주문 카드 */}
          <div className="flex items-center space-x-3 p-3 border rounded-xl my-2">
            <img src={selected.image} className="w-12 h-12 rounded-lg" alt={selected.name} />
            <div>
              <p className="font-semibold">{selected.name}</p>
              <p className="text-xs text-gray-500">
                {selected.period}
                {previewExpired ? ` · 예상 만료일: ${previewExpired}` : ""}
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
              결제 금액 <span className="text-gray-400">({selected.price.toLocaleString()}×{quantity})</span>
            </span>
            <span className="font-bold">{totalPrice.toLocaleString()} USDT</span>
          </div>

          <div className="flex justify-between text-sm mt-1">
            <span className="text-gray-500">사용 가능한 USDT</span>
            <span className="text-gray-600">{usdtBalance} USDT</span>
          </div>

          {insufficient && (
            <p className="text-xs text-red-500 mt-1">
              (USDT가 부족합니다. 금액 충전 후 결제를 진행해주세요.)
            </p>
          )}

          {/* 진행 상태 안내 */}
          {gasStepMsg && <div className="mt-3 text-center text-sm text-blue-600">{gasStepMsg}</div>}

          {/* 결제 버튼 */}
          <button
            onClick={handlePurchase}
            disabled={insufficient || loading}
            className={`mt-4 w-full py-2 rounded-md text-white font-semibold text-sm ${
              insufficient || loading ? "bg-blue-100 text-blue-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
          >
            {loading ? "결제 처리 중..." : "결제하기"}
          </button>

          {/* 트랜잭션 안내 */}
          {txHash && (
            <div className="mt-3 text-center text-sm text-green-600">
              ✅ 수강신청 완료!<br />
              트랜잭션 해시:<br />
              <a
                href={`https://polygonscan.com/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline break-all"
              >
                {txHash}
              </a>
            </div>
          )}

          <div onClick={onClose} className="mt-3 text-center text-sm text-gray-400 cursor-pointer">
            닫기
          </div>
        </div>
      </div>
    </>
  );
}

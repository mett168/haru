"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { X } from "lucide-react";

interface EntryAmountModalProps {
  onClose: () => void;
  selectedSymbol: string; // 예: "BTCUSDT", "ETHUSDT", "XRPUSDT"
  walletAddress: string;
}

export default function EntryAmountModal({ onClose, selectedSymbol, walletAddress }: EntryAmountModalProps) {
  const [entryAmount, setEntryAmount] = useState("");

  useEffect(() => {
    const loadSetting = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("entry_amount")
        .eq("wallet_address", walletAddress)
        .eq("symbol", selectedSymbol)
        .single();

      if (!error && data?.entry_amount) {
        setEntryAmount(data.entry_amount.toString());
      } else {
        // 기본값 설정: 심볼 앞부분 추출 후 설정
        if (selectedSymbol.startsWith("BTC")) setEntryAmount("0.001");
        else if (selectedSymbol.startsWith("ETH")) setEntryAmount("0.01");
        else if (selectedSymbol.startsWith("XRP")) setEntryAmount("50");
        else setEntryAmount("1");
      }
    };

    loadSetting();
  }, [selectedSymbol, walletAddress]);

  const handleSave = async () => {
    const parsed = parseFloat(entryAmount);
    if (!parsed || parsed <= 0) {
      alert("⚠️ 유효한 수량을 입력해주세요.");
      return;
    }

    const { data: existing, error: selectError } = await supabase
      .from("users")
      .select("id")
      .eq("wallet_address", walletAddress)
      .eq("symbol", selectedSymbol)
      .maybeSingle();

    if (selectError) {
      console.error("❌ 데이터 조회 실패:", selectError);
      alert("❌ 데이터 조회 실패: " + selectError.message);
      return;
    }

    if (existing) {
      const { error: updateError } = await supabase
        .from("users")
        .update({
          entry_amount: parsed,
          updated_at: new Date().toISOString(),
        })
        .eq("wallet_address", walletAddress)
        .eq("symbol", selectedSymbol);

      if (updateError) {
        console.error("❌ 업데이트 실패:", updateError);
        alert("❌ 저장 실패: " + updateError.message);
        return;
      }
    } else {
      const { error: insertError } = await supabase
        .from("users")
        .insert({
          wallet_address: walletAddress,
          symbol: selectedSymbol,
          entry_amount: parsed,
          updated_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error("❌ 저장 실패:", insertError);
        alert("❌ 저장 실패: " + insertError.message);
        return;
      }
    }

    alert(`✅ ${selectedSymbol} 진입 수량이 저장되었습니다.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40 backdrop-blur-sm">
      <div className="bg-white w-[90%] max-w-[400px] rounded-xl p-6 relative">
        <button
          className="absolute top-2 right-2 text-gray-400 hover:text-black"
          onClick={onClose}
        >
          <X />
        </button>

        <h2 className="text-lg font-bold mb-4">{selectedSymbol} 진입 수량 설정</h2>

        <label className="block text-sm text-gray-600 mb-1">
          진입 금액 (해당 코인 수량)
        </label>
        <input
          type="number"
          step="any"
          min="0"
          placeholder="예: 0.001"
          className="w-full border rounded px-3 py-2 mb-4"
          value={entryAmount}
          onChange={(e) => setEntryAmount(e.target.value)}
        />

        <button
          onClick={handleSave}
          className="w-full py-2 rounded bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
        >
          💾 설정 저장하기
        </button>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Props {
  walletAddress: string;
}

export default function CoinWUidInput({ walletAddress }: Props) {
  const [uid, setUid] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!walletAddress) return;

    (async () => {
      const { data: user } = await supabase
        .from("users")
        .select("COINW_uid")
        .eq("wallet_address", walletAddress.toLowerCase())
        .maybeSingle();

      if (user) {
        setUid(user.COINW_uid || "");
        if (user.COINW_uid) setSaved(true);
      }
    })();
  }, [walletAddress]);

  const handleSave = async () => {
    if (!uid || !walletAddress) return;
    await supabase
      .from("users")
      .update({ COINW_uid: uid })
      .eq("wallet_address", walletAddress.toLowerCase());
    setSaved(true);
  };

  if (!walletAddress) return null;

  return (
    <>
      {!saved ? (
        <section className="bg-white rounded-xl shadow px-4 pt-4 pb-4">
          <p className="text-sm font-semibold text-gray-700 mb-2">나의 COINW UID를 입력하세요</p>
          <div className="flex items-center space-x-2">
            <input
              type="text"
              placeholder="COINW UID"
              value={uid}
              onChange={(e) => setUid(e.target.value)}
              className="flex-1 py-2 px-3 border border-gray-300 rounded-md text-sm focus:outline-none"
            />
            <button
              onClick={handleSave}
              className="text-sm font-semibold bg-blue-500 text-white px-4 py-2 rounded-md hover:bg-blue-600"
            >
              저장
            </button>
          </div>
          <p className="mt-3 text-[12px] text-center text-gray-500 bg-gray-100 rounded-full py-1">
            COINW UID를 입력하지 않으면 리워드를 받을 수 없어요
          </p>
        </section>
      ) : (
        <div className="bg-white rounded-xl shadow px-4 pt-4 pb-4 flex justify-between items-center">
          <span className="text-sm font-semibold text-gray-700">COINW UID : {uid}</span>
          <div className="bg-blue-500 text-white text-xs rounded-full px-2 py-1">저장 완료</div>
        </div>
      )}
    </>
  );
}

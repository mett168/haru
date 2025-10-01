"use client";

import { useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";

export default function InviteRedirectPage() {
  const router = useRouter();
  const { code } = useParams();
  const account = useActiveAccount();

  // ✅ 로그인되지 않은 경우, /join으로 이동 (초기 진입 시)
  useEffect(() => {
    if (!account?.address && typeof code === "string") {
      console.log("⛔ 로그인 안됨 → /join 이동");
      router.replace(`/join?ref=${code}`);
    }
  }, [account, code, router]);

  // ✅ 로그인된 경우 추천인 저장 처리
  useEffect(() => {
    const saveReferral = async () => {
      if (!account?.address || typeof code !== "string") return;

      const wallet = account.address.toLowerCase();
      console.log("🟢 로그인 계정:", wallet, "추천 코드:", code);

      const { data: user, error } = await supabase
        .from("users")
        .select("ref_by")
        .eq("wallet_address", wallet)
        .maybeSingle();

      if (error) {
        console.error("❌ 사용자 조회 실패:", error.message);
        return;
      }

      if (!user?.ref_by) {
        const { error: updateError } = await supabase
          .from("users")
          .update({ ref_by: code })
          .eq("wallet_address", wallet);

        if (updateError) {
          console.error("❌ 추천코드 저장 실패:", updateError.message);
        } else {
          console.log("✅ 추천코드 저장 완료");
        }
      } else {
        console.log("ℹ️ 이미 추천인 설정됨:", user.ref_by);
      }

      router.replace("/join");
    };

    saveReferral();
  }, [account, code, router]);

  return (
    <main className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">초대코드를 저장 중입니다...</p>
    </main>
  );
}

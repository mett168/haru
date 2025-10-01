'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Head from "next/head";
import Image from "next/image";
import Link from "next/link";
import { ConnectButton, useActiveAccount } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { polygon } from "thirdweb/chains";
import { client } from "@/lib/client";
import { toast } from "react-hot-toast";
import { supabase } from "@/lib/supabaseClient";

export default function MainPage() {
  const account = useActiveAccount();
  const router = useRouter();
  const [called, setCalled] = useState(false);

useEffect(() => {
  if (!account || called) return;
  setCalled(true);

  // ✅ localStorage에서 추천 코드 가져오기
  let refBy = "HM1001";
  if (typeof window !== "undefined") {
    const savedRef = localStorage.getItem("ref_code");
    if (savedRef) {
      console.log("✅ 추천 코드 불러옴:", savedRef);
      refBy = savedRef;
    }
  }

  // ✅ /api/register 호출
  fetch("/api/register", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      wallet_address: account.address.toLowerCase(),
      ref_by: refBy,
    }),
  })
    .then((res) => res.json())
    .then(async () => {
      // ✅ 유저 정보 불러오기 (ref_code, name 포함)
      const { data: userData, error } = await supabase
        .from("users")
        .select("ref_code, name")
        .eq("wallet_address", account.address.toLowerCase())
        .maybeSingle();

      console.log("👤 유저 name 확인:", userData);
      
      // ✅ 회원가입 정보 없으면 추가정보 입력 페이지로
      if (!userData || !userData.name || userData.name.trim() === "") {
        router.push("/register-info");
      } else {
        router.push("/haru");
      }

      if (localStorage.getItem("logged_out") === "true") {
        localStorage.removeItem("logged_out");
      }
    })
    .catch((err) => {
      console.error("❌ register 요청 실패:", err);
      toast.error("지갑 등록 실패 ❌ 다시 시도해주세요.");
    });
}, [account, called, router]);



  return (
    <>
      <Head>
        <title>프라클</title>
      </Head>

      <main className="min-h-screen flex flex-col justify-between bg-[#f5f7fa] px-4 py-6 max-w-md mx-auto text-center">
        <div>
          <section className="w-full mb-6">
            <div className="p-4">
              <p className="text-[16px] font-bold text-left text-[#4d4e4f]">고객을 위한 가지 창조</p>
              <h1 className="text-[16px] font-bold text-left text-[#4d4e4f]">하루머니</h1>
            </div>
          </section>
          <div className="flex justify-center mt-20 mb-10">
            <div className="rounded-xl p-6">
              <Image src="/logo.png" alt="Logo" width={180} height={180} priority />
            </div>
          </div>

          {!account && (
            <div className="w-full mt-20 mb-10">
              <div className="rounded-xl p-6 relative h-[64px] flex items-center">
                <ConnectButton
                  client={client}
                  wallets={[
                    inAppWallet({ auth: { options: ["google"] } }),
                  ]}
                  connectButton={{
                    label: (
                      <div className="relative w-full flex items-center justify-center">
                        <Image src="/google-icon.png" alt="Google" width={18} height={18} className="absolute left-4" />
                        <span className="mx-auto">구글로 시작하기</span>
                      </div>
                    ),
                    style: {
                      backgroundColor: "transparent",
                      color: "#4d4e4f",
                      padding: "14px 0",
                      borderRadius: "12px",
                      fontSize: "16px",
                      fontWeight: "800",
                      width: "100%",
                      border: "1px solid #ccc",
                      boxShadow: "none",
                    },
                  }}
                  connectModal={{ title: "Google로 시작하기" }}
                />
              </div>
            </div>
          )}
        </div>

  <footer className="text-xs text-[#4d4e4f] w-full mt-10">
  <div className="rounded-lg p-2 text-center space-y-1">
    <p>
      계속하면 이용약관에 동의하는 것입니다.{" "}
      <Link href="/terms" className="text-[#1369b9] font-medium underline">
        이용약관
      </Link>
    </p>
    <p>
      개인정보 처리방침을 확인하세요.{" "}
      <Link href="/privacy" className="text-[#1369b9] font-medium underline">
        개인정보 처리방침
      </Link>
    </p>
  </div>
</footer>
      </main>
    </>
  );
}
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";

export default function RegisterInfoPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const handleSubmit = async () => {
    if (!account?.address) {
      alert("지갑이 연결되지 않았습니다.");
      return;
    }

    if (!name.trim()) {
      alert("이름을 입력해주세요.");
      return;
    }

    if (!email.trim().includes("@")) {
      alert("올바른 이메일을 입력해주세요.");
      return;
    }

    if (phone.length < 9) {
      alert("휴대폰 번호를 정확히 입력해주세요.");
      return;
    }

    const fullPhone = `+82${phone}`;

    const { error } = await supabase
      .from("users")
      .update({
        name: name.trim(),
        email: email.trim(),
        phone: fullPhone,
      })
      .eq("wallet_address", account.address.toLowerCase());

    if (error) {
      alert("저장 실패: " + error.message);
    } else {
      router.push("/haru");
    }
  };

  return (
    <main className="min-h-screen bg-[#eef3f8] flex justify-center items-start px-4 py-10">
      <div className="w-full max-w-md space-y-6">
        {/* 상단 제목 + 뒤로가기 */}
        <div className="flex items-center gap-2 text-gray-700">
          <button onClick={() => router.back()}>
            <ChevronLeft size={20} />
          </button>
          <h2 className="text-base font-semibold">정보 입력하기</h2>
        </div>

        <p className="text-sm text-[#555]">
          서비스 이용을 위해 아래의 정보를 입력 후 제출해주세요.
        </p>

        {/* 이름 */}
        <input
          type="text"
          placeholder="성함을 입력하세요."
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-sm placeholder-gray-400"
        />

        {/* 이메일 */}
        <input
          type="email"
          placeholder="등록 이메일 주소를 입력하세요."
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-300 rounded-lg bg-white text-sm placeholder-gray-400"
        />

        {/* 휴대폰 번호 */}
        <div className="flex items-center gap-2">
          <span className="px-4 py-3 bg-gray-200 rounded-lg text-sm text-gray-600 select-none">
            +82
          </span>
          <input
            type="tel"
            placeholder="휴대폰 번호를 입력하세요."
            value={phone}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, "");
              setPhone(val);
            }}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg bg-white text-sm placeholder-gray-400"
          />
        </div>

        {/* 저장 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={!name || !email || phone.length < 9}
          className={`w-full py-3 rounded-lg text-sm font-semibold transition ${
            !name || !email || phone.length < 9
              ? "bg-gray-300 text-gray-500 cursor-not-allowed"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          저장하기
        </button>
      </div>
    </main>
  );
}

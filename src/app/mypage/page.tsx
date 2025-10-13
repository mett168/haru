"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import BottomNav from "@/components/BottomNav";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react"; // ← 아이콘 추가

export default function MyPage() {
  const account = useActiveAccount();
  const router = useRouter();

  const [userData, setUserData] = useState<any>(null);
  const [editingField, setEditingField] = useState<"name" | "phone" | null>(null);
  const [nameInput, setNameInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");

  // ✅ 본사 계좌 모달 상태
  const [showCompanyAcc, setShowCompanyAcc] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!account?.address) return;

      const { data: user } = await supabase
        .from("users")
        .select("name, phone, email, created_at, ref_by, joined_at")
        .eq("wallet_address", account.address.toLowerCase())
        .maybeSingle();

      if (!user) return;

      let refName = null;
      if (user.ref_by) {
        const { data: refUser } = await supabase
          .from("users")
          .select("name")
          .eq("ref_code", user.ref_by)
          .maybeSingle();
        refName = refUser?.name || null;
      }

      setUserData({
        ...user,
        ref_by_name: refName,
      });
    };

    fetchUserData();
  }, [account?.address]);

  if (!account) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <p className="text-gray-500 text-sm">지갑 주소 불러오는 중...</p>
      </main>
    );
  }

  const handleLogout = async () => {
    try {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem("logged_out", "true");
      window.location.replace("/");
    } catch (error) {
      console.error("❌ 로그아웃 실패:", error);
      alert("로그아웃 중 문제가 발생했습니다.");
    }
  };

  return (
    <>
      <main className="min-h-screen bg-[#f5f7fa] pb-16 w-full">
        <div className="px-4 pt-2 max-w-[500px] mx-auto">
          {/* 계정관리 */}
          <section className="mb-2">
            <div className="flex items-center mb-1 pl-2">
              {/* 돌아가기 버튼 */}
              <button
                onClick={() => router.push("/haru")}
                className="mr-2 text-gray-600 hover:text-gray-900"
              >
                <ChevronLeft size={20} />
              </button>
              <h2 className="text-md font-semibold text-gray-700">계정관리</h2>
            </div>

            <div className="bg-white rounded-xl shadow border text-sm divide-y divide-gray-200">
              {/* 이름 */}
              <InfoItem
                label="내 이름"
                value={userData?.name}
                isEditing={editingField === "name"}
                onEdit={() => {
                  setEditingField("name");
                  setNameInput(userData?.name || "");
                }}
                onSave={async () => {
                  const { error } = await supabase
                    .from("users")
                    .update({ name: nameInput })
                    .eq("wallet_address", account.address.toLowerCase());

                  if (!error) {
                    setEditingField(null);
                    setUserData({ ...userData, name: nameInput });
                  }
                }}
                inputValue={nameInput}
                onInputChange={setNameInput}
              />

              {/* 휴대폰 번호 */}
              <InfoItem
                label="휴대폰 번호"
                value={userData?.phone}
                isEditing={editingField === "phone"}
                onEdit={() => {
                  setEditingField("phone");
                  setPhoneInput(userData?.phone || "");
                }}
                onSave={async () => {
                  const { error } = await supabase
                    .from("users")
                    .update({ phone: phoneInput })
                    .eq("wallet_address", account.address.toLowerCase());

                  if (!error) {
                    setEditingField(null);
                    setUserData({ ...userData, phone: phoneInput });
                  }
                }}
                inputValue={phoneInput}
                onInputChange={setPhoneInput}
              />

              {/* 이메일 */}
              <div className="flex justify-between px-4 py-3">
                <span>가입 이메일</span>
                <span className="text-gray-800">{userData?.email || "-"}</span>
              </div>

              {/* 가입 일시 */}
              <div className="flex justify-between px-4 py-3">
                <span>가입 일시</span>
                <span className="text-gray-800">
                  {userData?.joined_at
                    ? userData.joined_at.slice(0, 19).replace("T", " ")
                    : "-"}
                </span>
              </div>

              {/* 추천인 */}
              <div className="flex justify-between px-4 py-3">
                <span>추천인</span>
                <span className="text-gray-800">{userData?.ref_by_name || "-"}</span>
              </div>
            </div>
          </section>

          {/* ✅ 계좌 등록 */}
          <section className="mb-2">
            <div
              onClick={() => router.push("/settings/bank")}
              className="cursor-pointer bg-white p-4 rounded-xl shadow flex justify-between items-center hover:bg-gray-50"
            >
              <span className="text-sm font-medium">계좌 등록</span>
              <img src="/icon-go.png" alt="이동" className="w-4 h-4" />
            </div>

            {/* ✅ 본사 계좌 (하드코딩) */}
            <div
              onClick={() => setShowCompanyAcc(true)}
              className="mt-2 cursor-pointer bg-white p-4 rounded-xl shadow flex justify-between items-center hover:bg-gray-50"
            >
              <span className="text-sm font-medium">본사 계좌</span>
              <img src="/icon-go.png" alt="이동" className="w-4 h-4" />
            </div>
          </section>

          {/* 내역관리 */}
          <section className="mb-2">
            <h2 className="text-md font-semibold text-gray-700 mb-1 pl-2">내역관리</h2>
            <div className="bg-white rounded-xl shadow border text-sm divide-y divide-gray-200">
              {/* 💱 현금 교환 내역 */}
              <button
                onClick={() => router.push("/mypage/history/cash-exchange")}
                className="w-full px-4 py-3 hover:bg-gray-50 flex justify-between items-center"
              >
                <span>현금 교환 내역</span>
                <img src="/icon-go.png" alt="이동" className="w-4 h-4" />
              </button>
            </div>
          </section>

          {/* 문의 */}
          <section className="space-y-4 mb-2">
            <a
              href="http://pf.kakao.com/_rxaxmGn/chat"
              target="_blank"
              rel="noopener noreferrer"
              className="block bg-white p-4 rounded-xl shadow flex justify-between items-center hover:bg-gray-50"
            >
              <div className="flex items-center space-x-2">
                <img src="/icon-question.png" alt="문의" className="w-5 h-5" />
                <span className="text-sm">1:1 문의하기</span>
              </div>
              <img src="/icon-link.png" alt="이동" className="w-4 h-4" />
            </a>
          </section>

          {/* 로그아웃 */}
          <button
            onClick={handleLogout}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold mb-4"
          >
            로그아웃
          </button>
        </div>

        {/* ✅ 본사 계좌 모달 */}
        <CompanyAccountModal
          open={showCompanyAcc}
          onClose={() => setShowCompanyAcc(false)}
        />

        <BottomNav />
      </main>
    </>
  );
}

// ✅ 재사용 가능한 인라인 수정 컴포넌트
function InfoItem({
  label,
  value,
  isEditing,
  onEdit,
  onSave,
  inputValue,
  onInputChange,
}: {
  label: string;
  value: string;
  isEditing: boolean;
  onEdit: () => void;
  onSave: () => void;
  inputValue: string;
  onInputChange: (val: string) => void;
}) {
  return (
    <div className="flex justify-between px-4 py-3 items-center">
      <span>{label}</span>
      {isEditing ? (
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => onInputChange(e.target.value)}
            className="text-sm border rounded px-2 py-1 w-28"
          />
          <button onClick={onSave} className="text-blue-500 text-sm">
            저장
          </button>
        </div>
      ) : (
        <span className="text-gray-800">
          {value || "-"}{" "}
          <span onClick={onEdit} className="text-blue-500 cursor-pointer text-sm">
            수정
          </span>
        </span>
      )}
    </div>
  );
}

/* =========================
   ✅ 본사 계좌 모달 (하드코딩)
   ========================= */
function CompanyAccountModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  if (!open) return null;

  // 하드코딩된 본사 계좌
  const bankName = "기업은행";
  const accountNumber = "137-104541-01-019";
  const holderName = "CUICHENGXUN";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      alert("계좌번호가 복사되었습니다 ✅");
    } catch {
      alert("복사에 실패했습니다 ❌");
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
      {/* 딤(배경) */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* 모달 패널 */}
      <div
        className="
          relative w-[calc(100%-32px)] max-w-[500px] mx-auto
          bg-white rounded-t-2xl sm:rounded-2xl shadow-lg

          /* ▼ 핵심: 높이 제한 + 스크롤 */
          max-h-[75vh] overflow-y-auto overscroll-contain

          /* ▼ 하단 네비/안전영역에 가리지 않도록 패딩 */
          p-5 pb-[calc(env(safe-area-inset-bottom,0px)+88px)]
        "
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">본사 계좌</h3>
          <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
            닫기
          </button>
        </div>

        <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
          <div className="flex items-start justify-between gap-3">
            <span className="text-sm font-semibold text-gray-800">{bankName}</span>
            <button
              onClick={handleCopy}
              className="text-xs text-blue-600 hover:underline shrink-0"
            >
              복사하기
            </button>
          </div>

          <p className="text-sm mt-2 break-all">
            <span className="text-gray-500 mr-1">계좌번호</span>
            <span className="text-gray-900">{accountNumber}</span>
          </p>
          <p className="text-sm mt-1 break-all">
            <span className="text-gray-500 mr-1">예금주</span>
            <span className="text-gray-900">{holderName}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

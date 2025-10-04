"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";

type BankRow = {
  account_holder: string | null; // 예금주(표시/입력용)
  bank_name: string | null;
  account_number: string | null;
};

export default function BankRegisterPage() {
  const router = useRouter();
  const account = useActiveAccount();

  const [form, setForm] = useState<BankRow>({
    account_holder: "",
    bank_name: "",
    account_number: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 내 기본정보(ref_code, name)
  const [refCode, setRefCode] = useState<string>("");
  const [userName, setUserName] = useState<string>("");

  // ---------------------------
  // 초기 로드: users → ref_code/name → user_bank_accounts(ref_code)
  // ---------------------------
  useEffect(() => {
    const run = async () => {
      if (!account?.address) return;

      // 1) 내 사용자 정보(ref_code, name)
      const { data: me, error: meErr } = await supabase
        .from("users")
        .select("ref_code, name")
        .eq("wallet_address", account.address.toLowerCase())
        .maybeSingle();

      if (meErr) {
        console.error("users select error:", meErr);
        alert(meErr.message || "사용자 정보 조회 중 오류가 발생했습니다.");
        router.back();
        return;
      }

      if (!me?.ref_code) {
        alert("사용자 정보를 찾을 수 없습니다. (ref_code 없음)");
        router.back();
        return;
      }

      setRefCode(me.ref_code);
      setUserName(me.name || "");

      // 2) 기존 계좌 정보(ref_code 기준)
      const { data: bank, error: bankErr } = await supabase
        .from("user_bank_accounts")
        .select("account_holder, bank_name, account_number")
        .eq("ref_code", me.ref_code)
        .maybeSingle();

      if (bankErr) {
        console.error("bank select error:", bankErr);
        alert(bankErr.message || "계좌 정보 조회 중 오류가 발생했습니다.");
        router.back();
        return;
      }

      if (bank) {
        setForm({
          account_holder: bank.account_holder || me.name || "",
          bank_name: bank.bank_name || "",
          account_number: bank.account_number || "",
        });
      } else {
        // 최초 진입 시 예금주 기본값 = 내 이름
        setForm((prev) => ({ ...prev, account_holder: me.name || "" }));
      }

      setLoading(false);
    };
    run();
  }, [account?.address, router]);

  const onChange = (k: keyof BankRow, v: string) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  // ---------------------------
  // 검증
  // ---------------------------
  const validate = () => {
    if (!form.account_holder?.trim()) return "예금주를 입력해 주세요.";
    if (!form.bank_name?.trim()) return "은행명을 입력해 주세요.";
    if (!form.account_number?.trim()) return "계좌번호를 입력해 주세요.";
    // 숫자/하이픈/공백만, 길이 6~30 (필요 시 정책에 맞게 변경)
    const ok = /^[0-9\- ]{6,30}$/.test(form.account_number);
    if (!ok) return "계좌번호 형식이 올바르지 않습니다.";
    return "";
  };

  // ---------------------------
  // 저장(업서트): ref_code 유니크 기준
  // ---------------------------
  const onSave = async () => {
    const msg = validate();
    if (msg) return alert(msg);
    if (!refCode) return alert("ref_code를 확인할 수 없습니다.");

    try {
      setSaving(true);

      const payload = {
        ref_code: refCode,                                 // ✅ 초대코드 기준
        user_name: userName || form.account_holder || "",  // ✅ 이름도 같이 저장
        account_holder: form.account_holder!.trim(),       // 예금주(표시/입력)
        bank_name: form.bank_name!.trim(),
        account_number: form.account_number!.trim(),
      };

      // .select()를 붙여서 에러/결과 확인 용이하게
      const { data, error } = await supabase
        .from("user_bank_accounts")
        .upsert(payload, { onConflict: "ref_code" })
        .select();

      if (error) {
        console.error("upsert error:", error);
        alert(error.message || "저장 중 오류가 발생했습니다.");
        return;
      }

      console.log("upsert ok:", data);
      alert("계좌 정보가 저장되었습니다.");
      router.back();
    } catch (e: any) {
      console.error("onSave exception:", e);
      alert(e?.message || "저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
  };

  // ---------------------------
  // 렌더
  // ---------------------------
  if (!account) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <p className="text-gray-500 text-sm">지갑 주소 불러오는 중...</p>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#f5f7fa]">
        <p className="text-gray-500 text-sm">불러오는 중…</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa] pb-16">
      <div className="max-w-[500px] mx-auto px-4 pt-3">
        {/* 헤더 */}
        <div className="flex items-center mb-3">
          <button onClick={() => router.back()} className="text-sm text-gray-500 mr-2">←</button>
          <h1 className="text-lg font-bold">계좌 등록</h1>
        </div>

        {/* 폼 카드 */}
        <div className="bg-white rounded-xl shadow border p-4 space-y-4">
          {/* 예금주 */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">예금주</label>
            <input
              type="text"
              value={form.account_holder || ""}
              onChange={(e) => onChange("account_holder", e.target.value)}
              placeholder="홍길동"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          {/* 은행명 */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">은행명</label>
            <input
              type="text"
              value={form.bank_name || ""}
              onChange={(e) => onChange("bank_name", e.target.value)}
              placeholder="국민은행"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            {/* 필요하면 드롭다운으로 교체 가능 */}
          </div>

          {/* 계좌번호 */}
          <div>
            <label className="block text-sm text-gray-600 mb-1">계좌번호</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.account_number || ""}
              onChange={(e) => onChange("account_number", e.target.value)}
              placeholder="123-456-789012"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving}
            className="w-full bg-blue-600 text-white py-2 rounded-lg font-semibold disabled:opacity-60"
          >
            {saving ? "저장 중..." : "저장"}
          </button>
        </div>

        {/* 디버그용 표시 (원하면 제거) */}
        <p className="text-xs text-gray-400 mt-3">ref_code: {refCode}</p>
      </div>
    </main>
  );
}

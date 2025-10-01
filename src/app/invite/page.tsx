"use client";

import { useEffect, useState } from "react";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import BottomNav from "@/components/BottomNav";
import Link from "next/link";
import { useRouter } from "next/navigation";


interface Invitee {
  ref_code: string;
  name: string;
  created_at: string;
  total_reward: number;
}

export default function InvitePage() {
  const account = useActiveAccount();
  const address = account?.address || ""; // ✅ 지갑 주소 추출
  const [refCode, setRefCode] = useState("");
  const [inviteLink, setInviteLink] = useState("");
  const [copied, setCopied] = useState(false);
  const [invitees, setInvitees] = useState<Invitee[]>([]);
  const router = useRouter();


  // ✅ 추천코드 + 초대링크 생성
  useEffect(() => {
    const loadRefCode = async () => {
      if (!account?.address) return;

      const { data } = await supabase
        .from("users")
        .select("ref_code")
        .eq("wallet_address", account.address.toLowerCase())
        .single();

      if (data?.ref_code) {
        setRefCode(data.ref_code);
        const origin = typeof window !== "undefined" ? window.location.origin : "";
        setInviteLink(`${origin}/invite/${data.ref_code}`);
      }
    };
    loadRefCode();
  }, [account]);

  // ✅ 내가 초대한 유저 목록 불러오기
  useEffect(() => {
    const loadInvitees = async () => {
      if (!refCode) return;

      const { data } = await supabase
        .from("users")
        .select("ref_code, name, created_at")
        .eq("ref_by", refCode)
        .order("created_at", { ascending: false });

      if (data) {
        setInvitees(
          data.map((user: any) => ({
            ref_code: user.ref_code,
            name: user.name || user.ref_code,
            created_at: user.created_at,
            total_reward: 0,
          }))
        );
      }
    };
    loadInvitees();
  }, [refCode]);

  // ✅ 초대링크 복사
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("복사 실패: 수동으로 복사해주세요.");
    }
  };

  return (
    <>
      <main className="min-h-screen bg-[#f5f7fa] pb-32 w-full">
        <div className="px-2 pt-4 max-w-md mx-auto space-y-4">




          {/* ✅ 나의 초대 코드 */}
          <section className="bg-white rounded-xl shadow overflow-hidden">
            <div className="bg-blue-600 text-white px-3 py-1 font-semibold text-base">
              나의 초대 코드
            </div>
            <div className="px-3 py-4 space-y-1 text-xs text-black">
              <div className="text-left">
                <span className="font-semibold">초대코드 :</span> {refCode || "불러오는 중..."}
              </div>
              {inviteLink && (
                <>
                  <div className="text-left break-all  mt-6">
                    <span className="font-semibold">초대링크 :</span> {inviteLink}
                  </div>
                  <button
                    onClick={handleCopy}
                    className="w-full bg-blue-100 hover:bg-blue-200 text-blue-600 py-2 rounded-lg text-sm font-semibold  mt-4"
                  >
                    {copied ? "✅ 복사됨" : "초대 링크 복사하기"}
                  </button>
                </>
              )}
            </div>
          </section>

          {/* ✅ 초대한 친구 목록 */}
          <section className="bg-white rounded-xl shadow overflow-hidden">
            <div className="bg-blue-600 text-white px-3 py-1 font-semibold text-base">
              나의 초대 친구
            </div>
            <div className="px-3 py-4">
              {invitees.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-center">
                    <thead>
                      <tr className="bg-transparent text-gray-700 font-semibold">
                        <th className="p-2">초대친구</th>
                        <th className="p-2">가입날짜</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invitees.map((user, idx) => (
                        <tr key={idx} className="border-t">
                          <td className="p-2 text-left">
                            <div className="flex items-center gap-1">
                              <span>{user.name}</span>
                              <Link href={`/invite-detail?code=${user.ref_code}`}>
                                <button className="bg-gray-200 text-[10px] px-2 py-0.5 rounded">
                                  상세보기
                                </button>
                              </Link>
                            </div>
                          </td>
                          <td className="p-2">
                            {(() => {
                              const kst = new Date(new Date(user.created_at).getTime() + 9 * 60 * 60 * 1000);
                              return `${kst.getFullYear()}. ${kst.getMonth() + 1}. ${kst.getDate()}.`;
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-center text-xs text-gray-400 py-4">초대한 친구가 없습니다.</p>
              )}
            </div>
          </section>
        </div>
        <BottomNav />
      </main>
    </>
  );
}

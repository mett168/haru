"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveAccount } from "thirdweb/react";
import { supabase } from "@/lib/supabaseClient";
import { ChevronLeft } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { getKSTDateString } from "@/lib/dateUtil";

// ✅ 관리자 지갑 (소문자 비교)
const ADMIN_ADDRESS = "0xFa0614c4E486c4f5eFF4C8811D46A36869E8aEA1".toLowerCase();

type BorrowDoc = {
  id: string;
  file_url: string;
  file_name: string | null;
  doc_date: string;
  created_at: string;
};

export default function BorrowDocsPage() {
  const router = useRouter();
  const account = useActiveAccount();

  const [userRefCode, setUserRefCode] = useState<string | null>(null);

  const [docs, setDocs] = useState<BorrowDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchSize, setFetchSize] = useState(10);
  const [uploading, setUploading] = useState(false);

  const addrLower = account?.address?.toLowerCase() || "";
  const isAdmin = addrLower === ADMIN_ADDRESS;

  // 1) 현재 접속 계정의 ref_code 조회
  useEffect(() => {
    (async () => {
      if (!addrLower) return;
      const { data, error } = await supabase
        .from("users")
        .select("ref_code")
        .eq("wallet_address", addrLower)
        .maybeSingle();

      if (error) {
        console.error("load ref_code error:", error);
        return;
      }
      setUserRefCode(data?.ref_code ?? null);
    })();
  }, [addrLower]);

  // 2) ref_code 기준으로 차용증 목록 로드
  const loadDocs = async (count: number) => {
    if (!userRefCode) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("borrow_docs")
        .select("id, file_url, file_name, doc_date, created_at")
        .eq("ref_code", userRefCode)
        .order("created_at", { ascending: false })
        .limit(count);

      if (error) throw error;
      setDocs(data || []);
    } catch (e) {
      console.error("load borrow_docs error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDocs(fetchSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userRefCode, fetchSize]);

  // 3) 날짜별 그룹핑(정렬은 유지)
  const grouped = useMemo(() => {
    const map = new Map<string, BorrowDoc[]>();
    for (const d of docs) {
      if (!map.has(d.doc_date)) map.set(d.doc_date, []);
      map.get(d.doc_date)!.push(d);
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a < b ? 1 : -1));
  }, [docs]);

  // 4) 업로드 (관리자만 노출/실행) — ref_code 기준
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    try {
      if (!isAdmin) return;
      const inputEl = e.currentTarget; // unmount 대비
      const file = inputEl.files?.[0];
      if (!file || !userRefCode) return;

      // PDF + 이미지 허용
      const allowed = new Set([
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
      ]);
      if (!allowed.has(file.type)) {
        alert("PDF, JPG, PNG(또는 WEBP/HEIC)만 업로드할 수 있습니다.");
        return;
      }

      setUploading(true);

      const objectPath = `borrow/${userRefCode}/${Date.now()}_${file.name}`;
      const up = await supabase.storage
        .from("documents")
        .upload(objectPath, file, { upsert: true, contentType: file.type });

      if (up.error) {
        console.error("[Storage upload error]", up.error);
        alert(`업로드 실패(Storage): ${up.error.message}`);
        return;
      }

      const { data: pub } = supabase.storage
        .from("documents")
        .getPublicUrl(objectPath);
      const publicUrl = pub.publicUrl;

      const ins = await supabase.from("borrow_docs").insert({
        ref_code: userRefCode, // ref_code로 저장
        file_url: publicUrl,
        file_name: file.name,
        doc_date: getKSTDateString(),
      });

      if (ins.error) {
        console.error("[DB insert error]", ins.error);
        alert(`DB 저장 실패: ${ins.error.message}`);
        return;
      }

      await loadDocs(fetchSize);
      alert("차용증이 등록되었습니다.");
    } catch (err: any) {
      console.error("upload error:", err?.message || err);
      alert("업로드 중 오류가 발생했습니다.");
    } finally {
      setUploading(false);
      e.currentTarget && (e.currentTarget.value = "");
    }
  };

  return (
    <main className="min-h-screen bg-[#f5f7fa] pb-16">
      <div className="px-4 pt-2 max-w-[500px] mx-auto">
        {/* 헤더 */}
        <div className="flex items-center mb-2 pl-2">
          <button
            onClick={() => router.back()}
            className="mr-2 text-gray-600 hover:text-gray-900"
          >
            <ChevronLeft size={20} />
          </button>
          <h1 className="text-md font-semibold text-gray-700">차용증</h1>
        </div>

        {/* 업로드 (관리자만 노출) */}
        {isAdmin && userRefCode && (
          <div className="bg-white rounded-xl shadow p-4 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">
                차용증 등록 (관리자) – 대상: {userRefCode}
              </span>
              <label className="text-xs text-blue-600 cursor-pointer">
                {uploading ? "업로드 중..." : "파일 선택"}
                <input
                  type="file"
                  accept="application/pdf,image/*"
                  onChange={handleUpload}
                  className="hidden"
                />
              </label>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              업로드 후 목록에 최신 순으로 표시됩니다.
            </p>
          </div>
        )}

        {/* 목록 */}
        <div className="bg-white rounded-xl shadow p-4">
          {!userRefCode ? (
            <p className="text-xs text-gray-500">사용자 식별코드(ref_code) 확인 중…</p>
          ) : loading ? (
            <p className="text-xs text-gray-500">목록 불러오는 중...</p>
          ) : docs.length === 0 ? (
            <p className="text-xs text-gray-500">등록된 차용증이 없습니다.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  {items.map((it) => (
                    <div
                      key={it.id}
                      className="flex items-center text-xs py-2"
                    >
                      {/* 날짜 */}
                      <span className="w-28 shrink-0 text-gray-700">
                        {date}
                      </span>
                      {/* 파일명 */}
                      <span className="flex-1 truncate px-2 text-gray-800">
                        {it.file_name ?? "차용증"}
                      </span>
                      {/* 보기 */}
                      <a
                        href={it.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-blue-600 underline"
                      >
                        보기
                      </a>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}

          {docs.length >= fetchSize && (
            <button
              onClick={() => setFetchSize((n) => n + 10)}
              className="mt-3 text-xs text-blue-600 hover:underline"
            >
              더보기
            </button>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}

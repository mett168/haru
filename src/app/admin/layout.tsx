"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const NAV = [
  { href: "/admin", label: "지급관리" },
  { href: "/admin/investments", label: "투자현황" },
  { href: "/admin/configs", label: "수익현황" },
  { href: "/admin/repayments", label: "원금상환" },
  { href: "/admin/harumoney", label: "하루머니" },
  { href: "/admin/users", label: "사용자" },
  { href: "/admin/balances-net", label: "보유자산(실제)" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // 🔐 간단 비밀번호 가드
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    const ok = localStorage.getItem("admin_auth") === "true";
    setIsAuthed(ok);
  }, []);

  const checkPassword = () => {
    const expected = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;
    if (!expected) {
      setErr("서버 환경변수 NEXT_PUBLIC_ADMIN_PASSWORD가 설정되지 않았습니다.");
      return;
    }
    if (pwd === expected) {
      localStorage.setItem("admin_auth", "true");
      setIsAuthed(true);
      setErr("");
    } else {
      setErr("비밀번호가 올바르지 않습니다.");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") checkPassword();
  };

  // 아직 판단 전이면 아무것도 렌더하지 않음(깜빡임 방지)
  if (isAuthed === null) return null;

  // 로그인 요구 화면
  if (!isAuthed) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-[360px] bg-white rounded-2xl shadow p-6">
          <h1 className="text-lg font-semibold mb-4 text-center">관리자 로그인</h1>
          <input
            type="password"
            value={pwd}
            onChange={(e) => setPwd(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="비밀번호"
            className="w-full border rounded-lg px-3 py-2 mb-2"
          />
          {err && <p className="text-red-500 text-xs mb-2">{err}</p>}
          <button
            onClick={checkPassword}
            className="w-full bg-blue-600 text-white py-2 rounded-lg"
          >
            로그인
          </button>
        </div>
      </main>
    );
  }

  // 인증 통과 후 기존 관리자 레이아웃
  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-white">
        <div className="p-4 font-bold flex items-center justify-between">
          <span>관리자</span>
          <button
            className="text-xs text-gray-500 hover:text-gray-800"
            onClick={() => {
              localStorage.removeItem("admin_auth");
              setIsAuthed(false);
            }}
          >
            로그아웃
          </button>
        </div>
        <nav className="px-2 space-y-1">
          {NAV.map((n) => {
            // /admin/repayments, /admin/repayments/** 모두 활성 처리
            const active =
              pathname === n.href || (n.href !== "/admin" && pathname.startsWith(n.href));
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`block rounded px-3 py-2 text-sm ${
                  active ? "bg-blue-600 text-white" : "hover:bg-gray-100"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 bg-gray-50">{children}</main>
    </div>
  );
}

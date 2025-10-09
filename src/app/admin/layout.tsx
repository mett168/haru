"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "지급관리" },
  { href: "/admin/investments", label: "투자현황" },
  { href: "/admin/configs", label: "수익현황" },
  { href: "/admin/repayments", label: "원금상환" }, // ✅ 추가
  { href: "/admin/harumoney", label: "하루머니" },
  { href: "/admin/users", label: "사용자" },
  { href: "/admin/balances-net", label: "보유자산(실제)" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 shrink-0 border-r bg-white">
        <div className="p-4 font-bold">관리자</div>
        <nav className="px-2 space-y-1">
          {NAV.map((n) => {
            // ✅ /admin/repayments, /admin/repayments/anything 모두 활성 처리
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

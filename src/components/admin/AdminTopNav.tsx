"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { href: "/admin/users", label: "유저정보" },
  { href: "/admin/subscriptions", label: "구독현황" },
  { href: "/admin/rewards", label: "리워드송금" },
  { href: "/admin/bots", label: "봇운영현황" },
  { href: "/admin/account", label: "거래소세팅" },
  { href: "/admin/referrals", label: "추천구조" },
];

export default function AdminTopNav() {
  const pathname = usePathname();

  return (
    <div className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b">
      <div className="mx-auto max-w-6xl px-4">
        <div className="flex items-center gap-2 h-12 overflow-x-auto no-scrollbar">
          {tabs.map((t) => {
            const active = pathname === t.href || pathname?.startsWith(t.href + "/");
            return (
              <Link
                key={t.href}
                href={t.href}
                className={
                  active
                    ? "px-3 py-2 rounded-md text-sm font-semibold text-blue-600 bg-blue-50"
                    : "px-3 py-2 rounded-md text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                }
              >
                {t.label}
              </Link>
            );
          })}
          <div className="flex-1" />
          {/* 우측에 관리자 메뉴/로그아웃 버튼 자리 */}
        </div>
      </div>
    </div>
  );
}

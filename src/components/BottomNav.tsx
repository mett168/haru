'use client';

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, User, Book, Wallet, Brain, Building2 } from "lucide-react"; // 🧠 Brain, 🏢 Building 아이콘 추가

export default function BottomNav() {
  const pathname = usePathname();
  const isActive = (path: string) => pathname === path;

  return (
    <div className="relative">
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[500px] bg-white border-t border-gray-200 z-50">
        <div className="flex justify-around items-center h-14 text-xs text-gray-500">

          {/* 파워넵 */}
          <Link href="/powernap" className="flex flex-col items-center">
            <Brain size={20} className={isActive("/powernap") ? "text-blue-600" : "text-gray-400"} />
            <span className={isActive("/powernap") ? "text-blue-600" : "text-gray-400"}>파워넵</span>
          </Link>

          
          {/* 하루머니 */}
          <Link href="/haru" className="flex flex-col items-center">
            <Gift size={20} className={isActive("/haru") ? "text-blue-600" : "text-gray-400"} />
            <span className={isActive("/haru") ? "text-blue-600" : "text-gray-400"}>하루머니</span>
          </Link>

          {/* 원금상환 */}
          <Link href="/wallet" className="flex flex-col items-center">
            <Wallet size={20} className={isActive("/wallet") ? "text-blue-600" : "text-gray-400"} />
            <span className={isActive("/wallet") ? "text-blue-600" : "text-gray-400"}>원금상환</span>
          </Link>

          {/* 쇼핑몰 */}
          <Link href="/shopping" className="flex flex-col items-center">
            <User size={20} className={isActive("/shopping") ? "text-blue-600" : "text-gray-400"} />
            <span className={isActive("/shopping") ? "text-blue-600" : "text-gray-400"}>쇼핑몰</span>
          </Link>

        </div>
      </div>
    </div>
  );
}

"use client";

import { Bell, Settings } from "lucide-react";
import { useRouter } from "next/navigation";

export default function TopCard({ title = "HARU MONEY" }: { title?: string }) {
  const router = useRouter();

  return (
    <div className="w-full flex items-center justify-between px-4 py-3">
      {/* 왼쪽 텍스트 */}
      <p className="text-lg font-bold text-gray-800">{title}</p>

      {/* 오른쪽 아이콘 */}
      <div className="flex items-center space-x-3">
        <button onClick={() => alert("알림 기능 준비중입니다")} className="text-gray-500 hover:text-gray-700">
          <Bell size={20} />
        </button>
        <button onClick={() => router.push("/mypage")} className="text-gray-500 hover:text-gray-700">
          <Settings size={20} />
        </button>
      </div>
    </div>
  );
}

"use client";

type Props = {
  userName?: string | null;
};

export default function WelcomeCard({ userName }: Props) {
  return (
    <div className="w-full rounded-xl bg-white px-4 py-3 shadow">
      <p className="text-sm font-semibold text-gray-800">환영합니다 👋</p>
      <p className="text-xs text-gray-600 mt-1">
        {userName && userName.trim() !== ""
          ? `${userName}님, 오늘도 빛나는 하루 되세요 ✨`
          : "HARU MONEY와 함께 하세요 🚀"}
      </p>
    </div>
  );
}
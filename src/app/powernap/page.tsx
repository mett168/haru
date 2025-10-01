"use client";

import Image from "next/image";
import TopCard from "@/components/TopCard";
import BottomNav from "@/components/BottomNav";

export default function PowerNapPage() {
  return (
    <main className="relative mx-auto min-h-[100dvh] w-full max-w-[500px] bg-gray-50 pb-24">
      {/* ✅ 상단 고정 TopCard */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <TopCard title="파워넵" />
      </div>

      {/* 본문 */}
      <section className="px-5 py-6 space-y-6">
        {/* 제품 이미지 */}
        <div className="relative w-full aspect-[4/3] rounded-2xl overflow-hidden shadow bg-white">
          <Image
            src="/device.jpg" // public 폴더에 넣어주세요
            alt="Power Nap Device"
            fill
            className="object-cover"
          />
        </div>

        {/* 설명 텍스트 */}
        <div className="rounded-2xl bg-white shadow p-5 space-y-4">
          <h1 className="text-xl font-bold text-gray-900">POWER NAP</h1>
          <p className="text-sm text-gray-600">
            세계 최초의 수면 뇌기능 통합 훈련 장비
          </p>
          <blockquote className="text-center text-lg font-semibold text-blue-600">
            “30분 수면 = 3시간 수면 효과”
          </blockquote>

          <p className="text-sm text-gray-700 leading-relaxed">
            현재 뇌파 상태를 파악하고, 실시간 멀티 뉴로피드백과 유도 사운드를 통해
            잠재의식과 내면의식의 이완과 균형을 이루어 최적의 두뇌 통합 효과를 이끌어내는
            뉴로피드백 훈련 장비입니다.
          </p>

          <p className="text-sm text-gray-700 leading-relaxed">
            뇌도 운동을 해야 건강합니다. 근육운동이 몸의 긴장을 풀어주는 것처럼,
            뉴로피드백 훈련은 뇌 신경운동으로 30분 훈련만으로도 피로 회복, 집중력 향상,
            기억력 증진, 스트레스 해소 등에 도움을 줍니다.
          </p>
        </div>

        {/* 효과 아이콘/버튼 */}
        <div className="grid grid-cols-2 gap-3">
          {[
            "불면증 해소",
            "치매예방 및 개선",
            "집중력 향상",
            "우울증 개선",
            "인지능력 향상",
            "스트레스 해소",
            "에너지 강화",
          ].map((effect) => (
            <div
              key={effect}
              className="rounded-xl bg-blue-50 text-blue-700 text-center text-sm font-semibold py-3 shadow"
            >
              {effect}
            </div>
          ))}
        </div>
      </section>

      {/* ✅ 하단 탭바 */}
      <BottomNav />
    </main>
  );
}

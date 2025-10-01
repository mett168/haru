"use client";

import Image from "next/image";
import { ListChecks, Sparkles } from "lucide-react";
import BottomNav from "@/components/BottomNav";

// ✅ 갤러리 카드
function GalleryCard({ src, title, alt }: { src: string; title: string; alt?: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-sm bg-white">
      <div className="absolute left-2 top-2 z-10 rounded-lg bg-black/70 px-2 py-1 text-[10px] font-semibold tracking-wide text-white">
        {title}
      </div>
      <div className="relative aspect-[4/3] w-full">
        <Image src={src} alt={alt || title} fill className="object-cover" />
      </div>
    </div>
  );
}

// ✅ 리스트 아이템
function FeatureItem({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2 py-1">
      <span className="mt-[2px]">
        <ListChecks size={18} className="text-blue-600" />
      </span>
      <span className="text-[15px] leading-relaxed text-gray-800">{text}</span>
    </li>
  );
}

export default function StartupPage() {
  return (
    <main className="relative mx-auto min-h-[100dvh] w-full max-w-[500px] bg-gradient-to-b from-gray-50 to-gray-100 pb-24">
      {/* Hero */}
      <section className="relative">
        {/* 배경 이미지 (연한 오버레이) */}
        <div className="absolute inset-0 -z-10 opacity-20">
          <Image
            src="/images/startup/hero-bg.jpg" // 👉 프로젝트에 이미지 추가하세요
            alt="AI Brain Background"
            fill
            className="object-cover"
            priority
          />
        </div>

        <div className="px-5 pt-8">
          <p className="text-sm text-gray-600">뇌건강을 지키는 당신의 비즈니스 파트너</p>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-gray-900">
            Ai Brain Solution
          </h1>

          {/* 강조 배지 */}
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            <Sparkles size={14} />
            뇌파 케어 · 휴식 · 몰입공간
          </div>

          {/* 리스트 */}
          <ul className="mt-5 space-y-1">
            <FeatureItem text="GYM, 헬스장, 요가센터 등" />
            <FeatureItem text="카페, 수면방, 휴게소" />
            <FeatureItem text="심리상담센터, VIP Lounge, 고객센터" />
            <FeatureItem text="스터디카페, 공부방, 독서실" />
          </ul>
        </div>
      </section>

      {/* 갤러리 */}
      <section className="px-5 pt-6">
        <div className="grid grid-cols-2 gap-4">
          <GalleryCard src="/images/startup/gym.jpg" title="Gym, Health Training" alt="Gym" />
          <GalleryCard src="/images/startup/sleeping-cafe.jpg" title="Sleeping Cafe" alt="Sleeping Cafe" />
          <GalleryCard src="/images/startup/vip-lounge.jpg" title="VIP Lounge" alt="VIP Lounge" />
          <GalleryCard src="/images/startup/study-cafe.jpg" title="STUDY Cafe" alt="Study Cafe" />
        </div>
      </section>

      {/* 안내 블록 */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="text-lg font-bold text-gray-900">창업 안내</h2>
          <p className="mt-2 text-sm leading-6 text-gray-600">
            공간 유형에 맞춘 AI 브레인 케어 패키지를 제공합니다. 설치 상담부터 운영 매뉴얼, 마케팅 키트까지
            원스톱으로 지원합니다.
          </p>
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-700">
            <li>공간 진단 및 레이아웃 컨설팅</li>
            <li>장비 · 소프트웨어 세팅(표준 운영 가이드 포함)</li>
            <li>요금제/회원권 설계와 정산 시스템 연동</li>
            <li>브랜딩·홍보물 템플릿 제공</li>
          </ul>
        </div>
      </section>

      {/* 문의 CTA */}
      <section className="px-5 pt-6">
        <div className="rounded-2xl bg-blue-600 p-5 text-white shadow-sm">
          <h3 className="text-base font-semibold">도입 상담 / 제휴 문의</h3>
          <p className="mt-1 text-sm opacity-90">간단한 정보를 남겨주시면 담당자가 빠르게 연락드립니다.</p>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="rounded-md bg-white/10 px-2 py-1">contact@yourdomain.com</span>
            <span className="rounded-md bg-white/10 px-2 py-1">010-0000-0000</span>
          </div>
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

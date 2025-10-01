'use client';

import { useRouter } from 'next/navigation';

export default function SwapCompletePage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-white px-5 pt-5 pb-24 flex flex-col">

      <div className="flex flex-col items-center mt-24">
        <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center mb-4">
          <img src="/icons/check.png" alt="check" className="w-8 h-8" />
        </div>
        <p className="text-xl font-bold text-gray-800">교환신청이 완료됐어요</p>
      </div>

      <div className="mt-auto w-full px-4">
        <button
          onClick={() => router.push('/home')}
          className="w-full bg-gradient-to-r from-cyan-300 to-blue-400 text-white text-lg font-bold py-3 rounded-full"
        >
          완료
        </button>
      </div>
    </div>
  );
}

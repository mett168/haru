// src/app/join/JoinClient.tsx
'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function JoinClient() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const refCode = searchParams.get('ref');
    if (refCode) {
      console.log("✅ 추천코드로 접속됨:", refCode);
      localStorage.setItem('ref_code', refCode);
    }

    setTimeout(() => {
      router.push('/');
    }, 2000);
  }, [searchParams, router]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-white text-center">
      <div>
        <p className="text-gray-700 text-sm mb-2">초대 링크로 접속 중입니다...</p>
        <p className="text-xs text-gray-500">잠시 후 이동합니다.</p>
      </div>
    </main>
  );
}

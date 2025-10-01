'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';

export default function RecipientPage() {
  const router = useRouter();
  const [address, setAddress] = useState('');
  const [recentList, setRecentList] = useState<string[]>([]);

  useEffect(() => {
    const stored = localStorage.getItem('recent_recipients');
    if (stored) {
      setRecentList(JSON.parse(stored));
    }
  }, []);

  const handleDelete = (idx: number) => {
    const updated = recentList.filter((_, i) => i !== idx);
    setRecentList(updated);
    localStorage.setItem('recent_recipients', JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-white px-5 pt-5 pb-24 flex flex-col">

      <input
        value={address}
        onChange={(e) => setAddress(e.target.value)}
        placeholder="받는 분 지갑주소"
        className="w-full mt-4 px-4 py-3 border rounded-xl text-sm bg-gray-50 placeholder-gray-400"
      />

      {recentList.length > 0 && (
        <>
          <p className="mt-8 text-xs font-semibold text-gray-400">최근 내역</p>
          {recentList.map((addr, idx) => (
            <div key={idx} className="flex justify-between items-center mt-2">
              <p className="text-sm font-mono text-gray-700 truncate max-w-[80%]">{addr}</p>
              <button
                onClick={() => handleDelete(idx)}
                className="text-xs text-gray-400"
              >
                삭제
              </button>
            </div>
          ))}
        </>
      )}

      <div className="flex-1" />

<div className="flex items-center justify-between mt-auto px-1">
  <button className="w-14 h-14 rounded-full border border-gray-300 flex items-center justify-center">
    <img src="/icons/scan.png" alt="scan" className="w-6 h-6" />
  </button>
  <button
    disabled={!address}
    onClick={() => {
      const newList = [address, ...recentList.filter((a) => a !== address)].slice(0, 5);
      localStorage.setItem('recent_recipients', JSON.stringify(newList));
      localStorage.setItem('recipient_address', address); // ✅ 입력 주소 저장
      router.push('/home/send'); // ✅ 이동 경로 수정
    }}
    className="flex-1 ml-4 bg-gradient-to-r from-cyan-200 to-blue-200 text-white text-lg font-bold py-3 rounded-full"
  >
    다음
  </button>
</div>

    </div>
  );
}
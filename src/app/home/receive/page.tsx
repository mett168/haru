'use client';

import { useActiveAccount } from 'thirdweb/react';
import { Copy } from 'lucide-react';

export default function ReceivePage() {
  const account = useActiveAccount();

  const handleCopy = () => {
    if (account?.address) {
      navigator.clipboard.writeText(account.address);
      alert('주소가 복사되었습니다.');
    }
  };

  return (
    <div className="min-h-screen bg-white px-5 pt-5 pb-24">

      <section className="bg-white rounded-xl shadow mt-6 p-4 border">
        <h2 className="text-blue-600 font-semibold mb-1">나의 지갑 입금 주소</h2>
        <p className="font-mono text-sm break-all text-gray-800">
          {account?.address || '지갑 주소 없음'}
        </p>
        <p className="text-xs text-gray-500 mt-1">
          ※ 해당 주소는 <span className="font-semibold">POLYGON 체인</span>의 USDT 입금만 지원됩니다.
        </p>

        <button
          onClick={handleCopy}
          className="mt-3 w-full bg-blue-100 text-blue-700 font-semibold py-2 rounded text-sm flex items-center justify-center gap-2"
        >
          <Copy className="w-4 h-4" />
          주소 복사하기
        </button>
      </section>
    </div>
  );
}

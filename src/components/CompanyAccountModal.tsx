"use client";

export default function CompanyAccountModal({
  open,
  onClose,
}: { open: boolean; onClose: () => void }) {
  if (!open) return null;

  // 하드코딩된 본사 계좌 정보
  const bankName = "기업은행";
  const accountNumber = "13710454101019";
  const holderName = "CUICHENGXUN";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(accountNumber);
      alert("계좌번호가 복사되었습니다 ✅");
    } catch (err) {
      alert("복사에 실패했습니다 ❌");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* 배경 */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      
      {/* 모달 박스 */}
      <div className="relative w-full max-w-[500px] mx-auto bg-white rounded-t-2xl sm:rounded-2xl p-5 shadow-lg">
        {/* 헤더 */}
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold">본사 계좌</h3>
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            닫기
          </button>
        </div>

        {/* 본문 */}
        <div className="rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{bankName}</span>
            <button
              onClick={handleCopy}
              className="text-xs text-blue-600 hover:underline"
            >
              복사하기
            </button>
          </div>

          <p className="text-sm mt-2 break-all">
            <span className="text-gray-500 mr-1">계좌번호</span>
            {accountNumber}
          </p>

          <p className="text-sm">
            <span className="text-gray-500 mr-1">예금주</span>
            {holderName}
          </p>
        </div>
      </div>
    </div>
  );
}

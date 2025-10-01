'use client';

interface PositionData {
  symbol: string;
  qty: string;
  leverage: string;
  realizedPNL: string;
  fee: string;
  marginMode: string;
  side: string;
}

interface Props {
  position: PositionData;
}

export default function PositionCard({ position }: Props) {
  return (
    <div className="p-4 bg-zinc-900 text-white rounded-lg shadow-md border border-zinc-700">
      <h2 className="text-lg font-bold mb-2">🧭 coinw 실시간 포지션</h2>
      <div className="space-y-1 text-sm">
        <div>📌 <strong>종목:</strong> {position.symbol}</div>
        <div>📊 <strong>수량:</strong> {position.qty}</div>
        <div>🎯 <strong>방향:</strong> {position.side}</div>
        <div>⚙️ <strong>레버리지:</strong> {position.leverage}배</div>
        <div>💰 <strong>실현손익:</strong> {position.realizedPNL} USDT</div>
        <div>🧾 <strong>수수료:</strong> {position.fee}</div>
        <div>🧩 <strong>마진모드:</strong> {position.marginMode}</div>
      </div>
    </div>
  );
}

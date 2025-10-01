"use client";

import { ReactNode } from "react";
import { ThirdwebProvider as TWProvider } from "thirdweb/react";
import { inAppWallet } from "thirdweb/wallets";
import { polygon } from "thirdweb/chains";

const ThirdwebProvider = TWProvider as any;

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <ThirdwebProvider
      activeChain={polygon}
      autoConnect={true} // ✅ 자동 재연결 활성화만 유지
      wallets={[inAppWallet()]} // ❌ strategy 설정 제거
    >
      {children}
    </ThirdwebProvider>
  );
}

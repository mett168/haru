// src/wallets/wallets.ts

import { inAppWallet } from "thirdweb/wallets";

/**
 * 현재 프로젝트에서는 inAppWallet만 사용합니다.
 * 다른 지갑이 필요해지면 여기에 추가하세요.
 */
export const wallets = [
  inAppWallet(), // ✅ 소셜 로그인 기반 인앱 지갑
];

import crypto from 'crypto';

export function generateSignature(apiKey: string, secretKey: string, nonce: string, timestamp: number) {
  // 🧪 디버깅용 로그 추가
  console.log("🔐 generateSignature input:", { apiKey, secretKey, nonce, timestamp });

  if (!apiKey || !secretKey || !nonce || !timestamp) {
    throw new Error("❌ generateSignature: 인자 누락됨");
  }

  const payload = `apiKey=${apiKey}&nonce=${nonce}&timestamp=${timestamp}`;
  const hash = crypto.createHmac('sha256', secretKey).update(payload).digest('hex');
  return hash;
}



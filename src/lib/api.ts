// src/lib/api.ts
const FALLBACK_API = 'http://127.0.0.1:8000'; // 로컬 fallback

export const API_BASE =
  (process.env.NEXT_PUBLIC_REMOTE_API_BASE?.replace(/\/$/, '') ||
   process.env.NEXT_PUBLIC_API_BASE?.replace(/\/$/, '') ||
   FALLBACK_API);

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE}${path}`;
  console.log('🌐 apiGet ->', url); // 실제 나가는 URL 확인
  const res = await fetch(url, { cache: 'no-store', ...init });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`GET ${path} ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPost<T>(
  path: string,
  body?: unknown,
  init?: RequestInit
): Promise<T> {
  const url = `${API_BASE}${path}`;
  console.log('🌐 apiPost ->', url);
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`POST ${path} ${res.status} ${text}`);
  }
  return res.json() as Promise<T>;
}

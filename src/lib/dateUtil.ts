// /src/lib/dateUtil.ts

// ───────────────────────────────────────────────────────────────
// 내부 헬퍼: 임의의 Date를 'KST 시각'으로 변환한 Date 객체 반환
// (어느 타임존에서도 정확히 +9시간 보정)
// ───────────────────────────────────────────────────────────────
function toKST(date?: Date): Date {
  const base = date ? new Date(date) : new Date();
  const utcMs = base.getTime() + base.getTimezoneOffset() * 60_000; // 로컬 → UTC
  return new Date(utcMs + 9 * 60 * 60 * 1000); // UTC → KST(+9h)
}

// 한국시간 ISO 문자열 (타임스탬프 저장용)
// ▶ 인자 없으면 "지금(KST)" / 인자 있으면 해당 Date를 KST로 변환해 ISO
export function getKSTISOString(date?: Date): string {
  return toKST(date).toISOString();
}

// 한국 날짜 문자열 (YYYY-MM-DD)
// ▶ 인자 없으면 "오늘(KST)" / 인자 있으면 해당 Date를 KST로 변환해 YYYY-MM-DD
export function getKSTDateString(date?: Date): string {
  return getKSTISOString(date).slice(0, 10);
}

// 내부 헬퍼: Date -> KST 기준 YYYY-MM-DD
function toKSTDateYYYYMMDD(d: Date): string {
  return toKST(d).toISOString().slice(0, 10);
}

// ✅ 전주(월~일) KST 구간 반환 (월요일 실행 가정)
// todayKstYYYYMMDD를 넘기면 그 날짜를 기준으로 계산, 없으면 오늘(KST) 기준
export function getLastWeekRangeKST(todayKstYYYYMMDD?: string) {
  const today = todayKstYYYYMMDD ?? getKSTDateString(); // YYYY-MM-DD (KST)

  // KST 자정 기준 시점(UTC로는 전날 15:00Z)
  const baseKstMidnight = new Date(`${today}T00:00:00+09:00`);

  const MS = 24 * 60 * 60 * 1000;
  const startUTC = new Date(baseKstMidnight.getTime() - 7 * MS); // 전주 월요일 KST 자정 순간의 UTC값
  const endUTC   = new Date(baseKstMidnight.getTime() - 1 * MS); // 전주 일요일 KST 자정 순간의 UTC값

  const startDate = toKSTDateYYYYMMDD(startUTC);
  const endDate   = toKSTDateYYYYMMDD(endUTC);

  return {
    gte: `${startDate} 00:00:00+09`,
    lt:  `${endDate} 23:59:59.999+09`,
    period_start: startDate,
    period_end: endDate,
  };
}

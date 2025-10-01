'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { getKSTDateString } from '@/lib/dateUtil';
import Link from 'next/link';

type Row = {
  pass_type: string | null;
  created_at: string | null;        // timestamptz
  pass_expired_at: string | null;   // date (YYYY-MM-DD)
  memo: string | null;
};

export default function PassCard({ refCode }: { refCode: string }) {
  const [row, setRow] = useState<Row | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!refCode) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      const todayKst = getKSTDateString();
      const { data, error } = await supabase
        .from('enrollments')
        .select('pass_type, created_at, pass_expired_at, memo')
        .eq('ref_code', refCode)
        .ilike('memo', '%결제 완료%')
        .gte('pass_expired_at', todayKst)
        .order('pass_expired_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!cancelled) {
        if (error) console.warn('[PassCard] query error:', error.message);
        setRow(data ?? null);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [refCode]);

  if (loading) {
    return <div className="bg-white border border-blue-200 rounded-xl px-4 py-3 text-sm">구독 상태 확인 중…</div>;
  }

  if (!row) {
    return (
      <div className="space-y-0">
        <div className="bg-white border border-blue-200 rounded-t-xl px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">구독중인 프라멤버십</h3>
        </div>
        <div className="bg-white border border-blue-200 border-t-0 rounded-b-xl px-4 py-4 text-center">
          <p className="text-sm font-semibold text-gray-800 mb-2">구독중인 멤버십이 없어요</p>
          <p className="text-xs text-gray-600">하루머니에서 PASS를 구입하면 트레이딩봇을 이용할 수 있어요</p>
          <Link href="/haru" className="text-xs text-blue-600 mt-2 font-semibold inline-block">
            하루머니 바로가기 &gt;
          </Link>
        </div>
      </div>
    );
  }

  const created = row.created_at?.slice(0, 10) ?? '';
  const expired = row.pass_expired_at ?? '';

  // 남은 일수 계산
  let warningText: string | null = null;
  if (expired) {
    const today = new Date(getKSTDateString());
    const expDate = new Date(expired);
    const diffDays = Math.floor((expDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays >= 0 && diffDays <= 3) {
      warningText = `멤버십 종료 ${diffDays}일 전입니다`;
    }
  }

  return (
    <div className="space-y-0">
      <div className="bg-white border border-blue-200 rounded-t-xl px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">구독중인 프라멤버십</h3>
      </div>
      <div className="bg-white border border-blue-200 border-t-0 rounded-b-xl px-4 py-4 flex items-center gap-3">
        <img src="/pass-300.png" alt="PASS" className="w-12 h-12" />
        <div className="text-sm">
          <p className="font-semibold text-gray-900">{row.pass_type ?? '프라'} 멤버십</p>
          {created && <p className="text-xs text-gray-500">구입일 : {created}</p>}

          {warningText ? (
            <p className="text-lg font-bold text-red-600">{warningText}</p>
          ) : (
            <p className="text-xs text-gray-500">유효기간 : ~{expired}</p>
          )}
        </div>
      </div>
    </div>
  );
}

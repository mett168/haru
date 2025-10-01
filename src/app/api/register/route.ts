import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getKSTISOString, getKSTDateString } from "@/lib/dateUtil"; // ✅ 한국시간 함수 추가

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 추천코드 생성 함수 (HM1000부터 증가)
async function generateNextReferralCode(): Promise<string> {
  const { data, error } = await supabase
    .from("users")
    .select("ref_code")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("❌ ref_code 조회 실패:", error.message);
    throw error;
  }

  let newNumber = 1001; // NOTE: 주석엔 1000이지만 기존 코드 흐름 유지
  if (data.length > 0 && data[0].ref_code?.startsWith("HM")) {
    const lastNum = parseInt(data[0].ref_code.slice(2));
    newNumber = lastNum + 1;
  }

  return `HM${newNumber}`;
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    wallet_address,
    email = "",
    phone = "01000000000",
    ref_by = "HM1001",
    name = "", // ✅ name 파라미터 받음
  } = body;

  if (!wallet_address) {
    return NextResponse.json({ error: "지갑 주소는 필수입니다." }, { status: 400 });
  }

  const normalizedAddress = wallet_address.toLowerCase();

  // 🔍 이미 등록된 유저 확인
  const { data: existing, error: lookupError } = await supabase
    .from("users")
    .select("id, ref_code")
    .eq("wallet_address", normalizedAddress)
    .maybeSingle();

  if (lookupError) {
    console.error("❌ 유저 조회 실패:", lookupError.message);
    return NextResponse.json({ error: "유저 조회 실패" }, { status: 500 });
  }

  if (existing) {
    return NextResponse.json({
      message: "이미 등록된 유저입니다.",
      id: existing.id,
      ref_code: existing.ref_code,
    });
  }

  // 🧠 추천인 정보 확인 → 센터/초대인 정보 계산
  let center_id = "HM1001"; // 기본 센터 (기존 로직 유지)
  let inviter_name: string | null = null;   // ✅ ADDED
  let center_name: string | null = null;    // ✅ ADDED

  const { data: referrer, error: referrerError } = await supabase
    .from("users")
    // ✅ inviter_name, center_name도 함께 조회
    .select("center_id, center_name, ref_code, name")
    .eq("ref_code", ref_by)
    .maybeSingle();

  if (referrerError) {
    console.error("❌ 추천인 정보 조회 실패:", referrerError.message);
    return NextResponse.json({ error: "추천인 정보 조회 실패" }, { status: 500 });
  }

  if (referrer) {
    center_id = referrer.center_id || "HM1001";   // 기존 로직 유지
    inviter_name = referrer.name ?? null;          // ✅ ADDED
    center_name = referrer.center_name ?? null;    // ✅ ADDED
  }

  // (선택 보강) 추천인의 center_name이 비어 있을 경우 centers 테이블에서 보강
  // centers 테이블에 id/name이 있다면 활성화해서 사용 가능
  // if (center_id && !center_name) {
  //   const { data: centerRec, error: centerErr } = await supabase
  //     .from("centers")
  //     .select("id, name")
  //     .eq("id", center_id)
  //     .maybeSingle();
  //   if (!centerErr && centerRec) {
  //     center_name = (centerRec as any).name ?? null;
  //   }
  // }

  // 신규 추천코드 생성
  const newRefCode = await generateNextReferralCode();
  const finalName = name?.trim() || null; // ❗null로 저장하면 이후 name 체크 가능

  // ✅ 가입 날짜/시간 설정 (KST 기준)
  const joinedAt = getKSTISOString();     // 예: 2025-05-26T09:12:33.000Z
  const joinedDate = getKSTDateString();  // 예: 2025-05-26

  // 🆕 신규 유저 등록
  const { data: inserted, error: insertError } = await supabase
    .from("users")
    .insert({
      wallet_address: normalizedAddress,
      email,
      phone,
      name: finalName,
      ref_code: newRefCode,
      ref_by,
      center_id,
      // ✅ ADDED: 자동 저장 필드
      inviter_name,
      center_name,
      // ✅ 한국시간 저장(스키마에 컬럼이 존재한다고 가정)
      joined_at: joinedAt,
      joined_date: joinedDate,
    })
    .select("id, ref_code")
    .single();

  if (insertError) {
    console.error("❌ 등록 실패:", insertError.message);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({
    message: "등록 완료",
    id: inserted.id,
    ref_code: inserted.ref_code,
  });
}

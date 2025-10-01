// /src/app/api/grant-gas/route.ts
import { NextResponse } from "next/server";
import { polygon } from "thirdweb/chains";
import { client } from "@/lib/client";
import { privateKeyToAccount } from "thirdweb/wallets";
import { prepareTransaction, sendTransaction, toWei } from "thirdweb";
import { createClient } from "@supabase/supabase-js";

const isProd = process.env.NODE_ENV === "production";

// 에러 객체에서 유용한 정보만 안전하게 추출
function describeError(e: any) {
  // thirdweb/ethers 계열 에러에 자주 있는 필드들만 뽑음
  const cause = e?.cause || e?.error || {};
  return {
    name: e?.name,
    message: e?.message,
    // 네트워크/가스 관련 단서
    shortMessage: cause?.shortMessage,
    reason: cause?.reason,
    code: e?.code || cause?.code,
    data: cause?.data,
    // 개발 환경에서만 stack 노출
    stack: isProd ? undefined : e?.stack,
  };
}

export async function POST(req: Request) {
  // 공통적으로 no-store
  const json = (body: any, status = 200) =>
    new NextResponse(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });

  try {
    const { walletAddress } = await req.json();

    // ── ① 입력 검증 ─────────────────────────────────────────────
    if (!walletAddress) {
      return json({ ok: false, stage: "input", error: "walletAddress is required" }, 400);
    }
    if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
      return json({ ok: false, stage: "input", error: "invalid address" }, 400);
    }

    // ── ② 환경변수 확인 ─────────────────────────────────────────
    const adminPk = process.env.ADMIN_PRIVATE_KEY;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!adminPk) {
      return json({ ok: false, stage: "env", error: "ADMIN_PRIVATE_KEY not set" }, 500);
    }
    if (!supabaseUrl || !serviceRoleKey) {
      return json({ ok: false, stage: "env", error: "Supabase server env not set" }, 500);
    }

    // ── ③ 서버용 Supabase (서비스 롤) ───────────────────────────
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── ④ 현재 지급 여부 확인 ───────────────────────────────────
    let userRow;
    try {
      const { data, error } = await adminSupabase
        .from("users")
        .select("gas_granted")
        .eq("wallet_address", walletAddress.toLowerCase())
        .maybeSingle();

      if (error) throw error;
      userRow = data;
    } catch (e: any) {
      return json({ ok: false, stage: "select_user", error: "user load failed", detail: describeError(e) }, 500);
    }

    if (userRow?.gas_granted === true) {
      return json({ ok: true, skipped: true });
    }

    // ── ⑤ 운영자 지갑 준비 ─────────────────────────────────────
    let admin;
    try {
      admin = privateKeyToAccount({ client, privateKey: adminPk });
    } catch (e: any) {
      return json({ ok: false, stage: "admin_wallet", error: "failed to init admin wallet", detail: describeError(e) }, 500);
    }

    // ── ⑥ 0.5 MATIC 전송 준비/보내기 ────────────────────────────
    let transactionHash: string | undefined;
    try {
      const tx = prepareTransaction({
        client,
        chain: polygon,
        to: walletAddress,
        value: toWei("0.5"), // 0.5 MATIC
        // 필요시 gasPrice/gasLimit 지정 가능
      });

      const sent = await sendTransaction({ account: admin, transaction: tx });
      transactionHash = sent.transactionHash;
    } catch (e: any) {
      return json(
        { ok: false, stage: "send_transaction", error: "sendTransaction failed", detail: describeError(e) },
        500
      );
    }

    // ── ⑦ 지급 플래그 업데이트 ──────────────────────────────────
    try {
      const { error: upErr } = await adminSupabase
        .from("users")
        .update({ gas_granted: true })
        .eq("wallet_address", walletAddress.toLowerCase());

      if (upErr) throw upErr;
    } catch (e: any) {
      // 온체인 전송은 이미 발생 → tx 같이 반환하여 추적 가능
      return json(
        {
          ok: false,
          stage: "update_flag",
          error: "flag update failed",
          tx: transactionHash,
          detail: describeError(e),
        },
        500
      );
    }

    // ── 완료 ────────────────────────────────────────────────────
    return json({ ok: true, tx: transactionHash });
  } catch (e: any) {
    // 최상위 캐치
    return json({ ok: false, stage: "unhandled", error: e?.message ?? "unknown error", detail: describeError(e) }, 500);
  }
}

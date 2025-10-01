import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabaseClient";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const { ref_code, amount, memo } = await req.json();
    if (!ref_code || amount == null) throw new Error("ref_code, amount 필수");
    const amt = Math.max(0, Number(amount));
    const { error } = await supabase.from("repayments").insert({
      ref_code, amount: amt, memo: memo || null
    });
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e:any) {
    return NextResponse.json({ ok:false, error:e.message }, { status:400 });
  }
}

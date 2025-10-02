import { Suspense } from "react";
import DepositsClient from "./deposits-client";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4 text-sm">불러오는 중…</div>}>
      <DepositsClient />
    </Suspense>
  );
}

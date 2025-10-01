import { Suspense } from "react";
import SwapClient from "./SwapClient";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SwapClient />
    </Suspense>
  );
}

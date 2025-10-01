import { Suspense } from "react";
import SendClient from "./SendClient";

export const dynamic = "force-dynamic"; // 쿼리 의존 → SSG 비활성화

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SendClient />
    </Suspense>
  );
}

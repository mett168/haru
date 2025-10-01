// src/app/join/page.tsx
import { Suspense } from "react";
import JoinClient from "./JoinClient";

export default function JoinPageWrapper() {
  return (
    <Suspense fallback={<p>로딩 중...</p>}>
      <JoinClient />
    </Suspense>
  );
}

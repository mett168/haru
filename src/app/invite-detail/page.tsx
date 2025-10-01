// src/app/invite-detail/page.tsx
import { Suspense } from "react";
import InviteDetailClient from "./InviteDetailClient";

export default function InviteDetailPage() {
  return (
    <Suspense fallback={<p className="text-center text-gray-400 mt-20">로딩 중...</p>}>
      <InviteDetailClient />
    </Suspense>
  );
}

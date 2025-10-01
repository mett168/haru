"use client";

import { useState, useEffect } from "react";

const ADMIN_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD;

export default function AdminAuth({ children }: { children: React.ReactNode }) {
  const [authorized, setAuthorized] = useState(false);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const saved = localStorage.getItem("admin_access");
    if (saved === "granted") setAuthorized(true);
  }, []);

  const handleLogin = () => {
    if (password === ADMIN_PASSWORD) {
      localStorage.setItem("admin_access", "granted");
      setAuthorized(true);
    } else {
      alert("비밀번호가 틀렸습니다.");
    }
  };

  if (!authorized) {
    return (
      <div className="p-10 max-w-md mx-auto">
        <h2 className="text-lg font-bold mb-4">🔐 관리자 비밀번호 입력</h2>
        <input
          type="password"
          className="border p-2 w-full mb-4"
          placeholder="비밀번호"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button
          className="bg-blue-600 text-white px-4 py-2 rounded w-full"
          onClick={handleLogin}
        >
          확인
        </button>
      </div>
    );
  }

  return <>{children}</>;
}

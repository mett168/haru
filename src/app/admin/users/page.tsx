"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type UserRow = {
  id: string;
  ref_code: string;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  ref_by?: string | null;
  center_id?: string | null;
  created_at: string;
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("users")
        .select("id, ref_code, name, email, phone, ref_by, center_id, created_at")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("유저 조회 오류:", error.message);
      } else {
        setUsers(data || []);
      }
      setLoading(false);
    };
    fetchUsers();
  }, []);

  if (loading) return <p className="p-4">불러오는 중...</p>;

  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-lg font-bold mb-4">👤 사용자 목록</h1>
      <table className="w-full border border-gray-200 text-sm">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2">Ref Code</th>
            <th className="border p-2">이름</th>
            <th className="border p-2">이메일</th>
            <th className="border p-2">전화번호</th>
            <th className="border p-2">추천인</th>
            <th className="border p-2">센터</th>
            <th className="border p-2">가입일</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td className="border p-2">{u.ref_code}</td>
              <td className="border p-2">{u.name || "-"}</td>
              <td className="border p-2">{u.email || "-"}</td>
              <td className="border p-2">{u.phone || "-"}</td>
              <td className="border p-2">{u.ref_by || "-"}</td>
              <td className="border p-2">{u.center_id || "-"}</td>
              <td className="border p-2">
                {new Date(u.created_at).toLocaleDateString("ko-KR")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Search, Filter, Star, Plus, Minus } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import TopCard from "@/components/TopCard"; // ✅ 상단 고정 헤더

// ─────────────────────────────────────────────
// 상단 카드박스 (하루머니 톤)
// ─────────────────────────────────────────────
function TopSummaryCard({ cartCount }: { cartCount: number }) {
  return (
    <div className="max-w-[500px] mx-auto px-3 mt-3">
      <div className="rounded-2xl bg-white shadow p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">쇼핑몰</p>
            <p className="mt-1 text-xs text-gray-600">오늘의 특가 상품과 추천을 만나보세요</p>
          </div>
          <Link href="/cart" className="flex items-center gap-2 text-xs">
            <ShoppingCart size={18} />
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] text-gray-600">
              장바구니 {cartCount}
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// 상품 1개만 사용 (내부 public 이미지)
// public/images/product1.png 필요
// ─────────────────────────────────────────────
type Product = {
  id: string;
  title: string;
  price: number;
  image: string;
  rating?: number;
  category: string;
  badge?: "NEW" | "HOT" | "SALE";
};

const PRODUCTS: Product[] = [
  { id: "p1", title: "파워넵", price: 3000000, image: "device.jpg", rating: 4.7, category: "구독", badge: "HOT" },
];

type CartItem = { id: string; qty: number };

export default function ShoppingPage() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("전체");
  const [sort, setSort] = useState<"추천" | "낮은가격" | "높은가격">("추천");
  const [cart, setCart] = useState<CartItem[]>([]);

  // 장바구니 로컬 스토리지 동기화
  useEffect(() => {
    try {
      const saved = localStorage.getItem("shopping_cart");
      if (saved) setCart(JSON.parse(saved));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("shopping_cart", JSON.stringify(cart));
    } catch {}
  }, [cart]);

  const categories = useMemo(
    () => ["전체", ...Array.from(new Set(PRODUCTS.map(p => p.category)))],
    []
  );

  const filtered = useMemo(() => {
    let list = PRODUCTS.filter(p =>
      (category === "전체" || p.category === category) &&
      (query.trim() === "" || p.title.toLowerCase().includes(query.trim().toLowerCase()))
    );
    if (sort === "낮은가격") list = list.sort((a, b) => a.price - b.price);
    else if (sort === "높은가격") list = list.sort((a, b) => b.price - a.price);
    else list = list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0)); // 추천=평점순
    return list;
  }, [query, category, sort]);

  const qtyOf = (id: string) => cart.find(c => c.id === id)?.qty || 0;
  const add = (id: string) =>
    setCart(prev => {
      const has = prev.find(p => p.id === id);
      return has
        ? prev.map(p => (p.id === id ? { ...p, qty: p.qty + 1 } : p))
        : [...prev, { id, qty: 1 }];
    });
  const sub = (id: string) =>
    setCart(prev => {
      const has = prev.find(p => p.id === id);
      if (!has) return prev;
      if (has.qty <= 1) return prev.filter(p => p.id !== id);
      return prev.map(p => (p.id === id ? { ...p, qty: p.qty - 1 } : p));
    });

  const cartCount = cart.reduce((s, c) => s + c.qty, 0);

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* ✅ 상단 고정 TopCard */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur border-b border-gray-200">
        <TopCard title="쇼핑몰" />
      </div>

      {/* ✅ 상단 요약 카드 */}
      <TopSummaryCard cartCount={cartCount} />

      {/* 헤더(검색/필터) */}
      <div className="mx-auto max-w-[500px] px-4 mt-3">
        <div className="flex gap-2">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3">
            <Search size={16} className="text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="상품 검색"
              className="w-full h-10 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3">
            <Filter size={16} className="text-gray-400" />
            <select
              className="h-10 bg-transparent text-sm outline-none"
              value={sort}
              onChange={(e) => setSort(e.target.value as any)}
            >
              <option value="추천">추천순</option>
              <option value="낮은가격">낮은가격</option>
              <option value="높은가격">높은가격</option>
            </select>
          </div>
        </div>

        {/* 카테고리 */}
        <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
                category === cat
                  ? "border-blue-600 text-blue-600 bg-blue-50"
                  : "border-gray-200 text-gray-600 bg-white"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* 상품 (1개) */}
      <div className="mx-auto max-w-[500px] px-3 mt-3 grid grid-cols-2 gap-3">
        {filtered.map(p => (
          <div key={p.id} className="rounded-2xl bg-white shadow p-3">
            <div className="relative w-full aspect-square overflow-hidden rounded-xl bg-gray-100">
              <Image src="/device.jpg" alt={p.title} fill className="object-cover" />
              {p.badge && (
                <span className="absolute left-2 top-2 rounded-full bg-black/70 text-white text-[10px] px-2 py-0.5">
                  {p.badge}
                </span>
              )}
            </div>
            <div className="mt-2">
              <p className="text-sm font-semibold text-gray-900 line-clamp-2 min-h-[2.5rem]">
                {p.title}
              </p>
              <div className="mt-1 flex items-center gap-1 text-xs text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} size={12} fill={i < Math.round(p.rating ?? 0) ? "currentColor" : "none"} />
                ))}
                <span className="text-gray-500 ml-1">{(p.rating ?? 0).toFixed(1)}</span>
              </div>
              <p className="mt-1 text-base font-bold">{p.price.toLocaleString()}원</p>

              {/* 수량/담기 */}
              <div className="mt-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => sub(p.id)} className="h-8 w-8 rounded-full border border-gray-200 flex items-center justify-center">
                    <Minus size={16} />
                  </button>
                  <span className="w-6 text-center text-sm">{qtyOf(p.id)}</span>
                  <button onClick={() => add(p.id)} className="h-8 w-8 rounded-full border border-gray-200 flex items-center justify-center">
                    <Plus size={16} />
                  </button>
                </div>
                <button onClick={() => add(p.id)} className="rounded-xl bg-blue-600 text-white text-xs px-3 py-2">
                  담기
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 하단 고정 장바구니 버튼 (탭바 위로) */}
      <div className="fixed bottom-16 left-1/2 -translate-x-1/2 w-full max-w-[500px] px-3">
        <Link
          href="/cart"
          className={`block rounded-2xl text-center py-3 shadow ${
            cartCount > 0 ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-500"
          }`}
        >
          장바구니 {cartCount > 0 ? `(${cartCount})` : ""}
        </Link>
      </div>

      {/* 하단 탭바 */}
      <BottomNav />
    </div>
  );
}

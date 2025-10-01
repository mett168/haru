'use client';

import Image from "next/image";
import { useEffect, useState } from "react";

const ads = ["/ads/ad1.png", "/ads/ad2.png"];

export default function AdBanner() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % ads.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    // ✅ 여백 제거
    <Image
      src={ads[index]}
      alt={`광고 배너 ${index + 1}`}
      width={500}
      height={100}
      className="w-full object-cover"
    />
  );
}

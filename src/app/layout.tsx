import "./globals.css";
import { Inter } from "next/font/google";
import Providers from "@/components/Providers";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata = {
  title: "하루머니",
  description: "하루머니",

  // PWA/아이콘
  manifest: "/manifest.json?v=3",
  themeColor: "#0066ff",
  icons: {
    icon: [
      { url: "/haru.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/icon180.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: { capable: true, title: "하루머니" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className={`${inter.className} bg-gray-100`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

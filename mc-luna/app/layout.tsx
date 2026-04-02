import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalHeader from "@/src/components/common/GlobalHeader";
import { Toaster } from "sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Minecraft Luna Calculator",
  description: "도맨이 만든 루나서버 생활 계산기",
  icons: {
    icon: "/branding/plbear-face.png",
    shortcut: "/branding/plbear-face.png",
    apple: "/branding/plbear-face.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" data-theme="light">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen bg-[var(--background)] text-[var(--foreground)] antialiased`}
      >
        <GlobalHeader />

        {/* 
          페이지 본문은 한 번만 렌더링해야 한다.
          기존 코드처럼 children을 두 번 렌더링하면
          페이지가 중복 마운트되어 이벤트/상태가 꼬일 수 있다.
        */}
        <div className="mx-auto w-full max-w-7xl">{children}</div>

        {/* 
          전역 토스트 렌더러
          - 프로필 저장 성공/실패 메시지를 toast로 띄우기 위해 필요
          - 앱 전체에서 한 번만 두면 된다
        */}
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
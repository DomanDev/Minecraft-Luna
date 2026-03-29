import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import GlobalHeader from "@/src/components/common/GlobalHeader";

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
        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </body>
    </html>
  );
}
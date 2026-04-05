import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],

  /**
   * 마인크래프트 머리/스킨 렌더 이미지를
   * next/image 또는 외부 이미지 로딩에 사용할 수 있도록 허용
   */
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crafatar.com",
      },
    ],
  },
};

export default nextConfig;
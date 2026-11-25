import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 휴대폰 실기기 테스트: cloudflared 임시 터널(HTTPS) 주소에서 dev 서버 접근 허용
  allowedDevOrigins: ["*.trycloudflare.com"],
};

export default nextConfig;

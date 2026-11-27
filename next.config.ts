import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // 휴대폰 실기기 테스트: cloudflared 임시 터널(HTTPS) 주소에서 dev 서버 접근 허용
  // 같은 와이파이의 휴대폰(사설 IP)에서 접속할 때도 dev 서버 접근을 허용한다
  allowedDevOrigins: ["*.trycloudflare.com", "192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;

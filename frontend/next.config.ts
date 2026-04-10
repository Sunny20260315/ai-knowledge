import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'standalone', // ← 加这一行，Docker 部署必需
  allowedDevOrigins: ['192.168.31.229'],
};

export default nextConfig;

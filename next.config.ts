import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Preserve three 5 MiB uploads through Proxy; handlers enforce the lower
    // 15 MiB + 64 KiB multipart limit on actual bytes as well as Content-Length.
    proxyClientMaxBodySize: '16mb',
  },
};

export default nextConfig;

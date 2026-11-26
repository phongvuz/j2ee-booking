import type { NextConfig } from "next";
import { securityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  allowedDevOrigins: ['192.168.56.1', 'localhost:3000', 'localhost', '127.0.0.1'],
  distDir: process.env.SGU_DEMO === "true" ? ".next-demo" : ".next",
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  turbopack: {},
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },
  async rewrites() {
    // Point this to your new Render backend URL once deployed
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://photoproof-backend.onrender.com';
    return [
      {
        source: '/api/:path*',
        destination: `${backendUrl}/api/:path*`,
      },
      {
        source: '/processed/:path*',
        destination: `${backendUrl}/processed/:path*`,
      }
    ];
  },
};

export default withPWA(nextConfig);

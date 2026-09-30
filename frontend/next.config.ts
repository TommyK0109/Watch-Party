import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Socket.IO uses a trailing slash by default. Redirecting that request to
  // /socket.io breaks the Engine.IO handshake (and WebSocket upgrades).
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://127.0.0.1:5000"}/api/:path*`,
      },
      {
        source: "/socket.io/",
        destination: `${process.env.BACKEND_URL || "http://127.0.0.1:5000"}/socket.io/`,
      },
      {
        source: "/socket.io/:path*",
        destination: `${process.env.BACKEND_URL || "http://127.0.0.1:5000"}/socket.io/:path*`,
      },
    ];
  },
};

export default nextConfig;

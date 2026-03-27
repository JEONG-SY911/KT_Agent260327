import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The Python backend is called directly from the browser via CORS.
  // No proxy rewrites are needed for local development.
  experimental: {
    optimizePackageImports: ["lucide-react"],
  },
};

export default nextConfig;

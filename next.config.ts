import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["node-ical", "better-sqlite3"],
};

export default nextConfig;

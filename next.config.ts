import type { NextConfig } from "next";
import { setupDevPlatform } from "@cloudflare/next-on-pages/next-dev";

// Initialize Cloudflare local environment (Miniflare bindings) during development
if (process.env.NODE_ENV === "development") {
  setupDevPlatform().catch(console.error);
}

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;

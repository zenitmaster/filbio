import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The whole tool runs in the browser, so it ships as plain static files that
  // any host can serve (Vercel, GitHub Pages, an intranet web server, a USB key).
  output: "export",
  reactStrictMode: true,
};

export default nextConfig;

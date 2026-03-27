import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  serverExternalPackages: ["remotion", "@remotion/renderer", "@remotion/bundler"],
};

export default nextConfig;

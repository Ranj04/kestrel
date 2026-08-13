import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // lib/llm.ts optionally imports the Bedrock SDK at runtime (D12). The
  // package is deliberately NOT installed; marking it external stops
  // Turbopack from trying to resolve it at build time. At runtime the
  // dynamic import still fails inside its try/catch and the provider
  // chain falls through, exactly as documented.
  serverExternalPackages: ["@aws-sdk/client-bedrock-runtime"],
};

export default nextConfig;

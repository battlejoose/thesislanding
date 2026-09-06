import type { NextConfig } from 'next';

// Cloudflare Workers is the native vinext target and needs a server build.
// Vercel serves this app as plain files, so builds there prerender to `dist/client`.
const nextConfig: NextConfig = {
  output: process.env.VERCEL ? 'export' : undefined,
};

export default nextConfig;

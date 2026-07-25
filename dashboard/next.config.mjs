/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Enable server instrumentation hook (for Railway background worker)
  experimental: {
    instrumentationHook: true,
  },
};

export default nextConfig;

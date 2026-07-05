/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Disable ESLint during production builds — linting runs separately in CI
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Allow production builds even if there are type errors
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

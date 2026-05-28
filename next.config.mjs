/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  experimental: { instrumentationHook: false },
};
export default nextConfig;

const agencyInternalApiBaseUrl = process.env.AGENCY_INTERNAL_API_BASE_URL || 'http://127.0.0.1:8000';
const allowedDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  allowedDevOrigins,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
      },
    ],
  },
  output: 'standalone',
  async rewrites() {
    return [
      {
        source: '/backend/:path*',
        destination: `${agencyInternalApiBaseUrl.replace(/\/+$/, '')}/:path*`,
      },
    ];
  },
};

export default nextConfig;

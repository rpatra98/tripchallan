/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost', 'tripchallan.vercel.app'],
  },
  experimental: {
    serverExternalPackages: ['bcrypt']
  }
};

module.exports = nextConfig;

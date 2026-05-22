import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@photogrid/ui', '@photogrid/config'],
  experimental: {
    optimizePackageImports: ['lucide-react', '@photogrid/ui', 'framer-motion'],
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com' },
      { protocol: 'https', hostname: 'storage.googleapis.com' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
  poweredByHeader: false,
  async rewrites() {
    return [{ source: '/favicon.ico', destination: '/favicon.svg' }];
  },
};

export default config;

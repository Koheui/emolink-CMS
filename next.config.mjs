/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // Firebase Hosting用に静的エクスポートを有効化
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;

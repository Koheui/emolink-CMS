/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: exportを無効化（APIルートを使用するため）
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;

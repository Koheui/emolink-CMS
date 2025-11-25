/** @type {import('next').NextConfig} */
const nextConfig = {
  // 開発環境ではoutput: exportを無効化（動的ルートを使用するため）
  ...(process.env.NODE_ENV === 'production' && { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true
  }
};

export default nextConfig;

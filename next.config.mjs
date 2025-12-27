/** @type {import('next').NextConfig} */
const nextConfig = {
  // output: exportを無効化（APIルートを使用するため）
  trailingSlash: true,
  images: {
    unoptimized: true
  },
  // ビルドごとに一意のIDを生成してキャッシュをバスト
  generateBuildId: async () => {
    return `build-${Date.now()}`;
  },
  // functionsディレクトリをビルドから除外（Firebase Functions用）
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
    };
    // functionsディレクトリを無視
    config.watchOptions = {
      ...config.watchOptions,
      ignored: ['**/functions/**', '**/node_modules/**'],
    };
    return config;
  },
  // TypeScriptの除外設定
  typescript: {
    ignoreBuildErrors: false,
  },
};

export default nextConfig;

import dynamic from 'next/dynamic';
import { Suspense } from 'react';

// クライアントコンポーネントを動的インポート
const PublicPageClient = dynamic(() => import('./public-page-client').then(mod => ({ default: mod.PublicPageClient })), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-[#00ff00] border-t-transparent rounded-full animate-spin"></div>
    </div>
  ),
});

// output: export設定用のgenerateStaticParams
export function generateStaticParams() {
  return [
    { pageId: 'preview' },
  ];
}

interface PublicPageProps {
  params: {
    pageId: string;
  };
}

export default function PublicPage({ params }: PublicPageProps) {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#00ff00] border-t-transparent rounded-full animate-spin"></div>
      </div>
    }>
      <PublicPageClient />
    </Suspense>
  );
}

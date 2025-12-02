'use client';

import { Suspense } from 'react';
import { PublicPageClient } from '@/components/public-page-client';

function PublicPageContent({ pageId }: { pageId: string }) {
  return <PublicPageClient initialPageId={pageId} />;
}

export default function PublicPage({ params }: { params: { pageId: string } }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#000f24]">
        <div className="text-white">読み込み中...</div>
      </div>
    }>
      <PublicPageContent pageId={params.pageId} />
    </Suspense>
  );
}


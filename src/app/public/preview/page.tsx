'use client';

import { Suspense } from 'react';
import { PublicPageClient } from '@/components/public-page-client';
import { Loader2 } from 'lucide-react';

function PreviewPageContent() {
  // PublicPageClientは既にプレビューモードをサポートしている
  // pageId='preview'の場合、localStorageからデータを自動的に読み取る
  return <PublicPageClient initialPageId="preview" />;
}

export default function PreviewPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#000f24]">
        <Loader2 className="w-8 h-8 text-[#08af86] animate-spin" />
      </div>
    }>
      <PreviewPageContent />
    </Suspense>
  );
}


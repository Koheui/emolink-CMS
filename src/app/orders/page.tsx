'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// このページは廃止されました。CRMは /crm/orders を使用してください。
export default function OrderManagementDashboard() {
  const router = useRouter();

  useEffect(() => {
    // CRMの注文管理ページにリダイレクト
    router.replace('/crm/orders');
  }, [router]);
  
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">CRMにリダイレクト中...</p>
      </div>
    </div>
  );
}

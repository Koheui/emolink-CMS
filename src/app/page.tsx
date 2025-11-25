'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

export default function HomePage() {
  const { loading } = useSecretKeyAuth();
  const router = useRouter();

  const handleGo = () => {
    // 認証チェックは/memories/createで行うため、常に/memories/createに遷移
    // メール認証はLP経由（/claim経由）でのみ行う
    router.push('/memories/create');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000f24]">
        <div className="w-12 h-12 border-4 border-[#08af86] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#000f24] flex flex-col items-center justify-center px-6 py-12 text-center">
      {/* タイトル */}
      <h1 
        className="font-bold text-white mb-4 px-4"
        style={{ 
          fontSize: '35px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
        }}
      >
        大切な想い出をいつまでも
      </h1>

      {/* サブタイトル */}
      <p 
        className="text-white mb-8 max-w-2xl px-4"
        style={{ 
          fontSize: '16px',
          textShadow: '1px 1px 2px rgba(0,0,0,0.5)'
        }}
      >
        一度きりの想い出を残してください
      </p>

      {/* Goボタン */}
      <div className="absolute bottom-[15%]">
        <Button
          onClick={handleGo}
          size="lg"
          className="bg-[#08af86] text-white hover:bg-[#07a078] text-lg px-6 py-6 rounded-full shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105"
        >
          <ArrowRight className="w-6 h-6" />
        </Button>
      </div>

      {/* バージョン情報 */}
      <div className="absolute bottom-4 left-4">
        <p className="text-white/40 text-xs">v.1.0.0</p>
      </div>
    </div>
  );
}

'use client';

import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Loader2, Search, FileText, Edit, Eye, ExternalLink } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { useMemories } from '@/hooks/use-memories';
import { Memory } from '@/types';
import { MemorySelector } from '@/components/memory-selector';

export default function MemoriesListPage() {
  const { user, loading, isAuthenticated, logout } = useSecretKeyAuth();
  const router = useRouter();
  const { data: memories = [], isLoading: memoriesLoading, error } = useMemories(user?.uid || '');
  
  const [searchQuery, setSearchQuery] = useState('');
  
  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
      return;
    }
  }, [isAuthenticated, loading, router]);
  
  const filteredMemories = useMemo(() => {
    return memories.filter((memory: Memory) => {
      if (searchQuery && !memory.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      return true;
    });
  }, [memories, searchQuery]);
  
  if (loading || memoriesLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-white" />
      </div>
    );
  }
  
  if (!isAuthenticated) {
    return null;
  }
  
  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
        {/* ヘッダー */}
      <div className="bg-[#1a1a1a] border-b border-white/10 p-4 sm:p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <p className="text-white text-xs">edit</p>
            </div>
            <div className="flex items-center gap-3">
              <MemorySelector />
          <button
            onClick={() => router.push('/memories/create')}
            className="flex items-center justify-center w-10 h-10 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition"
            title="新規作成"
          >
            <Plus className="w-5 h-5" />
          </button>
          {isAuthenticated && (
            <button
              onClick={() => {
                logout();
                router.push('/');
              }}
              className="flex items-center justify-center w-10 h-10 bg-[#2a2a2a] text-white rounded-lg hover:bg-red-500/20 hover:border-red-500/50 border border-white/10 transition"
              title="ログアウト"
            >
              <ExternalLink className="w-5 h-5" />
            </button>
          )}
        </div>
            </div>

      <div className="p-4 sm:p-6 md:p-8">
        <div className="max-w-md mx-auto">
          {/* タイトル */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
              <FileText className="h-6 w-6" />
              emolinkページ一覧
            </h1>
            <p className="text-white/60 text-sm">全{memories.length}件のページが登録されています</p>
        </div>
        
        {/* 検索バー */}
          <div className="mb-6">
            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-white/40" />
                <Input
                  placeholder="タイトルで検索..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="flex-1 bg-[#2a2a2a] border-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-white/20"
                />
              </div>
            </div>
          </div>
        
        {/* メモリー一覧 */}
        {error ? (
            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-6">
                <div className="text-center py-8">
                <p className="text-red-400 mb-4">データの取得に失敗しました</p>
                <Button 
                  variant="outline" 
                  onClick={() => window.location.reload()}
                  className="bg-[#2a2a2a] border-white/10 text-white hover:bg-[#3a3a3a]"
                >
                    再読み込み
                  </Button>
                </div>
            </div>
        ) : memories.length === 0 ? (
            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-6">
                <div className="text-center py-12">
                <FileText className="w-16 h-16 text-white/40 mx-auto mb-4" />
                <p className="text-white/60 mb-4">まだemolinkページがありません</p>
                <Button 
                  onClick={() => router.push('/memories/create')} 
                  className="bg-white text-black hover:bg-white/90"
                >
                    <Plus className="w-4 h-4 mr-2" />
                    最初のページを作成
                  </Button>
                </div>
            </div>
        ) : filteredMemories.length === 0 ? (
            <div className="bg-[#1a1a1a] rounded-lg border border-white/10 p-6">
                <div className="text-center py-8">
                <p className="text-white/60 mb-2">検索条件に一致するページがありません</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchQuery('')}
                  className="bg-[#2a2a2a] border-white/10 text-white hover:bg-[#3a3a3a]"
                  >
                    検索をリセット
                  </Button>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
              {filteredMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-[#1a1a1a] rounded-lg border border-white/10 p-4 hover:bg-[#2a2a2a] transition cursor-pointer"
                  onClick={() => router.push(`/memories/create?memoryId=${memory.id}`)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-white flex-1 line-clamp-2">
                        {memory.title || '無題'}
                    </h3>
                    <span className={`px-2 py-1 text-xs rounded-full ml-2 ${
                        memory.status === 'published' 
                        ? 'bg-green-500/20 text-green-400 border border-green-500/50' 
                        : 'bg-white/10 text-white/60 border border-white/20'
                      }`}>
                        {memory.status === 'published' ? '公開中' : '下書き'}
                      </span>
                    </div>
                  <p className="text-white/40 text-xs mb-4">
                      更新: {formatDate(memory.updatedAt)}
                  </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                        router.push(`/memories/create?memoryId=${memory.id}`);
                        }}
                      className="flex-1 bg-[#2a2a2a] border-white/10 text-white hover:bg-[#3a3a3a]"
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        編集
                      </Button>
                      {memory.publicPageId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`/public/${memory.publicPageId}`, '_blank');
                          }}
                        className="bg-[#2a2a2a] border-white/10 text-white hover:bg-[#3a3a3a]"
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                </div>
            ))}
          </div>
        )}
        </div>
      </div>
    </div>
  );
}


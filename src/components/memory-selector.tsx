'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useMemories } from '@/hooks/use-memories';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { FileText, ChevronDown, Loader2, Plus } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { Memory } from '@/types';
import { cn } from '@/lib/utils';

export function MemorySelector() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useSecretKeyAuth();
  const { data: memories = [], isLoading } = useMemories(user?.uid || '');
  const [open, setOpen] = useState(false);
  const [currentMemoryId, setCurrentMemoryId] = useState<string | null>(null);
  
  // 現在のメモリーIDを取得（URLから）
  // /memories/create?memoryId=xxx の形式から取得
  useEffect(() => {
    if (pathname === '/memories/create' && typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setCurrentMemoryId(params.get('memoryId'));
    } else {
      setCurrentMemoryId(null);
    }
  }, [pathname]);
  
  const currentMemory = memories.find(m => m.id === currentMemoryId);
  
  // メモリー作成ページまたは一覧ページの場合は「新規作成」を表示
  const isCreatingOrListing = pathname === '/memories/create' || pathname === '/memories';
  
  const handleSelectMemory = (memoryId: string) => {
    setOpen(false);
    // window.location.hrefを使用して確実に遷移
    // router.pushではクエリパラメータが正しく処理されない場合があるため
    const url = `/memories/create?memoryId=${encodeURIComponent(memoryId)}`;
    window.location.href = url;
  };
  
  const handleCreateNew = () => {
    router.push('/memories/create');
    setOpen(false);
  };
  
  const handleViewList = () => {
    router.push('/memories');
    setOpen(false);
  };
  
  if (!user || isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }
  
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="w-10 h-10 bg-[#2a2a2a] border-white/10 text-white hover:bg-[#3a3a3a]"
        >
          <ChevronDown className="w-5 h-5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 bg-[#1a1a1a] border-white/10 text-white" align="start">
        <div className="p-2">
          {/* メモリー一覧 */}
          {memories.length === 0 ? (
            <div className="p-4 text-center text-sm text-white/60">
              まだemolinkページがありません
            </div>
          ) : (
            <div className="max-h-[400px] overflow-y-auto">
              <div className="space-y-1">
                {memories.map((memory) => (
                  <button
                    key={memory.id}
                    onClick={() => handleSelectMemory(memory.id)}
                    className={cn(
                      "w-full text-left px-3 py-2 rounded-md text-sm transition-colors",
                      "hover:bg-[#2a2a2a] text-white",
                      currentMemoryId === memory.id && "bg-[#2a2a2a] text-white"
                    )}
                  >
                    <div className="font-medium truncate">
                      {memory.title || '無題'}
                    </div>
                    <div className="text-xs text-white/40 mt-1">
                      {formatDate(memory.updatedAt)}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}




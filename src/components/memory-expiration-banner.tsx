'use client';

import { useState } from 'react';
import { Memory } from '@/types';
import { 
  isExpired, 
  getExpirationStatusText, 
  getExpirationWarningLevel,
  getDaysUntilExpiration 
} from '@/lib/expiration';
import { extendMemoryExpiration, canExtend, getExtensionInfo } from '@/lib/memory-extension';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Calendar, Clock } from 'lucide-react';

interface MemoryExpirationBannerProps {
  memory: Memory;
  userId: string;
  onExtended?: (updatedMemory: Memory) => void;
}

export function MemoryExpirationBanner({ 
  memory, 
  userId, 
  onExtended 
}: MemoryExpirationBannerProps) {
  const [isExtending, setIsExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const expired = isExpired(memory);
  const warningLevel = getExpirationWarningLevel(memory);
  const statusText = getExpirationStatusText(memory);
  const days = getDaysUntilExpiration(memory);
  const canExtendMemory = canExtend(memory);
  const extensionInfo = getExtensionInfo(memory);
  
  const handleExtend = async () => {
    if (!canExtendMemory) {
      setError('延長できません');
      return;
    }
    
    setIsExtending(true);
    setError(null);
    
    try {
      const updatedMemory = await extendMemoryExpiration(memory.id, userId);
      onExtended?.(updatedMemory);
    } catch (err) {
      setError(err instanceof Error ? err.message : '延長に失敗しました');
    } finally {
      setIsExtending(false);
    }
  };
  
  // 警告レベルに応じたスタイル
  const getBannerStyle = () => {
    switch (warningLevel) {
      case 'expired':
        return 'bg-red-500/20 border-red-500/50 text-red-200';
      case 'warning':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-200';
      default:
        return 'bg-blue-500/20 border-blue-500/50 text-blue-200';
    }
  };
  
  return (
    <Card className={`border ${getBannerStyle()}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1">
            {expired ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : warningLevel === 'warning' ? (
              <Clock className="w-5 h-5 text-yellow-400" />
            ) : (
              <Calendar className="w-5 h-5 text-blue-400" />
            )}
            <div className="flex-1">
              <div className="text-sm font-medium">
                {expired ? '利用期限が切れています' : '利用期限'}
              </div>
              <div className="text-xs opacity-80 mt-1">
                {statusText}
                {!expired && days > 0 && ` (${days}日)`}
              </div>
            </div>
          </div>
          
          {canExtendMemory && (
            <Button
              size="sm"
              onClick={handleExtend}
              disabled={true}
              className="shrink-0 bg-gray-500/50 text-gray-300 cursor-not-allowed"
              title="この機能は現在利用できません。CRMで管理してください。"
            >
              {`+${extensionInfo.extensionYears}年延長（申し込み）`}
            </Button>
          )}
        </div>
        
        {error && (
          <div className="mt-2 text-xs text-red-400">
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}


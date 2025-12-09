'use client';

import { useState } from 'react';
import { Memory } from '@/types';
import {
  getStorageLimit,
  getStorageUsed,
  getStorageRemaining,
  getStorageUsageRate,
  getStorageWarningLevel,
  formatStorageSize,
  checkStorageLimit as checkLimit,
} from '@/lib/storage-limit';
import {
  createStorageSubscription,
  getCurrentStoragePlan,
  getAvailableStoragePlans,
} from '@/lib/storage-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, HardDrive, TrendingUp } from 'lucide-react';

interface StorageLimitBannerProps {
  memory: Memory;
  userId: string;
  onExtended?: (updatedMemory: Memory) => void;
}

export function StorageLimitBanner({ 
  memory, 
  userId, 
  onExtended 
}: StorageLimitBannerProps) {
  const [isExtending, setIsExtending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const limit = getStorageLimit(memory);
  const used = getStorageUsed(memory);
  const remaining = getStorageRemaining(memory);
  const usageRate = getStorageUsageRate(memory);
  const warningLevel = getStorageWarningLevel(memory);
  const currentPlan = getCurrentStoragePlan(memory);
  const availablePlans = getAvailableStoragePlans(memory);
  
  const handleExtend = async () => {
    if (availablePlans.length === 0) {
      setError('利用可能な拡張プランがありません');
      return;
    }
    
    setIsExtending(true);
    setError(null);
    
    try {
      // 最初の利用可能なプランを選択
      const selectedPlan = availablePlans[0];
      const updatedMemory = await createStorageSubscription(
        memory.id,
        userId,
        selectedPlan.type
      );
      onExtended?.(updatedMemory);
    } catch (err) {
      setError(err instanceof Error ? err.message : '拡張に失敗しました');
    } finally {
      setIsExtending(false);
    }
  };
  
  // 警告レベルに応じたスタイル
  const getBannerStyle = () => {
    switch (warningLevel) {
      case 'over':
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
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1">
              {warningLevel === 'over' ? (
                <AlertCircle className="w-5 h-5 text-red-400" />
              ) : warningLevel === 'warning' ? (
                <TrendingUp className="w-5 h-5 text-yellow-400" />
              ) : (
                <HardDrive className="w-5 h-5 text-blue-400" />
              )}
              <div className="flex-1">
                <div className="text-sm font-medium">
                  {warningLevel === 'over' 
                    ? 'ストレージ制限を超過しています' 
                    : 'ストレージ使用量'}
                </div>
                <div className="text-xs opacity-80 mt-1">
                  {formatStorageSize(used)} / {formatStorageSize(limit)}
                  {warningLevel !== 'over' && ` (残り ${formatStorageSize(remaining)})`}
                </div>
              </div>
            </div>
            
            {availablePlans.length > 0 && (
              <Button
                size="sm"
                onClick={handleExtend}
                disabled={true}
                className="shrink-0 bg-gray-500/50 text-gray-300 cursor-not-allowed"
                title="この機能は現在利用できません。CRMで管理してください。"
              >
                {`拡張 (${availablePlans[0].price}円/月) 申し込み`}
              </Button>
            )}
          </div>
          
          {/* プログレスバー */}
          <div className="w-full bg-white/10 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all ${
                warningLevel === 'over'
                  ? 'bg-red-500'
                  : warningLevel === 'warning'
                  ? 'bg-yellow-500'
                  : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, usageRate)}%` }}
            />
          </div>
          
          {error && (
            <div className="text-xs text-red-400">
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}


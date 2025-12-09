import { Memory } from '@/types';

/**
 * デフォルトストレージ制限（120MB）
 */
export const DEFAULT_STORAGE_LIMIT = 120 * 1024 * 1024; // 120MB in bytes

/**
 * ストレージ拡張プラン
 */
export const STORAGE_PLANS = {
  default: {
    limit: DEFAULT_STORAGE_LIMIT,
    price: 0,
    name: '標準プラン',
  },
  extended: {
    limit: 200 * 1024 * 1024, // 200MB
    price: 200, // 月額200円
    name: '拡張プラン',
  },
} as const;

/**
 * ストレージ制限を取得
 * @param memory Memoryオブジェクト
 * @returns ストレージ制限（バイト単位）
 */
export function getStorageLimit(memory: Memory): number {
  return memory.storageLimit || DEFAULT_STORAGE_LIMIT;
}

/**
 * ストレージ使用量を取得
 * @param memory Memoryオブジェクト
 * @returns ストレージ使用量（バイト単位）
 */
export function getStorageUsed(memory: Memory): number {
  return memory.storageUsed || 0;
}

/**
 * ストレージの残り容量を取得
 * @param memory Memoryオブジェクト
 * @returns 残り容量（バイト単位）
 */
export function getStorageRemaining(memory: Memory): number {
  const limit = getStorageLimit(memory);
  const used = getStorageUsed(memory);
  return Math.max(0, limit - used);
}

/**
 * ストレージ使用率を取得
 * @param memory Memoryオブジェクト
 * @returns 使用率（0-100）
 */
export function getStorageUsageRate(memory: Memory): number {
  const limit = getStorageLimit(memory);
  const used = getStorageUsed(memory);
  if (limit === 0) return 0;
  return Math.min(100, (used / limit) * 100);
}

/**
 * ストレージ制限チェック
 * @param memory Memoryオブジェクト
 * @param additionalSize 追加しようとしているファイルサイズ（バイト単位）
 * @returns チェック結果
 */
export function checkStorageLimit(
  memory: Memory,
  additionalSize: number
): {
  allowed: boolean;
  currentUsed: number;
  limit: number;
  remaining: number;
  newTotal: number;
} {
  const limit = getStorageLimit(memory);
  const currentUsed = getStorageUsed(memory);
  const newTotal = currentUsed + additionalSize;
  
  return {
    allowed: newTotal <= limit,
    currentUsed,
    limit,
    remaining: Math.max(0, limit - currentUsed),
    newTotal,
  };
}

/**
 * ストレージ使用量を人間が読める形式で取得
 * @param bytes バイト数
 * @returns フォーマットされた文字列（例: "50.5 MB"）
 */
export function formatStorageSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

/**
 * ストレージ警告レベルを取得
 * @param memory Memoryオブジェクト
 * @returns 'over' | 'warning' | 'normal'
 */
export function getStorageWarningLevel(memory: Memory): 'over' | 'warning' | 'normal' {
  const usageRate = getStorageUsageRate(memory);
  
  if (usageRate >= 100) {
    return 'over';
  }
  
  if (usageRate >= 80) {
    return 'warning';
  }
  
  return 'normal';
}


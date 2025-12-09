import { Memory } from '@/types';

/**
 * 利用期限の基本年数（20年）
 */
export const BASE_EXPIRATION_YEARS = 20;

/**
 * 延長年数（10年）
 */
export const EXTENSION_YEARS = 10;

/**
 * 利用期限を計算する
 * @param createdAt 作成日時
 * @param extensionCount 延長回数（デフォルト: 0）
 * @returns 有効期限の日時
 */
export function calculateExpirationDate(
  createdAt: Date,
  extensionCount: number = 0
): Date {
  const totalYears = BASE_EXPIRATION_YEARS + (extensionCount * EXTENSION_YEARS);
  const expirationDate = new Date(createdAt);
  expirationDate.setFullYear(expirationDate.getFullYear() + totalYears);
  return expirationDate;
}

/**
 * 利用期限を取得する（expiresAtが設定されていない場合は計算）
 * @param memory Memoryオブジェクト
 * @returns 有効期限の日時
 */
export function getExpirationDate(memory: Memory): Date {
  if (memory.expiresAt) {
    return memory.expiresAt instanceof Date 
      ? memory.expiresAt 
      : new Date(memory.expiresAt);
  }
  
  // 既存データの互換性: expiresAtがない場合は計算
  const createdAt = memory.createdAt instanceof Date 
    ? memory.createdAt 
    : new Date(memory.createdAt);
  const extensionCount = memory.extensionCount || 0;
  return calculateExpirationDate(createdAt, extensionCount);
}

/**
 * 利用期限が切れているかチェック
 * @param memory Memoryオブジェクト
 * @returns 期限切れの場合はtrue
 */
export function isExpired(memory: Memory): boolean {
  const expiresAt = getExpirationDate(memory);
  return expiresAt < new Date();
}

/**
 * 残り日数を計算
 * @param memory Memoryオブジェクト
 * @returns 残り日数（負の値の場合は期限切れ）
 */
export function getDaysUntilExpiration(memory: Memory): number {
  const expiresAt = getExpirationDate(memory);
  const now = new Date();
  const diffTime = expiresAt.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

/**
 * 残り日数を人間が読める形式で取得
 * @param memory Memoryオブジェクト
 * @returns 残り日数の文字列（例: "365日"、"期限切れ"）
 */
export function getExpirationStatusText(memory: Memory): string {
  const days = getDaysUntilExpiration(memory);
  
  if (days < 0) {
    return '期限切れ';
  }
  
  if (days === 0) {
    return '本日期限';
  }
  
  if (days < 30) {
    return `あと${days}日`;
  }
  
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `あと約${months}ヶ月`;
  }
  
  const years = Math.floor(days / 365);
  const remainingDays = days % 365;
  if (remainingDays === 0) {
    return `あと${years}年`;
  }
  return `あと約${years}年`;
}

/**
 * 利用期限の警告レベルを取得
 * @param memory Memoryオブジェクト
 * @returns 'expired' | 'warning' | 'normal'
 */
export function getExpirationWarningLevel(memory: Memory): 'expired' | 'warning' | 'normal' {
  const days = getDaysUntilExpiration(memory);
  
  if (days < 0) {
    return 'expired';
  }
  
  if (days <= 30) {
    return 'warning';
  }
  
  return 'normal';
}


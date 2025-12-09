import { getMemoryById, updateMemory } from './firestore';
import { calculateExpirationDate, EXTENSION_YEARS } from './expiration';
import { Memory } from '@/types';

/**
 * 利用期限を延長する
 * @param memoryId Memory ID
 * @param userId ユーザーID（認証確認用）
 * @returns 更新されたMemoryオブジェクト
 */
export async function extendMemoryExpiration(
  memoryId: string,
  userId: string
): Promise<Memory> {
  // Memoryを取得
  const memory = await getMemoryById(memoryId);
  if (!memory) {
    throw new Error('Memory not found');
  }
  
  // 所有者確認
  if (memory.ownerUid !== userId) {
    throw new Error('Access denied: You are not the owner of this memory');
  }
  
  // 現在の延長回数を取得
  const currentExtensionCount = memory.extensionCount || 0;
  const newExtensionCount = currentExtensionCount + 1;
  
  // 新しい有効期限を計算
  const createdAt = memory.createdAt instanceof Date 
    ? memory.createdAt 
    : new Date(memory.createdAt);
  const newExpiresAt = calculateExpirationDate(createdAt, newExtensionCount);
  
  // Firestoreを更新
  await updateMemory(memoryId, {
    extensionCount: newExtensionCount,
    expiresAt: newExpiresAt,
    lastExtendedAt: new Date(),
  }, false);
  
  // 更新されたMemoryを返す
  const updatedMemory = await getMemoryById(memoryId);
  if (!updatedMemory) {
    throw new Error('Failed to retrieve updated memory');
  }
  
  return updatedMemory;
}

/**
 * 延長可能かどうかをチェック
 * @param memory Memoryオブジェクト
 * @returns 延長可能な場合はtrue
 */
export function canExtend(memory: Memory): boolean {
  // 将来的に延長回数の上限を設ける場合はここでチェック
  // 現時点では制限なし
  return true;
}

/**
 * 延長に必要な情報を取得
 * @param memory Memoryオブジェクト
 * @returns 延長情報
 */
export function getExtensionInfo(memory: Memory) {
  const currentExtensionCount = memory.extensionCount || 0;
  const nextExtensionCount = currentExtensionCount + 1;
  
  return {
    currentExtensionCount,
    nextExtensionCount,
    extensionYears: EXTENSION_YEARS,
    // TODO: Stripe統合時に決済情報を追加
  };
}


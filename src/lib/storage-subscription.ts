import { getMemoryById, updateMemory } from './firestore';
import { STORAGE_PLANS, DEFAULT_STORAGE_LIMIT } from './storage-limit';
import { Memory } from '@/types';

/**
 * ストレージ拡張プランのタイプ
 */
export type StoragePlanType = keyof typeof STORAGE_PLANS;

/**
 * ストレージ拡張サブスクリプションを作成（Stripe統合前は手動）
 * @param memoryId Memory ID
 * @param userId ユーザーID（認証確認用）
 * @param plan 拡張プランタイプ
 * @returns 更新されたMemoryオブジェクト
 */
export async function createStorageSubscription(
  memoryId: string,
  userId: string,
  plan: StoragePlanType = 'extended'
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
  
  // プラン情報を取得
  const selectedPlan = STORAGE_PLANS[plan];
  if (!selectedPlan) {
    throw new Error(`Invalid plan: ${plan}`);
  }
  
  // TODO: Stripeサブスクリプション作成処理を追加（後日実装）
  // const stripeSubscription = await createStripeSubscription(...);
  
  // Firestoreを更新
  await updateMemory(memoryId, {
    storageLimit: selectedPlan.limit,
    storageSubscriptionStatus: 'active',
    // storageSubscriptionId: stripeSubscription.id, // Stripe統合時に追加
  }, false);
  
  // 更新されたMemoryを返す
  const updatedMemory = await getMemoryById(memoryId);
  if (!updatedMemory) {
    throw new Error('Failed to retrieve updated memory');
  }
  
  return updatedMemory;
}

/**
 * ストレージ拡張サブスクリプションをキャンセル
 * @param memoryId Memory ID
 * @param userId ユーザーID（認証確認用）
 * @returns 更新されたMemoryオブジェクト
 */
export async function cancelStorageSubscription(
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
  
  // TODO: Stripeサブスクリプションキャンセル処理を追加（後日実装）
  // await cancelStripeSubscription(memory.storageSubscriptionId);
  
  // Firestoreを更新（デフォルト制限に戻す）
  await updateMemory(memoryId, {
    storageLimit: DEFAULT_STORAGE_LIMIT,
    storageSubscriptionStatus: 'canceled',
  }, false);
  
  // 更新されたMemoryを返す
  const updatedMemory = await getMemoryById(memoryId);
  if (!updatedMemory) {
    throw new Error('Failed to retrieve updated memory');
  }
  
  return updatedMemory;
}

/**
 * 現在のストレージプランを取得
 * @param memory Memoryオブジェクト
 * @returns 現在のプラン情報
 */
export function getCurrentStoragePlan(memory: Memory) {
  const limit = memory.storageLimit || DEFAULT_STORAGE_LIMIT;
  
  // プランを逆引き
  for (const [planType, plan] of Object.entries(STORAGE_PLANS)) {
    if (plan.limit === limit) {
      return {
        type: planType as StoragePlanType,
        ...plan,
      };
    }
  }
  
  // デフォルトプランを返す
  return {
    type: 'default' as StoragePlanType,
    ...STORAGE_PLANS.default,
  };
}

/**
 * 利用可能な拡張プランを取得
 * @param memory Memoryオブジェクト
 * @returns 利用可能なプランのリスト
 */
export function getAvailableStoragePlans(memory: Memory) {
  const currentPlan = getCurrentStoragePlan(memory);
  
  // 現在のプランより大きいプランのみを返す
  return Object.entries(STORAGE_PLANS)
    .filter(([_, plan]) => plan.limit > currentPlan.limit)
    .map(([type, plan]) => ({
      type: type as StoragePlanType,
      ...plan,
    }));
}


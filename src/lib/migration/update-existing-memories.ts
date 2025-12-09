import { collection, getDocs, updateDoc, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Memory } from '@/types';
import { calculateExpirationDate } from '../expiration';
import { DEFAULT_STORAGE_LIMIT } from '../storage-limit';

/**
 * 既存のMemoryデータにexpiresAtとstorageLimitを設定
 * 注意: この関数は管理者権限が必要です
 */
export async function migrateExistingMemories(): Promise<{
  success: number;
  failed: number;
  errors: string[];
}> {
  const errors: string[] = [];
  let success = 0;
  let failed = 0;

  try {
    // すべてのMemoryを取得
    const memoriesRef = collection(db, 'memories');
    const snapshot = await getDocs(memoriesRef);

    console.log(`Found ${snapshot.size} memories to migrate`);

    for (const docSnap of snapshot.docs) {
      try {
        const data = docSnap.data();
        const memory = {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        } as Memory;

        const updates: Partial<Memory> = {};

        // expiresAtが未設定の場合は計算
        if (!memory.expiresAt) {
          const createdAt = memory.createdAt instanceof Date 
            ? memory.createdAt 
            : new Date(memory.createdAt);
          const extensionCount = memory.extensionCount || 0;
          updates.expiresAt = calculateExpirationDate(createdAt, extensionCount);
          console.log(`Setting expiresAt for memory ${memory.id}: ${updates.expiresAt}`);
        }

        // storageLimitが未設定の場合はデフォルト値
        if (!memory.storageLimit) {
          updates.storageLimit = DEFAULT_STORAGE_LIMIT;
          console.log(`Setting storageLimit for memory ${memory.id}: ${updates.storageLimit}`);
        }

        // 更新がある場合のみFirestoreを更新
        if (Object.keys(updates).length > 0) {
          const memoryRef = doc(db, 'memories', memory.id);
          await updateDoc(memoryRef, {
            ...updates,
            updatedAt: new Date(),
          });
          success++;
          console.log(`✅ Migrated memory ${memory.id}`);
        } else {
          console.log(`⏭️  Memory ${memory.id} already has all required fields`);
        }
      } catch (error) {
        failed++;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Memory ${docSnap.id}: ${errorMessage}`);
        console.error(`❌ Failed to migrate memory ${docSnap.id}:`, error);
      }
    }

    return { success, failed, errors };
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

/**
 * 特定のMemoryを移行
 */
export async function migrateSingleMemory(memoryId: string): Promise<void> {
  const memoryRef = doc(db, 'memories', memoryId);
  const memoryDoc = await getDoc(memoryRef);

  if (!memoryDoc.exists()) {
    throw new Error(`Memory ${memoryId} not found`);
  }

  const data = memoryDoc.data();
  const memory = {
    id: memoryDoc.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Memory;

  const updates: Partial<Memory> = {};

  // expiresAtが未設定の場合は計算
  if (!memory.expiresAt) {
    const createdAt = memory.createdAt instanceof Date 
      ? memory.createdAt 
      : new Date(memory.createdAt);
    const extensionCount = memory.extensionCount || 0;
    updates.expiresAt = calculateExpirationDate(createdAt, extensionCount);
  }

  // storageLimitが未設定の場合はデフォルト値
  if (!memory.storageLimit) {
    updates.storageLimit = DEFAULT_STORAGE_LIMIT;
  }

  // 更新がある場合のみFirestoreを更新
  if (Object.keys(updates).length > 0) {
    await updateDoc(memoryRef, {
      ...updates,
      updatedAt: new Date(),
    });
  }
}


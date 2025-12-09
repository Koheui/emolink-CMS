/**
 * 広告バナー管理用のFirestore関数
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from './firebase';
import { Advertisement } from '@/types';

/**
 * テナントIDに紐付いた有効な広告バナーを取得
 * @param tenantId テナントID
 * @param location 表示場所（'cms' | 'lp' | 'both'）
 * @returns 広告バナーの配列
 */
export async function getActiveAdvertisements(
  tenantId: string,
  location: 'cms' | 'lp' | 'both' = 'both'
): Promise<Advertisement[]> {
  const advertisementsRef = collection(db, 'advertisements');
  
  // テナントIDとisActiveでフィルタ
  let q;
  if (location === 'both') {
    q = query(
      advertisementsRef,
      where('tenant', '==', tenantId),
      where('isActive', '==', true),
      orderBy('displayOrder', 'asc'),
      limit(10) // 最大10件まで取得
    );
  } else {
    // displayLocationが'both'または指定されたlocationと一致するものを取得
    // 注意: Firestoreのwhere句ではOR条件が使えないため、クライアント側でフィルタリング
    q = query(
      advertisementsRef,
      where('tenant', '==', tenantId),
      where('isActive', '==', true),
      orderBy('displayOrder', 'asc'),
      limit(20) // フィルタリング用に多めに取得
    );
  }
  
  try {
    const snapshot = await getDocs(q);
    const advertisements: Advertisement[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      const ad: Advertisement = {
        id: doc.id,
        tenant: data.tenant,
        title: data.title,
        imageUrl: data.imageUrl,
        linkUrl: data.linkUrl,
        displayOrder: data.displayOrder || 0,
        isActive: data.isActive !== false, // デフォルトはtrue
        displayLocation: data.displayLocation || 'both',
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      };
      
      // 表示場所でフィルタリング（クライアント側）
      if (location === 'both' || ad.displayLocation === 'both' || ad.displayLocation === location) {
        advertisements.push(ad);
      }
    });
    
    // displayOrderでソート（念のため）
    return advertisements.sort((a, b) => a.displayOrder - b.displayOrder);
  } catch (error: any) {
    // インデックスエラーの場合、orderByを削除して再試行
    if (
      error.code === 'failed-precondition' ||
      (error.message &&
        (error.message.includes('index') || error.message.includes('requires an index')))
    ) {
      console.warn('Index error detected, retrying without orderBy...');
      const qWithoutOrderBy = query(
        advertisementsRef,
        where('tenant', '==', tenantId),
        where('isActive', '==', true),
        limit(20)
      );
      const snapshot = await getDocs(qWithoutOrderBy);
      const advertisements: Advertisement[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const ad: Advertisement = {
          id: doc.id,
          tenant: data.tenant,
          title: data.title,
          imageUrl: data.imageUrl,
          linkUrl: data.linkUrl,
          displayOrder: data.displayOrder || 0,
          isActive: data.isActive !== false,
          displayLocation: data.displayLocation || 'both',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
        
        if (location === 'both' || ad.displayLocation === 'both' || ad.displayLocation === location) {
          advertisements.push(ad);
        }
      });
      
      // クライアント側でソート
      return advertisements.sort((a, b) => a.displayOrder - b.displayOrder);
    }
    console.error('Error fetching advertisements:', error);
    throw error;
  }
}

/**
 * 広告バナーを作成
 * @param advertisement 広告バナーのデータ
 * @returns 作成された広告バナーのID
 */
export async function createAdvertisement(
  advertisement: Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> {
  const advertisementsRef = collection(db, 'advertisements');
  const now = new Date();
  
  const docRef = await addDoc(advertisementsRef, {
    ...advertisement,
    createdAt: now,
    updatedAt: now,
  });
  
  return docRef.id;
}

/**
 * 広告バナーを更新
 * @param advertisementId 広告バナーのID
 * @param updates 更新するデータ
 */
export async function updateAdvertisement(
  advertisementId: string,
  updates: Partial<Omit<Advertisement, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<void> {
  const advertisementRef = doc(db, 'advertisements', advertisementId);
  await updateDoc(advertisementRef, {
    ...updates,
    updatedAt: new Date(),
  });
}

/**
 * 広告バナーを削除
 * @param advertisementId 広告バナーのID
 */
export async function deleteAdvertisement(advertisementId: string): Promise<void> {
  const advertisementRef = doc(db, 'advertisements', advertisementId);
  await deleteDoc(advertisementRef);
}

/**
 * 特定の広告バナーを取得
 * @param advertisementId 広告バナーのID
 * @returns 広告バナー（存在しない場合はnull）
 */
export async function getAdvertisement(advertisementId: string): Promise<Advertisement | null> {
  const advertisementRef = doc(db, 'advertisements', advertisementId);
  const snapshot = await getDoc(advertisementRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  const data = snapshot.data();
  return {
    id: snapshot.id,
    tenant: data.tenant,
    title: data.title,
    imageUrl: data.imageUrl,
    linkUrl: data.linkUrl,
    displayOrder: data.displayOrder || 0,
    isActive: data.isActive !== false,
    displayLocation: data.displayLocation || 'both',
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Advertisement;
}


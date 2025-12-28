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
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { ref, deleteObject, listAll } from 'firebase/storage';
import { db, storage } from './firebase';
import { Memory, Asset, PublicPage, ClaimRequest, Order, AcrylicPhoto, ShippingInfo, Staff, User } from '@/types';
import { getCurrentTenant } from './security/tenant-validation';

// Memories
export const memoriesCollection = collection(db, 'memories');

export async function getMemoriesByUser(ownerUid: string, filterByTenant: boolean = false): Promise<Memory[]> {
  console.log('=== getMemoriesByUser ===');
  console.log('ownerUid:', ownerUid);
  console.log('filterByTenant:', filterByTenant);
  
  if (!ownerUid) {
    console.warn('ownerUid is empty, returning empty array');
    return [];
  }
  
  // エンドユーザーは自分のすべての想い出ページを表示できるようにする
  // filterByTenantがtrueの場合のみテナントでフィルタリング（管理者向け）
  const currentTenant = getCurrentTenant();
  console.log('currentTenant:', currentTenant);
  
  let q;
  if (filterByTenant) {
    q = query(
      memoriesCollection,
      where('ownerUid', '==', ownerUid),
      where('tenant', '==', currentTenant), // テナントフィルタリング（管理者向け）
      orderBy('updatedAt', 'desc')
    );
  } else {
    // エンドユーザーは自分のすべての想い出ページを取得（テナント問わず）
    q = query(
      memoriesCollection,
      where('ownerUid', '==', ownerUid),
      orderBy('updatedAt', 'desc')
    );
  }
  
  console.log('Executing Firestore query...');
  try {
    const snapshot = await getDocs(q);
    console.log('Query result:', {
      size: snapshot.size,
      docs: snapshot.docs.map(doc => ({
        id: doc.id,
        ownerUid: doc.data().ownerUid,
        title: doc.data().title,
        tenant: doc.data().tenant,
      }))
    });
    
    const memories = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Memory[];
    
    console.log('Returning memories:', memories.length);
    return memories;
  } catch (error: any) {
    // インデックスエラーの場合、orderByを削除して再試行
    // FirebaseErrorのcodeは'failed-precondition'で、messageに'index'が含まれる
    const isIndexError = error.code === 'failed-precondition' || 
                        (error.message && (error.message.includes('index') || error.message.includes('requires an index')));
    if (isIndexError) {
      console.warn('Index error detected, retrying without orderBy...');
      try {
        let qWithoutOrderBy;
        if (filterByTenant) {
          qWithoutOrderBy = query(
            memoriesCollection,
            where('ownerUid', '==', ownerUid),
            where('tenant', '==', currentTenant)
          );
        } else {
          qWithoutOrderBy = query(
            memoriesCollection,
            where('ownerUid', '==', ownerUid)
          );
        }
        const snapshot = await getDocs(qWithoutOrderBy);
        const memories = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          createdAt: doc.data().createdAt?.toDate() || new Date(),
          updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        })) as Memory[];
        // updatedAtでソート（クライアント側）
        memories.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
        console.log('Returning memories (without orderBy):', memories.length);
        return memories;
      } catch (retryError: any) {
        console.error('Failed to fetch memories even without orderBy:', retryError);
        throw retryError;
      }
    }
    throw error;
  }
}

export async function getMemoryById(memoryId: string, skipTenantCheck: boolean = false): Promise<Memory | null> {
  console.log('=== getMemoryById ===');
  console.log('Memory ID:', memoryId);
  console.log('skipTenantCheck:', skipTenantCheck);
  
  const docRef = doc(db, 'memories', memoryId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    console.log('Memory document does not exist');
    return null;
  }
  
  const data = docSnap.data();
  console.log('=== getMemoryById: Firestore data ===');
  console.log('Memory ID:', memoryId);
  console.log('Owner UID:', data.ownerUid);
  console.log('Tenant:', data.tenant);
  console.log('Has blocks field:', 'blocks' in data);
  console.log('Blocks value:', data.blocks);
  console.log('Blocks type:', typeof data.blocks);
  console.log('Blocks is array:', Array.isArray(data.blocks));
  if (Array.isArray(data.blocks)) {
    console.log('Blocks count:', data.blocks.length);
    console.log('Blocks with URLs:', data.blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
  }
  
  const memory = {
    id: docSnap.id,
    ...data,
    createdAt: data.createdAt?.toDate() || new Date(),
    updatedAt: data.updatedAt?.toDate() || new Date(),
  } as Memory;
  
  console.log('Memory object blocks:', memory.blocks);
  console.log('Memory object blocks type:', typeof memory.blocks);
  console.log('Memory object blocks is array:', Array.isArray(memory.blocks));
  
  // テナント検証（エンドユーザーは自分のmemoryであればテナント問わずアクセス可能）
  if (!skipTenantCheck) {
    const currentTenant = getCurrentTenant();
    console.log('Tenant check:', { memoryTenant: memory.tenant, currentTenant });
    if (memory.tenant !== currentTenant) {
      console.error('Access denied: Tenant mismatch');
      throw new Error('Access denied: Tenant mismatch');
    }
  }
  
  return memory;
}

export async function createMemory(memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const currentTenant = getCurrentTenant();
  
  // テナント情報を必ず設定（データ分離のため必須）
  const memoryData = {
    ...memory,
    tenant: memory.tenant || currentTenant, // テナント情報を自動設定（既に設定されている場合は上書きしない）
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  
  // テナントが設定されていない場合はエラー
  if (!memoryData.tenant) {
    throw new Error('Tenant is required for data isolation');
  }
  
  const docRef = await addDoc(memoriesCollection, memoryData);
  
  return docRef.id;
}

export async function updateMemory(memoryId: string, updates: Partial<Memory>, skipTenantCheck: boolean = false): Promise<void> {
  const docRef = doc(db, 'memories', memoryId);
  
  console.log('=== updateMemory: Updating memory ===');
  console.log('Memory ID:', memoryId);
  console.log('Updates keys:', Object.keys(updates));
  console.log('Has blocks in updates:', 'blocks' in updates);
  if ('blocks' in updates) {
    console.log('Blocks value:', updates.blocks);
    console.log('Blocks type:', typeof updates.blocks);
    console.log('Blocks is array:', Array.isArray(updates.blocks));
    if (Array.isArray(updates.blocks)) {
      console.log('Blocks count:', updates.blocks.length);
      console.log('Blocks with URLs:', updates.blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
    }
  }
  
  // 既存データのテナント検証（エンドユーザーは自分のmemoryであればテナント問わず更新可能）
  if (!skipTenantCheck) {
    const existingDoc = await getDoc(docRef);
    if (existingDoc.exists()) {
      const currentTenant = getCurrentTenant();
      if (existingDoc.data().tenant !== currentTenant) {
        throw new Error('Access denied: Tenant mismatch');
      }
    }
  }
  
  // undefinedの値を除外するヘルパー関数
  const removeUndefined = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return null;
    }
    if (Array.isArray(obj)) {
      return obj.map(item => removeUndefined(item));
    }
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = removeUndefined(obj[key]);
        }
      }
      return cleaned;
    }
    return obj;
  };
  
  // undefinedの値を除外
  const cleanedUpdates = removeUndefined(updates);
  
  console.log('=== updateMemory: Calling updateDoc ===');
  console.log('Updates to save:', {
    ...cleanedUpdates,
    blocks: cleanedUpdates.blocks ? (Array.isArray(cleanedUpdates.blocks) ? `${cleanedUpdates.blocks.length} blocks` : 'not an array') : 'not in updates'
  });
  
  await updateDoc(docRef, {
    ...cleanedUpdates,
    updatedAt: serverTimestamp(),
  });
  
  // 保存後に実際に保存されたデータを確認
  const savedDoc = await getDoc(docRef);
  if (savedDoc.exists()) {
    const savedData = savedDoc.data();
    console.log('=== updateMemory: Verification after save ===');
    console.log('Saved blocks:', savedData.blocks);
    console.log('Saved blocks type:', typeof savedData.blocks);
    console.log('Saved blocks is array:', Array.isArray(savedData.blocks));
    if (Array.isArray(savedData.blocks)) {
      console.log('Saved blocks count:', savedData.blocks.length);
      console.log('Saved blocks with URLs:', savedData.blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
    }
  }
  
  console.log('=== updateMemory: Update completed ===');
}

export async function deleteMemory(memoryId: string, skipTenantCheck: boolean = false): Promise<void> {
  console.log('=== deleteMemory ===');
  console.log('Memory ID:', memoryId);
  console.log('skipTenantCheck:', skipTenantCheck);
  
  const docRef = doc(db, 'memories', memoryId);
  
  // 既存データのテナント検証（エンドユーザーは自分のmemoryであればテナント問わず削除可能）
  let memoryData: any = null;
  if (!skipTenantCheck) {
    const existingDoc = await getDoc(docRef);
    if (existingDoc.exists()) {
      memoryData = existingDoc.data();
      const currentTenant = getCurrentTenant();
      if (memoryData.tenant !== currentTenant) {
        throw new Error('Access denied: Tenant mismatch');
      }
    }
  } else {
    // skipTenantCheckがtrueの場合でも、メモリデータを取得して関連データを削除する必要がある
    const existingDoc = await getDoc(docRef);
    if (existingDoc.exists()) {
      memoryData = existingDoc.data();
    }
  }
  
  // 関連データの削除
  if (memoryData) {
    // 1. 公開ページの削除
    if (memoryData.publicPageId) {
      try {
        const publicPageRef = doc(db, 'publicPages', memoryData.publicPageId);
        const publicPageDoc = await getDoc(publicPageRef);
        if (publicPageDoc.exists()) {
          console.log('Deleting public page:', memoryData.publicPageId);
          await deleteDoc(publicPageRef);
          console.log('Public page deleted successfully');
        }
      } catch (error: any) {
        console.error('Error deleting public page:', error);
        // 公開ページの削除に失敗しても、メモリの削除は続行
      }
    }
    
    // 2. memoryIdで関連する公開ページを検索して削除（publicPageIdが設定されていない場合のフォールバック）
    try {
      const publicPagesQuery = query(
        publicPagesCollection,
        where('memoryId', '==', memoryId)
      );
      const publicPagesSnapshot = await getDocs(publicPagesQuery);
      for (const publicPageDoc of publicPagesSnapshot.docs) {
        console.log('Deleting public page by memoryId:', publicPageDoc.id);
        await deleteDoc(doc(db, 'publicPages', publicPageDoc.id));
      }
      if (!publicPagesSnapshot.empty) {
        console.log(`Deleted ${publicPagesSnapshot.docs.length} public page(s) by memoryId`);
      }
    } catch (error: any) {
      console.error('Error deleting public pages by memoryId:', error);
      // 公開ページの削除に失敗しても、メモリの削除は続行
    }
    
    // 3. アセットの削除とストレージファイルの削除
    try {
      const assetsQuery = query(
        assetsCollection,
        where('memoryId', '==', memoryId)
      );
      const assetsSnapshot = await getDocs(assetsQuery);
      for (const assetDoc of assetsSnapshot.docs) {
        const assetData = assetDoc.data();
        console.log('Deleting asset:', assetDoc.id);
        
        // ストレージファイルの削除
        if (assetData.storagePath) {
          try {
            const storageRef = ref(storage, assetData.storagePath);
            await deleteObject(storageRef);
            console.log('Storage file deleted:', assetData.storagePath);
          } catch (storageError: any) {
            console.error('Error deleting storage file:', storageError);
            // ストレージファイルの削除に失敗しても、アセットの削除は続行
          }
        }
        
        // アセットドキュメントの削除
        await deleteDoc(doc(db, 'assets', assetDoc.id));
      }
      if (!assetsSnapshot.empty) {
        console.log(`Deleted ${assetsSnapshot.docs.length} asset(s)`);
      }
    } catch (error: any) {
      console.error('Error deleting assets:', error);
      // アセットの削除に失敗しても、メモリの削除は続行
    }
    
    // 4. メモリのblocksに含まれるストレージファイルの削除
    // blocksからURLを抽出して、ストレージパスを取得して削除
    try {
      if (memoryData.blocks && Array.isArray(memoryData.blocks)) {
        const blocks = memoryData.blocks;
        for (const block of blocks) {
          // ブロックにURLがある場合、ストレージから削除を試みる
          if (block.url && typeof block.url === 'string') {
            try {
              // Firebase StorageのURLからパスを抽出
              // URL形式: https://firebasestorage.googleapis.com/v0/b/{bucket}/o/{encodedPath}?alt=media
              const urlMatch = block.url.match(/\/o\/([^?]+)/);
              if (urlMatch) {
                const encodedPath = urlMatch[1];
                const storagePath = decodeURIComponent(encodedPath);
                const storageRef = ref(storage, storagePath);
                await deleteObject(storageRef);
                console.log('Storage file deleted from block:', storagePath);
              }
            } catch (storageError: any) {
              console.error('Error deleting storage file from block:', storageError);
              // ストレージファイルの削除に失敗しても、続行
            }
          }
          
          // アルバムアイテムのストレージファイルも削除
          if (block.albumItems && Array.isArray(block.albumItems)) {
            for (const item of block.albumItems) {
              if (item.url && typeof item.url === 'string') {
                try {
                  const urlMatch = item.url.match(/\/o\/([^?]+)/);
                  if (urlMatch) {
                    const encodedPath = urlMatch[1];
                    const storagePath = decodeURIComponent(encodedPath);
                    const storageRef = ref(storage, storagePath);
                    await deleteObject(storageRef);
                    console.log('Storage file deleted from album item:', storagePath);
                  }
                } catch (storageError: any) {
                  console.error('Error deleting storage file from album item:', storageError);
                  // ストレージファイルの削除に失敗しても、続行
                }
              }
            }
          }
        }
      }
      
      // カバー画像とプロフィール画像の削除
      if (memoryData.coverImage && typeof memoryData.coverImage === 'string') {
        try {
          const urlMatch = memoryData.coverImage.match(/\/o\/([^?]+)/);
          if (urlMatch) {
            const encodedPath = urlMatch[1];
            const storagePath = decodeURIComponent(encodedPath);
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            console.log('Cover image deleted:', storagePath);
          }
        } catch (storageError: any) {
          console.error('Error deleting cover image:', storageError);
        }
      }
      
      if (memoryData.profileImage && typeof memoryData.profileImage === 'string') {
        try {
          const urlMatch = memoryData.profileImage.match(/\/o\/([^?]+)/);
          if (urlMatch) {
            const encodedPath = urlMatch[1];
            const storagePath = decodeURIComponent(encodedPath);
            const storageRef = ref(storage, storagePath);
            await deleteObject(storageRef);
            console.log('Profile image deleted:', storagePath);
          }
        } catch (storageError: any) {
          console.error('Error deleting profile image:', storageError);
        }
      }
    } catch (error: any) {
      console.error('Error deleting storage files from blocks:', error);
      // ストレージファイルの削除に失敗しても、メモリの削除は続行
    }
  }
  
  // 5. メモリドキュメントの削除
  console.log('Deleting memory document...');
  await deleteDoc(docRef);
  console.log('Memory deleted successfully');
}

// Assets
export const assetsCollection = collection(db, 'assets');

export async function getAssetsByMemory(memoryId: string): Promise<Asset[]> {
  const q = query(
    assetsCollection,
    where('memoryId', '==', memoryId),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Asset[];
}

export async function createAsset(asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(assetsCollection, {
    ...asset,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

export async function updateAsset(assetId: string, updates: Partial<Asset>): Promise<void> {
  const docRef = doc(db, 'assets', assetId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteAsset(assetId: string): Promise<void> {
  const docRef = doc(db, 'assets', assetId);
  await deleteDoc(docRef);
}

// Public Pages
export const publicPagesCollection = collection(db, 'publicPages');

export async function getPublicPageById(pageId: string, skipTenantCheck: boolean = true): Promise<PublicPage | null> {
  const docRef = doc(db, 'publicPages', pageId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const page = {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
  } as PublicPage;
  
  // 公開ページは誰でもアクセスできるため、テナント検証は行わない（skipTenantCheck=trueがデフォルト）
  // 書き込み時のみテナント検証を行う（updatePublicPage関数で実装）
  
  return page;
}

export async function createPublicPage(page: Omit<PublicPage, 'id' | 'createdAt' | 'updatedAt'>, ownerUid?: string): Promise<string> {
  const currentTenant = getCurrentTenant();
  
  // undefinedを削除してFirestoreに保存できるようにする
  const cleanPage: any = {};
  for (const [key, value] of Object.entries(page)) {
    if (value !== undefined) {
      if (key === 'media' && typeof value === 'object' && value !== null) {
        // mediaオブジェクトのundefinedを削除
        const cleanMedia: any = {};
        if ((value as any).cover !== undefined) cleanMedia.cover = (value as any).cover || null;
        if ((value as any).profile !== undefined) cleanMedia.profile = (value as any).profile || null;
        if (Object.keys(cleanMedia).length > 0) {
          cleanPage[key] = cleanMedia;
        }
      } else {
        cleanPage[key] = value;
      }
    }
  }
  
  // ownerUidが提供されている場合は設定
  if (ownerUid) {
    cleanPage.ownerUid = ownerUid;
  }
  
  const docRef = await addDoc(publicPagesCollection, {
    ...cleanPage,
    tenant: currentTenant, // テナント情報を自動設定
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

export async function updatePublicPage(pageId: string, updates: Partial<PublicPage>, skipTenantCheck: boolean = false, ownerUid?: string): Promise<void> {
  const docRef = doc(db, 'publicPages', pageId);
  
  // 既存データのテナント検証（エンドユーザーは自分のmemoryに関連する公開ページであればテナント問わず更新可能）
  if (!skipTenantCheck) {
    const existingDoc = await getDoc(docRef);
    if (existingDoc.exists()) {
      const existingData = existingDoc.data();
      // ownerUidが設定されていない場合、提供されたownerUidを設定
      if (!existingData.ownerUid && ownerUid) {
        updates.ownerUid = ownerUid;
      }
      const currentTenant = getCurrentTenant();
      if (existingData.tenant !== currentTenant) {
        throw new Error('Access denied: Tenant mismatch');
      }
    }
  } else if (ownerUid) {
    // skipTenantCheckがtrueの場合でも、ownerUidが提供されていれば設定
    const existingDoc = await getDoc(docRef);
    if (existingDoc.exists()) {
      const existingData = existingDoc.data();
      if (!existingData.ownerUid) {
        updates.ownerUid = ownerUid;
      }
    }
  }
  
  // undefinedを削除してFirestoreに保存できるようにする
  const cleanUpdates: any = {};
  for (const [key, value] of Object.entries(updates)) {
    if (value !== undefined) {
      if (key === 'media' && typeof value === 'object' && value !== null) {
        // mediaオブジェクトのundefinedを削除
        const cleanMedia: any = {};
        if ((value as any).cover !== undefined) cleanMedia.cover = (value as any).cover || null;
        if ((value as any).profile !== undefined) cleanMedia.profile = (value as any).profile || null;
        if (Object.keys(cleanMedia).length > 0) {
          cleanUpdates[key] = cleanMedia;
        }
      } else {
        cleanUpdates[key] = value;
      }
    }
  }
  
  await updateDoc(docRef, {
    ...cleanUpdates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * 同じテナント・同じユーザーの公開ページ一覧を取得
 * @param tenant テナント名
 * @param ownerUid ユーザーID
 * @returns 公開ページの一覧
 */
export async function getPublicPagesByTenantAndUser(tenant: string, ownerUid: string): Promise<PublicPage[]> {
  // まず、同じテナント・同じユーザーの公開済みメモリを取得
  const memoriesQuery = query(
    memoriesCollection,
    where('ownerUid', '==', ownerUid),
    where('tenant', '==', tenant),
    where('status', '==', 'published')
  );
  const memoriesSnapshot = await getDocs(memoriesQuery);
  const memoryIds = memoriesSnapshot.docs.map(doc => doc.id);
  
  if (memoryIds.length === 0) {
    return [];
  }
  
  // それらのメモリに関連する公開ページを取得
  const pages: PublicPage[] = [];
  for (const memoryId of memoryIds) {
    const pagesQuery = query(
      publicPagesCollection,
      where('tenant', '==', tenant),
      where('memoryId', '==', memoryId),
      where('publish.status', '==', 'published')
    );
    const pagesSnapshot = await getDocs(pagesQuery);
    pages.push(...pagesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as PublicPage[]);
  }
  
  // 公開日時でソート
  return pages.sort((a, b) => {
    const aDate = a.publish?.publishedAt?.getTime() || 0;
    const bDate = b.publish?.publishedAt?.getTime() || 0;
    return bDate - aDate;
  });
}

// Claim Requests (Read only for client)
export const claimRequestsCollection = collection(db, 'claimRequests');

export async function getClaimRequestById(requestId: string, skipTenantCheck: boolean = false): Promise<ClaimRequest | null> {
  const docRef = doc(db, 'claimRequests', requestId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const request = {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
  } as ClaimRequest;
  
  // テナント検証（エンドユーザーが自分のclaimRequestを取得する場合はスキップ可能）
  if (!skipTenantCheck) {
    const currentTenant = getCurrentTenant();
    if (request.tenant !== currentTenant) {
      console.warn('Tenant mismatch in getClaimRequestById:', {
        requestId,
        requestTenant: request.tenant,
        currentTenant,
      });
      throw new Error('Access denied: Tenant mismatch');
    }
  }
  
  return request;
}

export async function updateClaimRequest(requestId: string, updates: Partial<ClaimRequest>, skipTenantCheck: boolean = false): Promise<void> {
  const docRef = doc(db, 'claimRequests', requestId);
  
  // 既存データのテナント検証（skipTenantCheckがtrueの場合はスキップ）
  if (!skipTenantCheck) {
    const existingDoc = await getDoc(docRef);
    if (existingDoc.exists()) {
      const currentTenant = getCurrentTenant();
      if (existingDoc.data().tenant !== currentTenant) {
        throw new Error('Access denied: Tenant mismatch');
      }
    }
  }
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function getClaimRequestsByTenant(tenant: string): Promise<ClaimRequest[]> {
  const currentTenant = getCurrentTenant();
  if (tenant !== currentTenant) {
    throw new Error('Access denied: Tenant mismatch');
  }
  
  const q = query(
    claimRequestsCollection,
    where('tenant', '==', tenant),
    orderBy('createdAt', 'desc'),
    limit(100) // 最大100件まで取得
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    sentAt: doc.data().sentAt?.toDate(),
    claimedAt: doc.data().claimedAt?.toDate(),
  })) as ClaimRequest[];
}

// 秘密鍵でclaimRequestを検索する関数は廃止（JWTトークン認証リンク + メール/パスワードログインに変更）
// export async function getClaimRequestBySecretKey(secretKey: string): Promise<ClaimRequest | null> { ... }

// Orders (Read only for client)
export const ordersCollection = collection(db, 'orders');

export async function getOrdersByTenant(tenant: string): Promise<Order[]> {
  const currentTenant = getCurrentTenant();
  if (tenant !== currentTenant) {
    throw new Error('Access denied: Tenant mismatch');
  }
  
  const q = query(
    ordersCollection,
    where('tenant', '==', tenant),
    orderBy('createdAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Order[];
}

export async function getOrderById(orderId: string): Promise<Order | null> {
  const docRef = doc(db, 'orders', orderId);
  const docSnap = await getDoc(docRef);
  
  if (!docSnap.exists()) {
    return null;
  }
  
  const order = {
    id: docSnap.id,
    ...docSnap.data(),
    createdAt: docSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: docSnap.data().updatedAt?.toDate() || new Date(),
  } as Order;
  
  // テナント検証
  const currentTenant = getCurrentTenant();
  if (order.tenant !== currentTenant) {
    throw new Error('Access denied: Tenant mismatch');
  }
  
  return order;
}

// 秘密鍵で注文を検索（skパラメータ用）
export async function getOrderBySecretKey(secretKey: string): Promise<Order | null> {
  try {
    const q = query(
      ordersCollection,
      where('secretKey', '==', secretKey),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    const orderDoc = snapshot.docs[0];
    const order = {
      id: orderDoc.id,
      ...orderDoc.data(),
      createdAt: orderDoc.data().createdAt?.toDate() || new Date(),
      updatedAt: orderDoc.data().updatedAt?.toDate() || new Date(),
    } as Order;
    
    // 有効期限チェック
    if (order.secretKeyExpiresAt && order.secretKeyExpiresAt < new Date()) {
      console.warn('Secret key has expired');
      return null;
    }
    
    return order;
  } catch (error) {
    console.error('Error fetching order by secret key:', error);
    return null;
  }
}

// 注文更新は Functions API 経由のみ（specification v3.3に準拠）
// フロントからの直接更新は禁止されているため、この関数は削除
// 注文の更新は専用のNFC WriterアプリまたはFunctions API経由で行う
// 
// export async function updateOrder(orderId: string, updates: Partial<Order>): Promise<void> {
//   const docRef = doc(db, 'orders', orderId);
//   
//   // 既存データのテナント検証
//   const existingDoc = await getDoc(docRef);
//   if (existingDoc.exists()) {
//     const currentTenant = getCurrentTenant();
//     if (existingDoc.data().tenant !== currentTenant) {
//       throw new Error('Access denied: Tenant mismatch');
//     }
//   }
//   
//   await updateDoc(docRef, {
//     ...updates,
//     updatedAt: serverTimestamp(),
//   });
// }

// Acrylic Photos
export const acrylicPhotosCollection = collection(db, 'acrylicPhotos');

export async function getAcrylicPhotosByOrder(orderId: string): Promise<AcrylicPhoto[]> {
  const q = query(
    acrylicPhotosCollection,
    where('orderId', '==', orderId),
    orderBy('uploadedAt', 'desc')
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    uploadedAt: doc.data().uploadedAt?.toDate() || new Date(),
    approvedAt: doc.data().approvedAt?.toDate(),
    rejectedAt: doc.data().rejectedAt?.toDate(),
  })) as AcrylicPhoto[];
}

export async function createAcrylicPhoto(photo: Omit<AcrylicPhoto, 'id' | 'uploadedAt' | 'approvedAt' | 'rejectedAt'>): Promise<string> {
  const docRef = await addDoc(acrylicPhotosCollection, {
    ...photo,
    uploadedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

export async function updateAcrylicPhoto(photoId: string, updates: Partial<AcrylicPhoto>): Promise<void> {
  const docRef = doc(db, 'acrylicPhotos', photoId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Shipping Info
export const shippingInfoCollection = collection(db, 'shippingInfo');

export async function getShippingInfoByOrder(orderId: string): Promise<ShippingInfo | null> {
  const q = query(
    shippingInfoCollection,
    where('orderId', '==', orderId),
    limit(1)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    return null;
  }
  
  const doc = snapshot.docs[0];
  return {
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    shippedAt: doc.data().shippedAt?.toDate(),
    deliveredAt: doc.data().deliveredAt?.toDate(),
    returnedAt: doc.data().returnedAt?.toDate(),
    estimatedDelivery: doc.data().estimatedDelivery?.toDate(),
  } as ShippingInfo;
}

export async function createShippingInfo(shippingInfo: Omit<ShippingInfo, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(shippingInfoCollection, {
    ...shippingInfo,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

export async function updateShippingInfo(shippingInfoId: string, updates: Partial<ShippingInfo>): Promise<void> {
  const docRef = doc(db, 'shippingInfo', shippingInfoId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

// Users
export const usersCollection = collection(db, 'users');

export async function getUserByEmail(email: string): Promise<User | null> {
  try {
    const q = query(
      usersCollection,
      where('email', '==', email),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    const userDoc = snapshot.docs[0];
    const data = userDoc.data();
    return {
      uid: userDoc.id,
      email: data.email,
      displayName: data.displayName,
      tenant: data.tenant || getCurrentTenant(),
      tenants: data.tenants,
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as User;
  } catch (error) {
    console.error('Error fetching user by email:', error);
    return null;
  }
}

// Staff (店舗スタッフ/管理者)
export const staffCollection = collection(db, 'staff');

export async function getStaffByUid(uid: string): Promise<Staff | null> {
  try {
    const docRef = doc(db, 'staff', uid);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      return null;
    }
    
    const data = docSnap.data();
    return {
      uid: docSnap.id,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      adminTenant: data.adminTenant,
      companyId: data.companyId, // 企業IDを追加
      permissions: data.permissions || {},
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Staff;
  } catch (error) {
    console.error('Error fetching staff by UID:', error);
    return null;
  }
}

export async function getStaffByEmail(email: string): Promise<Staff | null> {
  try {
    const q = query(
      staffCollection,
      where('email', '==', email),
      limit(1)
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return null;
    }
    
    const staffDoc = snapshot.docs[0];
    const data = staffDoc.data();
    return {
      uid: staffDoc.id,
      email: data.email,
      displayName: data.displayName,
      role: data.role,
      adminTenant: data.adminTenant,
      companyId: data.companyId, // 企業IDを追加
      permissions: data.permissions || {},
      createdAt: data.createdAt?.toDate() || new Date(),
      updatedAt: data.updatedAt?.toDate() || new Date(),
    } as Staff;
  } catch (error) {
    console.error('Error fetching staff by email:', error);
    return null;
  }
}

export async function getStaffByTenant(tenant: string): Promise<Staff[]> {
  try {
    const q = query(
      staffCollection,
      where('adminTenant', '==', tenant),
      orderBy('createdAt', 'desc')
    );
    
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        email: data.email,
        displayName: data.displayName,
        role: data.role,
        adminTenant: data.adminTenant,
        companyId: data.companyId, // 企業IDを追加
        permissions: data.permissions || {},
        createdAt: data.createdAt?.toDate() || new Date(),
        updatedAt: data.updatedAt?.toDate() || new Date(),
      } as Staff;
    });
  } catch (error) {
    console.error('Error fetching staff by tenant:', error);
    return [];
  }
}

export async function createStaff(staff: Omit<Staff, 'uid' | 'createdAt' | 'updatedAt'>): Promise<string> {
  const docRef = await addDoc(staffCollection, {
    ...staff,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  
  return docRef.id;
}

export async function updateStaff(uid: string, updates: Partial<Staff>): Promise<void> {
  const docRef = doc(db, 'staff', uid);
  
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteStaff(uid: string): Promise<void> {
  const docRef = doc(db, 'staff', uid);
  await deleteDoc(docRef);
}

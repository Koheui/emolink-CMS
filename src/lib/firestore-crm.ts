/**
 * CRM用のFirestore関数
 * スタッフ向けの顧客・店舗情報取得関数
 */

import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  deleteDoc,
  query, 
  where, 
  orderBy,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from './firebase';
import { User, Tenant, ClaimRequest, Memory, PublicPage, Order, Company, Staff } from '@/types';

// 全顧客を取得（テナントフィルタ付き、管理者向け）
// staffTenant: スタッフが管理するテナントID（superAdminの場合はnullで全テナント）
export async function getAllUsers(staffTenant: string | null = null): Promise<User[]> {
  const usersRef = collection(db, 'users');
  
  // テナントフィルタを追加（セキュリティルールに合わせる）
  let q;
  if (staffTenant) {
    // 特定のテナントのユーザーのみ取得
    q = query(
      usersRef,
      where('tenant', '==', staffTenant),
      orderBy('createdAt', 'desc'),
      limit(1000) // 最大1000件まで取得
    );
  } else {
    // テナントフィルタなし（superAdminの場合、ただしセキュリティルールの制約により実際には取得できない可能性がある）
    q = query(
    usersRef,
    orderBy('createdAt', 'desc'),
    limit(1000) // 最大1000件まで取得
  );
  }
  
  try {
    const snapshot = await getDocs(q);
    const users: User[] = [];
    
    snapshot.forEach((doc) => {
      const data = doc.data();
      // roleフィールドがない、または'user'の場合のみエンドユーザーとして扱う
      const role = data.role;
      if (!role || role === 'user') {
        users.push({
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName,
          tenant: data.tenant || '',
          tenants: data.tenants || [],
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      }
    });
    
    return users;
  } catch (error: any) {
    // インデックスエラーの場合、orderByを削除して再試行
    if (error.code === 'failed-precondition' || 
        (error.message && (error.message.includes('index') || error.message.includes('requires an index')))) {
      console.warn('Index error detected, retrying without orderBy...');
      let qWithoutOrderBy;
      if (staffTenant) {
        qWithoutOrderBy = query(
          usersRef,
          where('tenant', '==', staffTenant),
          limit(1000)
        );
      } else {
        qWithoutOrderBy = query(usersRef, limit(1000));
      }
      const snapshot = await getDocs(qWithoutOrderBy);
      const users: User[] = [];
      
      snapshot.forEach((doc) => {
        const data = doc.data();
        const role = data.role;
        if (!role || role === 'user') {
          users.push({
            uid: doc.id,
            email: data.email || '',
            displayName: data.displayName,
            tenant: data.tenant || '',
            tenants: data.tenants || [],
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          });
        }
      });
      
      // クライアント側でソート
      return users.sort((a, b) => {
        const aTime = a.createdAt.getTime();
        const bTime = b.createdAt.getTime();
        return bTime - aTime;
      });
    }
    console.error('Error fetching users:', error);
    throw error;
  }
}

// 店舗情報に企業情報を含む拡張型
export interface TenantWithCompany extends Tenant {
  companyName?: string;
  companyId?: string;
}

// 全店舗を取得（テナントフィルタ付き、管理者向け、企業情報を含む）
// staffTenant: スタッフが管理するテナントID（superAdminの場合はnullで全テナント）
export async function getAllTenants(staffTenant: string | null = null): Promise<TenantWithCompany[]> {
  const tenantsRef = collection(db, 'tenants');
  
  // テナントフィルタを追加（セキュリティルールに合わせる）
  let q;
  if (staffTenant) {
    // 特定のテナントのみ取得
    q = query(
      tenantsRef,
      where('id', '==', staffTenant),
      orderBy('createdAt', 'desc')
    );
  } else {
    // テナントフィルタなし（superAdminの場合）
    q = query(tenantsRef, orderBy('createdAt', 'desc'));
  }
  
  try {
    const snapshot = await getDocs(q);
    const tenants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Tenant[];
    
    // 企業情報を取得
    const companyIds = Array.from(new Set(tenants.map(t => t.companyId).filter(Boolean) as string[]));
    const companyMap = new Map<string, Company>();
    
    if (companyIds.length > 0) {
      const companiesRef = collection(db, 'companies');
      const companyPromises = companyIds.map(async (companyId) => {
        try {
          const companyDoc = await getDoc(doc(companiesRef, companyId));
          if (companyDoc.exists()) {
            const companyData = companyDoc.data();
            companyMap.set(companyId, {
              id: companyDoc.id,
              ...companyData,
              createdAt: companyData.createdAt?.toDate() || new Date(),
              updatedAt: companyData.updatedAt?.toDate() || new Date(),
            } as Company);
          }
        } catch (err) {
          console.warn(`Failed to fetch company ${companyId}:`, err);
        }
      });
      await Promise.all(companyPromises);
    }
    
    // 企業情報を店舗情報に追加
    return tenants.map(tenant => ({
      ...tenant,
      companyName: tenant.companyId ? companyMap.get(tenant.companyId)?.name : undefined,
    })) as TenantWithCompany[];
  } catch (error: any) {
    // インデックスエラーの場合、orderByを削除して再試行
    if (error.code === 'failed-precondition' || 
        (error.message && (error.message.includes('index') || error.message.includes('requires an index')))) {
      console.warn('Index error detected, retrying without orderBy...');
      let qWithoutOrderBy;
      if (staffTenant) {
        qWithoutOrderBy = query(
          tenantsRef,
          where('id', '==', staffTenant)
        );
      } else {
        qWithoutOrderBy = query(tenantsRef);
      }
      const snapshot = await getDocs(qWithoutOrderBy);
      const tenants = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Tenant[];
      
      // 企業情報を取得
      const companyIds = Array.from(new Set(tenants.map(t => t.companyId).filter(Boolean) as string[]));
      const companyMap = new Map<string, Company>();
      
      if (companyIds.length > 0) {
        const companiesRef = collection(db, 'companies');
        const companyPromises = companyIds.map(async (companyId) => {
          try {
            const companyDoc = await getDoc(doc(companiesRef, companyId));
            if (companyDoc.exists()) {
              const companyData = companyDoc.data();
              companyMap.set(companyId, {
                id: companyDoc.id,
                ...companyData,
                createdAt: companyData.createdAt?.toDate() || new Date(),
                updatedAt: companyData.updatedAt?.toDate() || new Date(),
              } as Company);
            }
          } catch (err) {
            console.warn(`Failed to fetch company ${companyId}:`, err);
          }
        });
        await Promise.all(companyPromises);
      }
      
      // 企業情報を店舗情報に追加
      const tenantsWithCompany = tenants.map(tenant => ({
        ...tenant,
        companyName: tenant.companyId ? companyMap.get(tenant.companyId)?.name : undefined,
      })) as TenantWithCompany[];
      
      // クライアント側でソート
      return tenantsWithCompany.sort((a, b) => {
        const aTime = a.createdAt.getTime();
        const bTime = b.createdAt.getTime();
        return bTime - aTime;
      });
    }
    throw error;
  }
}

// 顧客の詳細情報を取得（claimRequest、memory、publicPageを含む）
export interface CustomerDetail {
  user: User;
  claimRequest?: ClaimRequest;
  memories: Memory[];
  publicPages: PublicPage[];
  status: {
    emailSent: boolean;
    accountCreated: boolean;
    publicPageCreated: boolean;
  };
}

export async function getCustomerDetail(uid: string): Promise<CustomerDetail | null> {
  // ユーザー情報を取得
  const userRef = doc(db, 'users', uid);
  const userSnap = await getDoc(userRef);
  
  if (!userSnap.exists()) {
    return null;
  }
  
  const userData = userSnap.data();
  // tenantを文字列に変換（オブジェクトの場合は空文字列にする）
  const tenantValue = userData.tenant;
  const tenantString = typeof tenantValue === 'string' ? tenantValue : (tenantValue ? String(tenantValue) : '');
  
  // tenants配列を文字列配列に変換
  const tenantsArray = userData.tenants || [];
  const tenantsStrings = Array.isArray(tenantsArray) 
    ? tenantsArray.map(t => typeof t === 'string' ? t : String(t || ''))
    : [];
  
  const user: User = {
    uid: userSnap.id,
    email: userData.email || '',
    displayName: userData.displayName,
    tenant: tenantString,
    tenants: tenantsStrings,
    createdAt: userData.createdAt?.toDate() || new Date(),
    updatedAt: userData.updatedAt?.toDate() || new Date(),
  };
  
  // claimRequestを取得（メールアドレスで検索）
  let claimRequest: ClaimRequest | undefined;
  try {
    const claimRequestsRef = collection(db, 'claimRequests');
    const claimQuery = query(
      claimRequestsRef,
      where('email', '==', user.email),
      orderBy('createdAt', 'desc'),
      limit(1)
    );
    
    try {
      const claimSnapshot = await getDocs(claimQuery);
      if (!claimSnapshot.empty) {
        const claimDoc = claimSnapshot.docs[0];
        claimRequest = {
          id: claimDoc.id,
          ...claimDoc.data(),
          createdAt: claimDoc.data().createdAt?.toDate() || new Date(),
          updatedAt: claimDoc.data().updatedAt?.toDate() || new Date(),
          sentAt: claimDoc.data().sentAt?.toDate(),
          claimedAt: claimDoc.data().claimedAt?.toDate(),
        } as ClaimRequest;
      }
    } catch (error: any) {
      // インデックスエラーの場合、orderByを削除して再試行
      if (error.code === 'failed-precondition' || 
          (error.message && (error.message.includes('index') || error.message.includes('requires an index')))) {
        const claimQueryWithoutOrderBy = query(
          claimRequestsRef,
          where('email', '==', user.email),
          limit(10)
        );
        const claimSnapshot = await getDocs(claimQueryWithoutOrderBy);
        if (!claimSnapshot.empty) {
          // クライアント側でソート
          const claims = claimSnapshot.docs
            .map(doc => ({
              id: doc.id,
              ...doc.data(),
              createdAt: doc.data().createdAt?.toDate() || new Date(),
              updatedAt: doc.data().updatedAt?.toDate() || new Date(),
              sentAt: doc.data().sentAt?.toDate(),
              claimedAt: doc.data().claimedAt?.toDate(),
            }))
            .sort((a: any, b: any) => {
              const aTime = a.createdAt.getTime();
              const bTime = b.createdAt.getTime();
              return bTime - aTime;
            });
          
          if (claims.length > 0) {
            claimRequest = claims[0] as ClaimRequest;
          }
        }
      }
    }
  } catch (error) {
    console.error('Error fetching claimRequest:', error);
  }
  
  // memoriesを取得
  const memoriesRef = collection(db, 'memories');
  const memoriesQuery = query(
    memoriesRef,
    where('ownerUid', '==', uid)
  );
  
  const memoriesSnapshot = await getDocs(memoriesQuery);
  const memories: Memory[] = memoriesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Memory[];
  
  // publicPagesを取得
  const publicPagesRef = collection(db, 'publicPages');
  const publicPagesQuery = query(
    publicPagesRef,
    where('ownerUid', '==', uid)
  );
  
  const publicPagesSnapshot = await getDocs(publicPagesQuery);
  const publicPages: PublicPage[] = publicPagesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as PublicPage[];
  
  // ステータスを判定
  const status = {
    emailSent: claimRequest?.status === 'sent' || claimRequest?.status === 'claimed' || !!claimRequest?.sentAt,
    accountCreated: !!user.uid && !!user.createdAt,
    publicPageCreated: memories.some(m => m.publicPageId) || publicPages.length > 0,
  };
  
  return {
    user,
    claimRequest,
    memories,
    publicPages,
    status,
  };
}

// 顧客アカウントを削除
export async function deleteCustomerAccount(uid: string): Promise<void> {
  // ユーザー情報を削除
  const userRef = doc(db, 'users', uid);
  await deleteDoc(userRef);
  
  // 関連するmemoriesも削除（オプション）
  // 注意: 実際の運用では、memoriesは保持するか、論理削除にすることを推奨
}

// 店舗詳細情報の拡張型
export interface TenantDetailWithCompany extends Tenant {
  company?: Company;
  staffCount?: number;
  memoryCount?: number;
  orderCount?: number;
}

// 店舗の詳細情報を取得（企業情報、スタッフ数、メモリー数を含む）
export async function getTenantDetail(tenantId: string): Promise<TenantDetailWithCompany | null> {
  const tenantRef = doc(db, 'tenants', tenantId);
  const tenantSnap = await getDoc(tenantRef);
  
  if (!tenantSnap.exists()) {
    return null;
  }
  
  const tenant = {
    id: tenantSnap.id,
    ...tenantSnap.data(),
    createdAt: tenantSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: tenantSnap.data().updatedAt?.toDate() || new Date(),
  } as Tenant;
  
  // 企業情報を取得
  let company: Company | undefined;
  if (tenant.companyId) {
    try {
      const companyRef = doc(db, 'companies', tenant.companyId);
      const companySnap = await getDoc(companyRef);
      if (companySnap.exists()) {
        company = {
          id: companySnap.id,
          ...companySnap.data(),
          createdAt: companySnap.data().createdAt?.toDate() || new Date(),
          updatedAt: companySnap.data().updatedAt?.toDate() || new Date(),
        } as Company;
      }
    } catch (err) {
      console.warn(`Failed to fetch company ${tenant.companyId}:`, err);
    }
  }
  
  // スタッフ数を取得
  let staffCount = 0;
  try {
    const staffRef = collection(db, 'staff');
    const staffQuery = query(staffRef, where('adminTenant', '==', tenantId));
    const staffSnapshot = await getDocs(staffQuery);
    staffCount = staffSnapshot.size;
  } catch (err) {
    console.warn('Failed to fetch staff count:', err);
  }
  
  // メモリー数を取得
  let memoryCount = 0;
  try {
    const memoriesRef = collection(db, 'memories');
    const memoriesQuery = query(memoriesRef, where('tenant', '==', tenantId));
    const memoriesSnapshot = await getDocs(memoriesQuery);
    memoryCount = memoriesSnapshot.size;
  } catch (err) {
    console.warn('Failed to fetch memory count:', err);
  }
  
  // 注文数を取得
  let orderCount = 0;
  try {
    const ordersRef = collection(db, 'orders');
    const ordersQuery = query(ordersRef, where('tenant', '==', tenantId));
    const ordersSnapshot = await getDocs(ordersQuery);
    orderCount = ordersSnapshot.size;
  } catch (err) {
    console.warn('Failed to fetch order count:', err);
  }
  
  return {
    ...tenant,
    company,
    staffCount,
    memoryCount,
    orderCount,
  };
}

// 注文を取得（テナントフィルタ付き）
export async function getAllOrders(staffTenant: string | null = null): Promise<Order[]> {
  const ordersRef = collection(db, 'orders');
  
  let q;
  if (staffTenant) {
    q = query(
      ordersRef,
      where('tenant', '==', staffTenant),
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
  } else {
    q = query(
      ordersRef,
      orderBy('createdAt', 'desc'),
      limit(1000)
    );
  }
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      paymentCompletedAt: doc.data().paymentCompletedAt?.toDate(),
      shipping: {
        ...doc.data().shipping,
        shippedAt: doc.data().shipping?.shippedAt?.toDate(),
        deliveredAt: doc.data().shipping?.deliveredAt?.toDate(),
      },
    })) as Order[];
  } catch (error: any) {
    // インデックスエラーの場合、orderByを削除して再試行
    if (error.code === 'failed-precondition' || 
        (error.message && (error.message.includes('index') || error.message.includes('requires an index')))) {
      console.warn('Index error detected, retrying without orderBy...');
      let qWithoutOrderBy;
      if (staffTenant) {
        qWithoutOrderBy = query(
          ordersRef,
          where('tenant', '==', staffTenant),
          limit(1000)
        );
      } else {
        qWithoutOrderBy = query(ordersRef, limit(1000));
      }
      const snapshot = await getDocs(qWithoutOrderBy);
      const orders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
        paymentCompletedAt: doc.data().paymentCompletedAt?.toDate(),
        shipping: {
          ...doc.data().shipping,
          shippedAt: doc.data().shipping?.shippedAt?.toDate(),
          deliveredAt: doc.data().shipping?.deliveredAt?.toDate(),
        },
      })) as Order[];
      
      // クライアント側でソート
      return orders.sort((a, b) => {
        const aTime = a.createdAt.getTime();
        const bTime = b.createdAt.getTime();
        return bTime - aTime;
      });
    }
    throw error;
  }
}

// 注文詳細を取得
export async function getOrderDetail(orderId: string): Promise<Order | null> {
  const orderRef = doc(db, 'orders', orderId);
  const orderSnap = await getDoc(orderRef);
  
  if (!orderSnap.exists()) {
    return null;
  }
  
  return {
    id: orderSnap.id,
    ...orderSnap.data(),
    createdAt: orderSnap.data().createdAt?.toDate() || new Date(),
    updatedAt: orderSnap.data().updatedAt?.toDate() || new Date(),
    paymentCompletedAt: orderSnap.data().paymentCompletedAt?.toDate(),
    shipping: {
      ...orderSnap.data().shipping,
      shippedAt: orderSnap.data().shipping?.shippedAt?.toDate(),
      deliveredAt: orderSnap.data().shipping?.deliveredAt?.toDate(),
    },
  } as Order;
}

// 注文のNFC書き込みステータスを更新
export async function updateOrderNFCStatus(orderId: string, operatorUid: string): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  const { updateDoc, serverTimestamp } = await import('firebase/firestore');
  
  await updateDoc(orderRef, {
    'nfc.written': true,
    'nfc.writtenAt': serverTimestamp(),
    'nfc.operator': operatorUid,
    updatedAt: serverTimestamp(),
  });
}

// 注文ステータスを更新（CRM用）
export async function updateOrderStatus(orderId: string, updates: {
  status?: Order['status'];
  paymentStatus?: Order['paymentStatus'];
  orderStatus?: Order['orderStatus'];
  nfcWritten?: boolean;
  shipped?: boolean;
  shippedAt?: Date;
}, operatorUid: string): Promise<void> {
  const orderRef = doc(db, 'orders', orderId);
  const { updateDoc, serverTimestamp, Timestamp } = await import('firebase/firestore');
  
  const updateData: any = {
    updatedAt: serverTimestamp(),
    'audit.lastUpdatedBy': operatorUid,
  };
  
  if (updates.status !== undefined) {
    updateData.status = updates.status;
  }
  
  if (updates.paymentStatus !== undefined) {
    updateData.paymentStatus = updates.paymentStatus;
  }
  
  if (updates.orderStatus !== undefined) {
    updateData.orderStatus = updates.orderStatus;
  }
  
  if (updates.nfcWritten !== undefined) {
    updateData['nfc.written'] = updates.nfcWritten;
    if (updates.nfcWritten) {
      updateData['nfc.writtenAt'] = serverTimestamp();
      updateData['nfc.operator'] = operatorUid;
    }
  }
  
  if (updates.shipped !== undefined) {
    updateData['shipping.shipped'] = updates.shipped;
    if (updates.shipped && updates.shippedAt) {
      updateData['shipping.shippedAt'] = Timestamp.fromDate(updates.shippedAt);
    }
  }
  
  await updateDoc(orderRef, updateData);
}

// 企業詳細を取得（店舗とスタッフ情報を含む）
export async function getCompanyDetail(companyId: string): Promise<{
  company: Company;
  tenants: Tenant[];
  staff: Staff[];
} | null> {
  const companyRef = doc(db, 'companies', companyId);
  const companySnap = await getDoc(companyRef);
  
  if (!companySnap.exists()) {
    return null;
  }
  
  const company = {
    id: companySnap.id,
    ...companySnap.data(),
    createdAt: companySnap.data().createdAt?.toDate() || new Date(),
    updatedAt: companySnap.data().updatedAt?.toDate() || new Date(),
  } as Company;
  
  // 店舗情報を取得
  const tenantsRef = collection(db, 'tenants');
  const tenantsQuery = query(tenantsRef, where('companyId', '==', companyId));
  const tenantsSnapshot = await getDocs(tenantsQuery);
  const tenants = tenantsSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Tenant[];
  
  // スタッフ情報を取得
  const staffRef = collection(db, 'staff');
  const staffQuery = query(staffRef, where('companyId', '==', companyId));
  const staffSnapshot = await getDocs(staffQuery);
  const staff = staffSnapshot.docs.map(doc => ({
    uid: doc.id,
    ...doc.data(),
    createdAt: doc.data().createdAt?.toDate() || new Date(),
    updatedAt: doc.data().updatedAt?.toDate() || new Date(),
  })) as Staff[];
  
  return { company, tenants, staff };
}

// 全企業を取得（superAdminのみ）
export async function getAllCompanies(): Promise<Company[]> {
  const companiesRef = collection(db, 'companies');
  const q = query(companiesRef, orderBy('createdAt', 'desc'));
  
  try {
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      createdAt: doc.data().createdAt?.toDate() || new Date(),
      updatedAt: doc.data().updatedAt?.toDate() || new Date(),
    })) as Company[];
  } catch (error: any) {
    // インデックスエラーの場合、orderByを削除して再試行
    if (error.code === 'failed-precondition' || 
        (error.message && (error.message.includes('index') || error.message.includes('requires an index')))) {
      console.warn('Index error detected, retrying without orderBy...');
      const qWithoutOrderBy = query(companiesRef);
      const snapshot = await getDocs(qWithoutOrderBy);
      const companies = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() || new Date(),
        updatedAt: doc.data().updatedAt?.toDate() || new Date(),
      })) as Company[];
      
      // クライアント側でソート
      return companies.sort((a, b) => {
        const aTime = a.createdAt.getTime();
        const bTime = b.createdAt.getTime();
        return bTime - aTime;
      });
    }
    throw error;
  }
}

// テナント情報を解決（識別可能なIDとFirestoreドキュメントIDの両方を取得）
async function resolveTenantIds(staffTenant: string | null): Promise<string[]> {
  console.log('[CRM] resolveTenantIds called with staffTenant:', staffTenant);
  
  if (!staffTenant) {
    // superAdminの場合は全テナントを取得
    console.log('[CRM] staffTenant is null, fetching all tenants');
    const tenantsRef = collection(db, 'tenants');
    const snapshot = await getDocs(tenantsRef);
    const tenantIds: string[] = [];
    snapshot.docs.forEach(doc => {
      const tenantData = doc.data();
      const identifiableId = tenantData.id || doc.id;
      const firestoreDocId = doc.id;
      console.log(`[CRM] Tenant: docId=${firestoreDocId}, identifiableId=${identifiableId}`);
      if (identifiableId && identifiableId !== firestoreDocId) {
        tenantIds.push(identifiableId);
      }
      tenantIds.push(firestoreDocId);
    });
    const uniqueIds = Array.from(new Set(tenantIds)); // 重複を除去
    console.log('[CRM] Resolved tenant IDs (superAdmin):', uniqueIds);
    return uniqueIds;
  }
  
  // テナント情報を取得（まずFirestoreドキュメントIDとして試行）
  console.log(`[CRM] Trying to fetch tenant as Firestore doc ID: ${staffTenant}`);
  const tenantRef = doc(db, 'tenants', staffTenant);
  const tenantSnap = await getDoc(tenantRef);
  
  if (!tenantSnap.exists()) {
    // FirestoreドキュメントIDで見つからない場合、識別可能なIDで検索
    console.log(`[CRM] Tenant not found as Firestore doc ID, searching by identifiable ID: ${staffTenant}`);
    const tenantsRef = collection(db, 'tenants');
    const q = query(tenantsRef, where('id', '==', staffTenant));
    const snapshot = await getDocs(q);
    if (!snapshot.empty) {
      const tenantDoc = snapshot.docs[0];
      const tenantData = tenantDoc.data();
      const identifiableId = tenantData.id || tenantDoc.id;
      const firestoreDocId = tenantDoc.id;
      const resolvedIds = Array.from(new Set([staffTenant, identifiableId, firestoreDocId]));
      console.log(`[CRM] Found tenant by identifiable ID: ${identifiableId}, Firestore doc ID: ${firestoreDocId}`);
      console.log('[CRM] Resolved tenant IDs:', resolvedIds);
      return resolvedIds;
    }
    
    // 識別可能なIDでも見つからない場合、companyIdで検索
    console.log(`[CRM] Tenant not found by identifiable ID, searching by companyId: ${staffTenant}`);
    const qByCompanyId = query(tenantsRef, where('companyId', '==', staffTenant));
    const snapshotByCompanyId = await getDocs(qByCompanyId);
    if (!snapshotByCompanyId.empty) {
      const tenantDoc = snapshotByCompanyId.docs[0];
      const tenantData = tenantDoc.data();
      const identifiableId = tenantData.id || tenantDoc.id;
      const firestoreDocId = tenantDoc.id;
      const companyId = tenantData.companyId;
      const resolvedIds = Array.from(new Set([staffTenant, companyId, identifiableId, firestoreDocId]));
      console.log(`[CRM] Found tenant by companyId: companyId=${companyId}, identifiableId=${identifiableId}, Firestore doc ID: ${firestoreDocId}`);
      console.log('[CRM] Resolved tenant IDs:', resolvedIds);
      return resolvedIds;
    }
    
    console.warn(`[CRM] Tenant not found by companyId either, using fallback: ${staffTenant}`);
    return [staffTenant]; // フォールバック
  }
  
  const tenantData = tenantSnap.data();
  const identifiableId = tenantData.id || staffTenant;
  const firestoreDocId = staffTenant;
  const companyId = tenantData.companyId;
  const resolvedIds = companyId 
    ? Array.from(new Set([staffTenant, companyId, identifiableId, firestoreDocId]))
    : Array.from(new Set([staffTenant, identifiableId, firestoreDocId]));
  console.log(`[CRM] Found tenant: companyId=${companyId}, identifiableId=${identifiableId}, firestoreDocId=${firestoreDocId}`);
  console.log('[CRM] Resolved tenant IDs:', resolvedIds);
  return resolvedIds;
}

// 顧客一覧を取得（claimRequestsコレクションを主なデータソースとして使用）
export interface CustomerListItem {
  customerId: string;           // claimRequestsのドキュメントID
  email: string;                // メールアドレス
  customerName: string;         // 顧客名（お名前）
  phone: string;                // 電話番号
  product: string;              // 商品名
  notes: string;                // 備考欄
  status: string;               // ステータス
  publicPageUrl: string | null; // 公開ページURL
  loginUrl: string | null;      // ログインURL
  memoryTitle: string | null;   // 想い出ページのタイトル（最初の1件）
  memoryCount: number;          // 想い出ページの件数
  createdAt: Date;              // 作成日時
  updatedAt: Date;              // 更新日時
  claimedAt: Date | null;       // 認証完了日時
}

export async function getAllCustomersFromClaimRequests(staffTenant: string | null = null): Promise<CustomerListItem[]> {
  console.log('[CRM] getAllCustomersFromClaimRequests called with staffTenant:', staffTenant);
  
  // テナントIDを解決（識別可能なIDとFirestoreドキュメントIDの両方）
  const tenantIds = await resolveTenantIds(staffTenant);
  console.log('[CRM] Resolved tenant IDs:', tenantIds);
  
  const claimRequestsRef = collection(db, 'claimRequests');
  const allClaimRequests: ClaimRequest[] = [];
  
  // 各テナントIDで検索
  for (const tenantId of tenantIds) {
    console.log(`[CRM] Searching claimRequests with tenant: ${tenantId}`);
    try {
      const q = query(
        claimRequestsRef,
        where('tenant', '==', tenantId),
        orderBy('createdAt', 'desc')
      );
      const snapshot = await getDocs(q);
      console.log(`[CRM] Found ${snapshot.docs.length} claimRequests for tenant ${tenantId}`);
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`[CRM] claimRequest: id=${doc.id}, email=${data.email}, tenant=${data.tenant}`);
        allClaimRequests.push({
          id: doc.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
          sentAt: data.sentAt?.toDate(),
          claimedAt: data.claimedAt?.toDate(),
        } as ClaimRequest);
      });
    } catch (error: any) {
      // インデックスエラーの場合、orderByを削除して再試行
      if (error.code === 'failed-precondition' || 
          (error.message && (error.message.includes('index') || error.message.includes('requires an index')))) {
        console.warn(`[CRM] Index error for tenant ${tenantId}, retrying without orderBy...`);
        const qWithoutOrderBy = query(
          claimRequestsRef,
          where('tenant', '==', tenantId)
        );
        const snapshot = await getDocs(qWithoutOrderBy);
        console.log(`[CRM] Found ${snapshot.docs.length} claimRequests for tenant ${tenantId} (without orderBy)`);
        snapshot.docs.forEach(doc => {
          const data = doc.data();
          console.log(`[CRM] claimRequest: id=${doc.id}, email=${data.email}, tenant=${data.tenant}`);
          allClaimRequests.push({
            id: doc.id,
            ...data,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            sentAt: data.sentAt?.toDate(),
            claimedAt: data.claimedAt?.toDate(),
          } as ClaimRequest);
        });
      } else {
        console.error(`[CRM] Error fetching claimRequests for tenant ${tenantId}:`, error);
      }
    }
  }
  
  // デバッグ: 全claimRequestsを取得してtenantフィールドの値を確認
  if (allClaimRequests.length === 0 && tenantIds.length > 0) {
    console.warn('[CRM] No claimRequests found, fetching all to debug tenant values...');
    try {
      const allSnapshot = await getDocs(claimRequestsRef);
      console.log(`[CRM] Total claimRequests in database: ${allSnapshot.docs.length}`);
      const tenantValues = new Set<string>();
      allSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.tenant) {
          tenantValues.add(data.tenant);
        }
      });
      console.log('[CRM] All tenant values in claimRequests:', Array.from(tenantValues));
      console.log('[CRM] Searching tenant IDs:', tenantIds);
      console.log('[CRM] Match check:', {
        searchingFor: tenantIds,
        foundInDatabase: Array.from(tenantValues),
        matches: tenantIds.filter(id => tenantValues.has(id))
      });
    } catch (err) {
      console.error('[CRM] Error fetching all claimRequests:', err);
    }
  }
  // 収集済みデータのtenant値と件数をログ出力（デバッグ用）
  const tenantValuesInClaims = Array.from(new Set(allClaimRequests.map(c => c.tenant).filter(Boolean)));
  console.log('[CRM] tenant values in collected claimRequests:', tenantValuesInClaims);
  console.log(`[CRM] Total claimRequests found: ${allClaimRequests.length}`);
  
  // 重複排除（同じemailのデータは1件として扱う、最新のcreatedAtが優先）
  const emailMap = new Map<string, ClaimRequest>();
  allClaimRequests.forEach(claim => {
    const existing = emailMap.get(claim.email);
    if (!existing || claim.createdAt > existing.createdAt) {
      emailMap.set(claim.email, claim);
    }
  });
  
  const uniqueClaimRequests = Array.from(emailMap.values());
  console.log(`[CRM] Found ${uniqueClaimRequests.length} unique customers from ${allClaimRequests.length} claimRequests`);
  
  // 顧客情報を補完
  const customerList: CustomerListItem[] = await Promise.all(
    uniqueClaimRequests.map(async (claim) => {
      // customerInfoを取得（claimRequests → orders）
      let customerName = claim.customerInfo?.name || '';
      let phone = claim.customerInfo?.phone || '';
      
      // ordersから補完（customerInfoがない場合）
      if (!customerName || !phone) {
        const ordersRef = collection(db, 'orders');
        const orderQueries = tenantIds.map(tenantId => 
          query(ordersRef, where('tenant', '==', tenantId), where('email', '==', claim.email), limit(1))
        );
        
        for (const orderQuery of orderQueries) {
          try {
            const orderSnapshot = await getDocs(orderQuery);
            if (!orderSnapshot.empty) {
              const orderData = orderSnapshot.docs[0].data() as Order;
              if (!customerName && orderData.customerInfo?.name) {
                customerName = orderData.customerInfo.name;
              }
              if (!phone && orderData.customerInfo?.phone) {
                phone = orderData.customerInfo.phone;
              }
              break; // 見つかったら終了
            }
          } catch (err) {
            // エラーは無視して続行
          }
        }
      }
      
      // memoriesを取得（想い出ページ情報）
      let memoryTitle: string | null = null;
      let memoryCount = 0;
      
      if (claim.claimedByUid) {
        const memoriesRef = collection(db, 'memories');
        const memoryQueries = tenantIds.map(tenantId =>
          query(memoriesRef, where('ownerUid', '==', claim.claimedByUid), where('tenant', '==', tenantId))
        );
        
        const allMemories: Memory[] = [];
        for (const memoryQuery of memoryQueries) {
          try {
            const memorySnapshot = await getDocs(memoryQuery);
            memorySnapshot.docs.forEach(doc => {
              const data = doc.data();
              allMemories.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                updatedAt: data.updatedAt?.toDate() || new Date(),
              } as Memory);
            });
          } catch (err) {
            // エラーは無視して続行
          }
        }
        
        memoryCount = allMemories.length;
        if (allMemories.length > 0) {
          // 最初の1件のタイトルを取得
          memoryTitle = allMemories[0].title || null;
        }
      }
      
      return {
        customerId: claim.id,
        email: claim.email,
        customerName: customerName || '-',
        phone: phone || '-',
        product: claim.product || claim.productType || '-',
        notes: claim.notes || '-',
        status: claim.status,
        publicPageUrl: claim.publicPageUrl || null,
        loginUrl: claim.loginUrl || null,
        memoryTitle,
        memoryCount,
        createdAt: claim.createdAt,
        updatedAt: claim.updatedAt,
        claimedAt: claim.claimedAt || null,
      };
    })
  );
  
  // createdAtで降順ソート
  return customerList.sort((a, b) => {
    const aTime = a.createdAt.getTime();
    const bTime = b.createdAt.getTime();
    return bTime - aTime;
  });
}

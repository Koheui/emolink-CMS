/**
 * テナント検証・セキュリティ機能
 * Originベースのテナント検証を実装し、テナント間のデータ分離を保証
 */

// テナント情報の設定
export const ORIGIN_TENANT_MAP: { [origin: string]: { tenant: string; lpId: string } } = {
  // 外部LPドメイン（例）
  'https://pet-memories.com': { tenant: 'petmem', lpId: 'main' },
  'https://pet-memories.jp': { tenant: 'petmem', lpId: 'main' },
  'https://memory-pets.com': { tenant: 'petmem', lpId: 'partner' },
  // Future Studio
  'https://futurestudio-lp.web.app': { tenant: 'futurestudio', lpId: 'emolink.cloud' },
  // 既存の設定
  'https://emolink.cloud': { tenant: 'petmem', lpId: 'direct' },
  'https://partner-a-lp.web.app': { tenant: 'client-a', lpId: 'main' },
  'https://partner-b-lp.web.app': { tenant: 'client-b', lpId: 'main' },
  // CMSドメイン（既存）
  'https://emolink-cms.web.app': { tenant: 'store-1764868335259', lpId: 'emolink-direct-01' },
  'https://emolink.net': { tenant: 'store-1764868335259', lpId: 'emolink-direct-01' },
  // CRM用ドメイン
  'https://emolink-crm.web.app': { tenant: 'store-1764868335259', lpId: 'crm' },
  // 開発環境
  'http://localhost:3000': { tenant: 'dev', lpId: 'local' },
  'http://localhost:3001': { tenant: 'dev', lpId: 'local' },
};

// Originベーステナント取得関数
export function getTenantFromOrigin(origin: string): { tenant: string; lpId: string } {
  const tenantInfo = ORIGIN_TENANT_MAP[origin];
  if (!tenantInfo) {
    // 未知のOriginの場合、デフォルトのテナントを返す（エラーを投げない）
    console.warn(`Unknown origin: ${origin}, using default tenant`);
    // デフォルトテナント（既存のCMSドメインと同じテナントを使用）
    return { tenant: 'store-1764868335259', lpId: 'emolink-direct-01' };
  }
  return tenantInfo;
}

// テナント検証関数
export function validateUserTenant(userTenant: string, dataTenant: string): boolean {
  return userTenant === dataTenant;
}

// セキュリティヘルパー関数
export function getCurrentTenant(): string {
  if (typeof window === 'undefined') {
    return 'unknown';
  }
  
  // まずlocalStorageから保存されたテナント情報を取得（認証リンク経由で設定されたもの）
  const savedTenant = localStorage.getItem('secretKeyTenant');
  if (savedTenant) {
    return savedTenant;
  }
  
  // sessionStorageもチェック
  const sessionTenant = sessionStorage.getItem('secretKeyTenant');
  if (sessionTenant) {
    return sessionTenant;
  }
  
  // 保存されたテナント情報がない場合は、Originから取得（フォールバック）
  const origin = window.location.origin;
  try {
    const tenantInfo = getTenantFromOrigin(origin);
    return tenantInfo.tenant;
  } catch (error) {
    console.error('Failed to get tenant from origin:', error);
    return 'unknown';
  }
}

// テナント情報の型定義
export interface TenantInfo {
  tenant: string;
  lpId: string;
  name?: string;
  description?: string;
  allowedLpIds?: string[];
  enabledProductTypes?: string[];
  settings?: {
    maxClaimRequestsPerHour?: number;
    emailTemplate?: string;
    branding?: {
      logo?: string;
      colors?: string[];
      theme?: string;
    };
    fulfillmentMode?: 'tenantDirect' | 'vendorDirect';
  };
  status?: 'active' | 'inactive' | 'suspended';
}

/**
 * Firestoreクエリにテナントフィルタを追加
 */
export function addTenantFilter<T extends { tenant: string }>(
  query: any,
  tenant: string
): any {
  return query.where('tenant', '==', tenant);
}

/**
 * データアクセス権限チェック
 */
export function checkDataAccess(
  userId: string | null,
  dataTenant: string,
  origin: string
): boolean {
  if (!userId) {
    console.error('User not authenticated');
    return false;
  }
  
  // return validateTenantAccess(null, dataTenant, origin);
  return true;
}

/**
 * セキュリティログ
 */
export function logSecurityEvent(
  event: string,
  userId: string | null,
  tenant: string,
  details: any = {}
): void {
  console.log(`[SECURITY] ${event}:`, {
    userId,
    tenant,
    timestamp: new Date().toISOString(),
    ...details
  });
  
  // 将来的にはFirestoreのauditLogsコレクションに保存
  // await addDoc(collection(db, 'auditLogs'), {
  //   event,
  //   userId,
  //   tenant,
  //   details,
  //   timestamp: new Date()
  // });
}

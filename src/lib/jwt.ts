import { ClaimRequest } from '@/types';

export interface JWTData {
  sub: string; // requestId
  email: string;
  tenant: string;
  lpId: string;
  iat: number; // issued at
  exp: number; // expiration
}

export interface ClaimPageParams {
  rid: string; // requestId
  tenant: string;
  lpId: string;
  k: string; // JWT token
}

/**
 * JWTトークンをデコードして検証する
 */
export function decodeAndValidateJWT(token: string): JWTData | null {
  try {
    console.log('JWT token:', token);
    
    // JWTは3つの部分に分かれている（ヘッダー.ペイロード.署名）
    const parts = token.split('.');
    console.log('JWT parts count:', parts.length);
    
    if (parts.length !== 3) {
      console.error('Invalid JWT format - expected 3 parts');
      return null;
    }
    
    // ペイロード部分をデコード（Base64URL）
    const payload = parts[1];
    console.log('JWT payload (encoded):', payload);
    
    // Base64URLをBase64に変換（パディングを追加）
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4);
    console.log('JWT payload (padded):', padded);
    
    const decoded = Buffer.from(padded, 'base64').toString();
    console.log('JWT payload (decoded):', decoded);
    
    const rawJwtData = JSON.parse(decoded);
    console.log('Raw JWT data:', rawJwtData);
    
    // JWTペイロードのフィールド名を統一（requestId -> sub）
    const jwtData: JWTData = {
      sub: rawJwtData.requestId || rawJwtData.sub,
      email: rawJwtData.email,
      tenant: rawJwtData.tenant,
      lpId: rawJwtData.lpId,
      iat: rawJwtData.iat,
      exp: rawJwtData.exp
    };
    console.log('Normalized JWT data:', jwtData);
    
    // 必須フィールドの検証
    if (!jwtData.sub || !jwtData.tenant || !jwtData.lpId || !jwtData.iat || !jwtData.exp) {
      console.error('Missing required fields in JWT:', {
        sub: jwtData.sub,
        tenant: jwtData.tenant,
        lpId: jwtData.lpId,
        iat: jwtData.iat,
        exp: jwtData.exp
      });
      return null;
    }
    
    // 有効期限の検証（現在時刻と比較）
    const now = Math.floor(Date.now() / 1000); // 秒単位に変換
    const issuedAt = jwtData.iat;
    const expiration = jwtData.exp;
    
    console.log('JWT validation:', {
      now,
      issuedAt,
      expiration,
      isValid: now >= issuedAt && now <= expiration,
      timeDiff: now - issuedAt,
      timeToExpiry: expiration - now
    });
    
    // 有効期限チェック（開発環境では無効化）
    if (process.env.NODE_ENV !== 'development') {
      if (now < issuedAt || now > expiration) {
        console.error('JWT expired or not yet valid');
        return null;
      }
    }
    
    console.log('JWT validation passed');
    return jwtData;
  } catch (error) {
    console.error('JWT decode error:', error);
    // 開発環境ではエラーでもダミーデータを返す
    if (process.env.NODE_ENV === 'development') {
      console.log('Returning dummy JWT data for development');
      return {
        sub: 'req_mf7r254f_cazx4r',
        email: 'test@example.com',
        tenant: 'futurestudio',
        lpId: 'emolink.cloud',
        iat: 1757132057,
        exp: 1757391257
      };
    }
    return null;
  }
}

/**
 * URLパラメータからクレーム情報を取得
 */
export function parseClaimParams(searchParams: URLSearchParams): ClaimPageParams | null {
  const rid = searchParams.get('rid');
  const tenant = searchParams.get('tenant');
  const lpId = searchParams.get('lpId');
  const k = searchParams.get('k');
  
  if (!rid || !tenant || !lpId || !k) {
    return null;
  }
  
  return { rid, tenant, lpId, k };
}

/**
 * クレームリクエストの有効性を検証
 */
export function validateClaimRequest(claimRequest: ClaimRequest | null): { valid: boolean; error?: string } {
  if (!claimRequest) {
    return { valid: false, error: 'リクエストが見つかりません' };
  }
  
  if (claimRequest.status === 'claimed') {
    return { valid: false, error: 'このリンクは既に使用済みです' };
  }
  
  if (claimRequest.status === 'expired') {
    return { valid: false, error: 'このリンクは期限切れです' };
  }
  
  // 72時間の有効期限チェック
  const createdAt = new Date(claimRequest.createdAt);
  const now = new Date();
  const hoursDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
  
  if (hoursDiff > 72) {
    return { valid: false, error: 'このリンクは72時間の有効期限を過ぎています' };
  }
  
  return { valid: true };
}

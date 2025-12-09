/**
 * OGP取得サービス
 * Firebase FunctionsのOGP取得APIを呼び出す
 */

interface OGPResponse {
  ok: boolean;
  data?: {
    title?: string;
    description?: string;
    image?: string;
    url?: string;
  };
  error?: string;
}

/**
 * URLからOGP情報を取得
 * @param url 取得するURL
 * @returns OGP情報
 */
export async function fetchOGP(url: string): Promise<{
  title?: string;
  description?: string;
  image?: string;
  url?: string;
} | null> {
  try {
    // Firebase Functionsのエンドポイントを構築
    // 本番環境と開発環境で異なるURLを使用
    // 注意: プロジェクトIDは環境に応じて変更してください
    const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'memorylink-cms';
    const baseUrl = isDevelopment
      ? `http://localhost:5001/${projectId}/asia-northeast1/getOgp`
      : `https://asia-northeast1-${projectId}.cloudfunctions.net/getOgp`;

    console.log('Fetching OGP from:', baseUrl);
    console.log('URL to fetch:', url);

    const requestUrl = `${baseUrl}?url=${encodeURIComponent(url)}`;
    console.log('OGP API request URL:', requestUrl);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30秒のタイムアウト

    try {
      const response = await fetch(requestUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      console.log('OGP API response status:', response.status);
      console.log('OGP API response headers:', Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error('OGP API error response:', errorText);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const data: OGPResponse = await response.json();
      console.log('OGP API response data:', data);

    if (!data.ok || !data.data) {
      console.warn('OGP API returned error:', data.error);
      throw new Error(data.error || 'Failed to fetch OGP');
    }

      return data.data;
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('OGP API request timeout after 30 seconds');
        throw new Error('Request timeout');
      }
      throw fetchError;
    }
  } catch (error: any) {
    console.error('=== OGP Fetch Error ===');
    console.error('Error type:', error?.name || typeof error);
    console.error('Error message:', error?.message || String(error));
    console.error('Error stack:', error?.stack);
    return null;
  }
}


import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | number): string {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * テナントごとに異なる公開ページURLを生成
 * @param pageId 公開ページID
 * @param tenant テナント名（オプション、指定しない場合は現在のテナントを使用）
 * @param baseUrl ベースURL（オプション、指定しない場合は現在のOriginを使用）
 * @returns 公開ページのURL
 */
export function generatePublicPageUrl(pageId: string, tenant?: string, baseUrl?: string): string {
  // 環境変数で固定ドメインを使用（NFCタグ用に一貫性を保つ）
  const url = baseUrl || (typeof window !== 'undefined' ? process.env.NEXT_PUBLIC_APP_URL || window.location.origin : process.env.NEXT_PUBLIC_APP_URL || 'https://emolink-cms.web.app');
  
  // シンプルなURL（テナント情報はクエリパラメータに含めない）
  return `${url}/public/${pageId}`;
}

/**
 * NFCタグ用の短縮URLを生成（テナント情報を含む）
 * @param pageId 公開ページID
 * @param tenant テナント名
 * @param baseUrl ベースURL（オプション）
 * @returns NFCタグ用のURL
 */
export function generateNfcUrl(pageId: string, tenant?: string, baseUrl?: string): string {
  return generatePublicPageUrl(pageId, tenant, baseUrl);
}

/**
 * 動画サムネイル生成
 * @param videoFile 動画ファイル
 * @returns サムネイルのDataURL
 */
export function generateVideoThumbnail(videoFile: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      reject(new Error('Canvas context not available'));
      return;
    }

    video.onloadedmetadata = () => {
      // 動画の最初のフレームをキャプチャ
      video.currentTime = 0;
    };

    video.onseeked = () => {
      try {
        // キャンバスのサイズを設定
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        // 動画フレームをキャンバスに描画
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        // サムネイルサイズにリサイズ（最大300x300）
        const thumbnailCanvas = document.createElement('canvas');
        const thumbnailCtx = thumbnailCanvas.getContext('2d');

        if (!thumbnailCtx) {
          reject(new Error('Thumbnail canvas context not available'));
          return;
        }

        const maxSize = 300;
        let { width, height } = canvas;
        
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }

        thumbnailCanvas.width = width;
        thumbnailCanvas.height = height;

        // サムネイルを描画
        thumbnailCtx.drawImage(canvas, 0, 0, width, height);

        // Base64に変換
        const thumbnailDataUrl = thumbnailCanvas.toDataURL('image/jpeg', 0.8);
        resolve(thumbnailDataUrl);
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    // 動画ファイルを読み込み
    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.load();
  });
}

/**
 * 動画の長さを取得
 * @param videoFile 動画ファイル
 * @returns 動画の長さ（秒）
 */
export function getVideoDuration(videoFile: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      resolve(video.duration);
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.load();
  });
}

/**
 * 動画の解像度を取得
 * @param videoFile 動画ファイル
 * @returns 動画の解像度（幅と高さ）
 */
export function getVideoResolution(videoFile: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    
    video.onloadedmetadata = () => {
      resolve({
        width: video.videoWidth,
        height: video.videoHeight
      });
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    const url = URL.createObjectURL(videoFile);
    video.src = url;
    video.load();
  });
}

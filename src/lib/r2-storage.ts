// 注意: R2への直接アップロードはサーバーサイドでのみ可能です
// クライアントサイドからはAPIルート経由でアップロードします

// 画像アップロード（APIルート経由）
export async function uploadImageToR2(
  file: File,
  memoryId: string,
  fileName: string
): Promise<{ url: string; path: string }> {
  const key = `users/${memoryId}/uploads/${fileName}`;
  console.log('uploadImageToR2: uploading to', key);
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', key);
  
  console.log('Calling /api/upload...');
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  console.log('Response status:', response.status);
  
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error('Upload failed:', errorData);
    throw new Error(errorData.error || 'Upload failed');
  }
  
  const data = await response.json();
  console.log('Upload successful, URL:', data.url);
  return { url: data.url, path: data.path };
}

// 動画アップロード（APIルート経由）
export async function uploadVideoToR2(
  file: File,
  memoryId: string,
  fileName: string
): Promise<{ url: string; path: string }> {
  const key = `users/${memoryId}/uploads/${fileName}`;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', key);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  const data = await response.json();
  return { url: data.url, path: data.path };
}

// 音声アップロード（APIルート経由）
export async function uploadAudioToR2(
  file: File,
  memoryId: string,
  fileName: string
): Promise<{ url: string; path: string }> {
  const key = `users/${memoryId}/uploads/${fileName}`;
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', key);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  const data = await response.json();
  return { url: data.url, path: data.path };
}

// 汎用ファイルアップロード（進捗コールバック付き、APIルート経由）
export async function uploadFileToR2(
  file: File,
  storagePath: string,
  onProgress?: (progress: { loaded: number; total: number }) => void
): Promise<{ url: string; thumbnailUrl?: string }> {
  // 進捗コールバック（簡易版）
  if (onProgress) {
    onProgress({ loaded: 0, total: file.size });
  }
  
  const formData = new FormData();
  formData.append('file', file);
  formData.append('path', storagePath);
  
  const response = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });
  
  if (!response.ok) {
    throw new Error('Upload failed');
  }
  
  // 進捗完了
  if (onProgress) {
    onProgress({ loaded: file.size, total: file.size });
  }
  
  const data = await response.json();
  return { url: data.url };
}

// ファイル削除（APIルート経由、実装が必要）
export async function deleteFileFromR2(path: string): Promise<void> {
  // TODO: APIルートを作成して実装
  const response = await fetch('/api/upload/delete', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ path }),
  });
  
  if (!response.ok) {
    throw new Error('Delete failed');
  }
}

// ファイル一覧取得（APIルート経由、実装が必要）
export async function listFilesFromR2(memoryId: string): Promise<string[]> {
  // TODO: APIルートを作成して実装
  const response = await fetch(`/api/upload/list?memoryId=${memoryId}`);
  
  if (!response.ok) {
    throw new Error('List failed');
  }
  
  const data = await response.json();
  return data.files || [];
}

// ファイルサイズ取得（APIルート経由、実装が必要）
export async function getFileSizeFromR2(path: string): Promise<number> {
  // TODO: APIルートを作成して実装
  const response = await fetch(`/api/upload/size?path=${encodeURIComponent(path)}`);
  
  if (!response.ok) {
    throw new Error('Get size failed');
  }
  
  const data = await response.json();
  return data.size || 0;
}


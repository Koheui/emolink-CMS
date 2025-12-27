import { 
  ref, 
  uploadBytes, 
  getDownloadURL, 
  deleteObject,
  listAll,
  getMetadata
} from 'firebase/storage';
import { storage } from './firebase';
import {
  uploadImageToR2,
  uploadVideoToR2,
  uploadAudioToR2,
  uploadFileToR2,
  deleteFileFromR2,
  listFilesFromR2,
  getFileSizeFromR2,
} from './r2-storage';

// ストレージプロバイダーの選択（環境変数で切り替え）
const STORAGE_PROVIDER = process.env.NEXT_PUBLIC_STORAGE_PROVIDER || 'firebase'; // 'firebase' | 'r2'

// デバッグ用ログ
if (typeof window !== 'undefined') {
  console.log('Storage Provider:', STORAGE_PROVIDER);
}

// 画像アップロード
export async function uploadImage(
  file: File, 
  memoryId: string, 
  fileName: string
): Promise<{ url: string; path: string }> {
  console.log('uploadImage called, STORAGE_PROVIDER:', STORAGE_PROVIDER);
  if (STORAGE_PROVIDER === 'r2') {
    console.log('Using R2 for image upload');
    return await uploadImageToR2(file, memoryId, fileName);
  }
  
  console.log('Using Firebase Storage for image upload');
  
  // Firebase Storage（デフォルト）
  const storagePath = `users/${memoryId}/uploads/${fileName}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { url, path: storagePath };
}

// 動画アップロード
export async function uploadVideo(
  file: File, 
  memoryId: string, 
  fileName: string
): Promise<{ url: string; path: string }> {
  if (STORAGE_PROVIDER === 'r2') {
    return await uploadVideoToR2(file, memoryId, fileName);
  }
  
  // Firebase Storage（デフォルト）
  const storagePath = `users/${memoryId}/uploads/${fileName}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { url, path: storagePath };
}

// 音声アップロード
export async function uploadAudio(
  file: File, 
  memoryId: string, 
  fileName: string
): Promise<{ url: string; path: string }> {
  if (STORAGE_PROVIDER === 'r2') {
    return await uploadAudioToR2(file, memoryId, fileName);
  }
  
  // Firebase Storage（デフォルト）
  const storagePath = `users/${memoryId}/uploads/${fileName}`;
  const storageRef = ref(storage, storagePath);
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  return { url, path: storagePath };
}

// ファイル削除
export async function deleteFile(path: string): Promise<void> {
  if (STORAGE_PROVIDER === 'r2') {
    return await deleteFileFromR2(path);
  }
  
  // Firebase Storage（デフォルト）
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}

// ファイル一覧取得
export async function listFiles(memoryId: string): Promise<string[]> {
  if (STORAGE_PROVIDER === 'r2') {
    return await listFilesFromR2(memoryId);
  }
  
  // Firebase Storage（デフォルト）
  const storageRef = ref(storage, `users/${memoryId}/uploads`);
  const result = await listAll(storageRef);
  
  return result.items.map(item => item.fullPath);
}

// ファイルサイズ取得
export async function getFileSize(path: string): Promise<number> {
  if (STORAGE_PROVIDER === 'r2') {
    return await getFileSizeFromR2(path);
  }
  
  // Firebase Storage（デフォルト）
  const storageRef = ref(storage, path);
  const metadata = await getMetadata(storageRef);
  return metadata.size;
}

// 汎用ファイルアップロード（進捗コールバック付き）
export async function uploadFile(
  file: File, 
  storagePath: string,
  onProgress?: (progress: { loaded: number; total: number }) => void
): Promise<{ url: string; thumbnailUrl?: string }> {
  if (STORAGE_PROVIDER === 'r2') {
    return await uploadFileToR2(file, storagePath, onProgress);
  }
  
  // Firebase Storage（デフォルト）
  const storageRef = ref(storage, storagePath);
  
  // 進捗コールバックがある場合は使用
  if (onProgress) {
    // Firebase Storageの進捗監視は実装が複雑なため、簡易版
    onProgress({ loaded: 0, total: file.size });
  }
  
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);
  
  // 進捗完了
  if (onProgress) {
    onProgress({ loaded: file.size, total: file.size });
  }
  
  return { url };
}

// ファイル名を生成
export function generateFileName(originalName: string, type: string): string {
  const timestamp = Date.now();
  const extension = originalName.split('.').pop();
  return `${type}_${timestamp}.${extension}`;
}

// ファイルタイプを判定
export function getFileType(file: File): 'image' | 'video' | 'audio' {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  throw new Error('Unsupported file type');
}

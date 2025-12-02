'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Camera, Video as VideoIcon, Music, Image as ImageIcon, Trash2, Eye, EyeOff, FileText, Edit, X, ArrowUp, Play, Mountain, ExternalLink, Palette, LogOut } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { useMemories, useMemory } from '@/hooks/use-memories';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate, generatePublicPageUrl, generateNfcUrl } from '@/lib/utils';
import { getCurrentTenant } from '@/lib/security/tenant-validation';
import { getMemoryById, updateMemory, deleteMemory, getClaimRequestById, createPublicPage, updatePublicPage, getPublicPageById } from '@/lib/firestore';
import { doc, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { ClaimRequest } from '@/types';

interface AlbumItem {
  id: string;
  url: string;
  title?: string;
  description?: string;
  fileSize?: number; // ファイルサイズ（バイト単位、ストレージ使用量計算用）
}

interface MediaBlock {
  id: string;
  type: 'image' | 'video' | 'audio' | 'album' | 'text';
  url?: string;
  thumbnail?: string;
  visibility: 'public' | 'private';
  title?: string;
  description?: string;
  isTopic?: boolean; // Topicsに表示するかどうか
  albumItems?: AlbumItem[];
  fileSize?: number; // ファイルサイズ（バイト単位、ストレージ使用量計算用）
}

function CreateMemoryPageContent() {
  const { user: currentUser, loading: authLoading, isAuthenticated, isAdmin, logout } = useSecretKeyAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null);
  const [showExistingMemories, setShowExistingMemories] = useState(false);
  const [showNfcUrlModal, setShowNfcUrlModal] = useState(false);
  const [selectedMemoryForNfc, setSelectedMemoryForNfc] = useState<{ id: string; publicPageId?: string } | null>(null);
  
  const authBypass = searchParams.get('auth') === 'bypass';
  const memoryId = searchParams.get('memoryId');
  
  // LP経由（/claim経由）で来たかどうかを判定
  // sessionStorageのfromClaimフラグをチェック（より厳密）
  const [isFromClaim, setIsFromClaim] = useState(false);
  
  // fromClaimフラグをチェック（毎回チェック）
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const fromClaim = sessionStorage.getItem('fromClaim') === 'true';
      setIsFromClaim(fromClaim);
    }
  }, []);
  
  // 既存の想い出ページを取得
  // デバッグ用: ユーザー情報をログ出力
  useEffect(() => {
    console.log('=== User Debug Info ===');
    console.log('currentUser:', currentUser);
    console.log('currentUser?.uid:', currentUser?.uid);
    console.log('isAuthenticated:', isAuthenticated);
    console.log('authLoading:', authLoading);
    console.log('Firebase Auth user:', auth?.currentUser);
  }, [currentUser, isAuthenticated, authLoading]);
  
  const { data: existingMemories = [], isLoading: memoriesLoading, error: memoriesError } = useMemories(currentUser?.uid || '');
  
  // memoryIdがある場合、既存のmemoryを取得（エンドユーザーは自分のmemoryであればテナント問わずアクセス可能）
  const { data: existingMemory, isLoading: existingMemoryLoading, refetch: refetchMemory } = useMemory(memoryId || '');
  
  // 既存のmemoryを読み込む（memoryIdがある場合）
  // 注意: このuseEffectは、existingMemoryが変更されたときのみ実行される
  // 保存処理中は実行されないようにするため、loading状態もチェック
  const [hasLoadedMemory, setHasLoadedMemory] = useState(false);
  const [lastLoadedMemoryId, setLastLoadedMemoryId] = useState<string | null>(null);
  
  // ログイン後に既存のメモリが1つだけの場合、自動的にそのメモリにリダイレクト
  useEffect(() => {
    // 認証が完了し、既存のメモリが1つだけで、memoryIdがURLにない場合
    if (
      !authLoading &&
      isAuthenticated &&
      currentUser?.uid &&
      existingMemories.length === 1 &&
      !memoryId &&
      !memoriesLoading &&
      !existingMemoryLoading
    ) {
      const firstMemory = existingMemories[0];
      console.log('Auto-redirecting to existing memory:', firstMemory.id);
      router.replace(`/memories/create?memoryId=${firstMemory.id}`, { scroll: false });
    }
  }, [authLoading, isAuthenticated, currentUser?.uid, existingMemories, memoryId, memoriesLoading, existingMemoryLoading, router]);
  
  // ログイン後に状態をリセット（再ログイン時に既存のメモリを読み込むため）
  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.uid) {
      console.log('=== After Login: Resetting load flags ===');
      console.log('memoryId from URL:', memoryId);
      console.log('hasLoadedMemory before reset:', hasLoadedMemory);
      console.log('lastLoadedMemoryId before reset:', lastLoadedMemoryId);
      
      // ログイン後に状態をリセットして、既存のメモリを再読み込み
      // memoryIdがURLに含まれている場合は、既存のメモリを読み込む必要がある
      if (memoryId && hasLoadedMemory && lastLoadedMemoryId === memoryId) {
        console.log('Resetting load flags to reload memory after login');
        setHasLoadedMemory(false);
        setLastLoadedMemoryId(null);
      }
    }
  }, [authLoading, isAuthenticated, currentUser?.uid, memoryId, hasLoadedMemory, lastLoadedMemoryId]);
  
  // デバッグ用: ログイン後の状態を確認
  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.uid) {
      console.log('=== After Login Debug ===');
      console.log('memoryId from URL:', memoryId);
      console.log('existingMemory:', existingMemory);
      console.log('existingMemoryLoading:', existingMemoryLoading);
      console.log('existingMemories count:', existingMemories.length);
      console.log('hasLoadedMemory:', hasLoadedMemory);
      console.log('lastLoadedMemoryId:', lastLoadedMemoryId);
    }
  }, [authLoading, isAuthenticated, currentUser?.uid, memoryId, existingMemory, existingMemoryLoading, existingMemories.length, hasLoadedMemory, lastLoadedMemoryId]);
  
  // デバッグ用: メモリ取得結果をログ出力
  useEffect(() => {
    console.log('=== Memories Fetch Debug ===');
    console.log('existingMemories:', existingMemories);
    console.log('memoriesLoading:', memoriesLoading);
    console.log('memoriesError:', memoriesError);
    console.log('Query enabled:', !!currentUser?.uid);
  }, [existingMemories, memoriesLoading, memoriesError, currentUser?.uid]);
  
  // デバッグ用: memoryIdとexistingMemoryの状態をログ出力
  useEffect(() => {
    console.log('=== Memory ID Debug ===');
    console.log('memoryId from URL:', memoryId);
    console.log('existingMemory:', existingMemory);
    console.log('existingMemoryLoading:', existingMemoryLoading);
    console.log('Current URL:', typeof window !== 'undefined' ? window.location.href : 'N/A');
  }, [memoryId, existingMemory, existingMemoryLoading]);
  
  // 公開ページIDをstateで管理（保存後に更新される）
  const [currentPublicPageId, setCurrentPublicPageId] = useState<string | null>(null);
  
  // 初期設定ページで作成された公開ページIDをsessionStorageから読み込む
  useEffect(() => {
    if (typeof window !== 'undefined' && !currentPublicPageId) {
      const initialSetupPublicPageId = sessionStorage.getItem('initialSetupPublicPageId');
      if (initialSetupPublicPageId) {
        console.log('✅ Loading initialSetupPublicPageId from sessionStorage:', initialSetupPublicPageId);
        setCurrentPublicPageId(initialSetupPublicPageId);
        // sessionStorageから削除しない（保存処理で使用するため）
      } else {
        console.log('ℹ️ No initialSetupPublicPageId found in sessionStorage');
      }
    }
  }, []); // 初回マウント時のみ実行
  
  // React Queryのクライアント
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bio, setBio] = useState('');
  const [showEditBanner, setShowEditBanner] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImagePosition, setProfileImagePosition] = useState('center center');
  const [profileImageScale, setProfileImageScale] = useState(1);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState('center center');
  const [coverImageScale, setCoverImageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingProfile, setIsDraggingProfile] = useState(false);
  // ドラッグ開始時の位置を記録（写真を動かすため）
  const [dragStartPos, setDragStartPos] = useState<{ x: number; y: number; posX: number; posY: number } | null>(null);
  const [dragStartPosProfile, setDragStartPosProfile] = useState<{ x: number; y: number; posX: number; posY: number } | null>(null);
  // ピンチ開始時の距離とスケールを記録
  const [pinchStart, setPinchStart] = useState<{ distance: number; scale: number } | null>(null);
  const [pinchStartProfile, setPinchStartProfile] = useState<{ distance: number; scale: number } | null>(null);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [mediaBlocks, setMediaBlocks] = useState<MediaBlock[]>([]);
  // mediaBlocksの最新の状態を保持するためのref
  const mediaBlocksRef = useRef<MediaBlock[]>([]);
  
  // mediaBlocksが更新されたら、refも更新
  useEffect(() => {
    mediaBlocksRef.current = mediaBlocks;
    console.log('=== mediaBlocks state updated ===');
    console.log('mediaBlocks count:', mediaBlocks.length);
    console.log('mediaBlocks with URLs:', mediaBlocks.filter(b => b.url).map(b => ({ id: b.id, type: b.type, url: b.url?.substring(0, 50) })));
  }, [mediaBlocks]);
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [accentColor, setAccentColor] = useState('#08af86');
  const [textColor, setTextColor] = useState('#ffffff');
  const [backgroundColor, setBackgroundColor] = useState('#000f24');
  // エディットページの背景色とカード背景色は固定
  const editPageBackgroundColor = '#000';
  const editPageCardBackgroundColor = '#1a1a1a';
  const [titleFontSize, setTitleFontSize] = useState(35); // px単位
  const [bodyFontSize, setBodyFontSize] = useState(16); // px単位
  const [topicsTitle, setTopicsTitle] = useState('Topics');
  const [storageUsed, setStorageUsed] = useState(0); // 現在のストレージ使用量（バイト単位）
  const [claimRequest, setClaimRequest] = useState<ClaimRequest | null>(null);
  const [claimRequestLoading, setClaimRequestLoading] = useState(false);
  
  // ストレージ制限（200MB = 200 * 1024 * 1024 バイト）
  const STORAGE_LIMIT = 200 * 1024 * 1024; // 209715200 バイト
  
  // claimRequestを取得（認証成功時にURLが確定されるため）
  useEffect(() => {
    const loadClaimRequest = async () => {
      if (typeof window === 'undefined') return;
      
      const claimRequestId = sessionStorage.getItem('currentClaimRequestId');
      if (!claimRequestId) return;
      
      setClaimRequestLoading(true);
      try {
        // エンドユーザーが自分のclaimRequestを取得する場合はテナントチェックをスキップ
        const request = await getClaimRequestById(claimRequestId, true);
        if (request) {
          setClaimRequest(request);
          console.log('Claim request loaded:', {
            id: request.id,
            publicPageUrl: request.publicPageUrl,
            loginUrl: request.loginUrl,
            status: request.status,
          });
        } else {
          console.warn('Claim request not found:', claimRequestId);
        }
      } catch (error) {
        console.error('Failed to load claim request:', error);
      } finally {
        setClaimRequestLoading(false);
      }
    };
    
    loadClaimRequest();
    
    // Functions APIが完了するまで少し待ってから再取得（最大5回、1秒間隔）
    let retryCount = 0;
    const maxRetries = 5;
    const retryInterval = setInterval(async () => {
      if (retryCount >= maxRetries) {
        clearInterval(retryInterval);
        return;
      }
      
      const claimRequestId = sessionStorage.getItem('currentClaimRequestId');
      if (!claimRequestId) {
        clearInterval(retryInterval);
        return;
      }
      
      try {
        // エンドユーザーが自分のclaimRequestを取得する場合はテナントチェックをスキップ
        const request = await getClaimRequestById(claimRequestId, true);
        if (request && request.publicPageUrl) {
          // URLが設定されていたら更新してポーリングを停止
          setClaimRequest(request);
          console.log('Claim request updated with URL:', {
            id: request.id,
            publicPageUrl: request.publicPageUrl,
          });
          clearInterval(retryInterval);
        } else {
          retryCount++;
          console.log(`Retrying claim request fetch (${retryCount}/${maxRetries})...`, {
            hasRequest: !!request,
            hasPublicPageUrl: !!request?.publicPageUrl,
          });
        }
      } catch (error) {
        console.error('Failed to retry load claim request:', error);
        retryCount++;
      }
    }, 1000); // 1秒ごとに再取得
    
    return () => clearInterval(retryInterval);
  }, []);
  
  useEffect(() => {
    console.log('=== useEffect: Loading existing memory ===');
    console.log('memoryId:', memoryId);
    console.log('existingMemory:', existingMemory);
    console.log('currentUser:', currentUser);
    console.log('loading:', loading);
    console.log('hasLoadedMemory:', hasLoadedMemory);
    console.log('lastLoadedMemoryId:', lastLoadedMemoryId);
    
    // 保存処理中は読み込み処理を実行しない
    if (loading) {
      console.log('Save process in progress, skipping load');
      return;
    }
    
    // memoryIdが変更された場合、または既に読み込み済みでない場合のみ読み込み
    // 同じmemoryIdで既に読み込み済みの場合は、existingMemoryが更新されたときのみ再読み込み
    console.log('=== useEffect check ===');
    console.log('memoryId:', memoryId);
    console.log('existingMemory:', existingMemory);
    console.log('existingMemoryLoading:', existingMemoryLoading);
    console.log('currentUser:', currentUser?.uid);
    console.log('hasLoadedMemory:', hasLoadedMemory);
    console.log('lastLoadedMemoryId:', lastLoadedMemoryId);
    
    if (memoryId && existingMemory && currentUser) {
      // memoryIdが変更された場合は、読み込み済みフラグをリセット
      if (lastLoadedMemoryId !== memoryId) {
        console.log('Memory ID changed, resetting load flag');
        setHasLoadedMemory(false);
        setLastLoadedMemoryId(memoryId);
      }
      
      // 既に読み込み済みで、existingMemoryが変更されていない場合はスキップ
      // ただし、blocksが空の場合は再読み込みする（再ログイン後の場合など）
      if (hasLoadedMemory && lastLoadedMemoryId === memoryId) {
        // blocksが空でない場合はスキップ
        const currentBlocks = (existingMemory.blocks as any) || [];
        if (currentBlocks.length > 0) {
          console.log('Already loaded this memory with blocks, skipping');
          return;
        } else {
          console.log('Memory already loaded but blocks is empty, reloading...');
          // blocksが空の場合は再読み込み
          setHasLoadedMemory(false);
        }
      }
      // 既存のmemoryデータでstateを初期化
      setTitle(existingMemory.title || '');
      setDescription(existingMemory.description || '');
      setBio(existingMemory.bio || '');
      setProfileImage(existingMemory.profileImage || null);
      setProfileImagePosition(existingMemory.profileImagePosition || 'center center');
      setProfileImageScale(existingMemory.profileImageScale || 1);
      setCoverImage((existingMemory as any).coverImage || null);
      setCoverImagePosition(existingMemory.coverImagePosition || 'center center');
      setCoverImageScale((existingMemory as any).coverImageScale || 1);
      // blocksはMediaBlock[]形式で保存されている可能性があるため、そのまま使用
      // Block[]の場合はMediaBlock[]に変換（linkタイプは除外）
      const blocks = (existingMemory.blocks as any) || [];
      console.log('=== Loading existing memory blocks ===');
      console.log('Raw blocks from Firestore:', blocks);
      console.log('Blocks count:', blocks.length);
      console.log('Blocks type:', typeof blocks);
      console.log('Blocks is array:', Array.isArray(blocks));
      if (Array.isArray(blocks)) {
        console.log('Blocks with URLs:', blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
      }
      
      const mediaBlocks = blocks.filter((block: any) => 
        block.type !== 'link' && ['image', 'video', 'audio', 'album', 'text'].includes(block.type)
      ) as MediaBlock[];
      
      console.log('Filtered mediaBlocks:', mediaBlocks);
      console.log('Filtered mediaBlocks count:', mediaBlocks.length);
      console.log('MediaBlocks with URLs:', mediaBlocks.filter(b => b.url).map(b => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
      
      // 保存処理中でない場合のみ、mediaBlocksを更新
      // 保存処理中にuseEffectが実行されると、mediaBlocksが空の状態で上書きされる可能性がある
      // ただし、blocksが空でない場合は、保存処理中でも更新する（リロード時の読み込みのため）
      if (!loading || (loading && mediaBlocks.length > 0)) {
        console.log('Setting mediaBlocks', { loading, mediaBlocksCount: mediaBlocks.length });
        setMediaBlocks(mediaBlocks);
        // refも同時に更新
        mediaBlocksRef.current = mediaBlocks;
        setHasLoadedMemory(true);
      } else {
        console.log('Skipping setMediaBlocks (save process in progress and blocks is empty)');
      }
    } else {
      console.log('=== useEffect: Conditions not met ===');
      console.log('memoryId exists:', !!memoryId);
      console.log('existingMemory exists:', !!existingMemory);
      console.log('currentUser exists:', !!currentUser);
      if (!memoryId) {
        console.log('Reason: memoryId is missing');
      }
      if (!existingMemory) {
        console.log('Reason: existingMemory is missing', { existingMemoryLoading });
      }
      if (!currentUser) {
        console.log('Reason: currentUser is missing');
      }
    }
    
    if (memoryId && existingMemory && currentUser) {
      setAccentColor(existingMemory.colors?.accent || '#08af86');
      setTextColor(existingMemory.colors?.text || '#ffffff');
      setBackgroundColor(existingMemory.colors?.background || '#000f24');
      setTitleFontSize(existingMemory.fontSizes?.title || 35);
      setBodyFontSize(existingMemory.fontSizes?.body || 16);
      setTopicsTitle(existingMemory.topicsTitle || 'Topics');
      
      // 公開ページIDをstateに設定
      // 優先順位: existingMemory.publicPageId > sessionStorageのinitialSetupPublicPageId > currentPublicPageId
      if (existingMemory.publicPageId) {
        console.log('Setting currentPublicPageId from existingMemory:', existingMemory.publicPageId);
        setCurrentPublicPageId(existingMemory.publicPageId);
      } else if (typeof window !== 'undefined') {
        const initialSetupPublicPageId = sessionStorage.getItem('initialSetupPublicPageId');
        if (initialSetupPublicPageId && !currentPublicPageId) {
          console.log('Setting currentPublicPageId from sessionStorage:', initialSetupPublicPageId);
          setCurrentPublicPageId(initialSetupPublicPageId);
        }
      }
      
      // ストレージ使用量を計算（既存のstorageUsedがない場合、blocksから計算）
      let calculatedStorage = existingMemory.storageUsed || 0;
      if (!existingMemory.storageUsed && mediaBlocks.length > 0) {
        calculatedStorage = mediaBlocks.reduce((sum, block) => {
          if (block.type === 'album' && block.albumItems) {
            return sum + block.albumItems.reduce((itemSum, item) => itemSum + (item.fileSize || 0), 0);
          } else if (block.fileSize) {
            return sum + block.fileSize;
          }
          return sum;
        }, 0);
      }
      setStorageUsed(calculatedStorage);
    } else if (!memoryId) {
      // memoryIdがない場合は、読み込み済みフラグをリセット
      setHasLoadedMemory(false);
      setLastLoadedMemoryId(null);
    }
  }, [memoryId, existingMemory, currentUser, loading, hasLoadedMemory, lastLoadedMemoryId]);
  
  // ログインフォーム用のstate（条件分岐の前に定義）
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const handleAddMedia = (type: 'image' | 'video' | 'audio' | 'album' | 'text') => {
    if (type === 'text') {
      // テキストブロックを直接作成
      const newBlock: MediaBlock = {
        id: Date.now().toString(),
        type: 'text',
        visibility: 'public',
        title: '',
        description: '',
      };
      setMediaBlocks(prev => {
        const updated = [...prev, newBlock];
        mediaBlocksRef.current = updated;
        return updated;
      });
      setShowUploadMenu(false);
      return;
    }
    
    if (type === 'album') {
      // アルバムの場合は複数選択でアップロード
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/*';
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;
        
        await handleAlbumUpload(Array.from(files));
      };
      input.click();
    } else {
      // 通常のメディアは1つずつアップロード
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = type === 'image' ? 'image/*' : type === 'video' ? 'video/*' : 'audio/*';
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) return;
        
        for (let i = 0; i < files.length; i++) {
          await handleFileUpload(files[i], type);
        }
      };
      input.click();
    }
    setShowUploadMenu(false);
  };
  
  const handleUpdateBlock = (id: string, field: 'title' | 'description' | 'isTopic', value: string | boolean) => {
    setMediaBlocks(prev => prev.map(block => 
      block.id === id ? { ...block, [field]: value } : block
    ));
  };

  const handleUpdateAlbumItem = (blockId: string, itemId: string, field: 'title' | 'description', value: string) => {
    setMediaBlocks(prev => prev.map(block => 
      block.id === blockId && block.albumItems
        ? {
            ...block,
            albumItems: block.albumItems.map(item =>
              item.id === itemId ? { ...item, [field]: value } : item
            )
          }
        : block
    ));
  };

  // ストレージ制限をチェックする関数
  const checkStorageLimit = (additionalSize: number): boolean => {
    const newTotal = storageUsed + additionalSize;
    if (newTotal > STORAGE_LIMIT) {
      const usedMB = (storageUsed / (1024 * 1024)).toFixed(2);
      const limitMB = (STORAGE_LIMIT / (1024 * 1024)).toFixed(0);
      const additionalMB = (additionalSize / (1024 * 1024)).toFixed(2);
      setError(`ストレージ制限を超えています。現在の使用量: ${usedMB}MB / ${limitMB}MB。追加しようとしているファイル: ${additionalMB}MB。`);
      return false;
    }
    return true;
  };

  // ストレージ使用量を更新する関数（Firestoreにも保存）
  const updateStorageUsed = async (additionalSize: number) => {
    const newStorageUsed = storageUsed + additionalSize;
    setStorageUsed(newStorageUsed);
    
    // memoryIdがある場合、Firestoreにも保存
    if (memoryId) {
      try {
        const memoryRef = doc(db, 'memories', memoryId);
        await updateDoc(memoryRef, {
          storageUsed: newStorageUsed,
        });
      } catch (err) {
        console.error('Failed to update storageUsed in Firestore:', err);
      }
    }
  };

  // ストレージ使用量を減算する関数（削除時用）
  const decreaseStorageUsed = async (sizeToSubtract: number) => {
    const newStorageUsed = Math.max(0, storageUsed - sizeToSubtract);
    setStorageUsed(newStorageUsed);
    
    // memoryIdがある場合、Firestoreにも保存
    if (memoryId) {
      try {
        const memoryRef = doc(db, 'memories', memoryId);
        await updateDoc(memoryRef, {
          storageUsed: newStorageUsed,
        });
      } catch (err) {
        console.error('Failed to update storageUsed in Firestore:', err);
      }
    }
  };

  const handleAddToAlbum = async (blockId: string) => {
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot add to album');
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      try {
        setUploading(true);
        setError(null); // エラーをクリア
        
        // すべてのファイルのサイズを合計してチェック
        const totalSize = Array.from(files).reduce((sum, file) => sum + file.size, 0);
        if (!checkStorageLimit(totalSize)) {
          setUploading(false);
          return;
        }
        
        const newItems: AlbumItem[] = [];
        
        // すべてのファイルをアップロード
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const storageRef = ref(storage, `memories/${currentUser.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          newItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            url: downloadURL,
            fileSize: file.size,
          });
        }
        
        // ストレージ使用量を更新
        await updateStorageUsed(totalSize);
        
        // 既存のアルバムに追加
        setMediaBlocks(prev => prev.map(block => 
          block.id === blockId && block.albumItems
            ? {
                ...block,
                albumItems: [...block.albumItems, ...newItems]
              }
            : block
        ));
      } catch (err: any) {
        console.error('Add to album error:', err);
        setError('写真の追加に失敗しました');
      } finally {
        setUploading(false);
      }
    };
    input.click();
  };

  const handleAlbumUpload = async (files: File[]) => {
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot upload album');
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    try {
      setUploading(true);
      setError(null); // エラーをクリア
      
      // すべてのファイルのサイズを合計してチェック
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      if (!checkStorageLimit(totalSize)) {
        setUploading(false);
        return;
      }
      
      const albumItems: AlbumItem[] = [];
      
      // すべてのファイルをアップロード
      for (const file of files) {
        const storageRef = ref(storage, `memories/${currentUser.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        albumItems.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: downloadURL,
          fileSize: file.size,
        });
      }
      
      // ストレージ使用量を更新
      await updateStorageUsed(totalSize);
      
      // アルバムの合計サイズを計算
      const albumTotalSize = albumItems.reduce((sum, item) => sum + (item.fileSize || 0), 0);
      
      const newBlock: MediaBlock = {
        id: Date.now().toString(),
        type: 'album',
        visibility: 'public',
        albumItems,
        fileSize: albumTotalSize,
      };
      
      console.log('=== handleAlbumUpload: New album block created ===');
      console.log('New album block:', { 
        id: newBlock.id, 
        type: newBlock.type, 
        albumItemsCount: newBlock.albumItems?.length || 0,
        albumItemsUrls: newBlock.albumItems?.map(item => item.url?.substring(0, 50))
      });
      
      setMediaBlocks(prev => {
        const updated = [...prev, newBlock];
        console.log('=== setMediaBlocks (album) ===');
        console.log('Previous mediaBlocks count:', prev.length);
        console.log('New block:', { id: newBlock.id, type: newBlock.type, hasAlbumItems: !!newBlock.albumItems, albumItemsCount: newBlock.albumItems?.length || 0 });
        console.log('Updated mediaBlocks count:', updated.length);
        console.log('Updated mediaBlocks:', updated.map(b => ({ 
          id: b.id, 
          type: b.type, 
          hasUrl: !!b.url, 
          hasAlbumItems: !!b.albumItems,
          albumItemsCount: b.albumItems?.length || 0
        })));
        // refも同時に更新
        mediaBlocksRef.current = updated;
        console.log('mediaBlocksRef updated, current count:', mediaBlocksRef.current.length);
        return updated;
      });
    } catch (err: any) {
      console.error('Album upload error:', err);
      setError('アルバムのアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'audio') => {
    console.log('=== handleFileUpload: Starting ===');
    console.log('File:', { name: file.name, size: file.size, type: file.type });
    console.log('Media type:', type);
    console.log('Current user UID:', currentUser?.uid);
    
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot upload file');
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    try {
      setUploading(true);
      setError(null); // エラーをクリア
      
      // ストレージ制限をチェック
      console.log('Checking storage limit...');
      const canUpload = checkStorageLimit(file.size);
      console.log('Storage limit check result:', canUpload);
      if (!canUpload) {
        console.warn('Storage limit exceeded, aborting upload');
        setUploading(false);
        return;
      }
      
      console.log('Uploading to Firebase Storage...');
      const storageRef = ref(storage, `memories/${currentUser.uid}/${Date.now()}_${file.name}`);
      console.log('Storage ref path:', storageRef.fullPath);
      
      const snapshot = await uploadBytes(storageRef, file);
      console.log('Upload complete, getting download URL...');
      
      const downloadURL = await getDownloadURL(snapshot.ref);
      console.log('Download URL obtained:', downloadURL?.substring(0, 100));
      
      // ストレージ使用量を更新
      await updateStorageUsed(file.size);
      
      const newBlock: MediaBlock = {
        id: Date.now().toString(),
        type,
        url: downloadURL,
        visibility: 'public',
        fileSize: file.size,
      };
      
      console.log('=== handleFileUpload: New block created ===');
      console.log('New block:', { id: newBlock.id, type: newBlock.type, hasUrl: !!newBlock.url, url: newBlock.url?.substring(0, 100) });
      
      setMediaBlocks(prev => {
        const updated = [...prev, newBlock];
        console.log('=== setMediaBlocks (file) ===');
        console.log('Previous mediaBlocks count:', prev.length);
        console.log('New block:', { id: newBlock.id, type: newBlock.type, hasUrl: !!newBlock.url, url: newBlock.url?.substring(0, 50) });
        console.log('Updated mediaBlocks count:', updated.length);
        console.log('Updated mediaBlocks:', updated.map(b => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
        // refも同時に更新
        mediaBlocksRef.current = updated;
        console.log('mediaBlocksRef updated, current count:', mediaBlocksRef.current.length);
        return updated;
      });
      
      console.log('=== handleFileUpload: Complete ===');
    } catch (err: any) {
      console.error('=== handleFileUpload: Error ===');
      console.error('Upload error:', err);
      console.error('Error details:', { message: err.message, code: err.code, stack: err.stack });
      setError('アップロードに失敗しました: ' + (err.message || 'Unknown error'));
    } finally {
      setUploading(false);
      console.log('=== handleFileUpload: Finally (uploading set to false) ===');
    }
  };

  const handleProfileImageUpload = async (file: File) => {
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot upload profile image');
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    try {
      setUploading(true);
      setError(null); // エラーをクリア
      
      // 既存のプロフィール画像がある場合、そのサイズを差し引く必要があるが、
      // 正確なサイズは取得できないため、新しい画像のサイズのみを追加
      // ストレージ制限をチェック
      if (!checkStorageLimit(file.size)) {
        setUploading(false);
        return;
      }
      
      const storageRef = ref(storage, `memories/${currentUser.uid}/profile_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // 既存のプロフィール画像がある場合、そのサイズを差し引く（正確なサイズは取得できないため、今回は追加のみ）
      // ストレージ使用量を更新
      await updateStorageUsed(file.size);
      
      setProfileImage(downloadURL);
      setProfileImagePosition('center center');
      setProfileImageScale(1);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot upload cover image');
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    try {
      setUploading(true);
      setError(null); // エラーをクリア
      
      // ストレージ制限をチェック
      if (!checkStorageLimit(file.size)) {
        setUploading(false);
        return;
      }
      
      const storageRef = ref(storage, `memories/${currentUser.uid}/cover_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      // ストレージ使用量を更新
      await updateStorageUsed(file.size);
      
      setCoverImage(downloadURL);
      setCoverImagePosition('center center');
      setCoverImageScale(1);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('カバー画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // 削除されるブロックのサイズを計算
    const blockToDelete = mediaBlocks.find(block => block.id === id);
    if (blockToDelete) {
      let sizeToSubtract = 0;
      
      if (blockToDelete.type === 'album' && blockToDelete.albumItems) {
        // アルバムの場合、すべてのアイテムのサイズを合計
        sizeToSubtract = blockToDelete.albumItems.reduce((sum, item) => sum + (item.fileSize || 0), 0);
      } else if (blockToDelete.fileSize) {
        // 通常のメディアブロックの場合
        sizeToSubtract = blockToDelete.fileSize;
      }
      
      // ストレージ使用量を減算
      if (sizeToSubtract > 0) {
        await decreaseStorageUsed(sizeToSubtract);
      }
    }
    
    setMediaBlocks(prev => prev.filter(block => block.id !== id));
  };

  const toggleVisibility = (id: string) => {
    setMediaBlocks(prev => prev.map(block => 
      block.id === id 
        ? { ...block, visibility: block.visibility === 'public' ? 'private' : 'public' }
        : block
    ));
  };

  const handleSave = async () => {
    console.log('=== handleSave started ===');
    console.log('Auth status:', { authBypass, isAuthenticated, currentUser: currentUser?.uid });
    console.log('Current loading state:', loading);
    console.log('Current uploading state:', uploading);
    console.log('Current mediaBlocks state:', mediaBlocks);
    console.log('MediaBlocks count:', mediaBlocks.length);
    console.log('MediaBlocks with URLs:', mediaBlocks.filter(b => b.url).map(b => ({ id: b.id, type: b.type, url: b.url?.substring(0, 50) })));
    console.log('mediaBlocksRef current:', mediaBlocksRef.current);
    console.log('mediaBlocksRef current count:', mediaBlocksRef.current.length);
    console.log('mediaBlocksRef current with URLs:', mediaBlocksRef.current.filter(b => b.url).map(b => ({ id: b.id, type: b.type, url: b.url?.substring(0, 50) })));
    
    // 既に保存処理が実行中の場合は、重複実行を防ぐ
    if (loading) {
      console.warn('Save process already in progress, skipping...');
      return;
    }
    
    // アップロード処理が実行中の場合は、完了するまで待つ
    if (uploading) {
      console.warn('Upload process in progress, waiting...');
      // アップロード処理が完了するまで待つ（最大5秒）
      let waitCount = 0;
      while (uploading && waitCount < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        waitCount++;
      }
      if (uploading) {
        setError('アップロード処理が完了していません。しばらく待ってから再度保存してください。');
        return;
      }
      console.log('Upload process completed, proceeding with save');
    }
    
    if (!authBypass && !isAuthenticated) {
      setError('秘密鍵認証が必要です');
      return;
    }

    // バリデーション
    if (!title || title.trim() === '') {
      setError('タイトルを入力してください');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      console.log('Starting save process...');
      
      // mediaBlocksの最新の状態を取得（状態更新が完了するまで少し待つ）
      // Reactの状態更新は同期的に見えるが、念のため最新の状態を確認
      await new Promise(resolve => setTimeout(resolve, 0));

      // 現在のテナントを取得
      const tenant = getCurrentTenant();
      
      console.log('=== Save process started ===');
      console.log('Current user info:', {
        uid: currentUser?.uid,
        email: currentUser?.email,
        isAuthenticated,
        authBypass,
      });
      console.log('Firebase Auth currentUser:', {
        uid: auth.currentUser?.uid,
        email: auth.currentUser?.email,
      });
      console.log('Tenant info:', {
        tenant,
      });

      // 認証チェック
      if (!currentUser?.uid) {
        throw new Error('ユーザーが認証されていません。ログインしてください。');
      }
      
      // Firebase Authenticationの認証状態を確認
      if (!auth.currentUser) {
        console.error('Firebase Authentication not authenticated');
        console.log('Attempting to restore authentication from localStorage...');
        
        // localStorageからメールアドレスを取得して再認証を試みる
        const savedUser = localStorage.getItem('secretKeyUser');
        if (savedUser) {
          try {
            const userData = JSON.parse(savedUser);
            console.log('Found saved user data:', { email: userData.email, uid: userData.uid });
            // メールアドレスは取得できるが、パスワードは保存していないため、再認証はできない
            // ユーザーに再ログインを促す
            throw new Error('認証が切れています。ページをリロードして再度ログインしてください。');
          } catch (error: any) {
            if (error.message.includes('認証が切れています')) {
              throw error;
            }
            console.error('Error parsing saved user data:', error);
          }
        }
        throw new Error('Firebase Authenticationで認証されていません。ページをリロードして再度ログインしてください。');
      }

      // mediaBlocksの最新の状態をrefから取得（状態更新が完了するまで待つ）
      // useStateの更新は非同期なので、refから最新の状態を取得する
      const latestMediaBlocks = mediaBlocksRef.current;
      console.log('=== Using latest mediaBlocks for save ===');
      console.log('mediaBlocks state count:', mediaBlocks.length);
      console.log('mediaBlocksRef current count:', latestMediaBlocks.length);
      console.log('Latest mediaBlocks:', latestMediaBlocks.map(b => ({ 
        id: b.id, 
        type: b.type, 
        hasUrl: !!b.url, 
        url: b.url?.substring(0, 50),
        hasAlbumItems: !!b.albumItems,
        albumItemsCount: b.albumItems?.length || 0
      })));
      
      // 現在のストレージ使用量を計算（blocksから）
      const currentStorageUsed = latestMediaBlocks.reduce((sum, block) => {
        if (block.type === 'album' && block.albumItems) {
          return sum + block.albumItems.reduce((itemSum, item) => itemSum + (item.fileSize || 0), 0);
        } else if (block.fileSize) {
          return sum + block.fileSize;
        }
        return sum;
      }, 0);

      // Firestoreはundefinedを許可しないため、nullに変換またはフィールドを削除
      // ownerUidはauth.currentUser.uidを使用（Firestoreのセキュリティルールで認証が通るように）
      // mediaBlocksをJSONシリアライズ可能な形式に変換
      const blocksToSave = latestMediaBlocks.map(block => {
        const blockData: any = {
          id: block.id,
          type: block.type,
          visibility: block.visibility,
        };
        if (block.url) blockData.url = block.url;
        if (block.thumbnail) blockData.thumbnail = block.thumbnail;
        if (block.title) blockData.title = block.title;
        if (block.description) blockData.description = block.description;
        if (block.isTopic !== undefined) blockData.isTopic = block.isTopic;
        if (block.fileSize) blockData.fileSize = block.fileSize;
        if (block.albumItems) blockData.albumItems = block.albumItems.map(item => ({
          id: item.id,
          url: item.url,
          title: item.title,
          description: item.description,
          fileSize: item.fileSize,
        }));
        return blockData;
      });
      
      const memoryData: any = {
        ownerUid: auth.currentUser.uid, // Firebase AuthenticationのUIDを使用
        tenant: tenant,
        title: title.trim(),
        blocks: blocksToSave, // シリアライズ可能な形式に変換したblocksを保存
        colors: {
          accent: accentColor,
          text: textColor,
          background: backgroundColor,
        },
        fontSizes: {
          title: titleFontSize,
          body: bodyFontSize,
        },
        storageUsed: currentStorageUsed,
        updatedAt: new Date(),
      };
      
      console.log('=== Saving memory data ===');
      console.log('Memory ID:', memoryId || 'new');
      console.log('Latest mediaBlocks count:', latestMediaBlocks.length);
      console.log('Latest mediaBlocks with URLs:', latestMediaBlocks.filter(b => b.url).map(b => ({ 
        id: b.id, 
        type: b.type, 
        url: b.url?.substring(0, 100),
        visibility: b.visibility
      })));
      console.log('Latest mediaBlocks with albumItems:', latestMediaBlocks.filter(b => b.albumItems && b.albumItems.length > 0).map(b => ({ 
        id: b.id, 
        type: b.type, 
        albumItemsCount: b.albumItems?.length || 0,
        albumItemsUrls: b.albumItems?.map(item => item.url?.substring(0, 50))
      })));
      
      console.log('Blocks to save (after conversion):', blocksToSave);
      console.log('Blocks to save count:', blocksToSave.length);
      console.log('Blocks to save with URLs:', blocksToSave.filter(b => b.url).map(b => ({ 
        id: b.id, 
        type: b.type, 
        url: b.url?.substring(0, 100)
      })));
      
      console.log('Owner UID:', memoryData.ownerUid);
      console.log('Auth current user UID:', auth.currentUser.uid);

      // オプショナルフィールドは値がある場合のみ追加（undefinedを避ける）
      if (description) memoryData.description = description;
      if (bio) memoryData.bio = bio;
      if (profileImage) {
        memoryData.profileImage = profileImage;
        memoryData.profileImagePosition = profileImagePosition;
        memoryData.profileImageScale = profileImageScale;
      }
      if (coverImage) {
        memoryData.coverImage = coverImage;
        memoryData.coverImagePosition = coverImagePosition;
        memoryData.coverImageScale = coverImageScale;
      }
      if (topicsTitle) memoryData.topicsTitle = topicsTitle;

      let savedMemoryId: string;
      
      if (memoryId) {
        // 既存のmemoryを更新（エンドユーザーは自分のmemoryであればテナント問わず更新可能）
        const isOwner = existingMemory?.ownerUid === currentUser?.uid;
        console.log('=== Updating memory ===');
        console.log('Memory update details:', {
          memoryId,
          isOwner,
          isAdmin,
          skipTenantCheck: !isAdmin && isOwner,
          ownerUid: existingMemory?.ownerUid,
          currentUserUid: currentUser?.uid,
          memoryDataKeys: Object.keys(memoryData),
        });
        try {
          console.log('=== Calling updateMemory ===');
          console.log('memoryData.blocks:', memoryData.blocks);
          console.log('memoryData.blocks type:', typeof memoryData.blocks);
          console.log('memoryData.blocks is array:', Array.isArray(memoryData.blocks));
          if (Array.isArray(memoryData.blocks)) {
            console.log('memoryData.blocks count:', memoryData.blocks.length);
            console.log('memoryData.blocks with URLs:', memoryData.blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, url: b.url?.substring(0, 50) })));
          }
          console.log('memoryData keys:', Object.keys(memoryData));
          console.log('memoryData.blocks before updateMemory:', JSON.stringify(memoryData.blocks).substring(0, 200));
          
          await updateMemory(memoryId, memoryData, !isAdmin && isOwner);
          console.log('Memory update successful');
          
          // 保存後にFirestoreから再取得して確認（少し待ってから）
          await new Promise(resolve => setTimeout(resolve, 500));
          const verifyDoc = await getDoc(doc(db, 'memories', memoryId));
          if (verifyDoc.exists()) {
            const verifyData = verifyDoc.data();
            console.log('=== Verification after updateMemory ===');
            console.log('Verified blocks:', verifyData.blocks);
            console.log('Verified blocks type:', typeof verifyData.blocks);
            console.log('Verified blocks is array:', Array.isArray(verifyData.blocks));
            if (Array.isArray(verifyData.blocks)) {
              console.log('Verified blocks count:', verifyData.blocks.length);
              console.log('Verified blocks with URLs:', verifyData.blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, url: b.url?.substring(0, 50) })));
            } else {
              console.error('ERROR: Verified blocks is not an array!', verifyData.blocks);
            }
          } else {
            console.error('ERROR: Memory document does not exist after update!');
          }
        } catch (error: any) {
          console.error('Memory update failed:', {
            code: error.code,
            message: error.message,
            stack: error.stack,
          });
          throw error;
        }
        savedMemoryId = memoryId;
      } else {
        // 新規作成
        console.log('=== Creating new memory ===');
        console.log('Memory creation details:', {
          ownerUid: memoryData.ownerUid,
          tenant: memoryData.tenant,
          title: memoryData.title,
          currentUserUid: currentUser?.uid,
          isAdmin,
        });
        try {
          const memoryRef = await addDoc(collection(db, 'memories'), {
            ...memoryData,
            status: 'draft',
            createdAt: new Date(),
          });
          savedMemoryId = memoryRef.id;
          console.log('Memory creation successful:', savedMemoryId);
        } catch (error: any) {
          console.error('Memory creation failed:', {
            code: error.code,
            message: error.message,
            stack: error.stack,
            memoryData: {
              ownerUid: memoryData.ownerUid,
              tenant: memoryData.tenant,
              title: memoryData.title,
            },
          });
          throw error;
        }
      }

      // 公開ページを作成または更新
      // 初期設定で既に公開ページが作成されている可能性があるため、まず検索
      // 優先順位: sessionStorageのinitialSetupPublicPageId > existingMemory?.publicPageId > currentPublicPageId
      // 初期設定で作成された公開ページを確実に使用するため、sessionStorageを最優先で確認
      const initialSetupPublicPageId = typeof window !== 'undefined' ? sessionStorage.getItem('initialSetupPublicPageId') : null;
      let publicPageId = initialSetupPublicPageId || existingMemory?.publicPageId || currentPublicPageId;
      
      console.log('Determining publicPageId:', {
        initialSetupPublicPageId: initialSetupPublicPageId,
        existingMemoryPublicPageId: existingMemory?.publicPageId,
        currentPublicPageId: currentPublicPageId,
        determinedPublicPageId: publicPageId,
        memoryId: memoryId,
        savedMemoryId: savedMemoryId,
      });
      
      let publicPagesSnapshot: any = null;
      let emptyMemoryIdSnapshot: any = null;
      
      // 初期設定で作成された公開ページがsessionStorageにある場合、それを優先的に使用
      if (initialSetupPublicPageId) {
        // sessionStorageから取得した公開ページIDが有効か確認
        try {
          const publicPageDoc = await getDoc(doc(db, 'publicPages', initialSetupPublicPageId));
          if (publicPageDoc.exists()) {
            publicPageId = initialSetupPublicPageId;
            console.log('Using publicPageId from initial setup (sessionStorage):', publicPageId);
            // sessionStorageから削除（一度使用したら不要）
            if (typeof window !== 'undefined') {
              sessionStorage.removeItem('initialSetupPublicPageId');
            }
          } else {
            console.warn('Initial setup publicPageId from sessionStorage not found in Firestore, ignoring');
            publicPageId = existingMemory?.publicPageId || currentPublicPageId;
          }
        } catch (error) {
          console.error('Error verifying initial setup publicPageId:', error);
          publicPageId = existingMemory?.publicPageId || currentPublicPageId;
        }
      }
      
      // 初期設定で作成された公開ページを検索（memoryIdが一致するもの）
      // これは初期設定で作成された公開ページを確実に使用するため
      if (!publicPageId && savedMemoryId) {
        const initialSetupPublicPageQuery = query(
          collection(db, 'publicPages'),
          where('memoryId', '==', savedMemoryId)
        );
        const initialSetupSnapshot = await getDocs(initialSetupPublicPageQuery);
        
        if (!initialSetupSnapshot.empty) {
          publicPageId = initialSetupSnapshot.docs[0].id;
          console.log('Found publicPage created in initial setup:', publicPageId);
        }
      }
      
      if (!publicPageId) {
        // 既存の公開ページを検索（memoryIdで、または空のmemoryIdでアカウント作成時に作成されたもの）
        const publicPagesQuery = query(
          collection(db, 'publicPages'),
          where('memoryId', '==', savedMemoryId)
        );
        publicPagesSnapshot = await getDocs(publicPagesQuery);
        
        if (!publicPagesSnapshot.empty) {
          publicPageId = publicPagesSnapshot.docs[0].id;
          console.log('Found existing publicPage by memoryId:', publicPageId);
          // 既存の公開ページが見つかった場合、更新処理は後で行う（elseブロックで処理）
          // publicPageIdが設定されたので、後続のelseブロックで更新される
        } else {
          // アカウント作成時に作成された公開ページを検索（memoryIdが空で、同じテナント）
          const emptyMemoryIdQuery = query(
            collection(db, 'publicPages'),
            where('memoryId', '==', ''),
            where('tenant', '==', tenant)
          );
          emptyMemoryIdSnapshot = await getDocs(emptyMemoryIdQuery);
          
          if (!emptyMemoryIdSnapshot.empty) {
            // アカウント作成時に作成された公開ページが見つかった場合、memoryIdを設定して更新
            publicPageId = emptyMemoryIdSnapshot.docs[0].id;
            console.log('Found existing publicPage with empty memoryId:', publicPageId);
            // mediaオブジェクトを構築（undefinedをnullに変換）
            const mediaUpdate: any = {};
            if (coverImage) mediaUpdate.cover = coverImage;
            if (profileImage) mediaUpdate.profile = profileImage;
            
            if (!publicPageId) {
              throw new Error('publicPageId is required');
            }
            console.log('=== Updating publicPage (empty memoryId) ===');
            console.log('PublicPage update details:', {
              publicPageId,
              savedMemoryId,
              isAdmin,
              skipTenantCheck: !isAdmin,
              ownerUid: currentUser?.uid,
            });
            try {
              await updatePublicPage(publicPageId, {
                memoryId: savedMemoryId,
                title: title.trim(),
                about: description || '',
                bio: bio || '',
                colors: {
                  accent: accentColor,
                  text: textColor,
                  background: backgroundColor,
                },
                ...(Object.keys(mediaUpdate).length > 0 && { media: mediaUpdate }),
                coverImagePosition: coverImagePosition,
                profileImagePosition: profileImagePosition,
                profileImageScale: profileImageScale,
                fontSizes: {
                  title: titleFontSize,
                  body: bodyFontSize,
                },
                ordering: mediaBlocks.map(block => block.id),
                publish: {
                  status: 'published', // デモ用に即座に公開
                  version: 1,
                  publishedAt: new Date(),
                },
                access: {
                  public: true,
                },
              }, !isAdmin, currentUser?.uid); // エンドユーザーはテナントチェックをスキップ、ownerUidを渡す
              console.log('PublicPage update successful (empty memoryId)');
            } catch (error: any) {
              console.error('PublicPage update failed (empty memoryId):', {
                code: error.code,
                message: error.message,
                stack: error.stack,
              });
              throw error;
            }
            
            // メモリにpublicPageIdを設定
            console.log('Updating memory with publicPageId (empty memoryId case):', publicPageId);
            try {
              await updateMemory(savedMemoryId, { publicPageId: publicPageId }, !isAdmin);
              console.log('Memory publicPageId update successful (empty memoryId case)');
            } catch (error: any) {
              console.error('Memory publicPageId update failed (empty memoryId case):', {
                code: error.code,
                message: error.message,
              });
              throw error;
            }
          } else {
            // 新規に公開ページを作成（アカウント作成時に作成されていない場合）
            console.log('=== Creating new publicPage ===');
            console.log('PublicPage creation details:', {
              tenant,
              savedMemoryId,
              ownerUid: currentUser?.uid,
              title: title.trim(),
            });
            try {
              publicPageId = await createPublicPage({
                tenant: tenant,
                memoryId: savedMemoryId,
                title: title.trim(),
                about: description || '',
                bio: bio || '',
                design: {
                  theme: 'default',
                  layout: 'default',
                  colors: {
                    primary: accentColor,
                    secondary: textColor,
                    background: backgroundColor,
                  },
                },
                colors: {
                  accent: accentColor,
                  text: textColor,
                  background: backgroundColor,
                },
                media: {
                  ...(coverImage && { cover: coverImage }),
                  ...(profileImage && { profile: profileImage }),
                },
                coverImagePosition: coverImagePosition,
                profileImagePosition: profileImagePosition,
                profileImageScale: profileImageScale,
                fontSizes: {
                  title: titleFontSize,
                  body: bodyFontSize,
                },
                ordering: mediaBlocks.map(block => block.id),
                publish: {
                  status: 'published', // デモ用に即座に公開
                  version: 1,
                  publishedAt: new Date(),
                },
                access: {
                  public: true,
                },
              }, currentUser?.uid); // ownerUidを渡す
              console.log('PublicPage creation successful:', publicPageId);
            } catch (error: any) {
              console.error('PublicPage creation failed:', {
                code: error.code,
                message: error.message,
                stack: error.stack,
              });
              throw error;
            }
            
            // メモリにpublicPageIdを設定
            console.log('Updating memory with publicPageId (new creation case):', publicPageId);
            try {
              await updateMemory(savedMemoryId, { publicPageId: publicPageId }, !isAdmin);
              console.log('Memory publicPageId update successful (new creation case)');
            } catch (error: any) {
              console.error('Memory publicPageId update failed (new creation case):', {
                code: error.code,
                message: error.message,
              });
              throw error;
            }
          }
        }
      } else {
        // 既存の公開ページを更新
        console.log('Updating existing publicPage:', publicPageId);
        // mediaオブジェクトを構築（undefinedをnullに変換）
        const mediaUpdate: any = {};
        if (coverImage) mediaUpdate.cover = coverImage;
        if (profileImage) mediaUpdate.profile = profileImage;
        
        console.log('=== Updating publicPage ===');
        console.log('PublicPage update details:', {
          publicPageId,
          isAdmin,
          skipTenantCheck: !isAdmin,
          ownerUid: currentUser?.uid,
        });
        try {
          await updatePublicPage(publicPageId, {
          memoryId: savedMemoryId, // memoryIdが空の場合に設定
          title: title.trim(),
          about: description || '',
          bio: bio || '',
          colors: {
            accent: accentColor,
            text: textColor,
            background: backgroundColor,
          },
          ...(Object.keys(mediaUpdate).length > 0 && { media: mediaUpdate }),
          coverImagePosition: coverImagePosition,
          profileImagePosition: profileImagePosition,
          profileImageScale: profileImageScale,
          fontSizes: {
            title: titleFontSize,
            body: bodyFontSize,
          },
          ordering: mediaBlocks.map(block => block.id),
          publish: {
            status: 'published',
            version: (existingMemory as any)?.publish?.version ? (existingMemory as any).publish.version + 1 : 1,
          publishedAt: new Date(),
        },
      }, !isAdmin, currentUser?.uid); // エンドユーザーはテナントチェックをスキップ、ownerUidを渡す
          console.log('PublicPage update successful');
        } catch (error: any) {
          console.error('PublicPage update failed:', {
            code: error.code,
            message: error.message,
            stack: error.stack,
          });
          throw error;
        }
        
        // メモリにpublicPageIdを設定（まだ設定されていない場合）
        if (!existingMemory?.publicPageId && !currentPublicPageId) {
          console.log('Updating memory with publicPageId:', publicPageId);
          try {
            await updateMemory(savedMemoryId, { publicPageId: publicPageId }, !isAdmin);
            console.log('Memory publicPageId update successful');
          } catch (error: any) {
            console.error('Memory publicPageId update failed:', {
              code: error.code,
              message: error.message,
            });
            throw error;
          }
        }
      }
      
      // 公開ページIDをstateに設定して、公開ページURLを表示できるようにする
      if (publicPageId) {
        setCurrentPublicPageId(publicPageId);
        // React Queryのキャッシュを無効化して再取得
        // ただし、保存処理完了後は、mediaBlocksを上書きしないようにするため、refetchMemoryは呼ばない
        // 代わりに、キャッシュのみを無効化する
        if (memoryId) {
          queryClient.invalidateQueries({ queryKey: ['memory', memoryId] });
          // refetchMemory()を呼ぶと、existingMemoryが更新されてuseEffectが実行され、
          // mediaBlocksが上書きされる可能性があるため、呼ばない
          // await refetchMemory();
        }
        // メモリ一覧も更新
        queryClient.invalidateQueries({ queryKey: ['memories', currentUser?.uid] });
        
        // 公開ページURLが決定した後にGmail送信をトリガー
        // claimRequestが存在し、まだURLが設定されていない場合にFunctions APIを呼び出す
        const claimRequestId = typeof window !== 'undefined' ? sessionStorage.getItem('currentClaimRequestId') : null;
        if (claimRequestId && (!claimRequest?.publicPageUrl || !claimRequest?.loginUrl)) {
          try {
            const publicPageUrl = generatePublicPageUrl(publicPageId, tenant);
            // ログインURLはトップページ（/）のみ（ログイン後は自動的に/memories/createにリダイレクトされる）
            const loginUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
            
            console.log('Sending URLs to Functions API for email notification:', {
              requestId: claimRequestId,
              publicPageUrl,
              loginUrl,
            });
            
            // claimRequestからメールアドレスを取得
            const claimRequestData = await getClaimRequestById(claimRequestId, true);
            const loginEmail = claimRequestData?.email || '';
            
            // パスワードはsessionStorageから取得（パスワード設定時に保存）
            const loginPassword = typeof window !== 'undefined' ? sessionStorage.getItem('tempPassword') || '' : '';
            
            // Firebase Functions APIを使用
            const response = await fetch(
              `https://asia-northeast1-memorylink-cms.cloudfunctions.net/claimSetUrls?requestId=${encodeURIComponent(claimRequestId)}`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  publicPageId: publicPageId,
                  publicPageUrl: publicPageUrl,
                  loginUrl: loginUrl,
                  loginEmail: loginEmail,
                  loginPassword: loginPassword,
                  claimedByUid: currentUser?.uid,
                }),
              }
            );
            
            const result = await response.json();
            
            if (!result.ok) {
              console.error('Failed to set URLs for email notification:', result.error);
            } else {
              console.log('URLs set successfully for email notification:', {
                publicPageUrl: result.publicPageUrl,
                loginUrl: result.loginUrl,
              });
              // claimRequestを再取得して更新
              const updatedRequest = await getClaimRequestById(claimRequestId, true);
              if (updatedRequest) {
                setClaimRequest(updatedRequest);
              }
            }
          } catch (error: any) {
            console.error('Error calling set-urls API for email notification:', error);
            // エラーが発生しても保存処理は続行する
          }
        }
      }

        // プレビュー用にlocalStorageに保存
      // 保存処理完了後は、最新のmediaBlocksを使用
      // 念のため、保存時に使用したblocksToSaveを使用
      const previewData = {
        title: title.trim(),
        description: description || '',
        bio: bio || '',
        profileImage: profileImage || null,
        profileImagePosition: profileImagePosition,
        profileImageScale: profileImageScale,
        coverImage: coverImage || null,
        coverImagePosition: coverImagePosition,
        coverImageScale: coverImageScale,
        blocks: blocksToSave, // 保存時に使用したblocksToSaveを使用（最新の状態が保証されている）
        colors: {
          accent: accentColor,
          text: textColor,
          background: backgroundColor,
        },
        fontSizes: {
          title: titleFontSize,
          body: bodyFontSize,
        },
      };
      localStorage.setItem('memory-preview', JSON.stringify(previewData));

      // 新規作成が完了した場合、LP経由のフラグをクリア
      if (!memoryId && isFromClaim) {
        localStorage.removeItem('pendingTenant');
        sessionStorage.removeItem('pendingTenant');
        sessionStorage.removeItem('fromClaim');
      }

            // 新規作成の場合は、memoryIdを含むURLに更新（リロードはしない）
            if (!memoryId && savedMemoryId) {
              console.log('New memory created, updating URL with memoryId:', savedMemoryId);
              // URLを更新（リロードせずに、useEffectで既存のメモリを読み込む）
              router.replace(`/memories/create?memoryId=${savedMemoryId}`, { scroll: false });
              // memoryIdをstateに設定して、useEffectで既存のメモリを読み込む
              // ただし、保存処理が完了するまで待つ
              // useEffectの依存配列にmemoryIdが含まれているため、URLが更新されると自動的に読み込まれる
            }

            // 成功メッセージを表示
            setError(null);
            setSuccessMessage('保存が完了しました！');

            // 3秒後に成功メッセージを消す
            setTimeout(() => {
              setSuccessMessage(null);
            }, 3000);

            // 管理者の場合はダッシュボードに、エンドユーザーの場合は同じページに留まる
            if (isAdmin) {
              setTimeout(() => {
                router.push('/dashboard');
              }, 2000);
            }
    } catch (err: any) {
      console.error('Save error:', err);
      console.error('Save error details:', {
        code: err.code,
        message: err.message,
        stack: err.stack,
        currentUser: currentUser?.uid,
        isAdmin,
        memoryId,
      });
      const errorMessage = err.message || '保存に失敗しました';
      setError(`保存に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };


  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError(null);

    try {
      if (!loginEmail || !loginPassword) {
        setLoginError('メールアドレスとパスワードを入力してください');
        setLoginLoading(false);
        return;
      }

      // Firebase Authenticationでログイン
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      
      if (!auth) {
        throw new Error('認証サービスが利用できません');
      }

      const userCredential = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      const firebaseUser = userCredential.user;

      // Firestoreからユーザー情報を取得
      const { doc, getDoc, setDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userData: any;
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || loginEmail,
          displayName: data.displayName || firebaseUser.displayName || loginEmail.split('@')[0],
          tenant: data.tenant || getCurrentTenant(),
          role: data.role || 'user',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      } else {
        // Firestoreにユーザー情報がない場合、新規作成
        const currentTenant = getCurrentTenant();
        
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || loginEmail,
          displayName: firebaseUser.displayName || loginEmail.split('@')[0],
          tenant: currentTenant,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await setDoc(userDocRef, userData);
      }

      // SecretKey認証システムのセッションに保存
      sessionStorage.setItem('secretKeyUser', JSON.stringify(userData));
      sessionStorage.setItem('secretKeyTenant', userData.tenant);
      sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());

      localStorage.setItem('secretKeyUser', JSON.stringify(userData));
      localStorage.setItem('secretKeyTenant', userData.tenant);
      localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());

      // ページをリロードして認証状態を反映
      // window.location.reload()では認証状態が反映されない可能性があるため、window.location.hrefを使用
      window.location.href = '/memories/create';
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = 'ログインに失敗しました';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'このメールアドレスは登録されていません。';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'パスワードが正しくありません。以前にもemolinkをご利用いただいている方は同じパスワードを使用してください。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません。';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setLoginError(errorMessage);
    } finally {
      setLoginLoading(false);
    }
  };

  // 認証状態の復元中はローディング画面を表示
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-white/80">読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!authBypass && !isAuthenticated) {
      return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#000f24' }}>
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-white font-medium mb-4">ログインしてください</p>
          <p className="text-white/70 text-sm mb-6">
            メールアドレスとパスワードを入力してください
          </p>

          <form onSubmit={handleLogin} className="space-y-4 text-left">
            <div className="space-y-2">
              <Label htmlFor="login-email" className="text-white/80">メールアドレス</Label>
                <Input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
                required
                disabled={loginLoading}
              />
              </div>

            <div className="space-y-2">
              <Label htmlFor="login-password" className="text-white/80">パスワード</Label>
              <div className="relative">
                <Input
                  id="login-password"
                  type={showLoginPassword ? 'text' : 'password'}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  className="w-full pr-10 bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
                  required
                  disabled={loginLoading}
                />
                <button
                  type="button"
                  onClick={() => setShowLoginPassword(!showLoginPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
                >
                  {showLoginPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {loginError && (
              <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded border border-red-500/20">
                {loginError}
          </div>
            )}

            <Button 
              type="submit"
              className="w-full bg-white text-black hover:bg-white/90"
              disabled={loginLoading || !loginEmail || !loginPassword}
            >
              {loginLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  認証中...
                </>
              ) : (
                '認証'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => router.push('/auth')}
              className="text-sm text-white/60 hover:text-white/80 underline"
            >
              パスワードを忘れた場合
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 新規作成の場合は、認証済みであれば許可（LP経由の制限を削除）
  // 管理者の場合は許可
  // 既存メモリの編集（memoryIdがある場合）は認証済みであれば許可
  // 認証されていない場合は、ログイン画面を表示（既に実装済み）

  // memoryIdがある場合は、一覧画面を表示せずに編集画面を表示する
  // 既存のmemoryを読み込み中の場合
  if (memoryId && existingMemoryLoading) {
      return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" />
          <p className="text-white/80">読み込み中...</p>
          </div>
        </div>
      );
    }
    
  // 既存のmemoryが存在しない場合（memoryIdが指定されているが、データが見つからない）
  if (memoryId && existingMemory === null && !existingMemoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white p-4">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full text-center">
          <p className="text-white font-medium mb-4">想い出ページが見つかりません</p>
          <p className="text-white/70 text-sm mb-6">
            指定された想い出ページは存在しないか、アクセス権限がありません。
          </p>
                <Button
            onClick={() => router.push('/memories/create')}
            className="bg-white text-black hover:bg-white/90"
                >
            一覧に戻る
                </Button>
          </div>
        </div>
      );
  }

  // 既存の想い出ページがある場合の選択画面（エンドユーザー向け、管理者は表示しない）
  // memoryIdがある場合は既存メモリを編集するため、選択画面は表示しない
  // 複数の想い出ページがある場合は、常に一覧を表示する
  // memoryIdがある場合は、編集画面を表示するため一覧は表示しない
  if (!isAdmin && existingMemories.length > 0 && !memoryId && !existingMemoryLoading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white p-4 sm:p-6 md:p-8">
        <div className="max-w-4xl mx-auto">
          {successMessage && (
            <div className="mb-4 bg-green-500/20 border border-green-500/30 text-green-400 p-3 rounded-lg text-center">
              {successMessage}
            </div>
          )}
          {error && (
            <div className="mb-4 bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-lg text-center">
              {error}
            </div>
          )}
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">既存の想い出ページ</h2>
            </div>
            <p className="text-white/80 mb-6">
              既に作成した想い出ページがあります。編集するページを選択してください。
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {existingMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-[#2a2a2a] rounded-xl border border-white/10 p-4 transition-all relative"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                >
                  {/* 削除ボタン（開発中のみ有効、公開版では廃止予定） */}
                  <button
                    type="button"
                    onClick={async (e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      console.log('Delete button clicked for memory:', memory.id);
                      if (confirm(`「${memory.title || '無題'}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
                        try {
                          setDeletingMemoryId(memory.id);
                          setError(null);
                          console.log('Calling deleteMemory...');
                          // エンドユーザーは自分のmemoryであればテナント問わず削除可能
                          const isOwner = memory.ownerUid === currentUser?.uid;
                          await deleteMemory(memory.id, !isAdmin && isOwner);
                          console.log('Delete successful, invalidating cache...');
                          // React Queryのキャッシュを無効化
                          queryClient.invalidateQueries({ queryKey: ['memories', currentUser?.uid] });
                          setSuccessMessage('削除が完了しました');
                          setTimeout(() => {
                            setSuccessMessage(null);
                          }, 3000);
                        } catch (error: any) {
                          console.error('Delete error:', error);
                          setError(`削除に失敗しました: ${error.message}`);
                          setTimeout(() => {
                            setError(null);
                          }, 5000);
                        } finally {
                          setDeletingMemoryId(null);
                        }
                      }
                    }}
                    disabled={deletingMemoryId === memory.id}
                    className="absolute top-2 right-2 p-2 bg-red-500/30 hover:bg-red-500/50 text-red-400 rounded-lg transition disabled:opacity-50 z-20 border border-red-500/50"
                    title="削除（開発中のみ有効）"
                  >
                    {deletingMemoryId === memory.id ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Trash2 className="w-5 h-5" />
                    )}
                  </button>
                  
                  <div
                    className="cursor-pointer"
                    onClick={() => router.push(`/memories/create?memoryId=${memory.id}`)}
                  >
                    <div className="flex items-start space-x-3 mb-3">
                      {/* プロフィール写真のサムネイル */}
                      {memory.profileImage ? (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10">
                          <img
                            src={memory.profileImage}
                            alt={memory.title || '無題'}
                            className="w-full h-full object-cover"
                            style={{
                              objectPosition: memory.profileImagePosition || 'center center',
                              transform: `scale(${memory.profileImageScale || 1})`,
                            }}
                          />
                        </div>
                      ) : (
                        <div className="flex-shrink-0 w-16 h-16 rounded-lg bg-[#1a1a1a] border border-white/10 flex items-center justify-center">
                          <FileText className="w-8 h-8 text-white/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-white truncate mb-1">{memory.title || '無題'}</h3>
                        <p className="text-white/60 text-sm">
                          {memory.status === 'published' ? (
                            <span style={{ color: accentColor }}>公開中</span>
                          ) : (
                            <span className="text-white/60">下書き</span>
                          )}
                        </p>
                        <p className="text-white/40 text-xs mt-1">
                          登録日: {formatDate(memory.createdAt)} • 最終更新: {formatDate(memory.updatedAt)}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        className="flex-1 py-2 px-4 bg-[#1a1a1a] border border-white/20 rounded-lg text-white hover:bg-[#2a2a2a] transition text-sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/memories/create?memoryId=${memory.id}`);
                        }}
                      >
                        <Edit className="w-4 h-4 inline mr-2" />
                        編集する
                      </button>
                      {/* 削除ボタン（開発中のみ有効、公開版では廃止予定） */}
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          console.log('Delete button clicked for memory:', memory.id);
                          if (confirm(`「${memory.title || '無題'}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
                            try {
                              setDeletingMemoryId(memory.id);
                              setError(null);
                              console.log('Calling deleteMemory...');
                              // エンドユーザーは自分のmemoryであればテナント問わず削除可能
                              const isOwner = memory.ownerUid === currentUser?.uid;
                              await deleteMemory(memory.id, !isAdmin && isOwner);
                              console.log('Delete successful, invalidating cache...');
                              // React Queryのキャッシュを無効化
                              queryClient.invalidateQueries({ queryKey: ['memories', currentUser?.uid] });
                              setSuccessMessage('削除が完了しました');
                              setTimeout(() => {
                                setSuccessMessage(null);
                              }, 3000);
                            } catch (error: any) {
                              console.error('Delete error:', error);
                              setError(`削除に失敗しました: ${error.message}`);
                              setTimeout(() => {
                                setError(null);
                              }, 5000);
                            } finally {
                              setDeletingMemoryId(null);
                            }
                          }
                        }}
                        disabled={deletingMemoryId === memory.id}
                        className="py-2 px-4 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 rounded-lg transition disabled:opacity-50 text-sm"
                        title="削除（開発中のみ有効）"
                      >
                        {deletingMemoryId === memory.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4 inline mr-2" />
                            削除
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* 編集バナー */}
      {showEditBanner && (
        <div className="bg-[#1a1a1a] border-b border-white/10 p-4 sm:p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
          <p className="text-white text-sm">エディットページ</p>
            {memoryId && (
              <span className="text-xs text-white/60 bg-[#2a2a2a] px-2 py-1 rounded">
                編集モード
              </span>
            )}
            {!memoryId && (
              <span className="text-xs text-white/60 bg-[#2a2a2a] px-2 py-1 rounded">
                新規作成
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowColorSettings(!showColorSettings)}
              className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition text-sm font-medium"
            >
              <Palette className="w-4 h-4" />
              設定
            </button>
            <button
              onClick={() => {
                // プレビュー用にlocalStorageに保存
                const previewData = {
                  title,
                  description,
                  bio,
                  profileImage,
                  profileImagePosition,
                  profileImageScale,
                  coverImage,
                  coverImagePosition,
                  coverImageScale,
                  blocks: mediaBlocks,
                  colors: {
                    accent: accentColor,
                    text: textColor,
                    background: backgroundColor,
                  },
                  fontSizes: {
                    title: titleFontSize,
                    body: bodyFontSize,
                  },
        topicsTitle: topicsTitle,
                };
                localStorage.setItem('memory-preview', JSON.stringify(previewData));
                window.open('/public/preview', '_blank');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg transition text-sm font-medium"
              style={{ 
                backgroundColor: accentColor, 
                color: '#000000',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <ExternalLink className="w-4 h-4" />
              プレビュー
            </button>
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-[#2a2a2a] text-white rounded-lg hover:bg-red-500/20 hover:border-red-500/50 border border-white/10 transition text-sm font-medium"
              >
                <LogOut className="w-4 h-4" />
                ログアウト
              </button>
            )}
          </div>
        </div>
      )}

      {/* 設定パネル */}
      {showColorSettings && (
        <div className="bg-[#1a1a1a] border-b border-white/10 p-4 sm:p-6">
          <div className="max-w-2xl mx-auto space-y-4">
            <h3 className="text-white font-medium mb-3">設定</h3>
            
            {/* ストレージ使用量メーター */}
            <div className="mb-4 pb-4 border-b border-white/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/80 text-xs">ストレージ使用量</span>
                <span className="text-white/60 text-xs">
                  {(storageUsed / (1024 * 1024)).toFixed(1)}MB / {(STORAGE_LIMIT / (1024 * 1024)).toFixed(0)}MB
                </span>
              </div>
              <div className="w-full bg-[#2a2a2a] rounded-full h-1.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (storageUsed / STORAGE_LIMIT) * 100)}%`,
                    backgroundColor: storageUsed / STORAGE_LIMIT > 0.9 
                      ? '#ef4444' // 赤（90%以上）
                      : storageUsed / STORAGE_LIMIT > 0.7 
                      ? '#f59e0b' // オレンジ（70%以上）
                      : accentColor, // アクセントカラー（70%未満）
                  }}
                />
              </div>
            </div>
            
            {/* 色設定 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">アクセントカラー</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={accentColor}
                    onChange={(e) => setAccentColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                    placeholder="#08af86"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">文字色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                    placeholder="#ffffff"
                  />
                </div>
              </div>
              <div>
                <label className="block text-white/80 text-sm mb-2">背景色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                    placeholder="#000f24"
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-white font-medium mb-3">Topics設定</h4>
              <div>
                <label className="block text-white/80 text-sm mb-2">Topicsセクションのタイトル</label>
                  <input
                    type="text"
                  value={topicsTitle}
                  onChange={(e) => setTopicsTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                  placeholder="Topics"
                />
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <h4 className="text-white font-medium mb-3">文字サイズ設定</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-white/80 text-sm mb-2">タイトルサイズ (px)</label>
                  <input
                    type="number"
                    min="12"
                    max="120"
                    value={titleFontSize}
                    onChange={(e) => setTitleFontSize(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
                <div>
                  <label className="block text-white/80 text-sm mb-2">本文サイズ (px)</label>
                  <input
                    type="number"
                    min="10"
                    max="48"
                    value={bodyFontSize}
                    onChange={(e) => setBodyFontSize(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="p-4 sm:p-6 md:p-8">
      {/* 既存の想い出ページがある場合のヘッダー（エンドユーザー向け） */}
      {/* LP経由（isFromClaim === true）の場合は既存メモリの表示を非表示 */}
      {!isAdmin && existingMemories.length > 0 && !isFromClaim && (
        <div className="max-w-2xl mx-auto mb-4">
          <div className="bg-[#1a1a1a] rounded-lg p-4 flex items-center justify-between border border-white/10">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-white" />
              <div>
                <p className="text-white font-medium">
                  既存の想い出ページが {existingMemories.length} 件あります
                </p>
                <p className="text-white/80 text-sm">
                  複数のLPから作成したページもすべて表示されます
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExistingMemories(!showExistingMemories)}
              className="bg-[#2a2a2a] border-white/20 text-white hover:bg-[#2a2a2a]/80"
            >
              {showExistingMemories ? '閉じる' : '一覧を見る'}
            </Button>
          </div>
        </div>
      )}
      
      {/* 既存ページ一覧（展開時） */}
      {/* LP経由（isFromClaim === true）の場合は既存メモリの表示を非表示 */}
      {!isAdmin && existingMemories.length > 0 && showExistingMemories && !isFromClaim && (
        <div className="max-w-2xl mx-auto mb-4">
          <div className="bg-[#1a1a1a] rounded-2xl p-6 border border-white/10">
            <h2 className="text-xl font-bold text-white mb-2">既存の想い出ページ</h2>
            <p className="text-white/80 text-sm mb-4">
              編集するページを選択してください
            </p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {existingMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="flex items-center justify-between p-3 border border-white/10 rounded-lg hover:bg-[#2a2a2a] cursor-pointer transition-colors"
                  onClick={() => router.push(`/memories/create?memoryId=${memory.id}`)}
                >
                  <div className="flex items-center space-x-3 flex-1 min-w-0">
                    {/* プロフィール写真のサムネイル */}
                    {memory.profileImage ? (
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/10">
                        <img
                          src={memory.profileImage}
                          alt={memory.title || '無題'}
                          className="w-full h-full object-cover"
                          style={{
                            objectPosition: memory.profileImagePosition || 'center center',
                            transform: `scale(${memory.profileImageScale || 1})`,
                          }}
                        />
                      </div>
                    ) : (
                      <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-[#1a1a1a] border border-white/10 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-white/40" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white truncate">
                      {memory.title || '無題'}
                    </p>
                    <p className="text-sm text-white/60">
                      {memory.status === 'published' ? '公開中' : '下書き'}
                    </p>
                    <p className="text-xs text-white/40 mt-1">
                      登録日: {formatDate(memory.createdAt)} • 最終更新: {formatDate(memory.updatedAt)}
                    </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {memory.status === 'published' && memory.publicPageId && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-[#2a2a2a]"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMemoryForNfc({ id: memory.id, publicPageId: memory.publicPageId });
                          setShowNfcUrlModal(true);
                        }}
                      >
                        <ExternalLink className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-white hover:bg-[#2a2a2a]"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/memories/create?memoryId=${memory.id}`);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    {/* 削除ボタン（開発中のみ有効、公開版では廃止予定） */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-400 hover:bg-red-500/20"
                      onClick={async (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        console.log('Delete button clicked for memory:', memory.id);
                        if (confirm(`「${memory.title || '無題'}」を削除してもよろしいですか？\nこの操作は取り消せません。`)) {
                          try {
                            setDeletingMemoryId(memory.id);
                            setError(null);
                            console.log('Calling deleteMemory...');
                            // エンドユーザーは自分のmemoryであればテナント問わず削除可能
                            const isOwner = memory.ownerUid === currentUser?.uid;
                            await deleteMemory(memory.id, !isAdmin && isOwner);
                            console.log('Delete successful, invalidating cache...');
                            // React Queryのキャッシュを無効化
                            queryClient.invalidateQueries({ queryKey: ['memories', currentUser?.uid] });
                            setSuccessMessage('削除が完了しました');
                            setTimeout(() => {
                              setSuccessMessage(null);
                            }, 3000);
                          } catch (error: any) {
                            console.error('Delete error:', error);
                            setError(`削除に失敗しました: ${error.message}`);
                            setTimeout(() => {
                              setError(null);
                            }, 5000);
                          } finally {
                            setDeletingMemoryId(null);
                          }
                        }
                      }}
                      disabled={deletingMemoryId === memory.id}
                      title="削除（開発中のみ有効）"
                    >
                      {deletingMemoryId === memory.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* プロフィールセクション */}
      <div className="max-w-2xl mx-auto mb-6 px-6 sm:px-8">
        {/* プロフィール写真 */}
        <div className="mb-6">
          <label className="block text-white/80 text-sm mb-2">プロフィール写真</label>
          <div className="relative w-full max-w-xs aspect-square rounded-full overflow-hidden border border-white/10 mb-4">
            {profileImage ? (
              <>
                <img 
                  src={profileImage} 
                  alt="プロフィール" 
                  className="w-full h-full object-cover select-none touch-none"
                  style={{ 
                    objectPosition: profileImagePosition,
                    transform: `scale(${profileImageScale})`,
                    cursor: isDraggingProfile ? 'grabbing' : 'grab',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    WebkitTouchCallout: 'none'
                  }}
                  onMouseDown={(e) => {
                    // ボタンエリアでのドラッグ開始を防ぐ
                    const target = e.target as HTMLElement;
                    if (target.closest('button')) {
                      return;
                    }
                    e.preventDefault();
                    setIsDraggingProfile(true);
                    const rect = e.currentTarget.getBoundingClientRect();
                    const startX = e.clientX;
                    const startY = e.clientY;
                    // 現在のobjectPositionをパース（center centerの場合は50%として扱う）
                    let posX = 50, posY = 50;
                    if (profileImagePosition && profileImagePosition !== 'center center') {
                      const parts = profileImagePosition.split(' ');
                      posX = parseFloat(parts[0]) || 50;
                      posY = parseFloat(parts[1]) || 50;
                    }
                    setDragStartPosProfile({
                      x: startX,
                      y: startY,
                      posX: posX,
                      posY: posY
                    });
                  }}
                  onMouseMove={(e) => {
                    if (isDraggingProfile && dragStartPosProfile) {
                      e.preventDefault();
                      const rect = e.currentTarget.getBoundingClientRect();
                      // 移動量を計算（ピクセル単位）
                      const deltaX = e.clientX - dragStartPosProfile.x;
                      const deltaY = e.clientY - dragStartPosProfile.y;
                      // 移動量をパーセンテージに変換（写真のサイズを考慮）
                      const deltaXPercent = (deltaX / rect.width) * 100;
                      const deltaYPercent = (deltaY / rect.height) * 100;
                      // 新しい位置を計算（写真を動かす方向に反転）
                      const newX = dragStartPosProfile.posX - deltaXPercent;
                      const newY = dragStartPosProfile.posY - deltaYPercent;
                      setProfileImagePosition(`${newX}% ${newY}%`);
                    }
                  }}
                  onMouseUp={() => {
                    setIsDraggingProfile(false);
                    setDragStartPosProfile(null);
                  }}
                  onMouseLeave={() => {
                    setIsDraggingProfile(false);
                    setDragStartPosProfile(null);
                  }}
                  onTouchStart={(e) => {
                    // ボタンエリアでのドラッグ開始を防ぐ
                    const target = e.target as HTMLElement;
                    if (target.closest('button')) {
                      return;
                    }
                    e.preventDefault();
                    
                    // 2本の指でピンチジェスチャー
                    if (e.touches.length === 2) {
                      const touch1 = e.touches[0];
                      const touch2 = e.touches[1];
                      const distance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                      );
                      setPinchStartProfile({
                        distance: distance,
                        scale: profileImageScale
                      });
                      setIsDraggingProfile(false);
                      setDragStartPosProfile(null);
                    } else if (e.touches.length === 1) {
                      // 1本の指でドラッグ
                      setIsDraggingProfile(true);
                      const touch = e.touches[0];
                      const startX = touch.clientX;
                      const startY = touch.clientY;
                      // 現在のobjectPositionをパース（center centerの場合は50%として扱う）
                      let posX = 50, posY = 50;
                      if (profileImagePosition && profileImagePosition !== 'center center') {
                        const parts = profileImagePosition.split(' ');
                        posX = parseFloat(parts[0]) || 50;
                        posY = parseFloat(parts[1]) || 50;
                      }
                      setDragStartPosProfile({
                        x: startX,
                        y: startY,
                        posX: posX,
                        posY: posY
                      });
                      setPinchStartProfile(null);
                    }
                  }}
                  onTouchMove={(e) => {
                    e.preventDefault();
                    
                    // 2本の指でピンチジェスチャー
                    if (e.touches.length === 2 && pinchStartProfile) {
                      const touch1 = e.touches[0];
                      const touch2 = e.touches[1];
                      const distance = Math.hypot(
                        touch2.clientX - touch1.clientX,
                        touch2.clientY - touch1.clientY
                      );
                      const scale = Math.max(0.5, Math.min(3, pinchStartProfile.scale * (distance / pinchStartProfile.distance)));
                      setProfileImageScale(scale);
                    } else if (e.touches.length === 1 && isDraggingProfile && dragStartPosProfile) {
                      // 1本の指でドラッグ
                      const touch = e.touches[0];
                      const rect = e.currentTarget.getBoundingClientRect();
                      // 移動量を計算（ピクセル単位）
                      const deltaX = touch.clientX - dragStartPosProfile.x;
                      const deltaY = touch.clientY - dragStartPosProfile.y;
                      // 移動量をパーセンテージに変換（写真のサイズを考慮）
                      const deltaXPercent = (deltaX / rect.width) * 100;
                      const deltaYPercent = (deltaY / rect.height) * 100;
                      // 新しい位置を計算（写真を動かす方向に反転）
                      const newX = dragStartPosProfile.posX - deltaXPercent;
                      const newY = dragStartPosProfile.posY - deltaYPercent;
                      setProfileImagePosition(`${newX}% ${newY}%`);
                    }
                  }}
                  onTouchEnd={() => {
                    setIsDraggingProfile(false);
                    setDragStartPosProfile(null);
                    setPinchStartProfile(null);
                  }}
                  onTouchCancel={() => {
                    setIsDraggingProfile(false);
                    setDragStartPosProfile(null);
                    setPinchStartProfile(null);
                  }}
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileImagePosition('center center');
                      setProfileImageScale(1);
                    }}
                    className="bg-blue-500/80 hover:bg-blue-500 rounded-full p-2 transition text-white text-xs"
                    title="中央にリセット"
                  >
                    中央
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileImage(null);
                      setProfileImagePosition('center center');
                      setProfileImageScale(1);
                    }}
                    className="bg-red-500/80 hover:bg-red-500 rounded-full p-2 transition"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded pointer-events-none">
                  ドラッグして表示位置を調整
                </div>
              </>
            ) : (
              <label className="w-full h-full bg-[#1a1a1a] flex flex-col items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition">
                <Camera className="w-12 h-12 text-white/50 mb-2" />
                <span className="text-white/60 text-sm">プロフィール写真を追加</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleProfileImageUpload(file);
                  }}
                  className="hidden"
                />
              </label>
            )}
          </div>
        </div>
        
        {/* タイトル */}
        <div className="mb-6">
          <label className="block text-white/80 text-sm mb-2">タイトル</label>
          <textarea
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="タイトルを入力"
            className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm resize-none"
            rows={2}
            onInput={(e) => {
              const target = e.currentTarget;
              target.style.height = 'auto';
              target.style.height = `${target.scrollHeight}px`;
            }}
          />
        </div>
        
        {/* 説明文 */}
        <div className="mb-6">
          <label className="block text-white/80 text-sm mb-2">説明文</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="説明文を入力"
            className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm resize-none"
            rows={3}
          />
        </div>
        
        {/* プロフィール */}
        <div className="mb-6">
          <label className="block text-white/80 text-sm mb-2">プロフィール</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="プロフィールを入力"
            className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm resize-none"
            rows={3}
          />
        </div>
      </div>

      {/* カバー画像 */}
      <div className="max-w-2xl mx-auto mb-6 px-6 sm:px-8">
        <div className="mb-2">
          <p className="text-white/60 text-sm">📱 縦長の写真を推奨します（スマートフォン表示に最適化）</p>
        </div>
        <div className="relative w-full aspect-[9/16] rounded-2xl overflow-hidden border border-white/10">
          {coverImage ? (
            <>
              <img 
                src={coverImage} 
                alt="Cover" 
                className="w-full h-full object-cover select-none touch-none"
                style={{ 
                  objectPosition: coverImagePosition,
                  transform: `scale(${coverImageScale})`,
                  cursor: isDragging ? 'grabbing' : 'grab',
                  userSelect: 'none',
                  WebkitUserSelect: 'none',
                  WebkitTouchCallout: 'none'
                }}
                onMouseDown={(e) => {
                  // ボタンエリアでのドラッグ開始を防ぐ
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) {
                    return;
                  }
                  e.preventDefault();
                  setIsDragging(true);
                  const startX = e.clientX;
                  const startY = e.clientY;
                  // 現在のobjectPositionをパース（center centerの場合は50%として扱う）
                  let posX = 50, posY = 50;
                  if (coverImagePosition && coverImagePosition !== 'center center') {
                    const parts = coverImagePosition.split(' ');
                    posX = parseFloat(parts[0]) || 50;
                    posY = parseFloat(parts[1]) || 50;
                  }
                  setDragStartPos({
                    x: startX,
                    y: startY,
                    posX: posX,
                    posY: posY
                  });
                }}
                onMouseMove={(e) => {
                  if (isDragging && dragStartPos) {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    // 移動量を計算（ピクセル単位）
                    const deltaX = e.clientX - dragStartPos.x;
                    const deltaY = e.clientY - dragStartPos.y;
                    // 移動量をパーセンテージに変換（写真のサイズを考慮）
                    const deltaXPercent = (deltaX / rect.width) * 100;
                    const deltaYPercent = (deltaY / rect.height) * 100;
                    // 新しい位置を計算（写真を動かす方向に反転）
                    const newX = dragStartPos.posX - deltaXPercent;
                    const newY = dragStartPos.posY - deltaYPercent;
                    setCoverImagePosition(`${newX}% ${newY}%`);
                  }
                }}
                onMouseUp={() => {
                  setIsDragging(false);
                  setDragStartPos(null);
                }}
                onMouseLeave={() => {
                  setIsDragging(false);
                  setDragStartPos(null);
                }}
                onTouchStart={(e) => {
                  // ボタンエリアでのドラッグ開始を防ぐ
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) {
                    return;
                  }
                  e.preventDefault();
                  
                  // 2本の指でピンチジェスチャー
                  if (e.touches.length === 2) {
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const distance = Math.hypot(
                      touch2.clientX - touch1.clientX,
                      touch2.clientY - touch1.clientY
                    );
                    setPinchStart({
                      distance: distance,
                      scale: coverImageScale
                    });
                    setIsDragging(false);
                    setDragStartPos(null);
                  } else if (e.touches.length === 1) {
                    // 1本の指でドラッグ
                  setIsDragging(true);
                  const touch = e.touches[0];
                    const startX = touch.clientX;
                    const startY = touch.clientY;
                    // 現在のobjectPositionをパース（center centerの場合は50%として扱う）
                    let posX = 50, posY = 50;
                    if (coverImagePosition && coverImagePosition !== 'center center') {
                      const parts = coverImagePosition.split(' ');
                      posX = parseFloat(parts[0]) || 50;
                      posY = parseFloat(parts[1]) || 50;
                    }
                    setDragStartPos({
                      x: startX,
                      y: startY,
                      posX: posX,
                      posY: posY
                    });
                    setPinchStart(null);
                  }
                }}
                onTouchMove={(e) => {
                    e.preventDefault();
                  
                  // 2本の指でピンチジェスチャー
                  if (e.touches.length === 2 && pinchStart) {
                    const touch1 = e.touches[0];
                    const touch2 = e.touches[1];
                    const distance = Math.hypot(
                      touch2.clientX - touch1.clientX,
                      touch2.clientY - touch1.clientY
                    );
                    const scale = Math.max(0.5, Math.min(3, pinchStart.scale * (distance / pinchStart.distance)));
                    setCoverImageScale(scale);
                  } else if (e.touches.length === 1 && isDragging && dragStartPos) {
                    // 1本の指でドラッグ
                    const touch = e.touches[0];
                    const rect = e.currentTarget.getBoundingClientRect();
                    // 移動量を計算（ピクセル単位）
                    const deltaX = touch.clientX - dragStartPos.x;
                    const deltaY = touch.clientY - dragStartPos.y;
                    // 移動量をパーセンテージに変換（写真のサイズを考慮）
                    const deltaXPercent = (deltaX / rect.width) * 100;
                    const deltaYPercent = (deltaY / rect.height) * 100;
                    // 新しい位置を計算（写真を動かす方向に反転）
                    const newX = dragStartPos.posX - deltaXPercent;
                    const newY = dragStartPos.posY - deltaYPercent;
                    setCoverImagePosition(`${newX}% ${newY}%`);
                  }
                }}
                onTouchEnd={() => {
                  setIsDragging(false);
                  setDragStartPos(null);
                  setPinchStart(null);
                }}
                onTouchCancel={() => {
                  setIsDragging(false);
                  setDragStartPos(null);
                  setPinchStart(null);
                }}
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoverImagePosition('center center');
                    setCoverImageScale(1);
                  }}
                  className="bg-blue-500/80 hover:bg-blue-500 rounded-full p-2 transition text-white text-xs"
                  title="中央にリセット"
                >
                  中央
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoverImage(null);
                    setCoverImagePosition('center center');
                    setCoverImageScale(1);
                  }}
                  className="bg-red-500/80 hover:bg-red-500 rounded-full p-2 transition"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded pointer-events-none">
                ドラッグして表示位置を調整
              </div>
            </>
          ) : (
            <label className="w-full h-full bg-[#1a1a1a] flex flex-col items-center justify-center cursor-pointer hover:bg-[#2a2a2a] transition">
              <Camera className="w-12 h-12 text-white/50 mb-2" />
              <span className="text-white/60 text-sm">カバー画像を追加</span>
              <span className="text-white/40 text-xs mt-1">（縦長推奨）</span>
              <input
                type="file"
                accept="image/*"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleCoverImageUpload(file);
                }}
                className="hidden"
              />
            </label>
          )}
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="max-w-2xl mx-auto px-6 sm:px-8">
        {/* 要素を追加 */}
        <div className="space-y-4 mb-6">
          {mediaBlocks.map((block) => (
            <div 
              key={block.id} 
              className={`rounded-2xl p-4 ${
                block.type === 'album' 
                  ? 'border-4'
                  : ''
              }`}
              style={{
                backgroundColor: editPageCardBackgroundColor,
                ...(block.type === 'album' ? { borderColor: accentColor } : {})
              }}
            >
              {block.type === 'album' && block.albumItems ? (
                // アルバム表示
                <div className="space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <input
                      type="text"
                      value={block.title || ''}
                      onChange={(e) => handleUpdateBlock(block.id, 'title', e.target.value)}
                      placeholder="アルバムタイトルを入力"
                      className="text-xl font-bold text-white bg-transparent border-none focus:outline-none focus:ring-0 placeholder:text-white/40 flex-1"
                    />
                    <button 
                      onClick={() => handleDelete(block.id)}
                      className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500/20 transition"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                  </div>
                  <textarea
                    placeholder="アルバムの説明を入力（任意）"
                    value={block.description || ''}
                    onChange={(e) => handleUpdateBlock(block.id, 'description', e.target.value)}
                    className="w-full mb-4 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg resize-none text-white placeholder:text-white/50 focus:outline-none focus:ring-2"
                    style={{ '--ring-color': accentColor } as React.CSSProperties}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = accentColor;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                    }}
                    rows={3}
                  />
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    {block.albumItems.map((item, index) => (
                      <div key={item.id} className="space-y-2">
                        <div className="aspect-square rounded-lg overflow-hidden relative group">
                          <img 
                            src={item.url} 
                            alt={`Album ${index + 1}`} 
                            className="w-full h-full object-cover"
                          />
                          <button
                            onClick={async () => {
                              // 削除されるアイテムのサイズを取得
                              const itemSize = item.fileSize || 0;
                              
                              // ストレージ使用量を減算
                              if (itemSize > 0) {
                                await decreaseStorageUsed(itemSize);
                              }
                              
                              setMediaBlocks(prev => prev.map(b => 
                                b.id === block.id && b.albumItems
                                  ? {
                                      ...b,
                                      albumItems: b.albumItems.filter(i => i.id !== item.id)
                                    }
                                  : b
                              ));
                            }}
                            className="absolute top-2 right-2 w-6 h-6 bg-red-500/80 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                          >
                            <X className="w-4 h-4 text-white" />
                          </button>
                        </div>
                        <textarea
                          placeholder="説明を入力"
                          value={item.description || ''}
                          onChange={(e) => handleUpdateAlbumItem(block.id, item.id, 'description', e.target.value)}
                          className="w-full px-2 py-1 bg-[#2a2a2a] border border-white/20 rounded text-white text-sm resize-none placeholder:text-white/50 focus:outline-none focus:ring-1"
                          style={{ '--ring-color': accentColor } as React.CSSProperties}
                          rows={2}
                          onFocus={(e) => {
                            e.currentTarget.style.borderColor = accentColor;
                            e.currentTarget.style.boxShadow = `0 0 0 1px ${accentColor}`;
                          }}
                          onBlur={(e) => {
                            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                            e.currentTarget.style.boxShadow = 'none';
                          }}
                        />
                      </div>
                    ))}
                    <button
                      onClick={() => handleAddToAlbum(block.id)}
                      className="aspect-square rounded-lg border-2 border-dashed border-white/30 flex flex-col items-center justify-center transition-all cursor-pointer"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = accentColor;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                      }}
                    >
                      <Mountain className="w-8 h-8 text-white/50 mb-2" />
                      <span className="text-white/70 text-sm">Add Photos</span>
                    </button>
                  </div>
                  
                  {/* Topicsトグル（アルバム） */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id={`topic-album-${block.id}`}
                      checked={block.isTopic || false}
                      onChange={(e) => handleUpdateBlock(block.id, 'isTopic', e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: accentColor }}
                    />
                    <label
                      htmlFor={`topic-album-${block.id}`}
                      className="text-sm text-white/80 cursor-pointer"
                    >
                      Topicsに表示
                    </label>
                  </div>
                </div>
              ) : block.type === 'text' ? (
                // テキストブロック表示
                <>
                  {/* タイトル */}
                  <input
                    type="text"
                    placeholder="タイトルを入力（任意）"
                    value={block.title || ''}
                    onChange={(e) => handleUpdateBlock(block.id, 'title', e.target.value)}
                    className="w-full mb-2 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2"
                    style={{ '--ring-color': accentColor } as React.CSSProperties}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* テキスト内容 */}
                  <textarea
                    placeholder="メッセージを入力..."
                    value={block.description || ''}
                    onChange={(e) => handleUpdateBlock(block.id, 'description', e.target.value)}
                    className="w-full mb-3 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg resize-none text-white placeholder:text-white/50 focus:outline-none focus:ring-2"
                    style={{ '--ring-color': accentColor } as React.CSSProperties}
                    rows={8}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Topicsトグル（テキスト） */}
                  <div className="flex items-center gap-2 mb-3">
                    <input
                      type="checkbox"
                      id={`topic-text-${block.id}`}
                      checked={block.isTopic || false}
                      onChange={(e) => handleUpdateBlock(block.id, 'isTopic', e.target.checked)}
                      className="w-4 h-4 rounded cursor-pointer"
                      style={{ accentColor: accentColor }}
                    />
                    <label
                      htmlFor={`topic-text-${block.id}`}
                      className="text-sm text-white/80 cursor-pointer"
                    >
                      Topicsに表示
                    </label>
                  </div>
                </>
              ) : (
                // 通常のメディア表示
                <>
                  <div className="aspect-video relative rounded-xl overflow-hidden mb-3">
                    {block.type === 'image' ? (
                      <img 
                        src={block.url} 
                        alt="Media" 
                        className="w-full h-full object-cover"
                      />
                    ) : block.type === 'video' ? (
                      <video 
                        src={block.url} 
                        className="w-full h-full object-cover"
                        controls
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-[#2a2a2a]">
                        <Music className="w-16 h-16 text-white/50" />
                      </div>
                    )}
                  </div>
                  
                  {/* タイトル */}
                  <input
                    type="text"
                    placeholder="タイトルを入力"
                    value={block.title || ''}
                    onChange={(e) => handleUpdateBlock(block.id, 'title', e.target.value)}
                    className="w-full mb-2 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white placeholder:text-white/50 focus:outline-none focus:ring-2"
                    style={{ '--ring-color': accentColor } as React.CSSProperties}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* 説明 */}
                  <textarea
                    placeholder="説明を入力"
                    value={block.description || ''}
                    onChange={(e) => handleUpdateBlock(block.id, 'description', e.target.value)}
                    className="w-full mb-3 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg resize-none text-white placeholder:text-white/50 focus:outline-none focus:ring-2"
                    style={{ '--ring-color': accentColor } as React.CSSProperties}
                    rows={2}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = accentColor;
                      e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  
                  {/* Topicsトグル（画像、動画） */}
                  {(block.type === 'image' || block.type === 'video') && (
                    <div className="flex items-center gap-2 mb-3">
                      <input
                        type="checkbox"
                        id={`topic-${block.id}`}
                        checked={block.isTopic || false}
                        onChange={(e) => handleUpdateBlock(block.id, 'isTopic', e.target.checked)}
                        className="w-4 h-4 rounded cursor-pointer"
                        style={{ accentColor: accentColor }}
                      />
                      <label
                        htmlFor={`topic-${block.id}`}
                        className="text-sm text-white/80 cursor-pointer"
                      >
                        Topicsに表示
                      </label>
                    </div>
                  )}
                </>
              )}
              
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-white/60">
                  {block.type === 'image' ? '📷 写真' : block.type === 'video' ? '🎥 動画' : block.type === 'album' ? '📚 アルバム' : block.type === 'text' ? '📝 テキスト' : '🎵 音声'}
                </span>
                <button
                  onClick={() => handleDelete(block.id)}
                  className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center hover:bg-red-500/20 transition"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            </div>
          ))}

          {/* 追加ボタン */}
          <button
            onClick={() => setShowUploadMenu(!showUploadMenu)}
            className="w-full bg-[#1a1a1a] rounded-2xl p-8 border-2 border-dashed border-white/30 transition-all group"
            style={{ 
              '--hover-border-color': accentColor,
            } as React.CSSProperties}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = accentColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
          >
            <div className="text-center">
              <Plus className="w-12 h-12 mx-auto mb-2" style={{ color: accentColor }} />
              <p className="font-medium text-sm" style={{ color: accentColor }}>要素を追加</p>
            </div>
          </button>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* 成功メッセージ */}
        {successMessage && (
          <div className="mb-4 p-4 rounded-lg" style={{ backgroundColor: `${accentColor}20`, borderColor: `${accentColor}50`, borderWidth: '1px', borderStyle: 'solid' }}>
            <p className="text-sm font-medium" style={{ color: accentColor }}>{successMessage}</p>
          </div>
        )}

        {/* 保存ボタン */}
        <div className="pb-8">
          <button
            onClick={handleSave}
            disabled={loading || uploading}
            className="w-full font-semibold py-4 rounded-2xl transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ 
              backgroundColor: accentColor, 
              color: '#000000',
            }}
            onMouseEnter={(e) => {
              if (!loading && !uploading) {
                e.currentTarget.style.opacity = '0.9';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.opacity = loading || uploading ? '0.5' : '1';
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                保存中...
              </span>
            ) : (
              '保存する'
            )}
          </button>
        </div>

        {/* URL情報表示 */}
        <div className="mt-8 pt-8 border-t border-white/10 pb-8">
          <h3 className="text-white font-medium mb-4 text-sm">アクセス情報</h3>
          
          {/* ログインURL */}
          <div className="mb-4">
            <Label className="text-white/70 text-xs mb-2 block">ログインURL</Label>
            <div className="flex items-center gap-2">
              <Input
                readOnly
                value={(() => {
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
                  return baseUrl; // メインページ（/）からログイン
                })()}
                className="bg-[#2a2a2a] border-white/20 text-white font-mono text-xs flex-1"
              />
              <Button
                size="sm"
                onClick={() => {
                  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
                  const loginUrl = baseUrl; // メインページ（/）からログイン
                  navigator.clipboard.writeText(loginUrl);
                  setSuccessMessage('ログインURLをクリップボードにコピーしました');
                  setTimeout(() => setSuccessMessage(null), 2000);
                }}
                style={{ backgroundColor: accentColor, color: '#000000' }}
                className="shrink-0"
              >
                コピー
              </Button>
            </div>
            <p className="text-white/50 text-xs mt-1">このURLをブックマークしておくと、次回から簡単にアクセスできます</p>
          </div>

          {/* 公開ページURL */}
          {(() => {
            const hasPublicPageUrl = !!(claimRequest?.publicPageUrl || currentPublicPageId || existingMemory?.publicPageId);
            if (typeof window !== 'undefined') {
              console.log('🔍 Public page URL display check:', {
                hasClaimRequestUrl: !!claimRequest?.publicPageUrl,
                claimRequestUrl: claimRequest?.publicPageUrl,
                hasCurrentPublicPageId: !!currentPublicPageId,
                currentPublicPageId: currentPublicPageId,
                hasExistingMemoryPublicPageId: !!existingMemory?.publicPageId,
                existingMemoryPublicPageId: existingMemory?.publicPageId,
                willDisplay: hasPublicPageUrl,
              });
            }
            return hasPublicPageUrl;
          })() ? (
            <div className="mb-4">
              <Label className="text-white/70 text-xs mb-2 block">公開ページURL</Label>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={
                    claimRequest?.publicPageUrl || 
                    (currentPublicPageId || existingMemory?.publicPageId ? generatePublicPageUrl(currentPublicPageId || existingMemory?.publicPageId || '', getCurrentTenant()) : '')
                  }
                  className="bg-[#2a2a2a] border-white/20 text-white font-mono text-xs flex-1"
                />
                <Button
                  size="sm"
                  onClick={() => {
                    const url = claimRequest?.publicPageUrl || 
                      (currentPublicPageId || existingMemory?.publicPageId ? generatePublicPageUrl(currentPublicPageId || existingMemory?.publicPageId || '', getCurrentTenant()) : '');
                    if (url) {
                      navigator.clipboard.writeText(url);
                      setSuccessMessage('公開ページURLをクリップボードにコピーしました');
                      setTimeout(() => setSuccessMessage(null), 2000);
                    } else {
                      setError('公開ページURLが取得できませんでした');
                    }
                  }}
                  style={{ backgroundColor: accentColor, color: '#000000' }}
                  className="shrink-0"
                >
                  コピー
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const url = claimRequest?.publicPageUrl || 
                      (currentPublicPageId || existingMemory?.publicPageId ? generatePublicPageUrl(currentPublicPageId || existingMemory?.publicPageId || '', getCurrentTenant()) : '');
                    if (url) {
                      window.open(url, '_blank');
                    } else {
                      setError('公開ページURLが取得できませんでした');
                    }
                  }}
                  className="shrink-0 border-white/20 text-white hover:bg-white/10"
                >
                  開く
                </Button>
              </div>
              <p className="text-white/50 text-xs mt-1">NFCタグに入力するURLです。保存後すぐにアクセスできます。</p>
            </div>
          ) : (
            <div className="mb-4">
              <Label className="text-white/70 text-xs mb-2 block">公開ページURL</Label>
              {claimRequestLoading ? (
                <p className="text-white/50 text-xs">読み込み中...</p>
              ) : (
                <p className="text-white/50 text-xs">保存後に公開ページURLが表示されます</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* アップロードメニュー */}
      {showUploadMenu && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-sm w-full">
            <h2 className="text-xl font-bold text-white mb-4">コンテンツを追加</h2>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleAddMedia('image')}
                className="flex flex-col items-center p-4 border-2 border-white/20 rounded-xl transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.backgroundColor = `${accentColor}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Camera className="w-10 h-10 text-white mb-2" />
                <span className="text-xs font-medium text-white">写真</span>
              </button>
              <button
                onClick={() => handleAddMedia('album')}
                className="flex flex-col items-center p-4 border-2 rounded-xl transition-all"
                style={{ 
                  borderColor: accentColor,
                  backgroundColor: `${accentColor}10`
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.backgroundColor = `${accentColor}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.backgroundColor = `${accentColor}10`;
                }}
              >
                <ImageIcon className="w-10 h-10 mb-2" style={{ color: accentColor }} />
                <span className="text-xs font-medium text-white">アルバム</span>
              </button>
              <button
                onClick={() => handleAddMedia('video')}
                className="flex flex-col items-center p-4 border-2 border-white/20 rounded-xl transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.backgroundColor = `${accentColor}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <VideoIcon className="w-10 h-10 text-white mb-2" />
                <span className="text-xs font-medium text-white">動画</span>
              </button>
              <button
                onClick={() => handleAddMedia('audio')}
                className="flex flex-col items-center p-4 border-2 border-white/20 rounded-xl transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.backgroundColor = `${accentColor}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <Music className="w-10 h-10 text-white mb-2" />
                <span className="text-xs font-medium text-white">音声</span>
              </button>
              <button
                onClick={() => handleAddMedia('text')}
                className="flex flex-col items-center p-4 border-2 border-white/20 rounded-xl transition-all"
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.backgroundColor = `${accentColor}10`;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <FileText className="w-10 h-10 text-white mb-2" />
                <span className="text-xs font-medium text-white">テキスト</span>
              </button>
            </div>
            <button
              onClick={() => setShowUploadMenu(false)}
              className="w-full mt-4 py-2 px-4 bg-[#2a2a2a] border border-white/20 rounded-lg text-white hover:bg-[#2a2a2a]/80 transition"
            >
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* アップロード中インジケーター */}
      {uploading && (
        <div 
          className="fixed top-4 right-4 text-black px-4 py-2 rounded-full shadow-lg flex items-center gap-2"
          style={{ backgroundColor: accentColor }}
        >
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm font-medium">アップロード中...</span>
        </div>
      )}

      {/* NFCタグ用URL表示モーダル */}
      {showNfcUrlModal && selectedMemoryForNfc && selectedMemoryForNfc.publicPageId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <Card className="bg-[#1a1a1a] border border-white/10 max-w-md w-full">
            <CardHeader>
              <CardTitle className="text-white flex items-center justify-between">
                <span>NFCタグ用URL</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowNfcUrlModal(false);
                    setSelectedMemoryForNfc(null);
                  }}
                  className="text-white hover:bg-[#2a2a2a]"
                >
                  <X className="w-4 h-4" />
                </Button>
              </CardTitle>
              <CardDescription className="text-white/60">
                このURLをNFCタグに書き込んでください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-white/80 text-sm mb-2">公開ページURL</label>
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={generateNfcUrl(selectedMemoryForNfc.publicPageId, getCurrentTenant())}
                    className="bg-[#2a2a2a] border-white/20 text-white font-mono text-sm"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const url = generateNfcUrl(selectedMemoryForNfc.publicPageId!, getCurrentTenant());
                      navigator.clipboard.writeText(url);
                      setSuccessMessage('URLをクリップボードにコピーしました');
                      setTimeout(() => setSuccessMessage(null), 2000);
                    }}
                    style={{ backgroundColor: accentColor, color: '#000000' }}
                  >
                    コピー
                  </Button>
                </div>
              </div>
              <div className="p-3 bg-[#2a2a2a] rounded-lg border border-white/10">
                <p className="text-white/60 text-xs mb-1">テナント情報</p>
                <p className="text-white text-sm font-mono">{getCurrentTenant()}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      </div>
    </div>
  );
}

export default function CreateMemoryPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-600">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    }>
      <CreateMemoryPageContent />
    </Suspense>
  );
}

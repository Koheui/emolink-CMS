'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Camera, Video as VideoIcon, Music, Image as ImageIcon, Trash2, Eye, EyeOff, FileText, Edit, X, ArrowUp, Play, Mountain, ExternalLink, Palette, ArrowUpRight, Settings, ArrowRight, ArrowUpCircle } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage, auth } from '@/lib/firebase';
import { uploadFile, uploadImage, uploadVideo, uploadAudio } from '@/lib/storage';
import { useMemories, useMemory } from '@/hooks/use-memories';
import { useQueryClient } from '@tanstack/react-query';
import { formatDate, generatePublicPageUrl, generateNfcUrl } from '@/lib/utils';
import { getCurrentTenant } from '@/lib/security/tenant-validation';
import { getMemoryById, updateMemory, deleteMemory, getClaimRequestById, createPublicPage, updatePublicPage, getPublicPageById } from '@/lib/firestore';
import { checkStorageLimit as checkStorageLimitLib, getStorageLimit, DEFAULT_STORAGE_LIMIT } from '@/lib/storage-limit';
import { isExpired } from '@/lib/expiration';
import { doc, updateDoc, query, where, getDocs, getDoc } from 'firebase/firestore';
import { ClaimRequest } from '@/types';
import { MemorySelector } from '@/components/memory-selector';
import { MemoryExpirationBanner } from '@/components/memory-expiration-banner';
import { StorageLimitBanner } from '@/components/storage-limit-banner';
import { TenantAdvertisement } from '@/components/tenant-advertisement';

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
  thumbnailUrl?: string; // テキストブロック用サムネイル画像URL
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
  
  // 既存のemolinkを取得
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
  
  // 最後に開いたページを保存
  useEffect(() => {
    if (memoryId && currentUser?.uid && typeof window !== 'undefined') {
      localStorage.setItem(`lastMemoryId_${currentUser.uid}`, memoryId);
    }
  }, [memoryId, currentUser?.uid]);

  // ログイン後に最後に開いたページを復元、なければ最初のメモリにリダイレクト
  useEffect(() => {
    // 認証が完了し、既存のメモリがある場合、最後に開いたページまたは最初のメモリにリダイレクト（エンドユーザー向け）
    if (
      !authLoading &&
      isAuthenticated &&
      !isAdmin &&
      currentUser?.uid &&
      existingMemories.length > 0 &&
      !memoryId &&
      !memoriesLoading &&
      !existingMemoryLoading &&
      !hasLoadedMemory
    ) {
      const userMemories = existingMemories.filter(m => m.ownerUid === currentUser?.uid);
      if (userMemories.length > 0) {
        // 最後に開いたページを取得
        let targetMemoryId: string | null = null;
        if (typeof window !== 'undefined') {
          const lastMemoryId = localStorage.getItem(`lastMemoryId_${currentUser.uid}`);
          // 最後に開いたページが存在するか確認
          if (lastMemoryId && userMemories.some(m => m.id === lastMemoryId)) {
            targetMemoryId = lastMemoryId;
          }
        }
        
        // 最後に開いたページがない場合は、最初のメモリを使用
        if (!targetMemoryId) {
          targetMemoryId = userMemories[0].id;
        }
        
        console.log('Auto-redirecting to memory:', targetMemoryId);
        router.replace(`/memories/create?memoryId=${targetMemoryId}`, { scroll: false });
      }
    }
  }, [authLoading, isAuthenticated, isAdmin, currentUser?.uid, existingMemories, memoryId, memoriesLoading, existingMemoryLoading, hasLoadedMemory, router]);
  
  // ログイン後に状態をリセット（再ログイン時に既存のメモリを読み込むため）
  // 無限ループを防ぐため、useRefでリセット済みフラグを管理
  const hasResetAfterLogin = useRef(false);
  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.uid && !hasResetAfterLogin.current) {
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
        hasResetAfterLogin.current = true;
      }
    }
  }, [authLoading, isAuthenticated, currentUser?.uid, memoryId]);
  
  // デバッグ用: ログイン後の状態を確認（無限ループを防ぐため、条件を厳しくする）
  const debugLogged = useRef(false);
  useEffect(() => {
    if (!authLoading && isAuthenticated && currentUser?.uid && !debugLogged.current) {
      console.log('=== After Login Debug ===');
      console.log('memoryId from URL:', memoryId);
      console.log('existingMemory:', existingMemory);
      console.log('existingMemoryLoading:', existingMemoryLoading);
      console.log('existingMemories count:', existingMemories.length);
      console.log('hasLoadedMemory:', hasLoadedMemory);
      console.log('lastLoadedMemoryId:', lastLoadedMemoryId);
      debugLogged.current = true;
    }
  }, [authLoading, isAuthenticated, currentUser?.uid]);
  
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
  
  // ブラウザのタブタイトルを動的に更新
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (title && title.trim()) {
        document.title = `${title.trim()} - emolink`;
      } else {
        document.title = 'emolink';
      }
    }
  }, [title]);
  
  const [showEditBanner, setShowEditBanner] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [profileImagePosition, setProfileImagePosition] = useState('center center');
  const [profileImageScale, setProfileImageScale] = useState(1);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState('center center');
  const [coverImageScale, setCoverImageScale] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [isDraggingProfile, setIsDraggingProfile] = useState(false);
  const [draggedBlockId, setDraggedBlockId] = useState<string | null>(null);
  const [dragOverBlockId, setDragOverBlockId] = useState<string | null>(null);
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
  const [gradientColor, setGradientColor] = useState('#000000'); // グラデーションの色（デフォルトは黒）
  // エディットページの背景色とカード背景色は固定
  const editPageBackgroundColor = '#000';
  const editPageCardBackgroundColor = '#1a1a1a';
  const [titleFontSize, setTitleFontSize] = useState(35); // px単位
  const [bodyFontSize, setBodyFontSize] = useState(16); // px単位
  const [topicsTitle, setTopicsTitle] = useState('Topics');
  const [messageTitle, setMessageTitle] = useState('Message');
  const [storageUsed, setStorageUsed] = useState(0); // 現在のストレージ使用量（バイト単位）
  const [claimRequest, setClaimRequest] = useState<ClaimRequest | null>(null);
  const [claimRequestLoading, setClaimRequestLoading] = useState(false);
  
  // ストレージ制限（既存のMemoryから取得、なければデフォルト値）
  const STORAGE_LIMIT = existingMemory ? getStorageLimit(existingMemory) : DEFAULT_STORAGE_LIMIT;
  
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
  
  // 無限ループを防ぐため、useRefで読み込み済みフラグを管理
  const memoryLoadRef = useRef<string | null>(null);
  const titleInitializedRef = useRef(false);
  const descriptionInitializedRef = useRef(false);
  const bioInitializedRef = useRef(false);
  const gradientColorInitializedRef = useRef(false);
  
  useEffect(() => {
    // 保存処理中は読み込み処理を実行しない
    if (loading) {
      return;
    }
    
    if (memoryId && existingMemory && currentUser) {
      // memoryIdが変更された場合のみ読み込み
      if (memoryLoadRef.current !== memoryId) {
        console.log('=== useEffect: Loading existing memory ===');
        console.log('memoryId:', memoryId);
        console.log('existingMemory:', existingMemory);
        console.log('currentUser:', currentUser?.uid);
        
        memoryLoadRef.current = memoryId;
        // リセットフラグ
        titleInitializedRef.current = false;
        descriptionInitializedRef.current = false;
        bioInitializedRef.current = false;
        gradientColorInitializedRef.current = false;
      }
      
      // 既存のmemoryデータでstateを初期化（初回のみ）
      if (!titleInitializedRef.current) {
      setTitle(existingMemory.title || '');
        titleInitializedRef.current = true;
      }
      if (!descriptionInitializedRef.current) {
      setDescription(existingMemory.description || '');
        descriptionInitializedRef.current = true;
      }
      if (!bioInitializedRef.current) {
      setBio(existingMemory.bio || '');
        bioInitializedRef.current = true;
      }
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
      
      let mediaBlocks = blocks.filter((block: any) => 
        block.type !== 'link' && ['image', 'video', 'audio', 'album', 'text'].includes(block.type)
      ) as MediaBlock[];
      
      console.log('Filtered mediaBlocks:', mediaBlocks);
      console.log('Filtered mediaBlocks count:', mediaBlocks.length);
      console.log('MediaBlocks with URLs:', mediaBlocks.filter(b => b.url).map(b => ({ id: b.id, type: b.type, hasUrl: !!b.url, url: b.url?.substring(0, 50) })));
      
      // orderingフィールドがある場合、それに従ってソート
      if (existingMemory.ordering && Array.isArray(existingMemory.ordering)) {
        console.log('=== Applying ordering ===');
        console.log('Ordering array:', existingMemory.ordering);
        const orderMap = new Map(existingMemory.ordering.map((id, index) => [id, index]));
        mediaBlocks = mediaBlocks.sort((a, b) => {
          const orderA = orderMap.get(a.id) ?? 999999;
          const orderB = orderMap.get(b.id) ?? 999999;
          return orderA - orderB;
        });
        console.log('Sorted mediaBlocks by ordering:', mediaBlocks.map(b => b.id));
      }
      
      // 保存処理中でない場合のみ、mediaBlocksを更新
      console.log('Setting mediaBlocks', { loading, mediaBlocksCount: mediaBlocks.length });
      setMediaBlocks(mediaBlocks);
      // refも同時に更新
      mediaBlocksRef.current = mediaBlocks;
      
      // 色設定とフォントサイズを設定
      setAccentColor(existingMemory.colors?.accent || '#08af86');
      setTextColor(existingMemory.colors?.text || '#ffffff');
      setBackgroundColor(existingMemory.colors?.background || '#000f24');
      // gradientColorは初回のみ設定（保存後に上書きされないようにする）
      if (!gradientColorInitializedRef.current) {
        setGradientColor(existingMemory.colors?.gradient || '#000000');
        gradientColorInitializedRef.current = true;
      }
      setTitleFontSize(existingMemory.fontSizes?.title || 35);
      setBodyFontSize(existingMemory.fontSizes?.body || 16);
      setTopicsTitle(existingMemory.topicsTitle || 'Topics');
      setMessageTitle(existingMemory.messageTitle || 'Message');
      
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
      memoryLoadRef.current = null;
      titleInitializedRef.current = false;
      descriptionInitializedRef.current = false;
      bioInitializedRef.current = false;
    }
  }, [memoryId, existingMemory, currentUser, loading]);
  
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
      // アルバムの場合は複数選択でアップロード（画像と動画の両方を受け付ける）
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/*,video/*';
      input.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (!files || files.length === 0) {
          console.log('No files selected for album');
          return;
        }
        
        console.log('Files selected for album:', files.length);
        try {
        await handleAlbumUpload(Array.from(files));
        } catch (error) {
          console.error('Error in handleAlbumUpload:', error);
        }
      };
      input.onerror = (e) => {
        console.error('File input error:', e);
        setError('ファイル選択でエラーが発生しました');
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
  
  const handleUpdateBlock = (id: string, field: 'title' | 'description' | 'isTopic' | 'thumbnailUrl', value: string | boolean | undefined) => {
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
    if (!existingMemory) {
      // existingMemoryがない場合はデフォルト制限でチェック
      const newTotal = storageUsed + additionalSize;
      if (newTotal > DEFAULT_STORAGE_LIMIT) {
        const usedMB = (storageUsed / (1024 * 1024)).toFixed(2);
        const limitMB = (DEFAULT_STORAGE_LIMIT / (1024 * 1024)).toFixed(0);
        const additionalMB = (additionalSize / (1024 * 1024)).toFixed(2);
        setError(`ストレージ制限を超えています。現在の使用量: ${usedMB}MB / ${limitMB}MB。追加しようとしているファイル: ${additionalMB}MB。`);
        return false;
      }
      return true;
    }
    
    // 新しいライブラリ関数を使用
    const result = checkStorageLimitLib(existingMemory, additionalSize);
    if (!result.allowed) {
      const usedMB = (result.currentUsed / (1024 * 1024)).toFixed(2);
      const limitMB = (result.limit / (1024 * 1024)).toFixed(0);
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
    console.log('=== handleAlbumUpload: Starting ===');
    console.log('Files count:', files.length);
    console.log('Current user UID:', currentUser?.uid);
    console.log('Storage initialized:', !!storage);
    console.log('Auth initialized:', !!auth);
    
    // ストレージの初期化チェック
    if (!storage) {
      console.error('❌ Storage is not initialized');
      setError('ストレージが初期化されていません。ページをリロードしてください。');
      return;
    }
    
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('❌ User not authenticated, cannot upload album');
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    if (!files || files.length === 0) {
      console.error('❌ No files provided');
      setError('ファイルが選択されていません');
      return;
    }
    
    try {
      setUploading(true);
      setError(null); // エラーをクリア
      console.log('✅ Starting album upload process...');
      
      // すべてのファイルのサイズを合計してチェック
      const totalSize = files.reduce((sum, file) => sum + file.size, 0);
      console.log('Total file size:', (totalSize / 1024 / 1024).toFixed(2), 'MB');
      if (!checkStorageLimit(totalSize)) {
        setUploading(false);
        return;
      }
      
      const albumItems: AlbumItem[] = [];
      
      // すべてのファイルをアップロード
      console.log('📤 Uploading', files.length, 'files...');
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        console.log(`📤 Uploading file ${i + 1}/${files.length}:`, file.name, `(${(file.size / 1024 / 1024).toFixed(2)} MB)`);
        
        try {
          // ファイル名のサニタイズ（特殊文字を削除）
          const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
          const storageRef = ref(storage, `memories/${currentUser.uid}/${Date.now()}_${i}_${sanitizedFileName}`);
          console.log('📤 Storage ref created:', storageRef.fullPath);
          
        const snapshot = await uploadBytes(storageRef, file);
          console.log('✅ Upload complete for file:', file.name);
          
        const downloadURL = await getDownloadURL(snapshot.ref);
          console.log('✅ Download URL obtained for file:', file.name);
        
        albumItems.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: downloadURL,
          fileSize: file.size,
        });
          console.log('✅ Album item added:', { id: albumItems[albumItems.length - 1].id, url: downloadURL.substring(0, 50) });
        } catch (fileError: any) {
          console.error(`❌ Error uploading file ${file.name}:`, fileError);
          console.error('File error details:', {
            code: fileError.code,
            message: fileError.message,
            stack: fileError.stack
          });
          throw new Error(`ファイル「${file.name}」のアップロードに失敗しました: ${fileError.message || fileError.code || '不明なエラー'}`);
        }
      }
      
      console.log('✅ All files uploaded. Total album items:', albumItems.length);
      
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
      console.error('❌ Album upload error:', err);
      console.error('Error details:', {
        message: err.message,
        code: err.code,
        stack: err.stack
      });
      
      // より詳細なエラーメッセージを表示
      let errorMessage = 'アルバムのアップロードに失敗しました';
      if (err.code === 'storage/unauthorized') {
        errorMessage = 'アップロード権限がありません。ログイン状態を確認してください。';
      } else if (err.code === 'storage/canceled') {
        errorMessage = 'アップロードがキャンセルされました。';
      } else if (err.code === 'storage/unknown') {
        errorMessage = '不明なエラーが発生しました。ネットワーク接続を確認してください。';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  };

  // 動画からサムネイルを生成する関数
  const generateVideoThumbnail = async (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        reject(new Error('Canvas context not available'));
        return;
      }
      
      video.preload = 'metadata';
      video.onloadedmetadata = () => {
        video.currentTime = 0.1; // 0.1秒の位置からフレームを取得
      };
      
      video.onseeked = () => {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to create blob from canvas'));
            }
          }, 'image/jpeg', 0.8);
        } catch (error) {
          reject(error);
        }
      };
      
      video.onerror = (error) => {
        reject(new Error('Video loading error'));
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'audio') => {
    console.log('=== handleFileUpload: Starting ===');
    console.log('File:', { name: file.name, size: file.size, type: file.type });
    console.log('Media type:', type);
    console.log('Current user UID:', currentUser?.uid);
    console.log('Auth state:', { isAuthenticated, authLoading, currentUser: !!currentUser });
    console.log('Firebase Auth currentUser:', auth?.currentUser?.uid);
    
    // ユーザー認証チェック
    if (!currentUser?.uid) {
      console.error('User not authenticated, cannot upload file');
      console.error('Auth details:', {
        currentUser: currentUser,
        isAuthenticated,
        authLoading,
        firebaseAuthUser: auth?.currentUser
      });
      setError('ログインが必要です。ページをリロードしてください。');
      return;
    }
    
    // Firebase Storageの初期化確認
    if (!storage) {
      console.error('Firebase Storage is not initialized');
      setError('ストレージの初期化に失敗しました。ページをリロードしてください。');
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
        setError('ストレージ容量が不足しています。既存のファイルを削除してから再度お試しください。');
        setUploading(false);
        return;
      }
      
      console.log('Uploading file...');
      const storagePath = `memories/${currentUser.uid}/${Date.now()}_${file.name}`;
      console.log('Storage path:', storagePath);
      
      // storage.tsのuploadFile関数を使用（R2/Firebase Storageを自動切り替え）
      const uploadResult = await uploadFile(file, storagePath, (progress) => {
        console.log('Upload progress:', progress);
      });
      
      const downloadURL = uploadResult.url;
      console.log('Download URL obtained:', downloadURL?.substring(0, 100));
      
      // ストレージ使用量を更新
      await updateStorageUsed(file.size);
      
      // 動画の場合はサムネイルを生成してアップロード
      let thumbnailUrl: string | undefined;
      if (type === 'video') {
        try {
          console.log('Generating video thumbnail...');
          const thumbnailBlob = await generateVideoThumbnail(file);
          console.log('Thumbnail generated, uploading to Firebase Storage...');
          
          // サムネイルをストレージにアップロード（R2/Firebase Storageを自動切り替え）
          const thumbnailPath = `memories/${currentUser.uid}/${Date.now()}_${file.name}_thumbnail.jpg`;
          const thumbnailFile = new File([thumbnailBlob], 'thumbnail.jpg', { type: 'image/jpeg' });
          const thumbnailResult = await uploadFile(thumbnailFile, thumbnailPath);
          thumbnailUrl = thumbnailResult.url;
          
          // サムネイルのストレージ使用量も更新
          await updateStorageUsed(thumbnailBlob.size);
          
          console.log('Thumbnail uploaded:', thumbnailUrl?.substring(0, 100));
        } catch (thumbnailError) {
          console.error('Failed to generate/upload thumbnail:', thumbnailError);
          // サムネイル生成に失敗しても動画のアップロードは続行
        }
      }
      
      const newBlock: MediaBlock = {
        id: Date.now().toString(),
        type,
        url: downloadURL,
        thumbnailUrl, // サムネイルURLを追加
        visibility: 'public',
        fileSize: file.size,
      };
      
      console.log('=== handleFileUpload: New block created ===');
      console.log('New block:', { id: newBlock.id, type: newBlock.type, hasUrl: !!newBlock.url, hasThumbnail: !!newBlock.thumbnailUrl, url: newBlock.url?.substring(0, 100) });
      
      setMediaBlocks(prev => {
        const updated = [...prev, newBlock];
        console.log('=== setMediaBlocks (file) ===');
        console.log('Previous mediaBlocks count:', prev.length);
        console.log('New block:', { id: newBlock.id, type: newBlock.type, hasUrl: !!newBlock.url, hasThumbnail: !!newBlock.thumbnailUrl, url: newBlock.url?.substring(0, 50) });
        console.log('Updated mediaBlocks count:', updated.length);
        console.log('Updated mediaBlocks:', updated.map(b => ({ id: b.id, type: b.type, hasUrl: !!b.url, hasThumbnail: !!b.thumbnailUrl, url: b.url?.substring(0, 50) })));
        // refも同時に更新
        mediaBlocksRef.current = updated;
        console.log('mediaBlocksRef updated, current count:', mediaBlocksRef.current.length);
        return updated;
      });
      
      console.log('=== handleFileUpload: Complete ===');
    } catch (err: any) {
      console.error('=== handleFileUpload: Error ===');
      console.error('Upload error:', err);
      console.error('Error details:', { 
        message: err.message, 
        code: err.code, 
        stack: err.stack,
        name: err.name,
        serverResponse: err.serverResponse
      });
      
      // エラーメッセージを詳細化
      let errorMessage = 'アップロードに失敗しました';
      if (err.code === 'storage/unauthorized') {
        errorMessage = 'アップロード権限がありません。ログイン状態を確認してください。';
      } else if (err.code === 'storage/canceled') {
        errorMessage = 'アップロードがキャンセルされました。';
      } else if (err.code === 'storage/unknown') {
        errorMessage = '不明なエラーが発生しました。ページをリロードして再度お試しください。';
      } else if (err.message) {
        errorMessage = `アップロードに失敗しました: ${err.message}`;
      }
      
      setError(errorMessage);
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
        hasThumbnailUrl: !!b.thumbnailUrl,
        thumbnailUrl: b.thumbnailUrl?.substring(0, 50),
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

      // undefinedの値を再帰的に除外するヘルパー関数
      const removeUndefined = (obj: any): any => {
        if (obj === null || obj === undefined) {
          return null;
        }
        if (Array.isArray(obj)) {
          return obj.map(item => removeUndefined(item)).filter(item => item !== null && item !== undefined);
        }
        if (typeof obj === 'object' && obj.constructor === Object) {
          const cleaned: any = {};
          for (const key in obj) {
            if (obj.hasOwnProperty(key) && obj[key] !== undefined) {
              const cleanedValue = removeUndefined(obj[key]);
              if (cleanedValue !== null && cleanedValue !== undefined) {
                cleaned[key] = cleanedValue;
              }
            }
          }
          return cleaned;
        }
        return obj;
      };

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
        if (block.thumbnailUrl) blockData.thumbnailUrl = block.thumbnailUrl; // 動画のサムネイルURLを保存
        if (block.title) blockData.title = block.title;
        if (block.description) blockData.description = block.description;
        if (block.isTopic !== undefined) blockData.isTopic = block.isTopic;
        if (block.fileSize !== undefined && block.fileSize !== null) blockData.fileSize = block.fileSize;
        if (block.albumItems && block.albumItems.length > 0) {
          blockData.albumItems = block.albumItems.map(item => {
            const itemData: any = {
              id: item.id,
              url: item.url,
            };
            // undefinedの値を除外（Firestoreはundefinedを許可しない）
            if (item.title !== undefined && item.title !== null) itemData.title = item.title;
            if (item.description !== undefined && item.description !== null) itemData.description = item.description;
            if (item.fileSize !== undefined && item.fileSize !== null) itemData.fileSize = item.fileSize;
            return itemData;
          });
        }
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
          gradient: gradientColor || '#000000', // グラデーション色を追加
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
      console.log('Gradient color being saved:', gradientColor);
      console.log('Memory data colors:', memoryData.colors);
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
        url: b.url?.substring(0, 100),
        hasThumbnailUrl: !!b.thumbnailUrl,
        thumbnailUrl: b.thumbnailUrl?.substring(0, 100)
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
      if (messageTitle) memoryData.messageTitle = messageTitle;
      
      // orderingを追加（最新の状態をrefから取得）
      memoryData.ordering = latestMediaBlocks.map(block => block.id);
      console.log('[Save] Ordering being saved:', memoryData.ordering);
      console.log('[Save] Block order:', latestMediaBlocks.map(b => ({ id: b.id, type: b.type })));

      // memoryDataからundefinedの値を完全に除外
      const cleanedMemoryData = removeUndefined(memoryData);
      
      console.log('=== Cleaned memory data ===');
      console.log('Cleaned memoryData keys:', Object.keys(cleanedMemoryData));
      console.log('Cleaned blocks count:', cleanedMemoryData.blocks?.length || 0);
      console.log('Cleaned ordering:', cleanedMemoryData.ordering);
      console.log('Cleaned ordering length:', cleanedMemoryData.ordering?.length || 0);

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
          memoryDataKeys: Object.keys(cleanedMemoryData),
        });
        try {
          console.log('=== Calling updateMemory ===');
          console.log('cleanedMemoryData.blocks:', cleanedMemoryData.blocks);
          console.log('cleanedMemoryData.blocks type:', typeof cleanedMemoryData.blocks);
          console.log('cleanedMemoryData.blocks is array:', Array.isArray(cleanedMemoryData.blocks));
          if (Array.isArray(cleanedMemoryData.blocks)) {
            console.log('cleanedMemoryData.blocks count:', cleanedMemoryData.blocks.length);
            console.log('cleanedMemoryData.blocks with URLs:', cleanedMemoryData.blocks.filter((b: any) => b.url).map((b: any) => ({ id: b.id, type: b.type, url: b.url?.substring(0, 50) })));
          }
          console.log('cleanedMemoryData keys:', Object.keys(cleanedMemoryData));
          console.log('cleanedMemoryData.blocks before updateMemory:', JSON.stringify(cleanedMemoryData.blocks).substring(0, 200));
          
          await updateMemory(memoryId, cleanedMemoryData, !isAdmin && isOwner);
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
          ownerUid: cleanedMemoryData.ownerUid,
          tenant: cleanedMemoryData.tenant,
          title: cleanedMemoryData.title,
          currentUserUid: currentUser?.uid,
          isAdmin,
        });
        try {
          const memoryRef = await addDoc(collection(db, 'memories'), {
            ...cleanedMemoryData,
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
              console.log('Updating publicPage with gradientColor:', gradientColor);
              console.log('Updating publicPage with topicsTitle:', topicsTitle);
              console.log('Updating publicPage with messageTitle:', messageTitle);
              await updatePublicPage(publicPageId, {
                memoryId: savedMemoryId,
                title: title.trim(),
                about: description || '',
                bio: bio || '',
                colors: {
                  accent: accentColor,
                  text: textColor,
                  background: backgroundColor,
                  gradient: gradientColor || '#000000',
                },
                ...(Object.keys(mediaUpdate).length > 0 && { media: mediaUpdate }),
                coverImagePosition: coverImagePosition,
                profileImagePosition: profileImagePosition,
                profileImageScale: profileImageScale,
                fontSizes: {
                  title: titleFontSize,
                  body: bodyFontSize,
                },
                topicsTitle: topicsTitle,
                messageTitle: messageTitle,
                ordering: latestMediaBlocks.map(block => block.id),
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
                  gradient: gradientColor,
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
                topicsTitle: topicsTitle,
                messageTitle: messageTitle,
                ordering: latestMediaBlocks.map(block => block.id),
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
        
        // 既存のpublicPageデータを取得
        const existingPublicPageDoc = await getDoc(doc(db, 'publicPages', publicPageId));
        const existingPublicPageData = existingPublicPageDoc.exists() ? existingPublicPageDoc.data() : {};
        
        // mediaオブジェクトを構築（既存のデータを保持しつつ、新しいデータで上書き）
        const mediaUpdate: any = {
          cover: coverImage || existingPublicPageData.media?.cover || undefined,
          profile: profileImage || existingPublicPageData.media?.profile || undefined,
        };
        
        console.log('=== Updating publicPage ===');
        console.log('PublicPage update details:', {
          publicPageId,
          isAdmin,
          skipTenantCheck: !isAdmin,
          ownerUid: currentUser?.uid,
          existingCoverImage: existingPublicPageData.media?.cover,
          newCoverImage: coverImage,
          finalCoverImage: mediaUpdate.cover,
        });
        try {
          console.log('Updating existing publicPage with gradientColor:', gradientColor);
          console.log('Updating existing publicPage with topicsTitle:', topicsTitle);
          console.log('Updating existing publicPage with messageTitle:', messageTitle);
          await updatePublicPage(publicPageId, {
          memoryId: savedMemoryId, // memoryIdが空の場合に設定
          title: title.trim(),
          about: description || '',
          bio: bio || '',
          colors: {
            accent: accentColor,
            text: textColor,
            background: backgroundColor,
            gradient: gradientColor || '#000000',
          },
          media: mediaUpdate,
          coverImagePosition: coverImagePosition,
          coverImageScale: coverImageScale,
          profileImagePosition: profileImagePosition,
          profileImageScale: profileImageScale,
          fontSizes: {
            title: titleFontSize,
            body: bodyFontSize,
          },
          topicsTitle: topicsTitle,
          messageTitle: messageTitle,
          ordering: latestMediaBlocks.map(block => block.id),
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
        
        console.log('=== Email Notification Check ===');
        console.log('claimRequestId:', claimRequestId);
        console.log('claimRequest?.publicPageUrl:', claimRequest?.publicPageUrl);
        console.log('claimRequest?.loginUrl:', claimRequest?.loginUrl);
        console.log('shouldSendEmail:', claimRequestId && (!claimRequest?.publicPageUrl || !claimRequest?.loginUrl));
        
        if (claimRequestId && (!claimRequest?.publicPageUrl || !claimRequest?.loginUrl)) {
          try {
            const publicPageUrl = generatePublicPageUrl(publicPageId, tenant);
            // ログインURLはトップページ（/）のみ（ログイン後は自動的に/memories/createにリダイレクトされる）
            const loginUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
            
            console.log('=== Sending URLs to API for email notification ===');
            console.log('requestId:', claimRequestId);
            console.log('publicPageUrl:', publicPageUrl);
            console.log('loginUrl:', loginUrl);
            
            // claimRequestからメールアドレスを取得
            const claimRequestData = await getClaimRequestById(claimRequestId, true);
            const loginEmail = claimRequestData?.email || '';
            
            // パスワードはsessionStorageから取得（パスワード設定時に保存）
            const loginPassword = typeof window !== 'undefined' ? sessionStorage.getItem('tempPassword') || '' : '';
            
            console.log('Email:', loginEmail);
            console.log('Password exists:', !!loginPassword);
            
            if (!loginEmail) {
              console.error('❌ Email address not found in claimRequest');
            }
            if (!loginPassword) {
              console.error('❌ Password not found in sessionStorage');
            }
            
            // Next.js APIルート経由でメール送信（Firebase Functions APIの代わり）
            const apiUrl = `/api/claim/${claimRequestId}/set-urls`;
            console.log('Calling API:', apiUrl);
            
            const response = await fetch(apiUrl, {
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
            });
            
            const result = await response.json();
            
            console.log('API Response:', result);
            
            if (!result.ok) {
              console.error('❌ Failed to set URLs for email notification:', result.error);
              setError(`メール送信に失敗しました: ${result.error || '不明なエラー'}`);
            } else {
              console.log('✅ URLs set successfully for email notification:', {
                publicPageUrl: result.publicPageUrl,
                loginUrl: result.loginUrl,
                emailSent: result.emailSent,
              });
              
              if (result.emailSent) {
                setSuccessMessage('メールを送信しました！');
              } else if (result.emailError) {
                console.error('❌ Email sending error:', result.emailError);
                setError(`メール送信に失敗しました: ${result.emailError}`);
              } else {
                console.warn('⚠️ Email not sent (email or password missing)');
              }
              
              // claimRequestを再取得して更新
              const updatedRequest = await getClaimRequestById(claimRequestId, true);
              if (updatedRequest) {
                setClaimRequest(updatedRequest);
              }
            }
          } catch (error: any) {
            console.error('❌ Error calling set-urls API for email notification:', error);
            console.error('Error details:', {
              message: error.message,
              stack: error.stack,
            });
            setError(`メール送信に失敗しました: ${error.message || '不明なエラー'}`);
            // エラーが発生しても保存処理は続行する
          }
        } else {
          if (!claimRequestId) {
            console.log('ℹ️ No claimRequestId found - email will not be sent (this is normal for direct page creation)');
          } else {
            console.log('ℹ️ URLs already set - email was already sent or will be sent by Firestore trigger');
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
          gradient: gradientColor || '#000000',
        },
        fontSizes: {
          title: titleFontSize,
          body: bodyFontSize,
        },
        topicsTitle: topicsTitle,
        messageTitle: messageTitle,
        ordering: latestMediaBlocks.map(block => block.id),
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
            
            // 保存後にメモリを再取得してgradientColorを更新
            if (memoryId) {
              try {
                // 少し待ってから再取得（Firestoreの更新が反映されるまで）
                await new Promise(resolve => setTimeout(resolve, 1000));
                const updatedMemory = await getMemoryById(memoryId, !isAdmin && existingMemory?.ownerUid === currentUser?.uid);
                console.log('Reloaded memory after save:', {
                  hasMemory: !!updatedMemory,
                  colors: updatedMemory?.colors,
                  gradient: updatedMemory?.colors?.gradient,
                });
                if (updatedMemory) {
                  // 色設定を更新
                  if (updatedMemory.colors?.accent) setAccentColor(updatedMemory.colors.accent);
                  if (updatedMemory.colors?.text) setTextColor(updatedMemory.colors.text);
                  if (updatedMemory.colors?.background) setBackgroundColor(updatedMemory.colors.background);
                  if (updatedMemory.colors?.gradient) {
                    setGradientColor(updatedMemory.colors.gradient);
                    console.log('Updated gradientColor after save:', updatedMemory.colors.gradient);
                  }
                  // フォントサイズを更新
                  if (updatedMemory.fontSizes?.title) setTitleFontSize(updatedMemory.fontSizes.title);
                  if (updatedMemory.fontSizes?.body) setBodyFontSize(updatedMemory.fontSizes.body);
                  // タイトルを更新
                  if (updatedMemory.topicsTitle) setTopicsTitle(updatedMemory.topicsTitle);
                  if (updatedMemory.messageTitle) setMessageTitle(updatedMemory.messageTitle);
                }
              } catch (error) {
                console.error('Failed to reload memory after save:', error);
              }
            }
      
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
  // 利用期限チェック
  if (memoryId && existingMemory && isExpired(existingMemory)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white p-4">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full text-center">
          <p className="text-white font-medium mb-4">利用期限が切れています</p>
          <p className="text-white/70 text-sm mb-6">
            このemolinkの利用期限が切れています。延長するには、管理者にお問い合わせください。
          </p>
        </div>
      </div>
    );
  }

  if (memoryId && existingMemory === null && !existingMemoryLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f] text-white p-4">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 max-w-md w-full text-center">
          <p className="text-white font-medium mb-4">emolinkが見つかりません</p>
          <p className="text-white/70 text-sm mb-6">
            指定されたemolinkは存在しないか、アクセス権限がありません。
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


  return (
    <div className="min-h-screen bg-[#0f0f0f] text-white">
      {/* 編集バナー */}
      {showEditBanner && (
        <div className="bg-[#1a1a1a] border-b border-white/10 p-2 sm:p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <MemorySelector />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowColorSettings(!showColorSettings)}
              className="flex items-center justify-center w-10 h-10 bg-[#2a2a2a] text-white rounded-lg hover:bg-[#3a3a3a] transition"
              title="設定"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button
              onClick={() => {
                // プレビュー用にlocalStorageに保存（最新の状態をrefから取得）
                const latestBlocks = mediaBlocksRef.current;
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
                  blocks: latestBlocks,
                  colors: {
                    accent: accentColor,
                    text: textColor,
                    background: backgroundColor,
                    gradient: gradientColor,
                  },
                  fontSizes: {
                    title: titleFontSize,
                    body: bodyFontSize,
                  },
                  topicsTitle: topicsTitle,
                  messageTitle: messageTitle,
                  ordering: latestBlocks.map(block => block.id),
                };
                localStorage.setItem('memory-preview', JSON.stringify(previewData));
                window.open('/public/preview', '_blank');
              }}
              className="flex items-center justify-center w-10 h-10 rounded-lg transition"
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
              title="プレビュー"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
            {isAuthenticated && (
              <button
                onClick={() => {
                  logout();
                  router.push('/');
                }}
                className="flex items-center justify-center w-10 h-10 bg-[#2a2a2a] text-white rounded-lg hover:bg-red-500/20 hover:border-red-500/50 border border-white/10 transition"
                title="ログアウト"
              >
                <ExternalLink className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* 設定パネル */}
      {showColorSettings && (
        <div className="bg-[#1a1a1a] border-b border-white/10 p-4 sm:p-6">
          <div className="max-w-[calc(42rem*1.1025)] mx-auto space-y-4">
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
              <div>
                <label className="block text-white/80 text-sm mb-2">グラデーション色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={gradientColor}
                    onChange={(e) => setGradientColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={gradientColor}
                    onChange={(e) => setGradientColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                    placeholder="#000000"
                  />
                </div>
                <p className="text-xs text-white/60 mt-1">サムネイル上のグラデーションの色を設定します</p>
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
              <h4 className="text-white font-medium mb-3">Message設定</h4>
              <div>
                <label className="block text-white/80 text-sm mb-2">Messageセクションのタイトル</label>
                  <input
                    type="text"
                  value={messageTitle}
                  onChange={(e) => setMessageTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                  placeholder="Message"
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
            
            {/* 利用期限・ストレージ制限バナー */}
            {existingMemory && currentUser && (
              <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                <MemoryExpirationBanner
                  memory={existingMemory}
                  userId={currentUser.uid}
                  onExtended={(updatedMemory) => {
                    // 延長後にMemoryを再取得して表示を更新
                    refetchMemory();
                  }}
                />
                <StorageLimitBanner
                  memory={existingMemory}
                  userId={currentUser.uid}
                  onExtended={(updatedMemory) => {
                    // 拡張後にMemoryを再取得して表示を更新
                    refetchMemory();
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="p-4 sm:p-6 md:p-8">
        {/* 追加ボタンと保存ボタン（プロフィール画像の上に配置、横並び、位置を逆に） */}
        <div className="max-w-[calc(42rem*1.1025)] mx-auto mb-4 mt-12 px-6 sm:px-8">
          <div className="flex gap-3">
            <button
              onClick={() => {
                setShowUploadMenu(!showUploadMenu);
                // コンテンツエリアの最下部までスクロール（アニメーション付き）
                setTimeout(() => {
                  const contentArea = document.querySelector('[data-content-area]') as HTMLElement | null;
                  if (contentArea) {
                    const rect = contentArea.getBoundingClientRect();
                    const scrollTarget = window.scrollY + rect.bottom - window.innerHeight + 100;
                    window.scrollTo({
                      top: Math.max(0, scrollTarget),
                      behavior: 'smooth'
                    });
                  }
                }, 100);
              }}
              className="flex-1 font-medium py-2.5 rounded-xl transition text-sm border-2"
              style={{ 
                borderColor: accentColor,
                color: accentColor,
                backgroundColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = `${accentColor}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                追加
              </span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading || uploading}
              className="flex-1 font-medium py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </span>
              ) : (
                '保存する'
              )}
            </button>
          </div>
        </div>

        {/* プロフィールセクション */}
      <div className="max-w-[calc(42rem*1.1025)] mx-auto mb-6 px-6 sm:px-8">
        {/* プロフィール写真 */}
        <div className="mb-6 flex flex-col items-center">
          <label className="block text-white/80 text-sm mb-2">プロフィール写真</label>
          <div className="flex flex-col items-center gap-3">
            <div className="relative w-40 h-40 rounded-full overflow-hidden border border-white/10">
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
            {profileImage && (
              <>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setProfileImagePosition('center center');
                      setProfileImageScale(1);
                    }}
                    className="bg-blue-500/80 hover:bg-blue-500 rounded-lg px-4 py-2 transition text-white text-sm"
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
                    className="bg-red-500/80 hover:bg-red-500 rounded-lg px-4 py-2 transition text-white"
                    title="削除"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-white/60 text-xs text-center">
                  ドラッグして表示位置を調整
                </p>
              </>
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
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm resize-none overflow-hidden"
                  rows={1}
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
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm resize-none overflow-hidden"
                  rows={2}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              </div>
              
              {/* プロフィール */}
        <div className="mb-6">
                <label className="block text-white/80 text-sm mb-2">プロフィール</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="プロフィールを入力"
                  className="w-full px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm resize-none overflow-hidden"
                  rows={2}
                  onInput={(e) => {
                    const target = e.currentTarget;
                    target.style.height = 'auto';
                    target.style.height = `${target.scrollHeight}px`;
                  }}
                />
              </div>
            </div>
      
      {/* カバー画像 */}
      <div className="max-w-[calc(42rem*1.1025)] mx-auto mb-6 px-6 sm:px-8">
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
      <div className="max-w-[calc(42rem*1.1025)] mx-auto px-6 sm:px-8" data-content-area>
        {/* 要素を追加 */}
        <div className="space-y-4 mb-6">
          {mediaBlocks.map((block, index) => (
            <div 
              key={block.id} 
              className={`rounded-2xl p-4 transition-all relative ${
                draggedBlockId === block.id ? 'opacity-50' : ''
              } ${
                dragOverBlockId === block.id ? 'ring-2 ring-offset-2' : ''
              }`}
              style={{
                backgroundColor: editPageCardBackgroundColor,
                ...(dragOverBlockId === block.id ? { 
                  ringColor: accentColor,
                  transform: 'translateY(-4px)',
                  boxShadow: `0 4px 12px ${accentColor}40`
                } : {})
              }}
              onDragOver={(e) => {
                if (draggedBlockId) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (draggedBlockId !== block.id) {
                    setDragOverBlockId(block.id);
                  }
                }
              }}
              onDragLeave={(e) => {
                // 子要素へのドラッグでクリアしないように、実際に要素を離れた時のみクリア
                if (e.currentTarget === e.target) {
                  setDragOverBlockId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                if (draggedBlockId && draggedBlockId !== block.id) {
                  const draggedIndex = mediaBlocks.findIndex(b => b.id === draggedBlockId);
                  const dropIndex = mediaBlocks.findIndex(b => b.id === block.id);
                  
                  if (draggedIndex !== -1 && dropIndex !== -1) {
                    const newBlocks = [...mediaBlocks];
                    const [removed] = newBlocks.splice(draggedIndex, 1);
                    newBlocks.splice(dropIndex, 0, removed);
                    console.log('[Ordering] Block moved:', {
                      draggedId: draggedBlockId,
                      draggedIndex,
                      dropIndex,
                      newOrder: newBlocks.map(b => ({ id: b.id, type: b.type }))
                    });
                    setMediaBlocks(newBlocks);
                    // refも同時に更新（保存時に最新の状態を使うため）
                    mediaBlocksRef.current = newBlocks;
                  }
                }
                setDraggedBlockId(null);
                setDragOverBlockId(null);
              }}
            >
              {/* ドラッグハンドル */}
              <div
                draggable
                onDragStart={(e) => {
                  setDraggedBlockId(block.id);
                  e.dataTransfer.effectAllowed = 'move';
                  e.dataTransfer.setData('text/plain', block.id);
                }}
                onDragEnd={() => {
                  setDraggedBlockId(null);
                  setDragOverBlockId(null);
                }}
                className="absolute top-2 right-2 flex items-center justify-center w-10 h-10 rounded cursor-move hover:bg-white/10 transition z-50"
                style={{ touchAction: 'none' }}
                title="ドラッグして順序を変更"
              >
                <div className="flex flex-col gap-1">
                  <div className="w-5 h-0.5 bg-white/70"></div>
                  <div className="w-5 h-0.5 bg-white/70"></div>
                  <div className="w-5 h-0.5 bg-white/70"></div>
                </div>
              </div>
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
                  {/* ゴミ箱ボタン（アルバムブロック下部） */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-white/10">
                    <button 
                      onClick={() => handleDelete(block.id)}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 transition flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                      <span className="text-white text-sm">削除</span>
                    </button>
                  </div>
                </div>
              ) : block.type === 'text' ? (
                // テキストブロック表示
                <>
                  {/* サムネイル画像（テキストブロック用） */}
                  <div className="mb-3">
                    <label className="block text-white/80 text-sm mb-2">サムネイル画像（任意）</label>
                    {block.thumbnailUrl ? (
                      <div className="relative aspect-video rounded-xl overflow-hidden border border-white/20">
                        <img 
                          src={block.thumbnailUrl} 
                          alt="サムネイル" 
                          className="w-full h-full object-cover"
                        />
                        <button
                          onClick={async () => {
                            // サムネイル画像を削除
                            handleUpdateBlock(block.id, 'thumbnailUrl', undefined);
                            // ストレージ使用量から削除（正確なサイズは取得できないため、今回は削除のみ）
                          }}
                          className="absolute top-2 right-2 bg-red-500/80 hover:bg-red-500 text-white rounded-full p-1.5 transition"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full aspect-video border-2 border-dashed border-white/30 rounded-xl cursor-pointer hover:border-white/50 transition">
                        <div className="flex flex-col items-center justify-center pt-5 pb-6">
                          <ImageIcon className="w-8 h-8 mb-2" style={{ color: accentColor }} />
                          <p className="text-sm text-white/80">画像をアップロード</p>
                        </div>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (file && currentUser?.uid) {
                              try {
                                setUploading(true);
                                // ストレージ制限をチェック
                                if (!checkStorageLimit(file.size)) {
                                  setUploading(false);
                                  return;
                                }
                                
                                const storageRef = ref(storage, `memories/${currentUser.uid}/text_thumbnail_${Date.now()}_${file.name}`);
                                const snapshot = await uploadBytes(storageRef, file);
                                const downloadURL = await getDownloadURL(snapshot.ref);
                                
                                // ストレージ使用量を更新
                                await updateStorageUsed(file.size);
                                
                                handleUpdateBlock(block.id, 'thumbnailUrl', downloadURL);
                              } catch (err: any) {
                                console.error('Upload error:', err);
                                setError('アップロードに失敗しました');
                              } finally {
                                setUploading(false);
                              }
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>
                  
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
                  
                  {/* ゴミ箱ボタン（テキストブロック下部） */}
                  <div className="flex justify-center mt-4 pt-4 border-t border-white/10">
                    <button 
                      onClick={() => handleDelete(block.id)}
                      className="px-4 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 transition flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                      <span className="text-white text-sm">削除</span>
                    </button>
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
              
              {/* ブロックタイプ表示 */}
              <div className="flex items-center gap-2 mt-3">
                <ArrowUp className="w-4 h-4 text-white/40" />
                <span className="text-xs text-white/60">
                  {block.type === 'image' ? '📷 写真' : block.type === 'video' ? '🎥 動画' : block.type === 'album' ? '📚 アルバム' : block.type === 'text' ? '📝 テキスト' : '🎵 音声'}
                </span>
              </div>
              
              {/* ゴミ箱ボタン（ブロック下部） - アルバムとテキストブロック以外 */}
              {block.type !== 'album' && block.type !== 'text' && (
                <div className="flex justify-center mt-4 pt-4 border-t border-white/10">
                  <button
                    onClick={() => handleDelete(block.id)}
                    className="px-4 py-2 rounded-lg bg-white/10 hover:bg-red-500/20 transition flex items-center gap-2"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">削除</span>
                  </button>
                </div>
              )}
            </div>
          ))}

          {/* 追加ボタンと保存ボタン（最下部、横並び） */}
          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setShowUploadMenu(!showUploadMenu)}
              className="flex-1 font-medium py-2.5 rounded-xl transition text-sm border-2"
              style={{ 
                borderColor: 'rgba(255, 255, 255, 0.3)',
                backgroundColor: 'transparent',
                color: accentColor,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = accentColor;
                e.currentTarget.style.backgroundColor = `${accentColor}20`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span className="flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" />
                追加
              </span>
            </button>
            <button
              onClick={handleSave}
              disabled={loading || uploading}
              className="flex-1 font-medium py-2.5 rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
                  <Loader2 className="w-4 h-4 animate-spin" />
                  保存中...
                </span>
              ) : (
                '保存する'
              )}
            </button>
          </div>
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


        {/* URL情報表示 */}
        <div className="mt-8 pt-8 border-t border-white/10 pb-8">
          {/* 広告バナー（アクセス情報の上） */}
          <TenantAdvertisement tenantId={existingMemory?.tenant || getCurrentTenant()} />
          
          <h3 className="text-white font-medium mb-4 text-sm mt-12">アクセス情報</h3>
          
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
            // デバッグログを削除（必要に応じて開発環境のみ出力）
            // if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
            //   console.log('🔍 Public page URL display check:', {
            //     hasClaimRequestUrl: !!claimRequest?.publicPageUrl,
            //     claimRequestUrl: claimRequest?.publicPageUrl,
            //     hasCurrentPublicPageId: !!currentPublicPageId,
            //     currentPublicPageId: currentPublicPageId,
            //     hasExistingMemoryPublicPageId: !!existingMemory?.publicPageId,
            //     existingMemoryPublicPageId: existingMemory?.publicPageId,
            //     willDisplay: hasPublicPageUrl,
            //   });
            // }
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
                  className="shrink-0 bg-[#2a2a2a] border-white/20 text-white hover:bg-[#3a3a3a]"
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
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f0f]">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    }>
      <CreateMemoryPageContent />
    </Suspense>
  );
}

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Plus, Camera, Video as VideoIcon, Music, Image as ImageIcon, Trash2, Eye, EyeOff, FileText, Edit, X, ArrowUp, Play, Mountain, ExternalLink, Palette } from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '@/lib/firebase';
import { useMemories } from '@/hooks/use-memories';
import { formatDate, generatePublicPageUrl, generateNfcUrl } from '@/lib/utils';
import { getCurrentTenant } from '@/lib/security/tenant-validation';

interface AlbumItem {
  id: string;
  url: string;
  title?: string;
  description?: string;
}

interface MediaBlock {
  id: string;
  type: 'image' | 'video' | 'audio' | 'album' | 'text';
  url?: string;
  thumbnail?: string;
  visibility: 'public' | 'private';
  title?: string;
  description?: string;
  albumItems?: AlbumItem[];
}

function CreateMemoryPageContent() {
  const { user: currentUser, loading: authLoading, isAuthenticated, isAdmin } = useSecretKeyAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
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
  const { data: existingMemories = [], isLoading: memoriesLoading } = useMemories(currentUser?.uid || '');
  
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [bio, setBio] = useState('');
  const [showEditBanner, setShowEditBanner] = useState(true);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [coverImagePosition, setCoverImagePosition] = useState('center center');
  const [isDragging, setIsDragging] = useState(false);
  const [showUploadMenu, setShowUploadMenu] = useState(false);
  const [mediaBlocks, setMediaBlocks] = useState<MediaBlock[]>([]);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDescription, setEditingDescription] = useState(false);
  const [editingBio, setEditingBio] = useState(false);
  const [showColorSettings, setShowColorSettings] = useState(false);
  const [accentColor, setAccentColor] = useState('#08af86');
  const [textColor, setTextColor] = useState('#ffffff');
  const [backgroundColor, setBackgroundColor] = useState('#000f24');
  const [cardBackgroundColor, setCardBackgroundColor] = useState('#1a1a1a');
  const [titleFontSize, setTitleFontSize] = useState(35); // px単位
  const [bodyFontSize, setBodyFontSize] = useState(16); // px単位
  
  // 開発用パスワード認証
  const [showDevPasswordForm, setShowDevPasswordForm] = useState(false);
  const [devPassword, setDevPassword] = useState('');
  const [devPasswordError, setDevPasswordError] = useState<string | null>(null);
  // 開発モードの判定（クライアントサイドでも動作するように）
  // 本番環境でも開発用パスワード認証を許可
  const isDevMode = typeof window !== 'undefined' 
    ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' || window.location.hostname.includes('web.app') || process.env.NODE_ENV === 'development')
    : process.env.NODE_ENV === 'development';
  
  // 開発用認証状態を初期値からチェック（sessionStorageから直接読み込む）
  const [isDevAuthenticated, setIsDevAuthenticated] = useState(() => {
    if (typeof window !== 'undefined' && isDevMode) {
      return sessionStorage.getItem('devAuth') === 'true';
    }
    return false;
  });
  
  // 開発用認証状態をチェック（毎回チェック）
  useEffect(() => {
    if (typeof window !== 'undefined' && isDevMode) {
      const devAuth = sessionStorage.getItem('devAuth') === 'true';
      setIsDevAuthenticated(devAuth);
    }
  }, [isDevMode]);

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
      setMediaBlocks(prev => [...prev, newBlock]);
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
  
  const handleUpdateBlock = (id: string, field: 'title' | 'description', value: string) => {
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

  const handleAddToAlbum = async (blockId: string) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.multiple = true;
    input.accept = 'image/*';
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (!files || files.length === 0) return;
      
      try {
        setUploading(true);
        const newItems: AlbumItem[] = [];
        
        // すべてのファイルをアップロード
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const storageRef = ref(storage, `memories/${currentUser?.uid}/${Date.now()}_${file.name}`);
          const snapshot = await uploadBytes(storageRef, file);
          const downloadURL = await getDownloadURL(snapshot.ref);
          
          newItems.push({
            id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
            url: downloadURL,
          });
        }
        
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
    try {
      setUploading(true);
      const albumItems: AlbumItem[] = [];
      
      // すべてのファイルをアップロード
      for (const file of files) {
        const storageRef = ref(storage, `memories/${currentUser?.uid}/${Date.now()}_${file.name}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        albumItems.push({
          id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
          url: downloadURL,
        });
      }
      
      const newBlock: MediaBlock = {
        id: Date.now().toString(),
        type: 'album',
        visibility: 'public',
        albumItems,
      };
      
      setMediaBlocks(prev => [...prev, newBlock]);
    } catch (err: any) {
      console.error('Album upload error:', err);
      setError('アルバムのアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'audio') => {
    try {
      setUploading(true);
      const storageRef = ref(storage, `memories/${currentUser?.uid}/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      
      const newBlock: MediaBlock = {
        id: Date.now().toString(),
        type,
        url: downloadURL,
        visibility: 'public',
      };
      
      setMediaBlocks(prev => [...prev, newBlock]);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleProfileImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const storageRef = ref(storage, `memories/${currentUser?.uid}/profile_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setProfileImage(downloadURL);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('アップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleCoverImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const storageRef = ref(storage, `memories/${currentUser?.uid}/cover_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setCoverImage(downloadURL);
    } catch (err: any) {
      console.error('Upload error:', err);
      setError('カバー画像のアップロードに失敗しました');
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = (id: string) => {
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

      // 現在のテナントを取得
      const tenant = getCurrentTenant();

      const memoryRef = await addDoc(collection(db, 'memories'), {
        ownerUid: currentUser?.uid || 'temp-user',
        tenant: tenant,
        title: title.trim(),
        description: description || '',
        bio: bio || '',
        profileImage: profileImage || null,
        coverImage: coverImage || null,
        blocks: mediaBlocks,
        colors: {
          accent: accentColor,
          text: textColor,
          background: backgroundColor,
          cardBackground: cardBackgroundColor,
        },
        fontSizes: {
          title: titleFontSize,
          body: bodyFontSize,
        },
        status: 'draft',
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      // プレビュー用にlocalStorageに保存
      const previewData = {
        title: title.trim(),
        description: description || '',
        bio: bio || '',
        profileImage: profileImage || null,
        coverImage: coverImage || null,
        coverImagePosition: coverImagePosition,
        blocks: mediaBlocks,
        colors: {
          accent: accentColor,
          text: textColor,
          background: backgroundColor,
          cardBackground: cardBackgroundColor,
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
      const errorMessage = err.message || '保存に失敗しました';
      setError(`保存に失敗しました: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };

  // 開発用パスワード認証ハンドラー
  const handleDevPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDevPasswordError(null);
    
    if (devPassword === 'dev1234') {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('devAuth', 'true');
      }
      setShowDevPasswordForm(false);
      // ページを再読み込みして認証状態を反映
      window.location.reload();
    } else {
      setDevPasswordError('パスワードが正しくありません');
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-600">
        <Loader2 className="w-12 h-12 animate-spin text-white" />
      </div>
    );
  }

  // 認証チェック：認証されていない場合はエラーを表示
  // 開発環境では開発用パスワード認証を表示
  if (!authBypass && !isAuthenticated && !isDevAuthenticated) {
    // パスワードフォームを表示
    if (showDevPasswordForm) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#000f24] p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">開発用認証</h2>
            <p className="text-white/70 text-sm mb-6 text-center">
              パスワードを入力してください。
            </p>
            <form onSubmit={handleDevPasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="devPassword" className="text-white">パスワード</Label>
                <Input
                  id="devPassword"
                  type="password"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  placeholder="開発用パスワード"
                  className="mt-1 bg-[#2a2a2a] border-white/20 text-white"
                  autoFocus
                />
                {devPasswordError && (
                  <p className="text-red-400 text-sm mt-2">{devPasswordError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#08af86] hover:bg-[#07a078] text-white"
                  disabled={!devPassword}
                >
                  認証
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDevPasswordForm(false);
                    router.push('/');
                  }}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  キャンセル
                </Button>
              </div>
            </form>
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-white/50 text-center">
                開発用パスワード: <span className="font-mono font-semibold text-[#08af86]">dev1234</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // パスワードフォームへのボタンを表示
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000f24] p-4">
        <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl p-8 max-w-md w-full text-center">
          <p className="text-red-400 mb-4 font-semibold">認証が必要です</p>
          <p className="text-white/70 text-sm mb-6">
            このページにアクセスするには、LP経由の認証リンクからアクセスする必要があります。
          </p>
          <div className="space-y-2">
            <Button 
              onClick={() => setShowDevPasswordForm(true)}
              className="w-full bg-[#08af86] hover:bg-[#07a078] text-white"
            >
              開発用パスワードで認証
            </Button>
            <Button 
              onClick={() => router.push('/')} 
              variant="outline"
              className="w-full border-white/20 text-white hover:bg-white/10"
            >
              トップページに戻る
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // 新規作成の場合は、認証済みかつLP経由（/claim経由）で来た場合のみ許可
  // 管理者の場合は開発用に許可
  // 開発用パスワード認証済みの場合も許可
  // 既存メモリの編集（memoryIdがある場合）は認証済みであれば許可
  if (!memoryId && !isAdmin && !isFromClaim && !authBypass && !isDevAuthenticated) {
    // パスワードフォームを表示
    if (showDevPasswordForm) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#000f24] p-4">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold text-white mb-4 text-center">開発用認証</h2>
            <p className="text-white/70 text-sm mb-6 text-center">
              パスワードを入力してください。
            </p>
            <form onSubmit={handleDevPasswordSubmit} className="space-y-4">
              <div>
                <Label htmlFor="devPassword" className="text-white">パスワード</Label>
                <Input
                  id="devPassword"
                  type="password"
                  value={devPassword}
                  onChange={(e) => setDevPassword(e.target.value)}
                  placeholder="開発用パスワード"
                  className="mt-1 bg-[#2a2a2a] border-white/20 text-white"
                  autoFocus
                />
                {devPasswordError && (
                  <p className="text-red-400 text-sm mt-2">{devPasswordError}</p>
                )}
              </div>
              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#08af86] hover:bg-[#07a078] text-white"
                  disabled={!devPassword}
                >
                  認証
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowDevPasswordForm(false);
                    router.push('/');
                  }}
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  キャンセル
                </Button>
              </div>
            </form>
            <div className="mt-6 pt-6 border-t border-white/10">
              <p className="text-xs text-white/50 text-center">
                開発用パスワード: <span className="font-mono font-semibold text-[#08af86]">dev1234</span>
              </p>
            </div>
          </div>
        </div>
      );
    }
    
    // パスワードフォームへのボタンを表示
    return (
      <div className="min-h-screen bg-[#000f24] text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white">新規作成はできません</h2>
              </div>
              <p className="text-white/80 mb-6">
                新しい想い出ページは、購入完了後の認証リンク（LP経由）からのみ作成できます。
                <br />
                <span className="text-white/60 text-sm">
                  直接URLからアクセスして新規作成することはできません。
                </span>
              </p>
              <div className="flex gap-4">
                <Button
                  onClick={() => setShowDevPasswordForm(true)}
                  className="bg-[#08af86] hover:bg-[#07a078] text-white"
                >
                  開発用パスワードで認証
                </Button>
                <Button
                  onClick={() => router.push('/')}
                  variant="outline"
                  className="border-white/20 text-white hover:bg-white/10"
                >
                  トップページに戻る
                </Button>
                {existingMemories.length > 0 && (
                  <Button
                    onClick={() => setShowExistingMemories(true)}
                    variant="outline"
                    className="border-white/20 text-white hover:bg-white/10"
                  >
                    既存の想い出ページを編集
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      );
  }

  // 既存の想い出ページがある場合の選択画面（エンドユーザー向け、管理者は表示しない）
  if (!isAdmin && existingMemories.length > 0 && !showExistingMemories && !memoryId) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white p-4">
        <div className="max-w-4xl mx-auto">
          <div className="bg-[#1a1a1a] rounded-2xl border border-white/10 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold text-white">既存の想い出ページ</h2>
              <button
                onClick={() => setShowExistingMemories(true)}
                className="text-white hover:text-white/80 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-white/80 mb-6">
              既に作成した想い出ページがあります。編集してください。
              <br />
              <span className="text-white/60 text-sm">
                新しい想い出ページは購入完了後の認証リンクから作成されます。
              </span>
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {existingMemories.map((memory) => (
                <div
                  key={memory.id}
                  className="bg-[#2a2a2a] rounded-xl border border-white/10 p-4 cursor-pointer transition-all"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = accentColor;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
                  }}
                  onClick={() => router.push(`/memories/${memory.id}`)}
                >
                  <div className="flex items-center space-x-2 mb-2">
                    <FileText className="w-5 h-5 text-white" />
                    <h3 className="font-semibold text-white truncate">{memory.title || '無題'}</h3>
                  </div>
                  <p className="text-white/60 text-sm mb-3">
                    {memory.status === 'published' ? (
                      <span style={{ color: accentColor }}>公開中</span>
                    ) : (
                      <span className="text-white/60">下書き</span>
                    )}
                    {' • '}
                    {formatDate(memory.updatedAt)}
                  </p>
                  <button className="w-full py-2 px-4 bg-[#1a1a1a] border border-white/20 rounded-lg text-white hover:bg-[#2a2a2a] transition text-sm">
                    <Edit className="w-4 h-4 inline mr-2" />
                    編集する
                  </button>
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
        <div className="bg-[#1a1a1a] border-b border-white/10 p-4 flex items-center justify-between">
          <p className="text-white text-sm">エディットページ</p>
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
                  coverImage,
                  coverImagePosition,
                  blocks: mediaBlocks,
                  colors: {
                    accent: accentColor,
                    text: textColor,
                    background: backgroundColor,
                    cardBackground: cardBackgroundColor,
                  },
                  fontSizes: {
                    title: titleFontSize,
                    body: bodyFontSize,
                  },
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
              公開ページを確認
            </button>
          </div>
        </div>
      )}

      {/* 設定パネル */}
      {showColorSettings && (
        <div className="bg-[#1a1a1a] border-b border-white/10 p-4">
          <div className="max-w-2xl mx-auto space-y-4">
            <h3 className="text-white font-medium mb-3">設定</h3>
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
                <label className="block text-white/80 text-sm mb-2">カード背景色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={cardBackgroundColor}
                    onChange={(e) => setCardBackgroundColor(e.target.value)}
                    className="w-12 h-10 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={cardBackgroundColor}
                    onChange={(e) => setCardBackgroundColor(e.target.value)}
                    className="flex-1 px-3 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm"
                    placeholder="#1a1a1a"
                  />
                </div>
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
      
      <div className="p-4">
      {/* 既存の想い出ページがある場合のヘッダー（エンドユーザー向け） */}
      {!isAdmin && existingMemories.length > 0 && (
        <div className="max-w-2xl mx-auto mb-4">
          <div className="bg-[#1a1a1a] rounded-lg p-4 flex items-center justify-between border border-white/10">
            <div className="flex items-center space-x-3">
              <FileText className="w-5 h-5 text-white" />
              <div>
                <p className="text-white font-medium">
                  既存の想い出ページが {existingMemories.length} 件あります
                </p>
                <p className="text-white/80 text-sm">
                  別のLPから作成したページも表示されます
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
      {!isAdmin && existingMemories.length > 0 && showExistingMemories && (
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
                  onClick={() => router.push(`/memories/${memory.id}`)}
                >
                  <div className="flex-1">
                    <p className="font-medium text-white">
                      {memory.title || '無題'}
                    </p>
                    <p className="text-sm text-white/60">
                      {memory.status === 'published' ? '公開中' : '下書き'} • {formatDate(memory.updatedAt)}
                    </p>
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
                    <Button variant="ghost" size="sm" className="text-white hover:bg-[#2a2a2a]">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      
      {/* カバー画像 */}
      <div className="max-w-2xl mx-auto mb-6">
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
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((e.clientX - rect.left) / rect.width) * 100;
                  const y = ((e.clientY - rect.top) / rect.height) * 100;
                  setCoverImagePosition(`${x}% ${y}%`);
                }}
                onMouseMove={(e) => {
                  if (isDragging) {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((e.clientX - rect.left) / rect.width) * 100;
                    const y = ((e.clientY - rect.top) / rect.height) * 100;
                    setCoverImagePosition(`${x}% ${y}%`);
                  }
                }}
                onMouseUp={() => {
                  setIsDragging(false);
                }}
                onMouseLeave={() => {
                  setIsDragging(false);
                }}
                onTouchStart={(e) => {
                  // ボタンエリアでのドラッグ開始を防ぐ
                  const target = e.target as HTMLElement;
                  if (target.closest('button')) {
                    return;
                  }
                  e.preventDefault();
                  setIsDragging(true);
                  const touch = e.touches[0];
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = ((touch.clientX - rect.left) / rect.width) * 100;
                  const y = ((touch.clientY - rect.top) / rect.height) * 100;
                  setCoverImagePosition(`${x}% ${y}%`);
                }}
                onTouchMove={(e) => {
                  if (isDragging) {
                    e.preventDefault();
                    const touch = e.touches[0];
                    const rect = e.currentTarget.getBoundingClientRect();
                    const x = ((touch.clientX - rect.left) / rect.width) * 100;
                    const y = ((touch.clientY - rect.top) / rect.height) * 100;
                    setCoverImagePosition(`${x}% ${y}%`);
                  }
                }}
                onTouchEnd={() => {
                  setIsDragging(false);
                }}
                onTouchCancel={() => {
                  setIsDragging(false);
                }}
              />
              <div className="absolute top-2 right-2 flex gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCoverImagePosition('center center');
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

      {/* ヘッダー部分：タイトルとbio */}
      <div className="max-w-2xl mx-auto pt-8 pb-6">
        <div className="flex flex-col items-center gap-4">
          {/* タイトルとbio */}
          <div className="text-center w-full">
            {editingTitle ? (
              <textarea
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="想い出タイトルを入力（改行可）"
                className="w-full font-bold text-white border-white/20 text-center placeholder:text-white/40 resize-none"
                style={{ 
                  backgroundColor: cardBackgroundColor,
                  fontSize: `${titleFontSize}px`,
                  '--ring-color': accentColor 
                } as React.CSSProperties}
                autoFocus
                rows={title.split('\n').length || 1}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                  setEditingTitle(false);
                }}
                onInput={(e) => {
                  const target = e.currentTarget;
                  target.style.height = 'auto';
                  target.style.height = `${target.scrollHeight}px`;
                }}
              />
            ) : (
              <h1 
                className="font-bold text-white cursor-pointer hover:opacity-90 mb-2 whitespace-pre-line"
                style={{ fontSize: `${titleFontSize}px` }}
                onClick={() => setEditingTitle(true)}
              >
                {title || <span className="text-white/40">想い出タイトルを入力（改行可）</span>}
              </h1>
            )}
            
            {editingBio ? (
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="プロフィール情報を入力"
                className="w-full mt-2 text-white/80 border-white/20 rounded resize-none text-center placeholder:text-white/40"
                style={{ 
                  backgroundColor: cardBackgroundColor,
                  fontSize: `${bodyFontSize}px`,
                  '--ring-color': accentColor 
                } as React.CSSProperties}
                rows={2}
                autoFocus
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.boxShadow = `0 0 0 2px ${accentColor}`;
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
                  e.currentTarget.style.boxShadow = 'none';
                  setEditingBio(false);
                }}
              />
            ) : (
              <p 
                className="mt-2 text-white/80 cursor-pointer hover:opacity-90 whitespace-pre-wrap"
                style={{ fontSize: `${bodyFontSize}px` }}
                onClick={() => setEditingBio(true)}
              >
                {bio || <span className="text-white/40">プロフィール情報を入力</span>}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* コンテンツエリア */}
      <div className="max-w-2xl mx-auto px-4">
        {/* 要素を追加 */}
        <div className="space-y-4 mb-6">
          {mediaBlocks.map((block) => (
            <div 
              key={block.id} 
              className={`rounded-2xl p-4 ${
                block.type === 'album' 
                  ? 'border-4'
                  : 'border border-white/10'
              }`}
              style={{
                backgroundColor: cardBackgroundColor,
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
                            onClick={() => {
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

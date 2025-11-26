'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Play, ArrowLeft, Share2, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface PublicPageData {
  id: string;
  tenant: string;
  memoryId: string;
  title: string;
  about?: string; // 説明文（カバー画像の上に表示）
  bio?: string; // プロフィール（カバー画像の下、Topicsの上に表示）
  design: {
    theme: string;
    layout: string;
    colors: {
      primary: string;
      secondary: string;
      background: string;
    };
  };
  colors?: {
    accent: string;
    text: string;
    background: string;
    cardBackground?: string;
  };
  media: {
    cover?: string;
    profile?: string;
  };
  coverImagePosition?: string;
  coverImageScale?: number;
  profileImagePosition?: string;
  profileImageScale?: number;
  fontSizes?: {
    title?: number;
    body?: number;
  };
  topicsTitle?: string; // Topicsセクションのタイトル
  ordering: string[];
  publish: {
    status: 'draft' | 'published';
    version: number;
    publishedAt?: Date;
  };
  access: {
    public: boolean;
    password?: string;
  };
  createdAt: Date;
  updatedAt: Date;
}

interface MediaBlock {
  id: string;
  type: 'image' | 'video' | 'audio' | 'album' | 'text';
  url?: string;
  visibility: 'public' | 'private';
  title?: string;
  description?: string;
  isTopic?: boolean; // Topicsに表示するかどうか
  albumItems?: Array<{
    id: string;
    url: string;
    description?: string;
  }>;
}

export function PublicPageClient() {
  const params = useParams();
  const searchParams = useSearchParams();
  const pageId = params.pageId as string;
  const tenantFromQuery = searchParams.get('tenant'); // クエリパラメータからテナント情報を取得
  const [pageData, setPageData] = useState<PublicPageData | null>(null);
  const [mediaBlocks, setMediaBlocks] = useState<MediaBlock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageBlock, setSelectedImageBlock] = useState<MediaBlock | null>(null);
  const [selectedAlbum, setSelectedAlbum] = useState<MediaBlock | null>(null);
  const [selectedAlbumIndex, setSelectedAlbumIndex] = useState(0);
  const [expandedTextBlocks, setExpandedTextBlocks] = useState<Set<string>>(new Set());
  const [coverImagePosition, setCoverImagePosition] = useState('center center');
  const [coverImageScale, setCoverImageScale] = useState(1);
  const [profileImagePosition, setProfileImagePosition] = useState('center center');
  const [profileImageScale, setProfileImageScale] = useState(1);
  const [colors, setColors] = useState({
    accent: '#08af86',
    text: '#ffffff',
    background: '#000f24',
    cardBackground: '#1a1a1a',
  });
  const [fontSizes, setFontSizes] = useState({
    title: 35,
    body: 16,
  });

  useEffect(() => {
    const fetchPageData = async () => {
      if (!pageId) return;
      
      // 開発環境用：プレビューモード（pageIdが'preview'の場合）
      if (pageId === 'preview') {
        // localStorageからプレビューデータを取得
        const previewDataStr = localStorage.getItem('memory-preview');
        console.log('Preview data found:', !!previewDataStr);
        if (previewDataStr) {
          try {
            const previewData = JSON.parse(previewDataStr);
            console.log('Preview data parsed successfully:', {
              hasTitle: !!previewData.title,
              hasCoverImage: !!previewData.coverImage,
              hasBlocks: !!previewData.blocks,
              blocksCount: previewData.blocks?.length || 0
            });
            // カバー画像とプロフィール画像を直接取得
            const coverImage: string | undefined = previewData.coverImage || undefined;
            const profileImage: string | undefined = previewData.profileImage || undefined;
            // カバー画像の表示位置とスケールを取得
            const coverPosition = previewData.coverImagePosition || 'center center';
            const coverScale = (previewData.coverImageScale !== undefined && previewData.coverImageScale !== null) ? previewData.coverImageScale : 1;
            setCoverImagePosition(coverPosition);
            setCoverImageScale(coverScale);
            // プロフィール画像の表示位置とスケールを取得
            const profilePosition = previewData.profileImagePosition || 'center center';
            const profileScale = (previewData.profileImageScale !== undefined && previewData.profileImageScale !== null) ? previewData.profileImageScale : 1;
            setProfileImagePosition(profilePosition);
            setProfileImageScale(profileScale);
            // 色設定を取得
            const customColors = previewData.colors || {
              accent: '#08af86',
              text: '#ffffff',
              background: '#000f24',
              cardBackground: '#1a1a1a',
            };
            setColors({
              accent: customColors.accent || '#08af86',
              text: customColors.text || '#ffffff',
              background: customColors.background || '#000f24',
              cardBackground: customColors.cardBackground || '#1a1a1a',
            });
            // 文字サイズを取得
            const customFontSizes = previewData.fontSizes || {
              title: 35,
              body: 16,
            };
            setFontSizes({
              title: customFontSizes.title || 48,
              body: customFontSizes.body || 16,
            });
            
            setPageData({
              id: 'preview',
              tenant: 'dev',
              memoryId: 'preview-memory',
              title: previewData.title || 'タイトル未設定',
              about: previewData.description || '',
              bio: previewData.bio || '',
              design: {
                theme: 'default',
                layout: 'default',
                colors: {
                  primary: customColors.accent,
                  secondary: '#1a1a1a',
                  background: customColors.background,
                },
              },
              media: {
                cover: coverImage,
                profile: profileImage,
              },
              coverImagePosition: coverPosition,
              coverImageScale: coverScale,
              profileImagePosition: profilePosition,
              profileImageScale: profileScale,
              ordering: (previewData.blocks || []).map((b: any) => b.id),
              topicsTitle: previewData.topicsTitle || 'Topics',
              publish: {
                status: 'published',
                version: 1,
                publishedAt: new Date(),
              },
              access: {
                public: true,
              },
              createdAt: new Date(),
              updatedAt: new Date(),
            });
            // メディアブロックを設定（公開設定のもののみ）
            setMediaBlocks((previewData.blocks || []).filter((b: any) => b.visibility === 'public'));
            setLoading(false);
            return;
          } catch (err) {
            console.error('Error parsing preview data:', err);
            console.error('Preview data string:', previewDataStr);
            setError(`プレビューデータの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
            setLoading(false);
            return;
          }
        }
        
        // プレビューデータがない場合はデフォルトのサンプルデータを表示
        console.log('No preview data found in localStorage');
        setPageData({
          id: 'preview',
          tenant: 'dev',
          memoryId: 'preview-memory',
          title: 'データがありません',
          about: '想い出ページを作成してから「プレビュー」ボタンをクリックしてください。',
          design: {
            theme: 'default',
            layout: 'default',
            colors: {
              primary: '#08af86',
              secondary: '#1a1a1a',
              background: '#000f24',
            },
          },
          media: {},
          ordering: [],
          publish: {
            status: 'published',
            version: 1,
            publishedAt: new Date(),
          },
          access: {
            public: true,
          },
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        setMediaBlocks([]);
        setLoading(false);
        return;
      }
      
      try {
        setLoading(true);
        const pageDoc = await getDoc(doc(db, 'publicPages', pageId));
        
        if (!pageDoc.exists()) {
          setError('ページが見つかりません');
          setLoading(false);
          return;
        }
        
        const data = pageDoc.data() as PublicPageData;
        
        // テナント検証（クエリパラメータからテナント情報が提供されている場合）
        if (tenantFromQuery && data.tenant !== tenantFromQuery) {
          setError('テナント情報が一致しません');
          setLoading(false);
          return;
        }
        
        // カバー画像の表示位置とスケールを取得
        if (data.coverImagePosition) {
          setCoverImagePosition(data.coverImagePosition);
        }
        if (data.coverImageScale !== undefined) {
          setCoverImageScale(data.coverImageScale);
        }
        // プロフィール画像の表示位置とスケールを取得
        if (data.profileImagePosition) {
          setProfileImagePosition(data.profileImagePosition);
        }
        if (data.profileImageScale !== undefined) {
          setProfileImageScale(data.profileImageScale);
        }
        
        // 色設定を取得（publicPagesに含まれている場合、またはdesign.colorsから）
        if (data.colors) {
          setColors({
            accent: data.colors.accent || '#08af86',
            text: data.colors.text || '#ffffff',
            background: data.colors.background || '#000f24',
            cardBackground: data.colors.cardBackground || '#1a1a1a',
          });
        } else if (data.design?.colors) {
          // design.colorsから色設定を読み込む（後方互換性のため）
          setColors({
            accent: data.design.colors.primary || '#08af86',
            text: '#ffffff',
            background: data.design.colors.background || '#000f24',
            cardBackground: '#1a1a1a',
          });
        }
        // 文字サイズを取得
        if (data.fontSizes) {
          setFontSizes({
            title: data.fontSizes.title || 48,
            body: data.fontSizes.body || 16,
          });
        }
        
        setPageData({
          ...data,
          id: pageDoc.id,
        });
      } catch (err: any) {
        console.error('Error fetching page:', err);
        setError('ページの読み込みに失敗しました');
      } finally {
        setLoading(false);
      }
    };

    fetchPageData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pageId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: colors.accent }} />
      </div>
    );
  }

  // メモリアルページの例（オプション）
  const isMemorial = pageId === 'preview-memorial'; // プレビュー用メモリアルページ
  const name = pageData?.title || '';
  const birthYear = '1950';
  const passingYear = '2020';
  const memorialMessage = 'Forever in our hearts, a life full of adventure and love.';

  if (error || !pageData) {
    console.log('Error or no pageData:', { error, pageData: !!pageData, loading });
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{error || 'ページが見つかりません'}</h1>
          <p className="text-white/60">このページは一時的に利用できません。</p>
          {error && <p className="text-red-400 mt-4 text-sm">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white m-0 p-0" style={{ backgroundColor: colors.background }}>
      {/* メモリアルヘッダー（オプション） */}
      {isMemorial && (
        <div className="rounded-2xl p-6 mb-4 mx-4 mt-4 border border-white/10" style={{ backgroundColor: colors.cardBackground }}>
          <p className="text-center mb-2" style={{ color: colors.text, opacity: 0.8 }}>In Loving Memory of</p>
          <h1 className="text-center text-3xl font-bold mb-2" style={{ color: colors.accent }}>{name}</h1>
          <p className="text-center" style={{ color: colors.text, opacity: 0.6 }}>{birthYear} - {passingYear}</p>
          <p className="text-center mt-2" style={{ color: colors.text, opacity: 0.8 }}>{memorialMessage}</p>
        </div>
      )}

      {/* メイン画像（固定） */}
      {pageData.media.cover && (
        <div className="fixed top-0 left-0 w-full z-10" style={{ height: '100dvh' }}>
          <img 
            src={pageData.media.cover} 
            alt={pageData.title} 
            className="w-full h-full object-cover cursor-pointer block m-0 p-0"
            style={{ 
              display: 'block', 
              margin: 0, 
              padding: 0, 
              verticalAlign: 'bottom',
              lineHeight: 0,
              fontSize: 0,
              objectPosition: coverImagePosition,
              transform: `scale(${coverImageScale || 1})`,
              height: '100%'
            }}
            onClick={() => {
              setSelectedImage(pageData.media.cover || null);
              setSelectedImageBlock(null);
            }}
          />
          {/* グラデーションオーバーレイ（下から45%の位置から開始） */}
          <div 
            className="absolute bottom-0 left-0 right-0"
            style={{
              height: '55%',
              background: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                ? 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 10%, rgba(0, 0, 0, 0.6) 25%, rgba(0, 0, 0, 0.3) 40%, transparent 55%)'
                : 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 10%, rgba(255, 255, 255, 0.6) 25%, rgba(255, 255, 255, 0.3) 40%, transparent 55%)',
              pointerEvents: 'none'
            }}
          />
          {/* タイトルとプロフィール情報を表示 */}
          <div 
            className="absolute bottom-[20%] left-0 right-0 pl-6 pr-4 pb-6 sm:pl-8 sm:pr-6 sm:pb-8"
          >
            <h2 
              className="font-bold mb-3 whitespace-pre-line" 
              style={{ 
                color: colors.text, 
                fontSize: `${fontSizes.title * 0.85}px`,
                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                  ? '0 2px 8px rgba(0, 0, 0, 0.5)'
                  : '0 2px 8px rgba(255, 255, 255, 0.5)'
              }}
            >
              {pageData.title}
            </h2>
            {pageData.about && (
              <p 
                className="whitespace-pre-wrap" 
                style={{ 
                  color: colors.text, 
                  opacity: 0.95, 
                  fontSize: `${fontSizes.body * 0.875}px`,
                  textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                    ? '0 1px 4px rgba(0, 0, 0, 0.5)'
                    : '0 1px 4px rgba(255, 255, 255, 0.5)'
                }}
              >
                {pageData.about}
              </p>
            )}
          </div>
        </div>
      )}

      {/* コンテンツエリア（カバー画像の下にスクロール可能なコンテンツ） */}
      <div className="relative z-20 rounded-t-2xl" style={{ marginTop: '100dvh', backgroundColor: colors.background, minHeight: '100vh' }}>
        {/* Bioセクション（カバー画像の下、Topicsの上） */}
        {(pageData.title || pageData.about || pageData.bio || pageData.media.profile) && (
          <div className="w-full pt-16 pb-6">
            <div className="max-w-2xl mx-auto px-6 sm:px-8 md:px-10">
              <div className="flex flex-row gap-6 sm:gap-8 items-start">
                {/* プロフィール写真 */}
                {pageData.media.profile && (
                  <div className="flex-shrink-0">
                    <img
                      src={pageData.media.profile}
                      alt="プロフィール"
                      className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full object-cover"
                      style={{ 
                        objectPosition: profileImagePosition,
                        transform: `scale(${profileImageScale || 1})`
                      }}
                    />
                  </div>
                )}
                {/* タイトルと説明文 */}
                <div className="flex-1 min-w-0">
                  {pageData.title && (
                    <h2 
                      className="font-bold mb-2 whitespace-pre-line text-left break-words"
                      style={{ 
                        color: colors.text, 
                        fontSize: `clamp(${fontSizes.body * 0.875}px, ${fontSizes.body}px, ${fontSizes.body * 1.125}px)`,
                        lineHeight: '1.4'
                      }}
                    >
                      {pageData.title}
                    </h2>
                  )}
                  {pageData.about && (
                    <p 
                      className="whitespace-pre-wrap text-left break-words" 
                      style={{ 
                        color: colors.text, 
                        opacity: 0.9,
                        fontSize: `clamp(${fontSizes.body * 0.75}px, ${fontSizes.body * 0.875}px, ${fontSizes.body}px)`,
                        lineHeight: '1.5'
                      }}
                    >
                      {pageData.about}
                    </p>
                  )}
                </div>
              </div>
              {/* プロフィール文（プロフィール写真の下） */}
              {pageData.bio && (
                <div className="mt-6">
                  <p 
                    className="whitespace-pre-wrap text-left break-words" 
                    style={{ 
                      color: colors.text, 
                      fontSize: `clamp(${fontSizes.body * 0.75}px, ${fontSizes.body * 0.875}px, ${fontSizes.body}px)`,
                      lineHeight: '1.6'
                    }}
                  >
                    {pageData.bio}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Topicsセクション（カバー画像の下、横スクロール） */}
      {mediaBlocks.filter(block => block.isTopic && block.visibility === 'public').length > 0 && (
        <div className="w-full py-6" style={{ backgroundColor: colors.background }}>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8">
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.text }}>
              {pageData.topicsTitle || 'Topics'}
            </h3>
            <div className="overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 md:-mx-8" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-4 px-4 sm:px-6 md:px-8 pb-4" style={{ width: 'max-content' }}>
              {/* すべてのアイテムを横スクロールで表示 */}
              {mediaBlocks
                .filter(block => block.isTopic && block.visibility === 'public')
                .map((block, index) => {
                  // 横スクロールで表示するため、すべて同じサイズに統一
                  const itemSize = 200; // すべて200pxに統一
                  
                  // 画像ブロックの場合
                  if (block.type === 'image' && block.url) {
                    return (
                      <div
                        key={block.id}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                        onClick={() => {
                          setSelectedImage(block.url || null);
                          setSelectedImageBlock(block);
                        }}
                      >
                        <img
                          src={block.url}
                          alt={block.title || 'Topic'}
                          className="w-full h-full object-cover"
                        />
                        {/* グラデーションオーバーレイ（左下部） */}
                        {(block.title || block.description) && (
                          <div 
                            className="absolute bottom-0 left-0 right-0"
                            style={{
                              height: '40%',
                              background: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                ? 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 10%, rgba(0, 0, 0, 0.6) 25%, rgba(0, 0, 0, 0.3) 35%, transparent 40%)'
                                : 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 10%, rgba(255, 255, 255, 0.6) 25%, rgba(255, 255, 255, 0.3) 35%, transparent 40%)',
                              pointerEvents: 'none'
                            }}
                          />
                        )}
                        {/* タイトルと説明文（左下） */}
                        {(block.title || block.description) && (
                          <div className="absolute bottom-0 left-0 right-0 p-2">
                            <p
                              className="text-xs font-medium truncate"
                              style={{
                                color: colors.text,
                                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                  ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                  : '0 1px 2px rgba(255, 255, 255, 0.5)'
                              }}
                            >
                              {block.title || block.description || ''}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                  // 動画ブロックの場合
                  if (block.type === 'video' && block.url) {
                    return (
                      <div
                        key={block.id}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                        onClick={() => {
                          setSelectedImage(block.url || null);
                          setSelectedImageBlock(block);
                        }}
                      >
                        <video
                          src={block.url}
                          className="w-full h-full object-cover"
                          muted
                          playsInline
                        />
                        {/* 再生アイコンオーバーレイ */}
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                          <Play className="w-8 h-8 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))' }} />
                        </div>
                        {/* タイトルと説明のオーバーレイ（1行のみ、上部） */}
                        {(block.title || block.description) && (
                          <div
                            className="absolute top-0 left-0 right-0 p-2"
                            style={{
                              background: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, transparent 100%)'
                                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, transparent 100%)',
                            }}
                          >
                            <p
                              className="text-xs font-medium truncate"
                              style={{
                                color: colors.text,
                                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                  ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                  : '0 1px 2px rgba(255, 255, 255, 0.5)'
                              }}
                            >
                              {block.title || block.description || ''}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                  // テキストブロックの場合
                  if (block.type === 'text') {
                    return (
                      <div
                        key={block.id}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative flex flex-col justify-center items-center p-3"
                        style={{ 
                          width: `${itemSize}px`, 
                          height: `${itemSize}px`,
                          backgroundColor: colors.cardBackground 
                        }}
                        onClick={() => {
                          // テキストブロックをクリックした場合の処理（必要に応じて実装）
                        }}
                      >
                        <FileText className="w-8 h-8 mb-2" style={{ color: colors.accent }} />
                        {block.title && (
                          <p
                            className="text-xs font-medium text-center line-clamp-2"
                            style={{ color: colors.text }}
                          >
                            {block.title}
                          </p>
                        )}
                        {!block.title && block.description && (
                          <p
                            className="text-xs text-center line-clamp-3"
                            style={{ color: colors.text, opacity: 0.8 }}
                          >
                            {block.description}
                          </p>
                        )}
                      </div>
                    );
                  }
                  // アルバムブロックの場合（最初の画像を使用）
                  if (block.type === 'album' && block.albumItems && block.albumItems.length > 0) {
                    return (
                      <div
                        key={block.id}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                        onClick={() => {
                          setSelectedAlbum(block);
                          setSelectedAlbumIndex(0);
                        }}
                      >
                        <img
                          src={block.albumItems[0].url}
                          alt={block.title || 'Topic'}
                          className="w-full h-full object-cover"
                        />
                        {/* タイトルと説明のオーバーレイ（1行のみ、上部） */}
                        {(block.title || block.description) && (
                          <div
                            className="absolute top-0 left-0 right-0 p-2"
                            style={{
                              background: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                ? 'linear-gradient(to bottom, rgba(0, 0, 0, 0.8) 0%, transparent 100%)'
                                : 'linear-gradient(to bottom, rgba(255, 255, 255, 0.8) 0%, transparent 100%)',
                            }}
                          >
                            <p
                              className="text-xs font-medium truncate"
                              style={{
                                color: colors.text,
                                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                  ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                  : '0 1px 2px rgba(255, 255, 255, 0.5)'
                              }}
                            >
                              {block.title || block.description || ''}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          </div>
        </div>
      )}

        {/* コンテンツエリア */}
        <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8 pb-8 pt-6">

        {/* メディアブロックを表示（Topics以外） */}
        {mediaBlocks.filter(block => !block.isTopic).map((block) => {
          if (block.type === 'image' && block.url) {
            return (
              <div key={block.id} className="relative rounded-2xl overflow-hidden mb-16 cursor-pointer hover:opacity-90 transition" onClick={() => {
                setSelectedImage(block.url || null);
                setSelectedImageBlock(block);
              }}>
                <img 
                  src={block.url} 
                  alt={block.title || pageData.title} 
                  className="w-full h-auto object-cover"
                />
                {/* グラデーションオーバーレイ（左下部） */}
                {(block.title || block.description) && (
                  <div 
                    className="absolute bottom-0 left-0 right-0"
                    style={{
                      height: '40%',
                      background: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                        ? 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 10%, rgba(0, 0, 0, 0.6) 25%, rgba(0, 0, 0, 0.3) 35%, transparent 40%)'
                        : 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 10%, rgba(255, 255, 255, 0.6) 25%, rgba(255, 255, 255, 0.3) 35%, transparent 40%)',
                      pointerEvents: 'none'
                    }}
                  />
                )}
                {/* タイトルと説明文 */}
                {(block.title || block.description) && (
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    {block.title && (
                      <h3
                        className="font-bold mb-1 whitespace-pre-line"
                        style={{
                          color: colors.text,
                          fontSize: `${fontSizes.body * 1.0}px`,
                          textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                            ? '0 2px 8px rgba(0, 0, 0, 0.5)'
                            : '0 2px 8px rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        {block.title}
                      </h3>
                    )}
                    {block.description && (
                      <p
                        className="whitespace-pre-wrap"
                        style={{
                          color: colors.text,
                          opacity: 0.95,
                          fontSize: `${fontSizes.body * 0.8}px`,
                          textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                            ? '0 1px 4px rgba(0, 0, 0, 0.5)'
                            : '0 1px 4px rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        {block.description}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          } else if (block.type === 'video' && block.url) {
            const textShadowColor = colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
              ? '0 2px 8px rgba(0, 0, 0, 0.5)'
              : '0 2px 8px rgba(255, 255, 255, 0.5)';
            const gradientBackground = colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
              ? 'linear-gradient(to top, rgba(0, 0, 0, 0.95) 0%, rgba(0, 0, 0, 0.85) 10%, rgba(0, 0, 0, 0.6) 25%, rgba(0, 0, 0, 0.3) 35%, transparent 40%)'
              : 'linear-gradient(to top, rgba(255, 255, 255, 0.95) 0%, rgba(255, 255, 255, 0.85) 10%, rgba(255, 255, 255, 0.6) 25%, rgba(255, 255, 255, 0.3) 35%, transparent 40%)';
            
            return (
              <div key={block.id} className="relative rounded-2xl overflow-hidden mb-16 cursor-pointer hover:opacity-90 transition" onClick={() => {
                setSelectedImage(block.url || null);
                setSelectedImageBlock(block);
              }}>
                <div className="relative aspect-video">
                  <video 
                    src={block.url} 
                    className="w-full h-full object-cover"
                    muted
                    playsInline
                  />
                  {/* 再生ボタンオーバーレイ */}
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                    <Play className="w-12 h-12 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))' }} />
                  </div>
                  {/* グラデーションオーバーレイ（左下部） */}
                  {(block.title || block.description) && (
                    <div 
                      className="absolute bottom-0 left-0 right-0"
                      style={{
                        height: '40%',
                        background: gradientBackground,
                        pointerEvents: 'none'
                      }}
                    />
                  )}
                  {/* タイトルと説明文（左下） */}
                  {(block.title || block.description) && (
                    <div className="absolute bottom-0 left-0 right-0 p-4">
                      {block.title && (
                        <h3
                          className="font-bold mb-1 whitespace-pre-line"
                          style={{
                            color: colors.text,
                            fontSize: `${fontSizes.body * 1.0}px`,
                            textShadow: textShadowColor
                          }}
                        >
                          {block.title}
                        </h3>
                      )}
                      {block.description && (
                        <p
                          className="whitespace-pre-wrap"
                          style={{
                            color: colors.text,
                            opacity: 0.8,
                            fontSize: `${fontSizes.body * 0.8}px`,
                            textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                              ? '0 1px 4px rgba(0, 0, 0, 0.5)'
                              : '0 1px 4px rgba(255, 255, 255, 0.5)'
                          }}
                        >
                          {block.description}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          } else if (block.type === 'audio' && block.url) {
            return (
              <div key={block.id} className="rounded-2xl p-4 sm:p-6 mb-4" style={{ backgroundColor: colors.cardBackground }}>
                {block.title && (
                  <h3 className="font-bold mb-2" style={{ color: colors.text, fontSize: `${fontSizes.body * 1.125}px` }}>{block.title}</h3>
                )}
                <audio src={block.url} controls className="w-full mb-2" />
                {block.description && (
                  <p className="whitespace-pre-wrap" style={{ color: colors.text, opacity: 0.8, fontSize: `${fontSizes.body}px` }}>{block.description}</p>
                )}
              </div>
            );
          } else if (block.type === 'text') {
            const isExpanded = expandedTextBlocks.has(block.id);
            const textContent = block.description || '';
            // 2行以上あるかどうかを判定（改行や長文の場合）
            const lines = textContent.split('\n');
            const hasMoreThanTwoLines = lines.length > 2 || textContent.length > 100;
            const shouldTruncate = hasMoreThanTwoLines && !isExpanded;
            
            return (
              <div key={block.id} className="rounded-2xl p-4 sm:p-6 mb-4" style={{ backgroundColor: colors.cardBackground }}>
                {block.title && (
                  <h3 className="font-bold mb-4" style={{ color: colors.text, fontSize: `${fontSizes.body * 1.125}px` }}>{block.title}</h3>
                )}
                <div className="relative">
                  <p 
                    className={`whitespace-pre-wrap ${shouldTruncate ? 'line-clamp-2' : ''}`}
                    style={{ color: colors.text, opacity: 0.8, fontSize: `${fontSizes.body}px` }}
                  >
                    {textContent}
                  </p>
                  {hasMoreThanTwoLines && (
                    <button
                      onClick={() => {
                        const newExpanded = new Set(expandedTextBlocks);
                        if (isExpanded) {
                          newExpanded.delete(block.id);
                        } else {
                          newExpanded.add(block.id);
                        }
                        setExpandedTextBlocks(newExpanded);
                      }}
                      className="mt-4 transition text-sm font-medium"
                      style={{ 
                        color: colors.accent,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.8';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      {isExpanded ? '閉じる' : 'もっと見る'}
                    </button>
                  )}
                </div>
              </div>
            );
          } else if (block.type === 'album' && block.albumItems && block.albumItems.length > 0) {
            const displayItems = block.albumItems.slice(0, 4);
            const hasMore = block.albumItems.length > 4;
            const remainingCount = block.albumItems.length - 4;
            
            return (
              <div key={block.id} className="mb-16">
                {block.title && (
                  <h3 className="font-bold mb-2" style={{ color: colors.text, fontSize: `${fontSizes.body * 1.125}px` }}>{block.title}</h3>
                )}
                {block.description && (
                  <p className="whitespace-pre-wrap mb-4" style={{ color: colors.text, opacity: 0.8 }}>{block.description}</p>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {displayItems.map((item, index) => {
                    // 4枚目で、さらに写真がある場合はオーバーレイ表示
                    const isLastWithMore = index === 3 && hasMore;
                    return (
                      <div 
                        key={item.id} 
                        className="aspect-square rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        onClick={() => {
                          setSelectedAlbum(block);
                          setSelectedAlbumIndex(index);
                        }}
                      >
                        <img 
                          src={item.url}
                          alt={item.description || block.title || 'Photo'}
                          className="w-full h-full object-cover"
                        />
                        {isLastWithMore && (
                          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                            <div className="text-center">
                              <div className="text-2xl font-bold mb-1" style={{ color: colors.text }}>+{remainingCount}</div>
                              <div className="text-sm" style={{ color: colors.text, opacity: 0.9 }}>もっと見る</div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}
        </div>
      </div>

      {/* 画像拡大表示モーダル */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex flex-col items-center justify-center p-4"
          onClick={() => {
            setSelectedImage(null);
            setSelectedImageBlock(null);
          }}
        >
          <button
            onClick={() => {
              setSelectedImage(null);
              setSelectedImageBlock(null);
            }}
            className="absolute top-4 right-4 text-white hover:text-white/80 transition"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={selectedImage} 
            alt={selectedImageBlock?.title || '拡大表示'}
            className="max-w-full max-h-[calc(100vh-120px)] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
          {/* タイトルと説明 */}
          {(selectedImageBlock?.title || selectedImageBlock?.description) && (
            <div 
              className="mt-4 max-w-2xl w-full px-4"
              onClick={(e) => e.stopPropagation()}
            >
              {selectedImageBlock.title && (
                <h3 className="text-white text-lg font-bold mb-2">
                  {selectedImageBlock.title}
                </h3>
              )}
              {selectedImageBlock.description && (
                <p className="text-white/80 whitespace-pre-wrap">
                  {selectedImageBlock.description}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* アルバムスクロール表示モーダル（縦スクロール） */}
      {selectedAlbum && selectedAlbum.albumItems && (
        <div 
          className="fixed inset-0 bg-black z-50 flex flex-col"
          onClick={() => {
            setSelectedAlbum(null);
            setSelectedAlbumIndex(0);
          }}
        >
          {/* ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <div className="text-white font-medium">
              {selectedAlbum.title || 'アルバム'}
            </div>
            <button
              onClick={() => {
                setSelectedAlbum(null);
                setSelectedAlbumIndex(0);
              }}
              className="text-white hover:text-white/80 transition"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* 縦スクロール可能なコンテンツエリア */}
          <div 
            className="flex-1 overflow-y-auto px-4 py-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="max-w-2xl mx-auto space-y-8">
              {selectedAlbum.albumItems.map((item) => (
                <div key={item.id} className="flex flex-col">
                  <img 
                    src={item.url}
                    alt={item.description || 'Photo'}
                    className="w-full max-w-full object-contain mb-4"
                  />
                  {/* 説明文 */}
                  {item.description && (
                    <p className="whitespace-pre-wrap text-left" style={{ color: colors.text, opacity: 0.8 }}>
                      {item.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


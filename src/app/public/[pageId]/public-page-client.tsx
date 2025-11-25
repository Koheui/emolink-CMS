'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Play, ArrowLeft, Share2, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface PublicPageData {
  id: string;
  tenant: string;
  memoryId: string;
  title: string;
  about?: string;
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
  fontSizes?: {
    title?: number;
    body?: number;
  };
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
  const [selectedAlbum, setSelectedAlbum] = useState<MediaBlock | null>(null);
  const [selectedAlbumIndex, setSelectedAlbumIndex] = useState(0);
  const [expandedTextBlocks, setExpandedTextBlocks] = useState<Set<string>>(new Set());
  const [coverImagePosition, setCoverImagePosition] = useState('center center');
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
        if (previewDataStr) {
          try {
            const previewData = JSON.parse(previewDataStr);
            // カバー画像とプロフィール画像を直接取得
            const coverImage: string | undefined = previewData.coverImage || undefined;
            const profileImage: string | undefined = previewData.profileImage || undefined;
            // カバー画像の表示位置を取得
            const position = previewData.coverImagePosition || 'center center';
            setCoverImagePosition(position);
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
              about: previewData.description || previewData.bio || '',
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
              ordering: (previewData.blocks || []).map((b: any) => b.id),
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
          }
        }
        
        // プレビューデータがない場合はデフォルトのサンプルデータを表示
        setPageData({
          id: 'preview',
          tenant: 'dev',
          memoryId: 'preview-memory',
          title: 'データがありません',
          about: '想い出ページを作成してから「公開ページを確認」ボタンをクリックしてください。',
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
        
        // カバー画像の表示位置を取得
        if (data.coverImagePosition) {
          setCoverImagePosition(data.coverImagePosition);
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
  }, [pageId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: colors.accent }} />
      </div>
    );
  }

  if (error || !pageData) {
    return (
      <div className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">{error || 'ページが見つかりません'}</h1>
          <p className="text-white/60">このページは一時的に利用できません。</p>
        </div>
      </div>
    );
  }

  // メモリアルページの例（オプション）
  const isMemorial = pageId === 'preview-memorial'; // プレビュー用メモリアルページ
  const name = pageData.title;
  const birthYear = '1950';
  const passingYear = '2020';
  const memorialMessage = 'Forever in our hearts, a life full of adventure and love.';

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

      {/* メイン画像 */}
      {pageData.media.cover && (
        <div className="relative w-full" style={{ height: '100dvh' }}>
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
              height: '100%'
            }}
            onClick={() => setSelectedImage(pageData.media.cover || null)}
          />
          {/* タイトルとプロフィール情報を左下に重ねて表示 */}
          <div className="absolute bottom-[20%] left-0 right-0 pl-6 pr-4 pb-4 sm:pl-8 sm:pr-6 sm:pb-6">
            <h2 className="font-bold mb-3 drop-shadow-lg whitespace-pre-line" style={{ color: colors.text, fontSize: `${fontSizes.title}px` }}>{pageData.title}</h2>
            {pageData.about && (
              <p className="whitespace-pre-wrap drop-shadow-lg" style={{ color: colors.text, opacity: 0.95, fontSize: `${fontSizes.body}px` }}>{pageData.about}</p>
            )}
          </div>
        </div>
      )}

      {/* コンテンツエリア */}
      <div className="max-w-2xl mx-auto px-0 sm:px-4 pb-8 pt-4">

        {/* メディアブロックを表示 */}
        {mediaBlocks.map((block) => {
          if (block.type === 'image' && block.url) {
            return (
              <div key={block.id} className="rounded-2xl p-4 sm:p-6 mb-4" style={{ backgroundColor: colors.cardBackground }}>
                {block.title && (
                  <h3 className="font-bold mb-2" style={{ color: colors.text, fontSize: `${fontSizes.body * 1.125}px` }}>{block.title}</h3>
                )}
                <img 
                  src={block.url} 
                  alt={block.title || pageData.title} 
                  className="w-full rounded-lg mb-2 cursor-pointer hover:opacity-90 transition"
                  onClick={() => setSelectedImage(block.url || null)}
                />
                {block.description && (
                  <p className="whitespace-pre-wrap" style={{ color: colors.text, opacity: 0.8, fontSize: `${fontSizes.body}px` }}>{block.description}</p>
                )}
              </div>
            );
          } else if (block.type === 'video' && block.url) {
            return (
              <div key={block.id} className="rounded-2xl overflow-hidden mb-4" style={{ backgroundColor: colors.cardBackground }}>
                {block.title && (
                  <div className="p-4 border-b border-white/10">
                    <h3 className="text-lg font-bold" style={{ color: colors.text }}>{block.title}</h3>
                  </div>
                )}
                <div className="relative aspect-video">
                  <video 
                    src={block.url} 
                    controls
                    className="w-full h-full object-cover"
                  />
                </div>
                {block.description && (
                  <div className="p-4">
                    <p className="whitespace-pre-wrap" style={{ color: colors.text, opacity: 0.8, fontSize: `${fontSizes.body}px` }}>{block.description}</p>
                  </div>
                )}
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
              <div key={block.id} className="rounded-2xl p-4 sm:p-6 mb-4" style={{ backgroundColor: colors.cardBackground }}>
                {block.title && (
                  <h3 className="font-bold mb-4" style={{ color: colors.text, fontSize: `${fontSizes.body * 1.125}px` }}>{block.title}</h3>
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
                {block.description && (
                  <p className="whitespace-pre-wrap mt-4" style={{ color: colors.text, opacity: 0.8 }}>{block.description}</p>
                )}
              </div>
            );
          }
          return null;
        })}
      </div>

      {/* 画像拡大表示モーダル */}
      {selectedImage && (
        <div 
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <button
            onClick={() => setSelectedImage(null)}
            className="absolute top-4 right-4 text-white hover:text-white/80 transition"
          >
            <X className="w-8 h-8" />
          </button>
          <img 
            src={selectedImage} 
            alt="拡大表示"
            className="max-w-full max-h-full object-contain"
            onClick={(e) => e.stopPropagation()}
          />
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


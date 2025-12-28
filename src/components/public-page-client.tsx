'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Play, ArrowLeft, Share2, X, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { linkifyText } from '@/lib/text-utils';

// ヘックスカラーをRGBに変換する関数
const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
};

// グラデーションを生成する関数（カバー画像用）
const generateCoverGradient = (color: string) => {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return 'linear-gradient(to top, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.6) 10%, rgba(0, 0, 0, 0.5) 20%, rgba(0, 0, 0, 0.4) 30%, rgba(0, 0, 0, 0.3) 40%, rgba(0, 0, 0, 0.2) 50%, rgba(0, 0, 0, 0.1) 60%, rgba(0, 0, 0, 0.05) 70%, transparent 80%)';
  }
  return `linear-gradient(to top, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.7) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.6) 10%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.5) 20%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 30%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.3) 40%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2) 50%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1) 60%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.05) 70%, transparent 80%)`;
};

// グラデーションを生成する関数（サムネイル用）
const generateThumbnailGradient = (color: string) => {
  const rgb = hexToRgb(color);
  if (!rgb) {
    return 'linear-gradient(to top, rgba(0, 0, 0, 0.65) 0%, rgba(0, 0, 0, 0.55) 10%, rgba(0, 0, 0, 0.4) 25%, rgba(0, 0, 0, 0.2) 40%, transparent 50%)';
  }
  return `linear-gradient(to top, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.65) 0%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.55) 10%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.4) 25%, rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2) 40%, transparent 50%)`;
};

// 動画のサムネイルを生成する関数（img要素を重ねて表示）
const generateVideoThumbnail = (video: HTMLVideoElement) => {
  try {
    // 既にサムネイル画像が存在する場合はスキップ
    if (video.parentElement?.querySelector('img[data-video-thumbnail]')) {
      console.log('Thumbnail already exists, skipping');
      return;
    }

    console.log('Generating video thumbnail:', {
      videoWidth: video.videoWidth,
      videoHeight: video.videoHeight,
      readyState: video.readyState,
      src: video.src?.substring(0, 50),
    });

    // サムネイル生成を試みる関数
    const tryCaptureFrame = () => {
      try {
        if (video.videoWidth > 0 && video.videoHeight > 0) {
          console.log('Attempting to capture frame:', {
            width: video.videoWidth,
            height: video.videoHeight,
            currentTime: video.currentTime,
            readyState: video.readyState,
          });
          
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            console.error('Canvas context not available');
            return false;
          }
          
          // 動画フレームをキャンバスに描画
          try {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          } catch (drawError) {
            console.error('Error drawing video to canvas:', drawError);
            return false;
          }
          
          const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          console.log('Frame captured successfully, thumbnail size:', thumbnailUrl.length);
          
          // 親要素にサムネイル画像を追加
          if (video.parentElement) {
            const parentElement = video.parentElement as HTMLElement;
            
            // 親要素のスタイルを確認（position: relativeが必要）
            const parentStyles = window.getComputedStyle(parentElement);
            if (parentStyles.position === 'static') {
              parentElement.style.position = 'relative';
            }
            // 親要素の背景色を透明に設定（重要）
            parentElement.style.setProperty('background-color', 'transparent', 'important');
            parentElement.style.setProperty('background', 'transparent', 'important');
            parentElement.style.setProperty('background-image', 'none', 'important');
            
            // MutationObserverを使って、親要素の背景色が変更されないように監視
            const observer = new MutationObserver(() => {
              const currentBg = window.getComputedStyle(parentElement).backgroundColor;
              // 背景色が透明でない場合は強制的に透明にする
              if (currentBg && currentBg !== 'rgba(0, 0, 0, 0)' && currentBg !== 'transparent') {
                const rgbMatch = currentBg.match(/\d+/g);
                if (rgbMatch && rgbMatch.length >= 3) {
                  const r = parseInt(rgbMatch[0]);
                  const g = parseInt(rgbMatch[1]);
                  const b = parseInt(rgbMatch[2]);
                  // 暗い色（合計が100未満）の場合は透明にする
                  if (r + g + b < 100) {
                    parentElement.style.setProperty('background-color', 'transparent', 'important');
                    parentElement.style.setProperty('background', 'transparent', 'important');
                    parentElement.style.setProperty('background-image', 'none', 'important');
                  }
                } else {
                  // RGB値が取得できない場合も透明にする
                  parentElement.style.setProperty('background-color', 'transparent', 'important');
                  parentElement.style.setProperty('background', 'transparent', 'important');
                  parentElement.style.setProperty('background-image', 'none', 'important');
                }
              }
            });
            observer.observe(parentElement, {
              attributes: true,
              attributeFilter: ['style', 'class'],
              childList: true,
              subtree: true,
            });
            
            // 定期的に背景色をチェック（念のため）
            const checkInterval = setInterval(() => {
              const currentBg = window.getComputedStyle(parentElement).backgroundColor;
              // 背景色が透明でない場合は強制的に透明にする
              if (currentBg && currentBg !== 'rgba(0, 0, 0, 0)' && currentBg !== 'transparent') {
                parentElement.style.setProperty('background-color', 'transparent', 'important');
                parentElement.style.setProperty('background', 'transparent', 'important');
                parentElement.style.setProperty('background-image', 'none', 'important');
              }
            }, 100);
            
            // サムネイル画像を作成
            const img = document.createElement('img');
            img.setAttribute('data-video-thumbnail', 'true');
            img.className = 'w-full h-full object-cover';
            img.style.objectPosition = 'center center';
            img.style.display = 'block';
            img.style.position = 'absolute';
            img.style.top = '0';
            img.style.left = '0';
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.zIndex = '1'; // グラデーション（z-index: 2）の下、動画（z-index: 0）の上に表示
            img.style.backgroundColor = 'transparent';
            img.style.opacity = '1';
            img.style.visibility = 'visible';
            img.style.pointerEvents = 'none'; // クリックイベントは親要素に通す
            img.style.setProperty('background-color', 'transparent', 'important');
            img.style.setProperty('background-image', 'none', 'important');
            img.style.setProperty('background', 'transparent', 'important');
            
            // 画像の読み込み完了後の処理
            img.onload = () => {
              console.log('Thumbnail image loaded successfully');
              console.log('Thumbnail image details:', {
                naturalWidth: img.naturalWidth,
                naturalHeight: img.naturalHeight,
                complete: img.complete,
                srcLength: img.src.length,
                srcStart: img.src.substring(0, 50),
              });
              
              // 動画要素を非表示にする（画像が読み込まれた後）
              video.style.setProperty('display', 'none', 'important');
              
              // 親要素のスタイルを再度確認（強制的に透明にする）
              parentElement.style.setProperty('background-color', 'transparent', 'important');
              parentElement.style.setProperty('background', 'transparent', 'important');
              parentElement.style.setProperty('background-image', 'none', 'important');
              
              // サムネイル画像のスタイルを再度確認（強制的に表示）
              img.style.setProperty('display', 'block', 'important');
              img.style.setProperty('visibility', 'visible', 'important');
              img.style.setProperty('opacity', '1', 'important');
              img.style.setProperty('width', '100%', 'important');
              img.style.setProperty('height', '100%', 'important');
              img.style.setProperty('position', 'absolute', 'important');
              img.style.setProperty('top', '0', 'important');
              img.style.setProperty('left', '0', 'important');
              img.style.setProperty('z-index', '1', 'important'); // グラデーションの下、動画の上に表示
              img.style.setProperty('background-color', 'transparent', 'important');
              img.style.setProperty('background', 'transparent', 'important');
              img.style.setProperty('background-image', 'none', 'important');
              
              // サムネイル画像が実際に表示されているか確認
              setTimeout(() => {
                const rect = img.getBoundingClientRect();
                const styles = window.getComputedStyle(img);
                const parentStyles = window.getComputedStyle(parentElement);
                const siblings = Array.from(parentElement.children).map((child, index) => {
                  const childStyles = window.getComputedStyle(child);
                  const childRect = child.getBoundingClientRect();
                  return {
                    index,
                    tag: child.tagName,
                    display: childStyles.display,
                    zIndex: childStyles.zIndex,
                    position: childStyles.position,
                    top: childStyles.top,
                    left: childStyles.left,
                    width: childRect.width,
                    height: childRect.height,
                    backgroundColor: childStyles.backgroundColor,
                    background: childStyles.background,
                    isThumbnail: child.hasAttribute('data-video-thumbnail'),
                    className: child.className,
                  };
                });
                console.log('Thumbnail final check:', {
                  inDOM: img.parentElement === parentElement,
                  display: styles.display,
                  visibility: styles.visibility,
                  opacity: styles.opacity,
                  zIndex: styles.zIndex,
                  width: rect.width,
                  height: rect.height,
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                  parentBackground: parentStyles.backgroundColor,
                  allSiblings: siblings,
                });
                
                // サムネイル画像が他の要素に覆われていないか確認
                const thumbnailIndex = siblings.findIndex(s => s.isThumbnail);
                if (thumbnailIndex !== -1) {
                  const thumbnailSibling = siblings[thumbnailIndex];
                  const coveringElements = siblings.filter((s, index) => {
                    if (index === thumbnailIndex) return false;
                    const sZIndex = parseInt(s.zIndex) || 0;
                    const thumbZIndex = parseInt(thumbnailSibling.zIndex) || 0;
                    return sZIndex > thumbZIndex && s.display !== 'none';
                  });
                  if (coveringElements.length > 0) {
                    console.warn('Elements covering thumbnail:', coveringElements);
                    // 覆っている要素の詳細を確認
                    coveringElements.forEach((elem, idx) => {
                      const elemNode = parentElement.children[Array.from(parentElement.children).findIndex((child, i) => {
                        const childStyles = window.getComputedStyle(child);
                        return childStyles.zIndex === elem.zIndex && child.tagName === elem.tag;
                      })];
                      if (elemNode) {
                        const elemRect = elemNode.getBoundingClientRect();
                        const thumbRect = img.getBoundingClientRect();
                        console.log(`Covering element ${idx}:`, {
                          tag: elem.tag,
                          zIndex: elem.zIndex,
                          position: elem.position,
                          top: elem.top,
                          left: elem.left,
                          width: elem.width,
                          height: elem.height,
                          backgroundColor: elem.backgroundColor,
                          background: elem.background,
                          coversThumbnail: !(elemRect.bottom < thumbRect.top || elemRect.top > thumbRect.bottom || elemRect.right < thumbRect.left || elemRect.left > thumbRect.right),
                        });
                      }
                    });
                  }
                }
                
                // サムネイル画像が実際に表示されているか確認（画像のsrcを直接確認）
                console.log('Thumbnail image src check:', {
                  src: img.src.substring(0, 100),
                  complete: img.complete,
                  naturalWidth: img.naturalWidth,
                  naturalHeight: img.naturalHeight,
                  currentSrc: img.currentSrc,
                });
                
                // サムネイル画像のDataURLをコンソールに出力（新しいタブで開けるように）
                console.log('Thumbnail DataURL (copy and paste in new tab to view):', img.src);
                
                // サムネイル画像が正しく表示されているか確認
                if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                  console.log('Thumbnail has valid dimensions, ensuring correct z-index');
                  // サムネイル画像はz-index: 1（グラデーションの下、動画の上）
                  img.style.setProperty('z-index', '1', 'important');
                  // グラデーションはz-index: 2（下部50%のみ）- 上部50%は透明なのでサムネイルが見える
                  const gradientElement = parentElement.querySelector('.absolute.bottom-0');
                  if (gradientElement) {
                    (gradientElement as HTMLElement).style.setProperty('z-index', '2', 'important');
                    // グラデーションが上部50%を覆わないように確認
                    const gradientStyles = window.getComputedStyle(gradientElement as HTMLElement);
                    const gradientRect = (gradientElement as HTMLElement).getBoundingClientRect();
                    const parentRect = parentElement.getBoundingClientRect();
                    console.log('Gradient position check:', {
                      gradientTop: gradientRect.top - parentRect.top,
                      gradientHeight: gradientRect.height,
                      parentHeight: parentRect.height,
                      shouldBeBottom50Percent: gradientRect.top - parentRect.top >= parentRect.height * 0.5,
                    });
                  }
                  // 再生アイコンはz-index: 3（サムネイル画像の上）- 背景は透明なのでサムネイルが見える
                  const playIconElement = parentElement.querySelector('.absolute.inset-0.flex');
                  if (playIconElement) {
                    (playIconElement as HTMLElement).style.setProperty('z-index', '3', 'important');
                    (playIconElement as HTMLElement).style.setProperty('background-color', 'transparent', 'important');
                    (playIconElement as HTMLElement).style.setProperty('background', 'transparent', 'important');
                  }
                  // タイトルはz-index: 3（サムネイル画像の上）
                  const titleElement = parentElement.querySelector('.absolute.bottom-0.p-2');
                  if (titleElement) {
                    (titleElement as HTMLElement).style.setProperty('z-index', '3', 'important');
                  }
                  console.log('Z-index hierarchy: thumbnail=1, gradient=2, playIcon/title=3');
                  
                  // サムネイル画像が実際に表示されているか確認
                  const imgRect = img.getBoundingClientRect();
                  const imgStyles = window.getComputedStyle(img);
                  console.log('Thumbnail visibility final check:', {
                    display: imgStyles.display,
                    visibility: imgStyles.visibility,
                    opacity: imgStyles.opacity,
                    zIndex: imgStyles.zIndex,
                    width: imgRect.width,
                    height: imgRect.height,
                    top: imgRect.top,
                    left: imgRect.left,
                    naturalWidth: img.naturalWidth,
                    naturalHeight: img.naturalHeight,
                  });
                }
              }, 100);
              
              // サムネイル画像の表示を確認
              const computedStyles = window.getComputedStyle(img);
              const rect = img.getBoundingClientRect();
              const parentComputed = window.getComputedStyle(parentElement);
              
              console.log('Thumbnail display check:', {
                imgDisplay: computedStyles.display,
                imgVisibility: computedStyles.visibility,
                imgOpacity: computedStyles.opacity,
                imgZIndex: computedStyles.zIndex,
                imgWidth: rect.width,
                imgHeight: rect.height,
                imgNaturalWidth: img.naturalWidth,
                imgNaturalHeight: img.naturalHeight,
                imgSrcLength: img.src.length,
                imgSrcStart: img.src.substring(0, 50),
                parentPosition: parentComputed.position,
                parentBackground: parentComputed.backgroundColor,
                parentOverflow: parentComputed.overflow,
              });
              
              // サムネイル画像が表示されていない場合、強制的に表示
              if (rect.width === 0 || rect.height === 0 || computedStyles.display === 'none') {
                console.warn('Thumbnail not visible, forcing display');
                img.style.setProperty('display', 'block', 'important');
                img.style.setProperty('visibility', 'visible', 'important');
                img.style.setProperty('opacity', '1', 'important');
                img.style.setProperty('width', '100%', 'important');
                img.style.setProperty('height', '100%', 'important');
                img.style.setProperty('position', 'absolute', 'important');
                img.style.setProperty('top', '0', 'important');
                img.style.setProperty('left', '0', 'important');
                img.style.setProperty('z-index', '1', 'important'); // グラデーションの下、動画の上に表示
              }
            };
            img.onerror = (error) => {
              console.error('Thumbnail image load error:', error);
              // エラー時は動画を表示する
              video.style.removeProperty('display');
            };
            
            // srcを設定（これで画像が読み込まれる）
            img.src = thumbnailUrl;
            
            // 動画の前に挿入
            video.parentElement.insertBefore(img, video);
            
            // 画像が既に読み込まれている場合（キャッシュなど）
            if (img.complete && img.naturalHeight !== 0) {
              console.log('Thumbnail image already loaded (cached)');
              video.style.setProperty('display', 'none', 'important');
            }
            
            console.log('Thumbnail image created, video will be hidden after image loads');
            
            return true;
          }
          return false;
        }
        return false;
      } catch (error) {
        console.error('Error capturing video frame:', error);
        return false;
      }
    };

      // 動画のサイズが取得できるまで待つ
      let retryCount = 0;
      const maxRetries = 100; // 最大10秒待つ（100ms * 100）
      
      const tryGenerate = () => {
        retryCount++;
        
        // readyState >= 2 かつ サイズが取得できている場合
        if (video.videoWidth > 0 && video.videoHeight > 0 && video.readyState >= 2) {
          // まず現在のフレームを試す
          if (tryCaptureFrame()) {
            return;
          }

          // 現在のフレームで失敗した場合、0.1秒の位置に移動して再試行
          const originalTime = video.currentTime;
          video.currentTime = 0.1;
          
          // seekedイベントでフレームを取得
          const handleSeeked = () => {
            try {
              if (!video.parentElement?.querySelector('img[data-video-thumbnail]')) {
                if (tryCaptureFrame()) {
                  video.removeEventListener('seeked', handleSeeked);
                  video.currentTime = originalTime;
                  return;
                }
              }
            } catch (error) {
              console.error('Error generating video thumbnail in seeked handler:', error);
            } finally {
              video.removeEventListener('seeked', handleSeeked);
              video.currentTime = originalTime;
            }
          };
          
          video.addEventListener('seeked', handleSeeked);
          
          // タイムアウト（5秒後にタイムアウト）
          setTimeout(() => {
            video.removeEventListener('seeked', handleSeeked);
            // タイムアウト時も現在のフレームを試す
            if (!video.parentElement?.querySelector('img[data-video-thumbnail]')) {
              console.log('Timeout reached, trying to capture current frame');
              tryCaptureFrame();
            }
          }, 5000);
      } else if (retryCount < maxRetries) {
        // まだ準備ができていない場合、少し待って再試行
        setTimeout(tryGenerate, 100);
      } else {
        console.error('Failed to generate thumbnail: video not ready after max retries', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
        });
      }
    };
    
    tryGenerate();
  } catch (error) {
    console.error('Error in generateVideoThumbnail:', error);
  }
};

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
  messageTitle?: string; // Messageセクションのタイトル
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
  thumbnailUrl?: string; // 動画のサムネイルURL
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

interface PublicPageClientProps {
  initialPageId?: string;
}

export function PublicPageClient({ initialPageId }: PublicPageClientProps) {
  const searchParams = useSearchParams();
  // 静的エクスポートではuseParams()が動作しない場合があるため、URLから直接取得するフォールバックを追加
  const [pageId, setPageId] = useState<string>(initialPageId || '');
  
  useEffect(() => {
    // 優先順位: initialPageId > URLから直接取得
    if (initialPageId) {
      setPageId(initialPageId);
      return;
    }
    
    // フォールバック: URLから直接取得
    if (typeof window !== 'undefined') {
      const pathname = window.location.pathname;
      const match = pathname.match(/^\/public\/([^\/]+)/);
      if (match && match[1]) {
        console.log('Extracted pageId from URL:', match[1]);
        setPageId(match[1]);
      }
    }
  }, [initialPageId]);
  
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
    gradient: '#000000',
  });
  const [fontSizes, setFontSizes] = useState({
    title: 35,
    body: 16,
  });
  
  // アニメーション用のrefs
  const coverImageRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLDivElement>(null);
  const bioSectionRef = useRef<HTMLDivElement>(null);
  const [visibleSections, setVisibleSections] = useState<Set<string>>(new Set(['cover', 'title']));
  
  // スクロール時のアニメーション用のIntersection Observer
  useEffect(() => {
    const observers: IntersectionObserver[] = [];
    
    // カバー画像のアニメーション
    if (coverImageRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSections((prev) => new Set(prev).add('cover'));
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(coverImageRef.current);
      observers.push(observer);
    }
    
    // タイトルのアニメーション
    if (titleRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSections((prev) => new Set(prev).add('title'));
            }
          });
        },
        { threshold: 0.1 }
      );
      observer.observe(titleRef.current);
      observers.push(observer);
    }
    
    // Bioセクションのアニメーション
    if (bioSectionRef.current) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSections((prev) => new Set(prev).add('bio'));
            }
          });
        },
        { 
          threshold: 0.1,
          rootMargin: '100px' // 要素が画面に入る100px前にトリガー
        }
      );
      observer.observe(bioSectionRef.current);
      observers.push(observer);
    }
    
    // メディアブロックのアニメーション
    const mediaBlocks = document.querySelectorAll('[data-media-block]');
    mediaBlocks.forEach((block, index) => {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setVisibleSections((prev) => new Set(prev).add(`media-${index}`));
            }
          });
        },
        { 
          threshold: 0.1,
          rootMargin: '100px' // 要素が画面に入る100px前にトリガー
        }
      );
      observer.observe(block);
      observers.push(observer);
    });
    
    return () => {
      observers.forEach((observer) => observer.disconnect());
    };
  }, [pageData, mediaBlocks]);

  // ブラウザのタブタイトルを動的に更新
  useEffect(() => {
    if (typeof window !== 'undefined' && pageData) {
      if (pageData.title && pageData.title.trim()) {
        document.title = `${pageData.title.trim()} - emolink`;
      } else {
        document.title = 'emolink';
      }
    }
  }, [pageData?.title]);

  useEffect(() => {
    const fetchPageData = async () => {
      // pageIdが設定されるまで待つ
      if (!pageId) {
        // pageIdがまだ設定されていない場合は、URLから直接取得を試みる
        if (typeof window !== 'undefined') {
          const pathname = window.location.pathname;
          const match = pathname.match(/^\/public\/([^\/]+)/);
          if (match && match[1]) {
            console.log('Extracting pageId from URL in fetchPageData:', match[1]);
            setPageId(match[1]);
            return; // pageIdが設定されたので、次のuseEffectで再実行される
          }
        }
        console.error('pageId is not available');
        setError('ページIDが指定されていません');
        setLoading(false);
        return;
      }
      
      console.log('Fetching page data for pageId:', pageId);
      
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
              gradient: customColors.gradient || '#000000',
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
              ordering: previewData.ordering || (previewData.blocks || []).map((b: any) => b.id),
              topicsTitle: previewData.topicsTitle || 'Topics',
              messageTitle: previewData.messageTitle || 'Message',
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
            // メディアブロックを設定（公開設定のもののみ）、thumbnailをthumbnailUrlにマッピング
            let previewBlocks = (previewData.blocks || [])
              .filter((b: any) => b.visibility === 'public')
              .map((b: any) => ({
                ...b,
                thumbnailUrl: b.thumbnailUrl || b.thumbnail, // thumbnailもthumbnailUrlとして扱う
              }));
            
            // orderingに従ってソート
            if (previewData.ordering && Array.isArray(previewData.ordering)) {
              const orderMap = new Map<string, number>(
                previewData.ordering.map((id: string, index: number) => [id, index])
              );
              previewBlocks = previewBlocks.sort((a: any, b: any) => {
                const orderA: number = orderMap.get(a.id) ?? 999999;
                const orderB: number = orderMap.get(b.id) ?? 999999;
                return orderA - orderB;
              });
            }
            
            setMediaBlocks(previewBlocks);
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
          console.error('Public page not found:', pageId);
          setError('ページが見つかりません');
          setLoading(false);
          return;
        }
        
        console.log('Public page found:', {
          id: pageDoc.id,
          hasData: !!pageDoc.data(),
          tenant: pageDoc.data()?.tenant,
        });
        
        const data = pageDoc.data() as PublicPageData;
        
        // セキュリティチェック：公開ページは誰でもアクセス可能だが、
        // ログイン済みユーザーが自分のページ以外にアクセスしようとした場合は警告を表示
        // ただし、公開ページはNFCタグやQRコードからアクセスされるため、完全にブロックはしない
        // 注意：このチェックは表示のみで、アクセス自体は許可する
        
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
          console.log('Loading colors from publicPage data:', data.colors);
          setColors({
            accent: data.colors.accent || '#08af86',
            text: data.colors.text || '#ffffff',
            background: data.colors.background || '#000f24',
            cardBackground: data.colors.cardBackground || '#1a1a1a',
            gradient: (data.colors as any)?.gradient || '#000000',
          });
          console.log('Set gradient color to:', (data.colors as any)?.gradient || '#000000');
        } else if (data.design?.colors) {
          // design.colorsから色設定を読み込む（後方互換性のため）
          setColors({
            accent: data.design.colors.primary || '#08af86',
            gradient: '#000000',
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
        
        console.log('Loading publicPage data:', {
          topicsTitle: data.topicsTitle,
          messageTitle: data.messageTitle,
          gradient: (data.colors as any)?.gradient,
          colors: data.colors,
          media: data.media,
          hasCoverImage: !!data.media?.cover,
          coverImageUrl: data.media?.cover,
        });
        setPageData({
          ...data,
          id: pageDoc.id,
          // mediaが存在しない場合は空のオブジェクトを設定
          media: data.media || { cover: undefined, profile: undefined },
          ordering: data.ordering || [],
          topicsTitle: data.topicsTitle || 'Topics',
          messageTitle: data.messageTitle || 'Message',
        });
        
        // メディアブロックを取得（memoryIdから）
        if (data.memoryId) {
          try {
            const memoryDoc = await getDoc(doc(db, 'memories', data.memoryId));
            if (memoryDoc.exists()) {
              const memoryData = memoryDoc.data();
              const blocks = memoryData.blocks || [];
              
              // 公開設定のブロックのみを表示し、thumbnailをthumbnailUrlにマッピング
              let publicBlocks = blocks
                .filter((b: any) => b.visibility === 'public')
                .map((b: any) => ({
                  ...b,
                  thumbnailUrl: b.thumbnailUrl || b.thumbnail, // thumbnailもthumbnailUrlとして扱う
                }));
              
              // orderingに従ってソート（publicPageのorderingを優先、なければmemoryのorderingを使用）
              const orderingToUse = data.ordering && data.ordering.length > 0 
                ? data.ordering 
                : (memoryData.ordering && Array.isArray(memoryData.ordering) ? memoryData.ordering : []);
              
              if (orderingToUse.length > 0) {
                const orderMap = new Map<string, number>(
                  orderingToUse.map((id: string, index: number) => [id, index])
                );
                publicBlocks = publicBlocks.sort((a: any, b: any) => {
                  const orderA: number = orderMap.get(a.id) ?? 999999;
                  const orderB: number = orderMap.get(b.id) ?? 999999;
                  return orderA - orderB;
                });
                
                // pageDataにorderingを反映
                setPageData(prev => prev ? { ...prev, ordering: orderingToUse } : null);
              }
              
              setMediaBlocks(publicBlocks);
            }
          } catch (err) {
            console.error('Error fetching memory blocks:', err);
          }
        }
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
      {pageData.media?.cover && (
        <div 
          ref={coverImageRef}
          className={`fixed top-0 left-0 w-full z-10 transition-opacity duration-1000 ${
            visibleSections.has('cover') ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ 
            height: '100svh', // small viewport height（ブラウザUIの表示/非表示に関わらず一定の高さを維持）
            width: '100%',
            overflow: 'hidden',
            pointerEvents: 'none',
            contain: 'layout style paint',
            isolation: 'isolate',
            transform: 'translateZ(0)',
            WebkitTransform: 'translateZ(0)',
            willChange: 'contents',
          }}
        >
          <img 
            src={pageData.media?.cover || ''} 
            alt={pageData.title} 
            className="object-cover cursor-pointer"
            style={{ 
              display: 'block', 
              margin: 0, 
              padding: 0, 
              objectPosition: coverImagePosition,
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
              transformOrigin: 'center center',
              height: `${100 * (coverImageScale || 1)}svh`, // small viewport height（ブラウザUIの表示/非表示に関わらず一定の高さを維持）
              width: `${100 * (coverImageScale || 1)}%`,
              objectFit: 'cover',
              pointerEvents: 'auto',
              userSelect: 'none',
              WebkitUserSelect: 'none',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              position: 'absolute',
              top: `${-50 * ((coverImageScale || 1) - 1)}svh`,
              left: `${-50 * ((coverImageScale || 1) - 1)}%`,
              right: `${-50 * ((coverImageScale || 1) - 1)}%`,
              bottom: `${-50 * ((coverImageScale || 1) - 1)}svh`,
              contain: 'layout style paint',
              willChange: 'contents',
            }}
            onClick={() => {
              setSelectedImage(pageData.media?.cover || null);
              setSelectedImageBlock(null);
            }}
            draggable={false}
          />
          {/* グラデーションオーバーレイ（一番下から開始） */}
          <div 
            className="absolute left-0 right-0"
            style={{
              bottom: 0,
              height: '80%',
              background: generateCoverGradient(colors.gradient || '#000000'),
              pointerEvents: 'none',
              zIndex: 1,
              marginBottom: 0,
            }}
          />
          {/* タイトルとプロフィール情報を表示 */}
          <div 
            ref={titleRef}
            className={`absolute bottom-[20%] left-0 right-0 pl-6 pr-4 pb-6 sm:pl-8 sm:pr-6 sm:pb-8 transition-all duration-700 ${
              visibleSections.has('title') 
                ? 'opacity-100 translate-y-0' 
                : 'opacity-0 translate-y-8'
            }`}
            style={{
              zIndex: 2,
              transform: 'translateZ(0)',
              WebkitTransform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              willChange: 'contents',
              contain: 'layout style paint',
            }}
          >
            <h2 
              className="font-bold mb-3 whitespace-pre-line" 
              style={{ 
                color: colors.text, 
                fontSize: `${fontSizes.title * 0.85}px`,
                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                  ? '0 2px 8px rgba(0, 0, 0, 0.5)'
                  : '0 2px 8px rgba(255, 255, 255, 0.5)',
                transform: 'translateZ(0)',
                WebkitTransform: 'translateZ(0)',
                backfaceVisibility: 'hidden',
                WebkitBackfaceVisibility: 'hidden',
                willChange: 'contents',
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
                    : '0 1px 4px rgba(255, 255, 255, 0.5)',
                  transform: 'translateZ(0)',
                  WebkitTransform: 'translateZ(0)',
                  backfaceVisibility: 'hidden',
                  WebkitBackfaceVisibility: 'hidden',
                  willChange: 'contents',
                }}
              >
                {pageData.about}
              </p>
            )}
          </div>
        </div>
      )}

      {/* コンテンツエリア（カバー画像の下にスクロール可能なコンテンツ） */}
      <div 
        className="relative z-20 rounded-t-2xl" 
        style={{ 
          marginTop: '100svh', 
          backgroundColor: colors.background, 
          minHeight: '100vh', 
          position: 'relative'
        }}
      >
        {/* ドラッグハンドル（角丸の真ん中） */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 w-12 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.6 }}></div>
        {/* Bioセクション（カバー画像の下、Topicsの上） */}
        {(pageData.title || pageData.about || pageData.bio || pageData.media?.profile) && (
          <div 
            ref={bioSectionRef}
            className="w-full pt-16 pb-0 opacity-100 translate-y-0"
          >
            <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8">
              <div className="flex flex-row gap-6 sm:gap-8 items-start">
                {/* プロフィール写真 */}
                {pageData.media?.profile && (
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
                    {linkifyText(pageData.bio).map((part, index) => {
                      if (typeof part === 'string') {
                        return <span key={index}>{part}</span>;
                      }
                      return <React.Fragment key={index}>{part}</React.Fragment>;
                    })}
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

      {/* Topicsセクション（カバー画像の下、横スクロール） */}
      {(() => {
        let topicsBlocks = mediaBlocks.filter(block => block.isTopic && block.visibility === 'public');
        
        // orderingに基づいてソート
        if (pageData.ordering && Array.isArray(pageData.ordering)) {
          const orderMap = new Map(pageData.ordering.map((id: string, index: number) => [id, index]));
          topicsBlocks = topicsBlocks.sort((a, b) => {
            const orderA = orderMap.get(a.id) ?? 999999;
            const orderB = orderMap.get(b.id) ?? 999999;
            return orderA - orderB;
          });
        }
        
        return topicsBlocks.length > 0 ? (
        <div className="w-full mt-6 mb-12" style={{ backgroundColor: colors.background }}>
          <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8">
            <h3 className="text-lg font-bold mb-4" style={{ color: colors.text }}>
              {pageData.topicsTitle || 'Topics'}
            </h3>
            <div className="overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 md:-mx-8" style={{ WebkitOverflowScrolling: 'touch' }}>
              <div className="flex gap-4 px-4 sm:px-6 md:px-8" style={{ width: 'max-content' }}>
              {/* すべてのアイテムを横スクロールで表示 */}
              {topicsBlocks
                .flatMap((block, index) => {
                  // 横スクロールで表示するため、すべて同じサイズに統一
                  const itemSize = 200; // すべて200pxに統一
                  
                  // 画像ブロックの場合
                  if (block.type === 'image' && block.url) {
                    return [(
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
                            className="absolute left-0 right-0"
                            style={{
                              bottom: 0,
                              height: '50%',
                              background: generateThumbnailGradient(colors.gradient || '#000000'),
                              pointerEvents: 'none',
                              marginBottom: 0,
                              paddingBottom: 0,
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
                    )];
                  }
                  // 動画ブロックの場合
                  if (block.type === 'video' && block.url) {
                    return [(
                      <div
                        key={block.id}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        style={{ 
                          width: `${itemSize}px`, 
                          height: `${itemSize}px`, 
                          position: 'relative',
                          backgroundColor: 'transparent',
                          background: 'transparent',
                        }}
                        onClick={() => {
                          setSelectedImage(block.url || null);
                          setSelectedImageBlock(block);
                        }}
                      >
                        {/* 動画サムネイル表示（poster属性または動的生成） */}
                        {(() => {
                          console.log('Topics video block thumbnail check:', {
                            blockId: block.id,
                            hasThumbnailUrl: !!block.thumbnailUrl,
                            thumbnailUrl: block.thumbnailUrl?.substring(0, 100),
                            url: block.url?.substring(0, 100),
                          });
                          return null;
                        })()}
                        {block.thumbnailUrl ? (
                          <img
                            src={block.thumbnailUrl}
                            alt={block.title || 'Video'}
                            className="w-full h-full object-cover"
                            style={{ position: 'relative', zIndex: 0 }}
                            onLoad={() => {
                              console.log('Topics thumbnail image loaded from URL:', block.thumbnailUrl?.substring(0, 100));
                            }}
                            onError={(e) => {
                              console.error('Topics thumbnail image load error:', block.thumbnailUrl?.substring(0, 100));
                            }}
                          />
                        ) : (
                          <video
                            ref={(videoElement) => {
                              if (videoElement && (!videoElement.poster || !videoElement.poster.startsWith('data:'))) {
                                // 動画要素がマウントされたら、すぐにサムネイル生成を試みる
                                const tryGenerate = () => {
                                  if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                                    generateVideoThumbnail(videoElement);
                                  } else {
                                    setTimeout(tryGenerate, 100);
                                  }
                                };
                                tryGenerate();
                              }
                            }}
                            src={block.url}
                            className="w-full h-full object-cover"
                            style={{
                              position: 'relative',
                              zIndex: 0,
                              display: 'block',
                              pointerEvents: 'none',
                              backgroundColor: 'transparent',
                            }}
                            muted
                            playsInline
                            preload="metadata"
                            onLoadedMetadata={(e) => {
                              const video = e.currentTarget;
                              if (!video.poster || !video.poster.startsWith('data:')) {
                                generateVideoThumbnail(video);
                              }
                            }}
                            onLoadedData={(e) => {
                              const video = e.currentTarget;
                              if (!video.poster || !video.poster.startsWith('data:')) {
                                generateVideoThumbnail(video);
                              }
                            }}
                            onCanPlay={(e) => {
                              const video = e.currentTarget;
                              if (!video.poster || !video.poster.startsWith('data:')) {
                                generateVideoThumbnail(video);
                              }
                            }}
                            onLoadedMetadataCapture={(e) => {
                              const video = e.currentTarget;
                              if (!video.poster || !video.poster.startsWith('data:')) {
                                generateVideoThumbnail(video);
                              }
                            }}
                          />
                        )}
                        {/* 再生アイコンオーバーレイ（背景色なし、アイコンのみ） */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 3, backgroundColor: 'transparent' }}>
                          <Play className="w-8 h-8 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))', pointerEvents: 'none' }} />
                        </div>
                        {/* グラデーションオーバーレイ（左下部） - 常に表示 */}
                        <div 
                          className="absolute bottom-0 left-0 right-0"
                          style={{
                            height: '50%',
                            background: generateThumbnailGradient(colors.gradient || '#000000'),
                            pointerEvents: 'none',
                            zIndex: 2,
                            top: 'auto', // 下部に配置
                            backgroundColor: 'transparent', // 上部は透明
                          }}
                        />
                        {/* タイトルと説明文（左下） */}
                        {(block.title || block.description) && (
                          <div className="absolute bottom-0 left-0 right-0 p-2" style={{ zIndex: 3 }}>
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
                    )];
                  }
                  // テキストブロックの場合
                  if (block.type === 'text') {
                    return [(
                      <div
                        key={block.id}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        style={{ 
                          width: `${itemSize}px`, 
                          height: `${itemSize}px`,
                          backgroundColor: block.thumbnailUrl ? 'transparent' : colors.cardBackground,
                        }}
                        onClick={() => {
                          setSelectedImageBlock(block);
                          setSelectedImage(null);
                        }}
                      >
                        {block.thumbnailUrl ? (
                          <>
                            <img
                              src={block.thumbnailUrl}
                              alt={block.title || 'Text'}
                              className="w-full h-full object-cover"
                              style={{ position: 'relative', zIndex: 0 }}
                            />
                            {/* グラデーションオーバーレイ（左下部） */}
                            {(block.title || block.description) && (
                              <div 
                                className="absolute left-0 right-0"
                                style={{
                                  bottom: 0,
                                  height: '50%',
                                  background: generateThumbnailGradient(colors.gradient || '#000000'),
                                  pointerEvents: 'none',
                                  zIndex: 1,
                                  marginBottom: 0,
                                  paddingBottom: 0,
                                }}
                              />
                            )}
                            {/* タイトルと説明文（左下） */}
                            {(block.title || block.description) && (
                              <div className="absolute bottom-0 left-0 right-0 p-2" style={{ zIndex: 2 }}>
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
                          </>
                        ) : (
                          <div className="flex flex-col justify-center items-center p-3 h-full">
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
                        )}
                      </div>
                    )];
                  }
                  // アルバムブロックの場合（各画像を個別に表示）
                  if (block.type === 'album' && block.albumItems && block.albumItems.length > 0) {
                    return block.albumItems.map((item, itemIndex) => (
                      <div
                        key={`${block.id}-${item.id}`}
                        className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                        style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                        onClick={() => {
                          setSelectedAlbum(block);
                          setSelectedAlbumIndex(itemIndex);
                        }}
                      >
                        <img
                          src={item.url}
                          alt={item.description || block.title || 'Album item'}
                          className="w-full h-full object-cover"
                          style={{ position: 'relative', zIndex: 0 }}
                        />
                        {/* グラデーションオーバーレイ（左下部） - アルバムの場合は常に表示 */}
                        <div 
                          className="absolute left-0 right-0"
                          style={{
                            bottom: 0,
                            height: '50%',
                            background: generateThumbnailGradient(colors.gradient || '#000000'),
                            pointerEvents: 'none',
                            zIndex: 1,
                            marginBottom: 0,
                            paddingBottom: 0,
                          }}
                        />
                        {/* タイトルと説明文（左下） */}
                        {(item.description || (itemIndex === 0 && block.title)) && (
                          <div className="absolute bottom-0 left-0 right-0 p-2" style={{ zIndex: 2 }}>
                            <p
                              className="text-xs font-medium truncate"
                              style={{
                                color: colors.text,
                                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                  ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                  : '0 1px 2px rgba(255, 255, 255, 0.5)'
                              }}
                            >
                              {item.description || (itemIndex === 0 ? block.title : '') || ''}
                            </p>
                          </div>
                        )}
                      </div>
                    ));
                  }
                  return [];
                })}
              </div>
            </div>
          </div>
        </div>
        ) : null;
      })()}

        {/* コンテンツエリア */}
        <div className="max-w-2xl mx-auto">

        {/* 1枚のみの写真・動画・アルバムを表示（単体で2:1アスペクト比、orderingに基づいて順序表示） */}
        {(() => {
          // orderingに基づいて全体をソート
          let allOrderedBlocks: any[] = [];
          if (pageData.ordering && Array.isArray(pageData.ordering) && pageData.ordering.length > 0) {
            // orderingに基づいて順序を決定
            const orderMap = new Map(pageData.ordering.map((id: string, index: number) => [id, index]));
            allOrderedBlocks = mediaBlocks
              .filter(block => !block.isTopic && block.type !== 'text' && block.visibility === 'public')
              .sort((a, b) => {
                const orderA = orderMap.get(a.id) ?? 999999;
                const orderB = orderMap.get(b.id) ?? 999999;
                return orderA - orderB;
              });
          } else {
            // orderingがない場合は従来通り
            allOrderedBlocks = mediaBlocks.filter(block => !block.isTopic && block.type !== 'text' && block.type !== 'album' && block.visibility === 'public' && ((block.type === 'image' && block.url) || (block.type === 'video' && block.url)));
          }
          
          // 画像・動画・アルバムを順序通りに表示
          let filteredBlocks = allOrderedBlocks.filter(block => 
            ((block.type === 'image' && block.url) || 
             (block.type === 'video' && block.url) || 
             (block.type === 'album' && block.albumItems && block.albumItems.length > 0))
          );
          
          return filteredBlocks.length > 0 ? (
          <div className="w-full mb-6" style={{ backgroundColor: colors.background }}>
            <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8">
              {filteredBlocks.map((block, index) => {
                if (block.type === 'image' && block.url) {
                  return (
                    <div
                      key={block.id}
                      data-media-block
                      className="w-full rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-500 mb-12 opacity-100 translate-y-0"
                      style={{ 
                        aspectRatio: '2/1',
                        transitionDelay: `${index * 100}ms`,
                      }}
                      onClick={() => {
                        setSelectedImage(block.url || null);
                        setSelectedImageBlock(block);
                      }}
                    >
                      <img
                        src={block.url}
                        alt={block.title || 'Image'}
                        className="w-full h-full object-cover"
                        style={{ objectPosition: 'center center' }}
                      />
                      {/* グラデーションオーバーレイ（左下部） */}
                      {block.title && (
                        <div 
                          className="absolute left-0 right-0"
                          style={{
                            bottom: 0,
                            height: '50%',
                            background: generateThumbnailGradient(colors.gradient || '#000000'),
                            pointerEvents: 'none',
                            marginBottom: 0,
                            paddingBottom: 0,
                          }}
                        />
                      )}
                      {/* タイトルのみ表示 */}
                      {block.title && (
                        <div className="absolute bottom-0 left-0 right-0 p-4" style={{ zIndex: 3 }}>
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: colors.text,
                              textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                : '0 1px 2px rgba(255, 255, 255, 0.5)'
                            }}
                          >
                            {block.title}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
                if (block.type === 'video' && block.url) {
                  return (
                    <div
                      key={block.id}
                      data-media-block
                      className="w-full rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-all duration-500 relative mb-12 opacity-100 translate-y-0"
                      style={{ 
                        aspectRatio: '2/1', 
                        position: 'relative',
                        backgroundColor: 'transparent',
                        transitionDelay: `${index * 100}ms`,
                      }}
                      onClick={() => {
                        setSelectedImage(block.url || null);
                        setSelectedImageBlock(block);
                      }}
                    >
                      {/* 動画サムネイル表示（thumbnailUrlがある場合はimg、ない場合はvideo + 動的生成） */}
                      {(() => {
                        console.log('Video block thumbnail check:', {
                          blockId: block.id,
                          hasThumbnailUrl: !!block.thumbnailUrl,
                          thumbnailUrl: block.thumbnailUrl?.substring(0, 100),
                          url: block.url?.substring(0, 100),
                        });
                        return null;
                      })()}
                      {block.thumbnailUrl ? (
                        <img
                          src={block.thumbnailUrl}
                          alt={block.title || 'Video'}
                          className="w-full h-full object-cover"
                          style={{ 
                            objectPosition: 'center center',
                            position: 'relative',
                            zIndex: 0,
                          }}
                          onLoad={() => {
                            console.log('Thumbnail image loaded from URL:', block.thumbnailUrl?.substring(0, 100));
                          }}
                          onError={(e) => {
                            console.error('Thumbnail image load error:', block.thumbnailUrl?.substring(0, 100));
                          }}
                        />
                      ) : (
                        <video
                          ref={(videoElement) => {
                            if (videoElement && !videoElement.parentElement?.querySelector('img[data-video-thumbnail]')) {
                              // 動画要素がマウントされたら、すぐにサムネイル生成を試みる
                              const tryGenerate = () => {
                                if (videoElement.readyState >= 2 && videoElement.videoWidth > 0 && videoElement.videoHeight > 0) {
                                  generateVideoThumbnail(videoElement);
                                } else {
                                  setTimeout(tryGenerate, 100);
                                }
                              };
                              tryGenerate();
                            }
                          }}
                          src={block.url}
                          className="w-full h-full object-cover"
                          style={{ 
                            objectPosition: 'center center',
                            position: 'relative',
                            zIndex: 0,
                            display: 'block',
                            pointerEvents: 'none',
                            backgroundColor: 'transparent',
                          }}
                          muted
                          playsInline
                          preload="metadata"
                          onLoadedMetadata={(e) => {
                            const video = e.currentTarget;
                            if (!video.parentElement?.querySelector('img[data-video-thumbnail]')) {
                              generateVideoThumbnail(video);
                            }
                          }}
                          onLoadedData={(e) => {
                            const video = e.currentTarget;
                            if (!video.parentElement?.querySelector('img[data-video-thumbnail]')) {
                              generateVideoThumbnail(video);
                            }
                          }}
                          onCanPlay={(e) => {
                            const video = e.currentTarget;
                            if (!video.parentElement?.querySelector('img[data-video-thumbnail]')) {
                              generateVideoThumbnail(video);
                            }
                          }}
                          onLoadedMetadataCapture={(e) => {
                            const video = e.currentTarget;
                            if (!video.parentElement?.querySelector('img[data-video-thumbnail]')) {
                              generateVideoThumbnail(video);
                            }
                          }}
                        />
                      )}
                      {/* 再生アイコンオーバーレイ（背景色なし、アイコンのみ） */}
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ zIndex: 3 }}>
                        <Play className="w-12 h-12 text-white" style={{ filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.5))', pointerEvents: 'none' }} />
                      </div>
                      {/* グラデーションオーバーレイ（左下部） - タイトルがある場合は常に表示 */}
                      <div 
                        className="absolute left-0 right-0"
                        style={{
                          bottom: 0,
                          height: '50%',
                          background: generateThumbnailGradient(colors.gradient || '#000000'),
                          pointerEvents: 'none',
                          zIndex: 2,
                          marginBottom: 0,
                          paddingBottom: 0,
                        }}
                      />
                      {/* タイトルのみ表示 */}
                      {block.title && (
                        <div className="absolute bottom-0 left-0 right-0 p-4" style={{ zIndex: 3 }}>
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: colors.text,
                              textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                : '0 1px 2px rgba(255, 255, 255, 0.5)'
                            }}
                          >
                            {block.title}
                          </p>
                        </div>
                      )}
                    </div>
                  );
                }
                // アルバムブロックの場合（Photosセクション内で表示、横スクロールデザイン）
                if (block.type === 'album' && block.albumItems && block.albumItems.length > 0) {
                  return (
                    <div key={block.id} className="mb-6">
                      {block.title && (
                        <h3 className="text-lg font-bold mb-1" style={{ color: colors.text }}>
                          {block.title}
                        </h3>
                      )}
                      {block.description && (
                        <p className="text-sm mb-4 whitespace-pre-wrap" style={{ color: colors.text, opacity: 0.8 }}>
                          {block.description}
                        </p>
                      )}
                      <div className="overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 md:-mx-8" style={{ WebkitOverflowScrolling: 'touch' }}>
                        <div className="flex gap-4 px-4 sm:px-6 md:px-8 pb-4" style={{ width: 'max-content' }}>
                          {block.albumItems.map((item: any, itemIndex: number) => {
                            const itemSize = 200; // Topicsと同じサイズ
                            return (
                              <div
                                key={item.id}
                                className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                                style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                                onClick={() => {
                                  setSelectedAlbum(block);
                                  setSelectedAlbumIndex(itemIndex);
                                }}
                              >
                                <img
                                  src={item.url}
                                  alt={item.description || block.title || 'Album item'}
                                  className="w-full h-full object-cover"
                                  style={{ position: 'relative', zIndex: 0 }}
                                />
                                {/* グラデーションオーバーレイ（左下部） - アルバムの場合は常に表示 */}
                                <div 
                                  className="absolute left-0 right-0"
                                  style={{
                                    bottom: 0,
                                    height: '50%',
                                    background: generateThumbnailGradient(colors.gradient || '#000000'),
                                    pointerEvents: 'none',
                                    zIndex: 1,
                                    marginBottom: 0,
                                    paddingBottom: 0,
                                  }}
                                />
                                {/* タイトルと説明文（左下） */}
                                {(item.description || (itemIndex === 0 && block.title)) && (
                                  <div className="absolute bottom-0 left-0 right-0 p-2" style={{ zIndex: 2 }}>
                                    <p
                                      className="text-xs font-medium truncate"
                                      style={{
                                        color: colors.text,
                                        textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                          ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                          : '0 1px 2px rgba(255, 255, 255, 0.5)'
                                      }}
                                    >
                                      {item.description || (itemIndex === 0 ? block.title : '') || ''}
                                    </p>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
          ) : null;
        })()}

        {/* Messageセクション（テキストブロックのみ、Topicsと同じレイアウトスタイル） */}
        {(() => {
          let filteredBlocks = mediaBlocks.filter(block => block.type === 'text' && block.visibility === 'public');
          
          // orderingに基づいてソート
          if (pageData.ordering && Array.isArray(pageData.ordering)) {
            const orderMap = new Map(pageData.ordering.map((id: string, index: number) => [id, index]));
            filteredBlocks = filteredBlocks.sort((a, b) => {
              const orderA = orderMap.get(a.id) ?? 999999;
              const orderB = orderMap.get(b.id) ?? 999999;
              return orderA - orderB;
            });
          }
          
          return filteredBlocks.length > 0 ? (
          <div className="w-full mb-6" style={{ backgroundColor: colors.background }}>
            <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8">
              <h3 className="text-lg font-bold mb-4" style={{ color: colors.text }}>
                {pageData.messageTitle || 'Message'}
              </h3>
              <div className="overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 md:-mx-8" style={{ WebkitOverflowScrolling: 'touch' }}>
                <div className="flex gap-4 px-4 sm:px-6 md:px-8 pb-4" style={{ width: 'max-content' }}>
                  {filteredBlocks.map((block) => {
                      const itemSize = 200; // Topicsと同じサイズ
                      return (
                        <div
                          key={block.id}
                          className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                          style={{ 
                            width: `${itemSize}px`, 
                            height: `${itemSize}px`,
                            backgroundColor: block.thumbnailUrl ? 'transparent' : colors.cardBackground,
                          }}
                          onClick={() => {
                            setSelectedImageBlock(block);
                            setSelectedImage(null);
                          }}
                        >
                          {block.thumbnailUrl ? (
                            <>
                              <img
                                src={block.thumbnailUrl}
                                alt={block.title || 'Text'}
                                className="w-full h-full object-cover"
                                style={{ position: 'relative', zIndex: 0 }}
                              />
                              {/* グラデーションオーバーレイ（左下部） */}
                              {(block.title || block.description) && (
                                <div 
                                  className="absolute left-0 right-0"
                                  style={{
                                    bottom: 0,
                                    height: '50%',
                                    background: generateThumbnailGradient(colors.gradient || '#000000'),
                                    pointerEvents: 'none',
                                    zIndex: 1,
                                    marginBottom: 0,
                                    paddingBottom: 0,
                                  }}
                                />
                              )}
                              {/* タイトルと説明文（左下） */}
                              {(block.title || block.description) && (
                                <div className="absolute bottom-0 left-0 right-0 p-2" style={{ zIndex: 2 }}>
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
                            </>
                          ) : (
                            <div className="flex flex-col justify-center items-center p-3 h-full">
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
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
          ) : null;
        })()}

        {/* アルバムセクション（orderingに含まれていないアルバムのみ表示、Topicsと同じレイアウトスタイル） */}
        {(() => {
          // orderingに含まれているアルバムのIDを取得
          const orderedAlbumIds = new Set<string>();
          if (pageData.ordering && Array.isArray(pageData.ordering)) {
            const orderedBlocks = mediaBlocks.filter(block => 
              block.type === 'album' && 
              pageData.ordering.includes(block.id)
            );
            orderedBlocks.forEach(block => orderedAlbumIds.add(block.id));
          }
          
          // orderingに含まれていないアルバムのみを表示
          let filteredBlocks = mediaBlocks.filter(block => 
            block.type === 'album' && 
            block.albumItems && 
            block.albumItems.length > 0 && 
            block.visibility === 'public' &&
            !orderedAlbumIds.has(block.id) // orderingに含まれていないもののみ
          );
          
          // orderingに基づいてソート（orderingに含まれていない場合は従来通り）
          if (pageData.ordering && Array.isArray(pageData.ordering) && pageData.ordering.length > 0) {
            const orderMap = new Map(pageData.ordering.map((id: string, index: number) => [id, index]));
            filteredBlocks = filteredBlocks.sort((a, b) => {
              const orderA = orderMap.get(a.id) ?? 999999;
              const orderB = orderMap.get(b.id) ?? 999999;
              return orderA - orderB;
            });
          }
          
          return filteredBlocks.length > 0 ? (
          <div className="w-full mb-6" style={{ backgroundColor: colors.background }}>
            <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8">
              {/* アルバムタイトルをTopicsのタイトル位置に表示（各アルバムブロックごと） */}
              {filteredBlocks.map((albumBlock) => {
                return albumBlock?.title ? (
                  <div key={`album-section-${albumBlock.id}`} className="mb-4">
                    <h3 className="text-lg font-bold mb-1" style={{ color: colors.text }}>
                      {albumBlock.title}
                    </h3>
                    {albumBlock.description && (
                      <p className="text-sm mb-4 whitespace-pre-wrap" style={{ color: colors.text, opacity: 0.8 }}>
                        {albumBlock.description}
                      </p>
                    )}
                    <div className="overflow-x-auto scrollbar-hide -mx-4 sm:-mx-6 md:-mx-8" style={{ WebkitOverflowScrolling: 'touch' }}>
                      <div className="flex gap-4 px-4 sm:px-6 md:px-8 pb-4" style={{ width: 'max-content' }}>
                        {albumBlock.albumItems!.map((item, itemIndex) => {
                          const itemSize = 200; // Topicsと同じサイズ
                          return (
                            <div
                              key={`${albumBlock.id}-${item.id}`}
                              className="flex-shrink-0 rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition relative"
                              style={{ width: `${itemSize}px`, height: `${itemSize}px` }}
                              onClick={() => {
                                setSelectedAlbum(albumBlock);
                                setSelectedAlbumIndex(itemIndex);
                              }}
                            >
                              <img
                                src={item.url}
                                alt={item.description || albumBlock.title || 'Album item'}
                                className="w-full h-full object-cover"
                                style={{ position: 'relative', zIndex: 0 }}
                              />
                              {/* グラデーションオーバーレイ（左下部） - アルバムの場合は常に表示 */}
                              <div 
                                className="absolute left-0 right-0"
                                style={{
                                  bottom: 0,
                                  height: '50%',
                                  background: generateThumbnailGradient(colors.gradient || '#000000'),
                                  pointerEvents: 'none',
                                  zIndex: 1,
                                  marginBottom: 0,
                                  paddingBottom: 0,
                                }}
                              />
                              {/* 説明文のみ表示（タイトルは上部に表示） */}
                              {item.description && (
                                <div className="absolute bottom-0 left-0 right-0 p-2" style={{ zIndex: 2 }}>
                                  <p
                                    className="text-xs font-medium truncate"
                                    style={{
                                      color: colors.text,
                                      textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                                        ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                                        : '0 1px 2px rgba(255, 255, 255, 0.5)'
                                    }}
                                  >
                                    {item.description}
                                  </p>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                ) : null;
              })}
            </div>
          </div>
          ) : null;
        })()}
        </div>
      </div>

      {/* 画像・動画・テキスト詳細表示モーダル（詳細ページスタイル） */}
      {(selectedImage || selectedImageBlock) && (
        <div 
          className="fixed inset-0 z-50 flex flex-col overflow-y-auto"
          style={{ backgroundColor: colors.background }}
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
            className="fixed top-4 right-4 z-10 hover:opacity-80 transition"
            style={{ color: colors.text }}
          >
            <X className="w-8 h-8" />
          </button>
          
          {/* 画像の場合 */}
          {selectedImage && selectedImageBlock?.type === 'image' && (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              {/* 画像（上左右隙間なし） */}
              <img 
                src={selectedImage} 
                alt={selectedImageBlock?.title || '拡大表示'}
                className="w-full object-cover"
                style={{ maxHeight: '60vh', objectFit: 'cover' }}
              />
              {/* タイトルと説明文（設定カラーに準ずる） */}
              <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                {selectedImageBlock?.title && (
                  <h3 
                    className="text-xl font-bold mb-3"
                    style={{ color: colors.text }}
                  >
                    {selectedImageBlock.title}
                  </h3>
                )}
                {selectedImageBlock?.description && (
                  <p 
                    className="text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ color: colors.text, opacity: 0.9 }}
                  >
                    {selectedImageBlock.description}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* 動画の場合 */}
          {selectedImage && selectedImageBlock?.type === 'video' && (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              {/* 動画（上左右隙間なし） */}
              <video 
                src={selectedImage} 
                controls
                autoPlay
                className="w-full"
                style={{ maxHeight: '60vh', objectFit: 'contain' }}
              >
                お使いのブラウザは動画タグをサポートしていません。
              </video>
              {/* タイトルと説明文（設定カラーに準ずる） */}
              <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                {selectedImageBlock?.title && (
                  <h3 
                    className="text-xl font-bold mb-3"
                    style={{ color: colors.text }}
                  >
                    {selectedImageBlock.title}
                  </h3>
                )}
                {selectedImageBlock?.description && (
                  <p 
                    className="text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ color: colors.text, opacity: 0.9 }}
                  >
                    {selectedImageBlock.description}
                  </p>
                )}
              </div>
            </div>
          )}
          
          {/* テキストブロックの場合 */}
          {selectedImageBlock?.type === 'text' && (
            <div className="w-full" onClick={(e) => e.stopPropagation()}>
              {/* サムネイル画像がある場合（上左右隙間なし） */}
              {selectedImageBlock.thumbnailUrl && (
                <img 
                  src={selectedImageBlock.thumbnailUrl} 
                  alt={selectedImageBlock?.title || 'テキスト'}
                  className="w-full object-cover"
                  style={{ maxHeight: '60vh', objectFit: 'cover' }}
                />
              )}
              {/* タイトルと説明文（設定カラーに準ずる） */}
              <div className="max-w-2xl mx-auto px-4 sm:px-6 md:px-8 py-6">
                {selectedImageBlock?.title && (
                  <h3 
                    className="text-xl font-bold mb-3"
                    style={{ color: colors.text }}
                  >
                    {selectedImageBlock.title}
                  </h3>
                )}
                {selectedImageBlock?.description && (
                  <p 
                    className="text-sm whitespace-pre-wrap leading-relaxed"
                    style={{ color: colors.text, opacity: 0.9 }}
                  >
                    {selectedImageBlock.description}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* アルバム横スライド表示モーダル（詳細ページスタイル） */}
      {selectedAlbum && selectedAlbum.albumItems && (
        <div 
          className="fixed inset-0 z-50 flex flex-col overflow-hidden"
          style={{ backgroundColor: colors.background }}
          onClick={() => {
            setSelectedAlbum(null);
            setSelectedAlbumIndex(0);
          }}
        >
          {/* タイトル（固定表示、写真のすぐ上に重ねて配置、左寄せ） */}
          {selectedAlbum.title && (
            <div 
              data-album-title
              className="fixed z-20 max-w-2xl px-4 sm:px-6 md:px-8"
              style={{ 
                top: '0',
                left: '0',
                right: '0',
                color: colors.text,
                textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                  ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                  : '0 1px 2px rgba(255, 255, 255, 0.5)'
              }}
            >
              <h2 
                className="text-xl font-bold text-left"
                style={{ color: colors.text }}
              >
                {selectedAlbum.title}
              </h2>
            </div>
          )}

          <button
            onClick={() => {
              setSelectedAlbum(null);
              setSelectedAlbumIndex(0);
            }}
            className="fixed top-4 right-4 z-30 hover:opacity-80 transition"
            style={{ color: colors.text }}
          >
            <X className="w-8 h-8" />
          </button>

          {/* 横スライド可能なコンテンツエリア */}
          <div 
            ref={(el) => {
              if (el && selectedAlbum && selectedAlbum.albumItems) {
                let isDragging = false;
                let startX = 0;
                let scrollLeft = 0;
                
                // スクロール位置を追跡
                const handleScroll = () => {
                  const currentScrollLeft = el.scrollLeft;
                  const itemWidth = el.clientWidth;
                  const currentIndex = Math.round(currentScrollLeft / itemWidth);
                  if (currentIndex !== selectedAlbumIndex && currentIndex >= 0 && currentIndex < selectedAlbum.albumItems!.length) {
                    setSelectedAlbumIndex(currentIndex);
                  }
                };
                el.addEventListener('scroll', handleScroll);
                
                // PCでのマウスホイール横スクロール対応
                const handleWheel = (e: WheelEvent) => {
                  e.preventDefault();
                  // 縦スクロールを横スクロールに変換
                  el.scrollLeft += e.deltaY;
                };
                el.addEventListener('wheel', handleWheel, { passive: false });
                
                // ドラッグでのスクロール
                const handleMouseDown = (e: MouseEvent) => {
                  isDragging = true;
                  startX = e.pageX - el.offsetLeft;
                  scrollLeft = el.scrollLeft;
                  el.style.cursor = 'grabbing';
                  el.style.userSelect = 'none';
                };
                
                const handleMouseMove = (e: MouseEvent) => {
                  if (!isDragging) return;
                  e.preventDefault();
                  const x = e.pageX - el.offsetLeft;
                  const walk = (x - startX) * 2; // スクロール速度を調整
                  el.scrollLeft = scrollLeft - walk;
                };
                
                const handleMouseUp = () => {
                  isDragging = false;
                  el.style.cursor = 'grab';
                  el.style.userSelect = '';
                };
                
                const handleMouseLeave = () => {
                  isDragging = false;
                  el.style.cursor = 'grab';
                  el.style.userSelect = '';
                };
                
                el.addEventListener('mousedown', handleMouseDown);
                el.addEventListener('mousemove', handleMouseMove);
                el.addEventListener('mouseup', handleMouseUp);
                el.addEventListener('mouseleave', handleMouseLeave);
                el.style.cursor = 'grab';
                
                // キーボードナビゲーション（矢印キー）
                const handleKeyDown = (e: KeyboardEvent) => {
                  if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                    e.preventDefault();
                    e.stopPropagation();
                    const itemWidth = el.clientWidth;
                    if (e.key === 'ArrowLeft') {
                      const prevIndex = Math.max(0, selectedAlbumIndex - 1);
                      setSelectedAlbumIndex(prevIndex);
                      el.scrollTo({
                        left: itemWidth * prevIndex,
                        behavior: 'smooth'
                      });
                    } else if (e.key === 'ArrowRight') {
                      const nextIndex = Math.min(selectedAlbum.albumItems!.length - 1, selectedAlbumIndex + 1);
                      setSelectedAlbumIndex(nextIndex);
                      el.scrollTo({
                        left: itemWidth * nextIndex,
                        behavior: 'smooth'
                      });
                    }
                  }
                };
                window.addEventListener('keydown', handleKeyDown);
                
                // 初期位置にスクロール
                if (selectedAlbumIndex > 0) {
                  setTimeout(() => {
                    el.scrollTo({
                      left: el.clientWidth * selectedAlbumIndex,
                      behavior: 'smooth'
                    });
                  }, 100);
                }
                // クリーンアップ関数を返す
                return () => {
                  el.removeEventListener('scroll', handleScroll);
                  el.removeEventListener('wheel', handleWheel);
                  el.removeEventListener('mousedown', handleMouseDown);
                  el.removeEventListener('mousemove', handleMouseMove);
                  el.removeEventListener('mouseup', handleMouseUp);
                  el.removeEventListener('mouseleave', handleMouseLeave);
                  window.removeEventListener('keydown', handleKeyDown);
                };
              }
            }}
            className="flex-1 overflow-x-auto overflow-y-hidden snap-x snap-mandatory"
            style={{ 
              scrollBehavior: 'smooth',
              WebkitOverflowScrolling: 'touch',
              cursor: 'grab',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex h-full">
              {selectedAlbum.albumItems.map((item, index) => (
                <div 
                  key={item.id} 
                  className="flex-shrink-0 w-full h-full flex flex-col snap-center relative"
                  style={{ 
                    minWidth: '100vw',
                    width: '100vw',
                    height: '100vh',
                  }}
                >
                  {/* 背景画像（画面いっぱい、ワイド基準） */}
                  <div 
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      width: '100vw',
                      height: '100vh',
                    }}
                  >
                    <img
                      ref={(imgEl) => {
                        if (imgEl) {
                          // 画像の読み込み完了後、タイトルと説明文の位置を調整
                          const updatePositions = () => {
                            const container = imgEl.parentElement;
                            if (container) {
                              const imgRect = imgEl.getBoundingClientRect();
                              const containerRect = container.getBoundingClientRect();
                              const imgTop = imgRect.top - containerRect.top;
                              const imgBottom = imgRect.bottom - containerRect.top;
                              
                              // タイトルと説明文の位置を画像の上端/下端に合わせる
                              const titleElement = document.querySelector(`[data-album-title]`) as HTMLElement;
                              const descElement = container.parentElement?.querySelector(`[data-album-desc-${index}]`) as HTMLElement;
                              
                              if (titleElement) {
                                titleElement.style.top = `${imgTop - titleElement.offsetHeight - 4}px`; // 画像の上端から4px上
                              }
                              if (descElement) {
                                descElement.style.bottom = `${containerRect.height - imgBottom}px`; // 画像の下端に直接配置
                              }
                            }
                          };
                          
                          if (imgEl.complete) {
                            updatePositions();
                          } else {
                            imgEl.onload = updatePositions;
                          }
                        }
                      }}
                      src={item.url}
                      alt={item.description || 'Album item'}
                      className="w-full h-auto"
                      style={{
                        maxHeight: '100vh',
                        objectFit: 'contain',
                      }}
                    />
                  </div>
                  
                  {/* 説明文（写真のすぐ下に重ねて配置、左寄せ） */}
                  {item.description && (
                    <div 
                      data-album-desc={index}
                      className="absolute z-10 max-w-2xl px-4 sm:px-6 md:px-8"
                      style={{ 
                        bottom: '0',
                        left: '0',
                        right: '0',
                      }}
                    >
                      <p 
                        className="text-sm whitespace-pre-wrap leading-relaxed text-left"
                        style={{ 
                          color: colors.text,
                          opacity: 0.9,
                          textShadow: colors.text === '#ffffff' || colors.text === '#fff' || colors.text.toLowerCase() === 'white'
                            ? '0 1px 2px rgba(0, 0, 0, 0.5)'
                            : '0 1px 2px rgba(255, 255, 255, 0.5)'
                        }}
                      >
                        {item.description}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ナビゲーションドット */}
          {selectedAlbum.albumItems.length > 1 && (
            <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-10 flex gap-2">
              {selectedAlbum.albumItems.map((_, index) => (
                <button
                  key={index}
                  onClick={(e) => {
                    e.stopPropagation();
                    const container = e.currentTarget.closest('.overflow-x-auto') as HTMLElement;
                    if (container) {
                      const itemWidth = container.clientWidth;
                      container.scrollTo({
                        left: itemWidth * index,
                        behavior: 'smooth'
                      });
                      setSelectedAlbumIndex(index);
                    }
                  }}
                  className="w-2 h-2 rounded-full transition-all"
                  style={{
                    backgroundColor: index === selectedAlbumIndex ? colors.accent : `${colors.text}40`,
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


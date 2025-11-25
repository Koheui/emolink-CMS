'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Camera, ArrowRight, Type } from 'lucide-react';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

export default function HomePage() {
  const { isAuthenticated, loading, currentUser } = useSecretKeyAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('大切な想い出をいつまでも');
  const [subtitle, setSubtitle] = useState('一度きりの想い出を残してください');
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingSubtitle, setEditingSubtitle] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showFontSizeControls, setShowFontSizeControls] = useState(false);
  const [titleFontSize, setTitleFontSize] = useState(48); // px
  const [subtitleFontSize, setSubtitleFontSize] = useState(18); // px

  // テキスト位置の状態
  const [titlePosition, setTitlePosition] = useState({ x: 0, y: 0 });
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 0 });
  const [buttonPosition, setButtonPosition] = useState({ x: 0, y: 0 });

  // ドラッグ状態
  const [dragging, setDragging] = useState<'title' | 'subtitle' | 'button' | null>(null);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const elementStartPos = useRef({ x: 0, y: 0 });

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      const storageRef = ref(storage, `landing/${currentUser?.uid || 'default'}/background_${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      setBackgroundImage(downloadURL);
    } catch (err: any) {
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleGo = () => {
    if (isAuthenticated) {
      // 既存メモリの編集のみ許可（新規作成はLP経由のみ）
      // 既存メモリがある場合は一覧を表示するため、/memories/createに遷移
      // ただし、新規作成はLP経由（/claim経由）でのみ可能
      router.push('/memories/create');
    } else {
      router.push('/auth');
    }
  };

  // ドラッグ開始
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent, type: 'title' | 'subtitle' | 'button') => {
    e.preventDefault();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    dragStartPos.current = { x: clientX, y: clientY };
    elementStartPos.current = type === 'title' ? titlePosition : type === 'subtitle' ? subtitlePosition : buttonPosition;
    setDragging(type);
  };

  // ドラッグ中
  const handleDrag = (e: React.TouchEvent | React.MouseEvent) => {
    if (!dragging) return;
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    const deltaX = clientX - dragStartPos.current.x;
    const deltaY = clientY - dragStartPos.current.y;

    const newPos = {
      x: elementStartPos.current.x + deltaX,
      y: elementStartPos.current.y + deltaY,
    };

    if (dragging === 'title') {
      setTitlePosition(newPos);
    } else if (dragging === 'subtitle') {
      setSubtitlePosition(newPos);
    } else if (dragging === 'button') {
      setButtonPosition(newPos);
    }
  };

  // ドラッグ終了
  const handleDragEnd = () => {
    setDragging(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-600 to-cyan-600">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div 
      className="relative min-h-screen overflow-hidden"
      onMouseMove={handleDrag}
      onMouseUp={handleDragEnd}
      onTouchMove={handleDrag}
      onTouchEnd={handleDragEnd}
    >
      {/* 背景画像 - 全画面表示 */}
      <div className="absolute inset-0 z-0">
        {backgroundImage ? (
          <img 
            src={backgroundImage} 
            alt="Background" 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-teal-500 via-cyan-500 to-blue-600" />
        )}
        {/* 薄いオーバーレイ */}
        <div className="absolute inset-0 bg-black/20" />
      </div>

      {/* 背景画像アップロードボタン */}
      <label className="absolute top-4 right-4 bg-white/90 hover:bg-white rounded-full p-3 cursor-pointer shadow-lg z-20 transition-all">
        <Camera className="w-5 h-5 text-gray-700" />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleImageUpload(file);
          }}
          className="hidden"
        />
      </label>

      {/* フォントサイズ調整ボタン */}
      <button
        onClick={() => setShowFontSizeControls(!showFontSizeControls)}
        className="absolute top-4 right-20 bg-white/90 hover:bg-white rounded-full p-3 cursor-pointer shadow-lg z-20 transition-all"
      >
        <Type className="w-5 h-5 text-gray-700" />
      </button>

      {/* フォントサイズ調整パネル */}
      {showFontSizeControls && (
        <div className="absolute top-20 right-4 bg-white rounded-2xl shadow-2xl p-6 z-30 min-w-[280px]">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">フォントサイズ調整</h3>
          
          {/* タイトルサイズ */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">タイトル</span>
              <span className="text-xs font-mono text-blue-600 font-semibold">{titleFontSize}px</span>
            </div>
            <input
              type="range"
              min="24"
              max="120"
              value={titleFontSize}
              onChange={(e) => setTitleFontSize(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((titleFontSize - 24) / (120 - 24)) * 100}%, #e5e7eb ${((titleFontSize - 24) / (120 - 24)) * 100}%, #e5e7eb 100%)`
              }}
            />
            <style jsx>{`
              input[type="range"]::-webkit-slider-thumb {
                appearance: none;
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              }
              input[type="range"]::-moz-range-thumb {
                width: 20px;
                height: 20px;
                border-radius: 50%;
                background: #3b82f6;
                cursor: pointer;
                border: none;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
              }
            `}</style>
          </div>

          {/* サブタイトルサイズ */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-gray-600">サブタイトル</span>
              <span className="text-xs font-mono text-blue-600 font-semibold">{subtitleFontSize}px</span>
            </div>
            <input
              type="range"
              min="12"
              max="32"
              value={subtitleFontSize}
              onChange={(e) => setSubtitleFontSize(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((subtitleFontSize - 12) / (32 - 12)) * 100}%, #e5e7eb ${((subtitleFontSize - 12) / (32 - 12)) * 100}%, #e5e7eb 100%)`
              }}
            />
          </div>

          {/* 閉じるボタン */}
          <Button
            onClick={() => setShowFontSizeControls(false)}
            variant="outline"
            className="w-full mt-2"
            size="sm"
          >
            閉じる
          </Button>
        </div>
      )}

      {/* コンテンツ - 中央配置 */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-12 text-center">
        {/* タイトル - 写真の上に直接オーバーレイ */}
        <div 
          className="mb-4 relative"
          style={{
            transform: `translate(${titlePosition.x}px, ${titlePosition.y}px)`,
            transition: dragging === 'title' ? 'none' : 'transform 0.1s ease-out'
          }}
          onMouseDown={(e) => handleDragStart(e, 'title')}
          onTouchStart={(e) => handleDragStart(e, 'title')}
        >
          {editingTitle ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={() => setEditingTitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingTitle(false);
                }
              }}
              className="font-bold text-white text-center bg-transparent border-white/50 backdrop-blur-sm"
              autoFocus
              style={{ 
                fontSize: `${titleFontSize}px`,
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                cursor: 'text'
              }}
            />
          ) : (
            <h1 
              className="font-bold text-white drop-shadow-lg cursor-move hover:opacity-90 transition-opacity px-4 select-none"
              onClick={() => setEditingTitle(true)}
              style={{ 
                fontSize: `${titleFontSize}px`,
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)' 
              }}
            >
              {title}
            </h1>
          )}
        </div>

        {/* サブタイトル */}
        <div 
          className="mb-8 max-w-2xl relative"
          style={{
            transform: `translate(${subtitlePosition.x}px, ${subtitlePosition.y}px)`,
            transition: dragging === 'subtitle' ? 'none' : 'transform 0.1s ease-out'
          }}
          onMouseDown={(e) => handleDragStart(e, 'subtitle')}
          onTouchStart={(e) => handleDragStart(e, 'subtitle')}
        >
          {editingSubtitle ? (
            <Input
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              onBlur={() => setEditingSubtitle(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setEditingSubtitle(false);
                }
              }}
              className="text-white text-center bg-transparent border-white/50 backdrop-blur-sm"
              autoFocus
              style={{ 
                fontSize: `${subtitleFontSize}px`,
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
                cursor: 'text'
              }}
            />
          ) : (
            <p 
              className="text-white drop-shadow-md cursor-move hover:opacity-90 transition-opacity px-4 select-none"
              onClick={() => setEditingSubtitle(true)}
              style={{ 
                fontSize: `${subtitleFontSize}px`,
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)' 
              }}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Goボタン - 移動可能 */}
        <div 
          className="absolute bottom-12"
          style={{
            transform: `translate(${buttonPosition.x}px, ${buttonPosition.y}px)`,
            transition: dragging === 'button' ? 'none' : 'transform 0.1s ease-out'
          }}
          onMouseDown={(e) => {
            e.preventDefault();
            handleDragStart(e, 'button');
          }}
          onTouchStart={(e) => {
            e.preventDefault();
            handleDragStart(e, 'button');
          }}
        >
          <Button
            onClick={handleGo}
            size="lg"
            className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-6 py-6 rounded-full shadow-2xl hover:shadow-3xl transition-all transform hover:scale-105 cursor-move"
          >
            <ArrowRight className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* アップロード中インジケーター */}
      {uploading && (
        <div className="fixed top-4 left-4 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-30">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
          <span className="text-sm">アップロード中...</span>
        </div>
      )}

      {/* バージョン情報 */}
      <div className="absolute bottom-4 left-4 z-10">
        <p className="text-white/40 text-xs drop-shadow-md">v.1.0.0</p>
      </div>
    </div>
  );
}

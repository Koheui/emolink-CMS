'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  ArrowLeft, 
  Edit, 
  Save, 
  Plus, 
  GripVertical, 
  Image, 
  Video, 
  Link, 
  Trash2,
  Eye,
  Smartphone
} from 'lucide-react';
import AlbumEditor from './album-editor';
import TextEditor from './text-editor';
import { FileUpload } from './file-upload';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';

interface ContentBlock {
  id: string;
  type: 'text' | 'image' | 'video' | 'link' | 'album';
  content: string;
  title?: string;
  description?: string;
  order: number;
  metadata?: any;
  items?: Array<{
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    title?: string;
    description?: string;
  }>;
}

interface MemoryEditorProps {
  claimInfo: any;
  onSave: (memoryData: any) => void;
  onBack: () => void;
}

export default function MemoryEditor({ claimInfo, onSave, onBack }: MemoryEditorProps) {
  const { user, loading } = useAuth();
  const router = useRouter();
  
  const [title, setTitle] = useState('岡 浩平');
  const [description, setDescription] = useState('FutureStudio株式会社 代表取緄役');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [contentBlocks, setContentBlocks] = useState<ContentBlock[]>([]);
  const [editingBlock, setEditingBlock] = useState<string | null>(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showAlbumEditor, setShowAlbumEditor] = useState(false);
  const [showTextEditor, setShowTextEditor] = useState(false);
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [showCoverUpload, setShowCoverUpload] = useState(false);
  const [showVideoUpload, setShowVideoUpload] = useState(false);
  const [showColorEditor, setShowColorEditor] = useState(false);
  const [backgroundColor, setBackgroundColor] = useState('#1e3a8a');
  const [secondaryColor, setSecondaryColor] = useState('#0ea5e9');
  const [textColor, setTextColor] = useState('#ffffff');

  // 認証状態をチェック
  useEffect(() => {
    if (!loading && !user) {
      // 本番環境では認証ページにリダイレクト
      if (process.env.NODE_ENV === 'production') {
        router.push('/auth');
      } else {
        // 開発環境ではテスト登録ページにリダイレクト
        router.push('/test-registration');
      }
    }
  }, [user, loading, router]);

  // デバッグ用：プレビューモードの状態をログ出力
  useEffect(() => {
    console.log('Preview mode changed:', isPreviewMode);
  }, [isPreviewMode]);

  const handleSave = async () => {
    try {
      const memoryData = {
        title,
        description,
        coverImage,
        contentBlocks,
        backgroundColor,
        secondaryColor,
        textColor,
        claimInfo
      };
      
      // Firestoreに保存
      const { createMemory } = await import('@/lib/firestore');
      const memoryId = await createMemory({
        ownerUid: user?.uid || 'temp',
        tenant: claimInfo.tenant,
        title: title || '新しい想い出',
        type: 'personal',
        status: 'draft',
        description: description,
        design: {
          theme: 'custom',
          layout: 'standard',
          colors: {
            primary: backgroundColor,
            secondary: secondaryColor,
            background: backgroundColor,
          },
        },
        blocks: contentBlocks.map(block => ({
          id: block.id,
          type: block.type,
          content: block.content,
          order: block.order,
          visibility: 'public' as const,
          createdAt: new Date(),
          updatedAt: new Date(),
        })),
        metadata: {
          source: 'lp-form',
          lpId: claimInfo.lpId,
          productType: claimInfo.productType,
          coverImage,
          backgroundColor,
          secondaryColor,
          textColor,
        },
      });
      
      console.log('Memory saved with ID:', memoryId);
      onSave(memoryData);
    } catch (error) {
      console.error('Save error:', error);
      alert('保存に失敗しました');
    }
  };

  const addContentBlock = (type: 'text' | 'image' | 'video' | 'link' | 'album') => {
    const newBlock: ContentBlock = {
      id: Date.now().toString(),
      type,
      content: '',
      order: contentBlocks.length + 1,
      metadata: {},
      items: type === 'album' ? [] : undefined
    };
    setContentBlocks([...contentBlocks, newBlock]);
    
    if (type === 'album') {
      setEditingAlbumId(newBlock.id);
      setShowAlbumEditor(true);
    } else if (type === 'text') {
      setEditingTextId(newBlock.id);
      setShowTextEditor(true);
    } else if (type === 'video') {
      // 動画アップロード用のモーダルを表示
      setEditingBlock(newBlock.id);
      setShowVideoUpload(true);
    } else {
      setEditingBlock(newBlock.id);
    }
  };

  const updateContentBlock = (id: string, updates: Partial<ContentBlock>) => {
    setContentBlocks(blocks => 
      blocks.map(block => 
        block.id === id ? { ...block, ...updates } : block
      )
    );
  };

  const deleteContentBlock = (id: string) => {
    setContentBlocks(blocks => blocks.filter(block => block.id !== id));
    setEditingBlock(null);
  };

  const moveBlock = (id: string, direction: 'up' | 'down') => {
    const blocks = [...contentBlocks];
    const index = blocks.findIndex(block => block.id === id);
    
    if (direction === 'up' && index > 0) {
      [blocks[index], blocks[index - 1]] = [blocks[index - 1], blocks[index]];
    } else if (direction === 'down' && index < blocks.length - 1) {
      [blocks[index], blocks[index + 1]] = [blocks[index + 1], blocks[index]];
    }
    
    setContentBlocks(blocks);
  };

  const getBlockIcon = (type: string) => {
    switch (type) {
      case 'text': return <Edit className="w-4 h-4" />;
      case 'image': return <Image className="w-4 h-4" />;
      case 'video': return <Video className="w-4 h-4" />;
      case 'link': return <Link className="w-4 h-4" />;
      case 'album': return <Image className="w-4 h-4" />;
      default: return <Edit className="w-4 h-4" />;
    }
  };

  const getLinkIcon = (iconType: string) => {
    switch (iconType) {
      case 'drive': return <div className="w-4 h-4 bg-blue-500 rounded"></div>;
      case 'youtube': return <div className="w-4 h-4 bg-red-500 rounded"></div>;
      case 'phone': return <div className="w-4 h-4 bg-green-500 rounded"></div>;
      case 'mail': return <div className="w-4 h-4 bg-gray-500 rounded"></div>;
      case 'twitter': return <div className="w-4 h-4 bg-black rounded"></div>;
      case 'instagram': return <div className="w-4 h-4 bg-gradient-to-r from-purple-500 to-pink-500 rounded"></div>;
      default: return <div className="w-4 h-4 bg-gray-400 rounded"></div>;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 relative">
      {/* スマートフォン幅の背景 */}
      {!isPreviewMode && (
        <div 
          className="fixed inset-0 w-full h-full"
          style={{ 
            background: `linear-gradient(60deg, ${backgroundColor}, ${secondaryColor})` 
          }}
        >
          <div className="w-full h-full flex justify-center">
            <div className="w-full max-w-md h-full"></div>
          </div>
        </div>
      )}
      
      {/* コンテンツ */}
      <div className="relative z-10">
      {/* ヘッダー */}
      <div className={`${isPreviewMode ? 'bg-white text-blue-900' : 'bg-blue-900 text-white'} p-4`}>
        <div className="flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={onBack} 
            className={isPreviewMode 
              ? "text-blue-900 hover:bg-gray-100" 
              : "text-white hover:bg-blue-800"
            }
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            戻る
          </Button>
          <div className="flex items-center space-x-2">
            <Button 
              variant={isPreviewMode ? "default" : "outline"}
              onClick={() => setIsPreviewMode(!isPreviewMode)}
              className={isPreviewMode 
                ? "bg-white text-blue-900 hover:bg-gray-100" 
                : "text-white border-white hover:bg-blue-800"
              }
            >
              <Eye className="w-4 h-4 mr-2" />
              {isPreviewMode ? '編集' : 'プレビュー'}
            </Button>
            <Button onClick={handleSave} className="bg-gradient-to-r from-purple-500 to-pink-500">
              <Save className="w-4 h-4 mr-2" />
              保存
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto min-h-screen">
        {/* プレビューモード */}
        {isPreviewMode ? (
          <div 
            className="min-h-screen"
            style={{ backgroundColor: backgroundColor }}
          >
            {/* カバー写真 */}
            <div className="relative h-48 bg-gradient-to-r from-blue-500 to-teal-500">
              {coverImage ? (
                <img 
                  src={coverImage} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">カバー写真</p>
                  </div>
                </div>
              )}
              {/* プレビューモードでもカバー写真編集ボタンを表示 */}
              <div className="absolute top-2 right-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowCoverUpload(true)}
                  className="bg-white/90 hover:bg-white text-gray-800"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  編集
                </Button>
              </div>
            </div>

            {/* プロフィール情報 */}
            <div 
              className="p-4 text-white relative" 
              style={{ 
                background: `linear-gradient(60deg, ${backgroundColor}, ${secondaryColor})` 
              }}
            >
              <h1 className="text-xl font-bold mb-2">{title}</h1>
              <p className="text-sm opacity-90">{description}</p>
            </div>

            {/* コンテンツブロック */}
            <div className="p-4 space-y-4">
              {contentBlocks.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <p>コンテンツがありません</p>
                  <p className="text-sm">編集モードでコンテンツを追加してください</p>
                </div>
              ) : (
                contentBlocks.map((block) => (
                  <div key={block.id} className="bg-white rounded-lg p-4">
                    {block.type === 'text' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">{block.title || 'テキスト'}</h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{block.content}</p>
                        {block.description && (
                          <p className="text-sm text-gray-500 mt-2">{block.description}</p>
                        )}
                      </div>
                    )}
                    {block.type === 'image' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">{block.title || '画像'}</h3>
                        {block.content ? (
                          <div className="relative">
                            <img 
                              src={block.content} 
                              alt={block.title || '画像'} 
                              className="w-full h-auto rounded-lg object-cover max-h-96"
                            />
                            {block.metadata?.thumbnail && block.metadata.thumbnail !== block.content && (
                              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded">
                                サムネイル
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-100 rounded-lg p-8 text-center">
                            <Image className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500">画像が設定されていません</p>
                          </div>
                        )}
                        {block.description && (
                          <p className="text-sm text-gray-500 mt-2">{block.description}</p>
                        )}
                      </div>
                    )}
                    {block.type === 'video' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">{block.title || '動画'}</h3>
                        {block.content ? (
                          <div className="relative">
                            {block.metadata?.thumbnail ? (
                              <div className="relative">
                                <img 
                                  src={block.metadata.thumbnail} 
                                  alt={block.title || '動画サムネイル'} 
                                  className="w-full h-auto rounded-lg object-cover max-h-96"
                                />
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="bg-black/50 rounded-full p-3">
                                    <Video className="w-8 h-8 text-white" />
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-gray-100 rounded-lg p-8 text-center">
                                <Video className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                                <p className="text-gray-500">動画サムネイルなし</p>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-100 rounded-lg p-8 text-center">
                            <Video className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500">動画が設定されていません</p>
                          </div>
                        )}
                        {block.description && (
                          <p className="text-sm text-gray-500 mt-2">{block.description}</p>
                        )}
                      </div>
                    )}
                    {block.type === 'album' && (
                      <div>
                        <h3 className="font-medium text-gray-900 mb-2">{block.title || 'アルバム'}</h3>
                        {block.items && block.items.length > 0 ? (
                          <div className="relative">
                            {/* アルバムスライド表示 */}
                            <div className="flex overflow-x-auto gap-2 pb-2 scrollbar-hide">
                              {block.items.map((item, index) => (
                                <div 
                                  key={item.id || index}
                                  className="flex-shrink-0 relative"
                                  style={{ 
                                    width: '120px', 
                                    height: '120px',
                                    marginRight: index === (block.items?.length || 0) - 1 ? '60px' : '0'
                                  }}
                                >
                                  <img 
                                    src={item.url || item.thumbnail} 
                                    alt={item.title || `写真 ${index + 1}`}
                                    className="w-full h-full object-cover rounded-lg"
                                  />
                                  {item.type === 'video' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                      <div className="bg-black/50 rounded-full p-2">
                                        <Video className="w-4 h-4 text-white" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                            
                            {/* 写真数表示 */}
                            <div className="mt-2 text-center">
                              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                                {block.items.length}枚の写真
                              </span>
                            </div>
                            
                            {/* スライドインジケーター */}
                            {block.items.length > 1 && (
                              <div className="flex justify-center mt-2 space-x-1">
                                {Array.from({ length: Math.min(3, block.items.length) }).map((_, index) => (
                                  <div 
                                    key={index}
                                    className="w-2 h-2 bg-gray-300 rounded-full"
                                  />
                                ))}
                                {block.items.length > 3 && (
                                  <span className="text-xs text-gray-500 ml-1">...</span>
                                )}
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="bg-gray-100 rounded-lg p-8 text-center">
                            <Image className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                            <p className="text-gray-500">アルバムが空です</p>
                          </div>
                        )}
                        {block.description && (
                          <p className="text-sm text-gray-500 mt-2">{block.description}</p>
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            {/* 編集モード */}
            {/* カバー写真 */}
            <div 
              className="relative h-48 bg-gradient-to-r from-blue-500 to-teal-500 cursor-pointer"
              onClick={() => setShowCoverUpload(true)}
            >
              {coverImage ? (
                <img 
                  src={coverImage} 
                  alt="Cover" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center text-white">
                    <Image className="w-12 h-12 mx-auto mb-2 opacity-50" />
                    <p className="text-sm opacity-75">カバー写真をアップロード</p>
                  </div>
                </div>
              )}
            </div>

        {/* プロフィール情報 */}
        <div className="p-4 text-white">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-medium">プロフィール情報</h2>
            <Button 
              size="sm" 
              variant="outline" 
              className="text-white border-white/30 hover:bg-white/20"
              onClick={() => setShowColorEditor(true)}
            >
              <Edit className="w-4 h-4 mr-1" />
              色を変更
            </Button>
          </div>
          {editingBlock === 'title' ? (
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="text-xl font-bold bg-transparent border-white text-white placeholder-white/70"
              placeholder="名前を入力"
              onBlur={() => setEditingBlock(null)}
              autoFocus
            />
          ) : (
            <h1 
              className="text-xl font-bold cursor-pointer hover:bg-blue-800 p-2 rounded"
              onClick={() => setEditingBlock('title')}
            >
              {title}
            </h1>
          )}
          
          {editingBlock === 'description' ? (
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="text-sm bg-transparent border-white text-white placeholder-white/70 mt-2"
              placeholder="説明を入力"
              onBlur={() => setEditingBlock(null)}
              autoFocus
            />
          ) : (
            <p 
              className="text-sm mt-2 cursor-pointer hover:bg-blue-800 p-2 rounded border border-dashed border-white/30"
              onClick={() => setEditingBlock('description')}
            >
              {description}
            </p>
          )}
        </div>

        {/* コンテンツブロック */}
        <div className="p-4">
          <h3 className="text-white mb-4">公開中のMyリンク</h3>
          
          {contentBlocks.map((block, index) => (
            <div key={block.id} className="mb-3">
              {block.type === 'album' ? (
                <div className="text-white p-3 rounded-lg border border-white/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getBlockIcon(block.type)}
                      <span className="ml-3">{block.title || 'アルバム'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'up')}
                        disabled={index === 0}
                        className="text-white hover:bg-teal-600"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'down')}
                        disabled={index === contentBlocks.length - 1}
                        className="text-white hover:bg-teal-600"
                      >
                        ↓
                      </Button>
                      <GripVertical className="w-4 h-4 text-white/70" />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteContentBlock(block.id)}
                        className="text-white hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  {/* アルバムサムネイル表示 */}
                  <div className="flex space-x-2 overflow-x-auto">
                    {block.items?.map((item, itemIndex) => (
                      <div key={item.id} className="flex-shrink-0">
                        <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden">
                          {item.thumbnail ? (
                            <img 
                              src={item.thumbnail} 
                              alt={item.title || 'Media'} 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              {item.type === 'image' ? (
                                <Image className="w-6 h-6 text-gray-400" />
                              ) : (
                                <Video className="w-6 h-6 text-gray-400" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                    <div className="flex-shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-20 h-20 border-white/30 text-white hover:bg-white/20"
                      >
                        <Plus className="w-6 h-6" />
                      </Button>
                    </div>
                  </div>
                </div>
              ) : block.type === 'video' ? (
                <div className="text-white p-3 rounded-lg border border-white/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getBlockIcon(block.type)}
                      <span className="ml-3">動画</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'up')}
                        disabled={index === 0}
                        className="text-white hover:bg-teal-600"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'down')}
                        disabled={index === contentBlocks.length - 1}
                        className="text-white hover:bg-teal-600"
                      >
                        ↓
                      </Button>
                      <GripVertical className="w-4 h-4 text-white/70" />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteContentBlock(block.id)}
                        className="text-white hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  {block.content ? (
                    <div className="w-full h-32 bg-gray-200 rounded-lg overflow-hidden">
                      <video 
                        src={block.content} 
                        className="w-full h-full object-cover"
                        controls
                      />
                    </div>
                  ) : (
                    <div className="w-full h-32 bg-gray-200 rounded-lg flex items-center justify-center">
                      <Video className="w-8 h-8 text-gray-400" />
                    </div>
                  )}
                </div>
              ) : block.type === 'text' ? (
                <div className="text-white p-3 rounded-lg border border-white/20">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      {getBlockIcon(block.type)}
                      <span className="ml-3">{block.title || 'テキスト'}</span>
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'up')}
                        disabled={index === 0}
                        className="text-white hover:bg-teal-600"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => moveBlock(block.id, 'down')}
                        disabled={index === contentBlocks.length - 1}
                        className="text-white hover:bg-teal-600"
                      >
                        ↓
                      </Button>
                      <GripVertical className="w-4 h-4 text-white/70" />
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteContentBlock(block.id)}
                        className="text-white hover:bg-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="text-sm text-white/80">
                    <p className="truncate">{block.title || 'テキスト'}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center text-white p-3 rounded-lg border border-white/20">
                  <div className="flex items-center flex-1">
                    {getLinkIcon(block.metadata?.icon || 'default')}
                    <span className="ml-3">{block.content}</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveBlock(block.id, 'up')}
                      disabled={index === 0}
                      className="text-white hover:bg-teal-600"
                    >
                      ↑
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => moveBlock(block.id, 'down')}
                      disabled={index === contentBlocks.length - 1}
                      className="text-white hover:bg-teal-600"
                    >
                      ↓
                    </Button>
                    <GripVertical className="w-4 h-4 text-white/70" />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteContentBlock(block.id)}
                      className="text-white hover:bg-red-600"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* ブロック追加ボタン */}
          <div className="grid grid-cols-2 gap-2 mt-4">
            <Button 
              variant="outline" 
              onClick={() => addContentBlock('text')}
              className="flex items-center justify-center"
            >
              <Edit className="w-4 h-4 mr-2" />
              テキスト
            </Button>
            <Button 
              variant="outline" 
              onClick={() => addContentBlock('album')}
              className="flex items-center justify-center"
            >
              <Image className="w-4 h-4 mr-2" />
              アルバム
            </Button>
            <Button 
              variant="outline" 
              onClick={() => addContentBlock('video')}
              className="flex items-center justify-center"
            >
              <Video className="w-4 h-4 mr-2" />
              動画
            </Button>
            <Button 
              variant="outline" 
              onClick={() => addContentBlock('link')}
              className="flex items-center justify-center"
            >
              <Link className="w-4 h-4 mr-2" />
              リンク
            </Button>
          </div>
        </div>

            {/* フローティングアクションボタン */}
            <div className="fixed bottom-4 left-4">
              <Button 
                size="lg" 
                className="bg-blue-900 text-white rounded-full w-12 h-12"
              >
                <Smartphone className="w-6 h-6" />
              </Button>
            </div>
          </>
        )}

        {/* モーダル */}
        <AlbumEditor
          isOpen={showAlbumEditor}
          onClose={() => {
            setShowAlbumEditor(false);
            setEditingAlbumId(null);
          }}
          albumTitle={editingAlbumId ? contentBlocks.find(b => b.id === editingAlbumId)?.title || '' : ''}
          albumDescription={editingAlbumId ? contentBlocks.find(b => b.id === editingAlbumId)?.description || '' : ''}
          items={editingAlbumId ? contentBlocks.find(b => b.id === editingAlbumId)?.items || [] : []}
          onSave={(title, description, items) => {
            if (editingAlbumId) {
              updateContentBlock(editingAlbumId, { title, description, items });
            }
          }}
        />

        <TextEditor
          isOpen={showTextEditor}
          onClose={() => {
            setShowTextEditor(false);
            setEditingTextId(null);
          }}
          title={editingTextId ? contentBlocks.find(b => b.id === editingTextId)?.title || '' : ''}
          content={editingTextId ? contentBlocks.find(b => b.id === editingTextId)?.content || '' : ''}
          onSave={(title, content) => {
            if (editingTextId) {
              updateContentBlock(editingTextId, { title, content });
            }
          }}
        />

        {/* カバー写真アップロード */}
        {showCoverUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">カバー写真をアップロード</h3>
              <FileUpload
                memoryId="cover"
                ownerUid="temp"
                onUploadComplete={(asset) => {
                  setCoverImage(asset.url);
                  setShowCoverUpload(false);
                }}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setShowCoverUpload(false)}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 動画アップロード */}
        {showVideoUpload && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold mb-4">動画をアップロード</h3>
              <FileUpload
                memoryId="video"
                ownerUid="temp"
                onUploadComplete={(asset) => {
                  if (editingBlock) {
                    updateContentBlock(editingBlock, { 
                      content: asset.url,
                      metadata: { 
                        type: 'video',
                        url: asset.url,
                        thumbnail: asset.url // 一時的にURLをサムネイルとして使用
                      }
                    });
                  }
                  setShowVideoUpload(false);
                  setEditingBlock(null);
                }}
              />
              <div className="mt-4 flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowVideoUpload(false);
                    setEditingBlock(null);
                  }}
                >
                  キャンセル
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* 色変更エディタ */}
        {showColorEditor && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>色を変更</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="backgroundColor">背景色1</Label>
                  <Input
                    id="backgroundColor"
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secondaryColor">背景色2</Label>
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={secondaryColor}
                    onChange={(e) => setSecondaryColor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="textColor">文字色</Label>
                  <Input
                    id="textColor"
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                  />
                </div>
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setShowColorEditor(false)}>
                    キャンセル
                  </Button>
                  <Button onClick={() => setShowColorEditor(false)}>
                    適用
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { 
  X, 
  Plus, 
  Image, 
  Video, 
  Edit, 
  Trash2,
  Upload
} from 'lucide-react';
import FileUpload from './file-upload-modal';
import BulkPhotoUpload from './bulk-photo-upload';

interface AlbumItem {
  id: string;
  type: 'image' | 'video';
  url: string;
  thumbnail?: string;
  title?: string;
  description?: string;
}

interface AlbumEditorProps {
  isOpen: boolean;
  onClose: () => void;
  albumTitle: string;
  albumDescription: string;
  items: AlbumItem[];
  onSave: (title: string, description: string, items: AlbumItem[]) => void;
}

export default function AlbumEditor({ 
  isOpen, 
  onClose, 
  albumTitle, 
  albumDescription, 
  items, 
  onSave 
}: AlbumEditorProps) {
  const [title, setTitle] = useState(albumTitle);
  const [description, setDescription] = useState(albumDescription);
  const [albumItems, setAlbumItems] = useState<AlbumItem[]>(items);
  const [editingItem, setEditingItem] = useState<string | null>(null);
  const [showFileUpload, setShowFileUpload] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);

  const handleSave = () => {
    onSave(title, description, albumItems);
    onClose();
  };

  const addItem = (type: 'image' | 'video') => {
    const newItem: AlbumItem = {
      id: Date.now().toString(),
      type,
      url: '',
      title: '',
      description: ''
    };
    setAlbumItems([...albumItems, newItem]);
    setUploadingItemId(newItem.id);
    setShowFileUpload(true);
  };

  const handleBulkUploadComplete = (assets: any[]) => {
    const newItems: AlbumItem[] = assets.map(asset => ({
      id: asset.id,
      type: 'image',
      url: asset.url,
      thumbnail: asset.thumbnail || asset.url
    }));
    setAlbumItems([...albumItems, ...newItems]);
    setShowBulkUpload(false);
  };

  const updateItem = (id: string, updates: Partial<AlbumItem>) => {
    setAlbumItems(items => 
      items.map(item => 
        item.id === id ? { ...item, ...updates } : item
      )
    );
  };

  const deleteItem = (id: string) => {
    setAlbumItems(items => items.filter(item => item.id !== id));
    setEditingItem(null);
  };

  const moveItem = (id: string, direction: 'up' | 'down') => {
    const items = [...albumItems];
    const index = items.findIndex(item => item.id === id);
    
    if (direction === 'up' && index > 0) {
      [items[index], items[index - 1]] = [items[index - 1], items[index]];
    } else if (direction === 'down' && index < items.length - 1) {
      [items[index], items[index + 1]] = [items[index + 1], items[index]];
    }
    
    setAlbumItems(items);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>アルバム編集</CardTitle>
            <Button variant="ghost" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* アルバム基本情報 */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="albumTitle">アルバムタイトル</Label>
              <Input
                id="albumTitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="アルバムのタイトルを入力"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="albumDescription">アルバム説明</Label>
              <Textarea
                id="albumDescription"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="アルバムの説明を入力"
                rows={3}
              />
            </div>
          </div>

          {/* アイテム一覧 */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">アイテム ({albumItems.length})</h3>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addItem('image')}
                >
                  <Image className="w-4 h-4 mr-2" />
                  画像追加
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addItem('video')}
                >
                  <Video className="w-4 h-4 mr-2" />
                  動画追加
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowBulkUpload(true)}
                  className="bg-blue-50 border-blue-200 text-blue-700 hover:bg-blue-100"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  複数写真一括アップロード
                </Button>
              </div>
            </div>

            {albumItems.map((item, index) => (
              <div key={item.id} className="border rounded-lg p-4">
                <div className="flex items-start space-x-4">
                  {/* サムネイル */}
                  <div className="w-20 h-20 bg-gray-200 rounded-lg overflow-hidden flex-shrink-0">
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

                  {/* アイテム情報 */}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium">
                        {item.type === 'image' ? '画像' : '動画'}
                      </span>
                      <div className="flex space-x-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveItem(item.id, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => moveItem(item.id, 'down')}
                          disabled={index === albumItems.length - 1}
                        >
                          ↓
                        </Button>
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex items-center"
                        onClick={() => {
                          setUploadingItemId(item.id);
                          setShowFileUpload(true);
                        }}
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        ファイル選択
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteItem(item.id)}
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        削除
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {albumItems.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <Image className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p>まだアイテムがありません</p>
                <p className="text-sm">画像や動画を追加してください</p>
              </div>
            )}
          </div>

          {/* 保存ボタン */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              キャンセル
            </Button>
            <Button onClick={handleSave}>
              保存
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ファイルアップロードモーダル */}
      {showFileUpload && uploadingItemId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
          <FileUpload
            type={albumItems.find(item => item.id === uploadingItemId)?.type || 'image'}
            onUploadComplete={(url, thumbnail) => {
              updateItem(uploadingItemId, { url, thumbnail });
              setShowFileUpload(false);
              setUploadingItemId(null);
            }}
            onCancel={() => {
              setShowFileUpload(false);
              setUploadingItemId(null);
            }}
          />
        </div>
      )}

      {/* 複数写真一括アップロードモーダル */}
      {showBulkUpload && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-60">
          <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <BulkPhotoUpload
              memoryId="album"
              ownerUid="temp"
              onUploadComplete={handleBulkUploadComplete}
              onCancel={() => setShowBulkUpload(false)}
              maxFiles={20}
            />
          </div>
        </div>
      )}
    </div>
  );
}

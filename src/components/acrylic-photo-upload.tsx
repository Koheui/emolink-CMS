'use client';

import React, { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { createAcrylicPhoto } from '@/lib/firestore';
import { uploadFile } from '@/lib/storage';
import { Order, AcrylicPhoto } from '@/types';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

interface AcrylicPhotoUploadProps {
  order: Order;
  onPhotoUploaded: (photo: AcrylicPhoto) => void;
}

export default function AcrylicPhotoUpload({ order, onPhotoUploaded }: AcrylicPhotoUploadProps) {
  const { currentUser } = useSecretKeyAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    size: '10cm' as '6cm' | '10cm' | '14cm',
    description: '',
  });
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // ファイル形式チェック
    if (!file.type.startsWith('image/')) {
      setError('画像ファイルを選択してください。');
      return;
    }

    // ファイルサイズチェック（10MB以下）
    if (file.size > 10 * 1024 * 1024) {
      setError('ファイルサイズは10MB以下にしてください。');
      return;
    }

    setSelectedFile(file);
    setError(null);

    // プレビュー生成
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewUrl(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async () => {
    if (!selectedFile || !currentUser) {
      setError('ファイルを選択してください。');
      return;
    }

    setIsUploading(true);
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    try {
      // 1. ファイルをFirebase Storageにアップロード
      const storagePath = `acrylic-photos/${order.id}/${Date.now()}-${selectedFile.name}`;
      const uploadResult = await uploadFile(selectedFile, storagePath, (progress) => {
        setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
      });

      // 2. 画像のメタデータを取得
      const img = new Image();
      img.onload = async () => {
        try {
          // 3. Firestoreに写真情報を保存
          const photoData = {
            orderId: order.id,
            fileName: selectedFile.name,
            fileSize: selectedFile.size,
            mimeType: selectedFile.type,
            storagePath: storagePath,
            url: uploadResult.url,
            thumbnailUrl: uploadResult.thumbnailUrl,
            size: formData.size,
            description: formData.description,
            status: 'uploaded' as const,
            metadata: {
              width: img.width,
              height: img.height,
              resolution: `${img.width}x${img.height}`,
              quality: (img.width >= 1000 && img.height >= 1000 ? 'high' : 
                      img.width >= 500 && img.height >= 500 ? 'medium' : 'low') as 'high' | 'medium' | 'low'
            }
          };

          const photoId = await createAcrylicPhoto(photoData);
          const photo: AcrylicPhoto = {
            id: photoId,
            ...photoData,
            uploadedAt: new Date(),
          };

          // 4. 注文ステータスを更新（v3.3仕様により、クライアント側からの更新は不要）
          // 注文ステータスの更新はNFC Writerアプリで行われます
          // await updateOrder(order.id, {
          //   orderStatus: 'photo_upload_pending',
          //   acrylicStand: {
          //     size: order.acrylicStand?.size,
          //     photoUploaded: true,
          //     photoUrl: uploadResult.url,
          //     photoUploadedAt: new Date(),
          //     productionStarted: order.acrylicStand?.productionStarted || false,
          //     productionCompleted: order.acrylicStand?.productionCompleted || false,
          //   }
          // });

          setSuccess('写真のアップロードが完了しました。');
          onPhotoUploaded(photo);
          
          // フォームをリセット
          setSelectedFile(null);
          setPreviewUrl(null);
          setFormData({ size: '10cm', description: '' });
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }

        } catch (error) {
          console.error('Photo metadata processing error:', error);
          setError('写真の処理中にエラーが発生しました。');
        }
      };
      img.src = uploadResult.url;

    } catch (error) {
      console.error('Upload error:', error);
      setError('アップロード中にエラーが発生しました。もう一度お試しください。');
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const getQualityBadge = (file: File) => {
    if (!file) return null;
    
    const img = new Image();
    img.onload = () => {
      const quality = img.width >= 1000 && img.height >= 1000 ? 'high' : 
                     img.width >= 500 && img.height >= 500 ? 'medium' : 'low';
      return quality;
    };
    img.src = URL.createObjectURL(file);
  };

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>アクリルスタンド用写真アップロード</CardTitle>
        <CardDescription>
          アクリルスタンド制作用の写真をアップロードしてください。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* ファイル選択 */}
        <div className="space-y-2">
          <Label htmlFor="photo-upload">写真ファイル</Label>
          <Input
            id="photo-upload"
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            ref={fileInputRef}
            className="cursor-pointer"
          />
          <p className="text-sm text-gray-500">
            JPEG、PNG形式、10MB以下、推奨解像度: 1000x1000px以上
          </p>
        </div>

        {/* プレビュー */}
        {previewUrl && (
          <div className="space-y-2">
            <Label>プレビュー</Label>
            <div className="relative">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-full max-w-md h-64 object-cover rounded-lg border"
              />
              {selectedFile && (
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary">
                    {selectedFile.size > 1024 * 1024 
                      ? `${(selectedFile.size / (1024 * 1024)).toFixed(1)}MB`
                      : `${(selectedFile.size / 1024).toFixed(0)}KB`
                    }
                  </Badge>
                </div>
              )}
            </div>
          </div>
        )}

        {/* サイズ選択 */}
        <div className="space-y-2">
          <Label htmlFor="size">アクリルスタンドサイズ</Label>
          <select
            id="size"
            value={formData.size}
            onChange={(e) => setFormData({ ...formData, size: e.target.value as '6cm' | '10cm' | '14cm' })}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="6cm">6cm</option>
            <option value="10cm">10cm</option>
            <option value="14cm">14cm</option>
          </select>
        </div>

        {/* 説明 */}
        <div className="space-y-2">
          <Label htmlFor="description">写真の説明（任意）</Label>
          <Textarea
            id="description"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            placeholder="写真についての説明があれば入力してください"
            rows={3}
          />
        </div>

        {/* エラー・成功メッセージ */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* アップロードボタン */}
        <Button
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
          className="w-full"
        >
          {isUploading ? (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              <span>アップロード中... {uploadProgress}%</span>
            </div>
          ) : (
            '写真をアップロード'
          )}
        </Button>

        {/* アップロード進捗 */}
        {isUploading && (
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${uploadProgress}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

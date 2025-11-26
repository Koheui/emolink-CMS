'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Upload, Image, Video, Music, File, X } from 'lucide-react';
import { uploadImage, uploadVideo, uploadAudio, generateFileName, getFileType } from '@/lib/storage';
import { createAsset } from '@/lib/firestore';
import { Asset } from '@/types';

interface FileUploadProps {
  memoryId: string;
  ownerUid: string; // ユーザーIDを追加
  onUploadComplete: (asset: Asset) => void;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'success' | 'error';
  error?: string;
}

export function FileUpload({ memoryId, ownerUid, onUploadComplete }: FileUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const newUploadingFiles: UploadingFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading' as const,
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);

    for (const uploadingFile of newUploadingFiles) {
      try {
        const fileType = getFileType(uploadingFile.file);
        const fileName = generateFileName(uploadingFile.file.name, fileType);
        
        let uploadResult;
        switch (fileType) {
          case 'image':
            uploadResult = await uploadImage(uploadingFile.file, memoryId, fileName);
            break;
          case 'video':
            uploadResult = await uploadVideo(uploadingFile.file, memoryId, fileName);
            break;
          case 'audio':
            uploadResult = await uploadAudio(uploadingFile.file, memoryId, fileName);
            break;
          default:
            throw new Error('Unsupported file type');
        }

        // AssetをFirestoreに保存
        const asset: Omit<Asset, 'id' | 'createdAt' | 'updatedAt'> = {
          memoryId,
          ownerUid: ownerUid,
          name: uploadingFile.file.name,
          type: fileType,
          storagePath: uploadResult.path,
          url: uploadResult.url,
          size: uploadingFile.file.size,
        };

        const assetId = await createAsset(asset);
        const createdAsset: Asset = {
          id: assetId,
          ...asset,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // 成功状態に更新
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, progress: 100, status: 'success' as const }
              : f
          )
        );

        onUploadComplete(createdAsset);

      } catch (error) {
        console.error('Upload error:', error);
        setUploadingFiles(prev => 
          prev.map(f => 
            f.id === uploadingFile.id 
              ? { ...f, status: 'error' as const, error: error instanceof Error ? error.message : 'Upload failed' }
              : f
          )
        );
      }
    }
  }, [memoryId, ownerUid, onUploadComplete]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp'],
      'video/*': ['.mp4', '.webm', '.ogg'],
      'audio/*': ['.mp3', '.wav', '.ogg'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  });

  const removeUploadingFile = (id: string) => {
    setUploadingFiles(prev => prev.filter(f => f.id !== id));
  };

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image className="w-4 h-4" />;
    if (file.type.startsWith('video/')) return <Video className="w-4 h-4" />;
    if (file.type.startsWith('audio/')) return <Music className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>ファイルアップロード</CardTitle>
          <CardDescription>
            画像、動画、音声ファイルをアップロードできます
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
              isDragActive 
                ? 'border-blue-500 bg-blue-50' 
                : 'border-gray-300 hover:border-gray-400'
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-8 h-8 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600">ファイルをここにドロップしてください</p>
            ) : (
              <div>
                <p className="text-gray-600 mb-2">
                  ファイルをドラッグ&ドロップするか、クリックして選択してください
                </p>
                <p className="text-sm text-gray-500">
                  対応形式: JPEG, PNG, GIF, MP4, MP3 (最大50MB)
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* アップロード中のファイル一覧 */}
      {uploadingFiles.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>アップロード状況</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {uploadingFiles.map((uploadingFile) => (
                <div
                  key={uploadingFile.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getFileIcon(uploadingFile.file)}
                    <div>
                      <p className="font-medium text-sm">{uploadingFile.file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(uploadingFile.file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    {uploadingFile.status === 'uploading' && (
                      <>
                        <div className="w-16 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${uploadingFile.progress}%` }}
                          />
                        </div>
                        <Loader2 className="w-4 h-4 animate-spin" />
                      </>
                    )}
                    
                    {uploadingFile.status === 'success' && (
                      <span className="text-green-600 text-sm">完了</span>
                    )}
                    
                    {uploadingFile.status === 'error' && (
                      <span className="text-red-600 text-sm">{uploadingFile.error}</span>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeUploadingFile(uploadingFile.id)}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

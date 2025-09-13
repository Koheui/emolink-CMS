'use client';

import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Loader2, Upload, Image, X, CheckCircle, AlertCircle } from 'lucide-react';
import { uploadImage, generateFileName } from '@/lib/storage';
import { createAsset } from '@/lib/firestore';
import { Asset } from '@/types';

interface BulkPhotoUploadProps {
  memoryId: string;
  ownerUid: string;
  onUploadComplete: (assets: Asset[]) => void;
  onCancel: () => void;
  maxFiles?: number;
}

interface UploadingFile {
  id: string;
  file: File;
  progress: number;
  status: 'uploading' | 'completed' | 'error';
  error?: string;
  asset?: Asset;
}

export default function BulkPhotoUpload({
  memoryId,
  ownerUid,
  onUploadComplete,
  onCancel,
  maxFiles = 20
}: BulkPhotoUploadProps) {
  const [uploadingFiles, setUploadingFiles] = useState<UploadingFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [completedCount, setCompletedCount] = useState(0);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    // ファイル数制限チェック
    const totalFiles = uploadingFiles.length + acceptedFiles.length;
    if (totalFiles > maxFiles) {
      alert(`最大${maxFiles}枚までアップロードできます。`);
      return;
    }

    const newUploadingFiles: UploadingFile[] = acceptedFiles.map(file => ({
      id: Math.random().toString(36).substr(2, 9),
      file,
      progress: 0,
      status: 'uploading'
    }));

    setUploadingFiles(prev => [...prev, ...newUploadingFiles]);
    setIsUploading(true);
    setCompletedCount(0);

    // 各ファイルを順次アップロード
    newUploadingFiles.forEach(async (uploadingFile) => {
      try {
        const fileName = generateFileName(uploadingFile.file.name, uploadingFile.file.type);
        const uploadResult = await uploadImage(uploadingFile.file, memoryId, fileName);
        
        // アセットを作成
        const asset: Asset = {
          id: Math.random().toString(36).substr(2, 9),
          memoryId,
          ownerUid,
          name: fileName,
          type: 'image',
          storagePath: uploadResult.path,
          url: uploadResult.url,
          thumbnailUrl: uploadResult.url,
          size: uploadingFile.file.size,
          createdAt: new Date(),
          updatedAt: new Date()
        };

        await createAsset(asset);

        // アップロード完了
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, progress: 100, status: 'completed', asset }
            : f
        ));

        setCompletedCount(prev => prev + 1);

      } catch (error) {
        console.error('Upload error:', error);
        setUploadingFiles(prev => prev.map(f => 
          f.id === uploadingFile.id 
            ? { ...f, status: 'error', error: 'アップロードに失敗しました' }
            : f
        ));
      }
    });
  }, [uploadingFiles.length, maxFiles, memoryId, ownerUid]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png', '.gif', '.webp']
    },
    multiple: true,
    disabled: isUploading
  });

  const handleComplete = () => {
    const completedAssets = uploadingFiles
      .filter(f => f.status === 'completed' && f.asset)
      .map(f => f.asset!);
    
    onUploadComplete(completedAssets);
  };

  const handleCancel = () => {
    setUploadingFiles([]);
    setIsUploading(false);
    setCompletedCount(0);
    onCancel();
  };

  const allCompleted = uploadingFiles.length > 0 && uploadingFiles.every(f => f.status === 'completed');
  const hasErrors = uploadingFiles.some(f => f.status === 'error');

  return (
    <div className="w-full max-w-2xl mx-auto p-4">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">複数写真をアップロード</h3>
        <p className="text-sm text-gray-600 mb-4">
          最大{maxFiles}枚まで一度にアップロードできます。スマホでは複数選択が可能です。
        </p>
      </div>

      {/* ドラッグ&ドロップエリア */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
              ${isDragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}
              ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
            `}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            {isDragActive ? (
              <p className="text-blue-600 font-medium">ここに写真をドロップしてください</p>
            ) : (
              <div>
                <p className="text-gray-600 font-medium mb-2">
                  写真をドラッグ&ドロップするか、クリックして選択
                </p>
                <p className="text-sm text-gray-500">
                  スマホでは「複数選択」をタップして複数の写真を選択できます
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* アップロード進捗 */}
      {uploadingFiles.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-medium">アップロード進捗</h4>
              <span className="text-sm text-gray-600">
                {completedCount} / {uploadingFiles.length} 完了
              </span>
            </div>
            
            <div className="space-y-3">
              {uploadingFiles.map((file) => (
                <div key={file.id} className="flex items-center space-x-3">
                  <div className="flex-shrink-0">
                    {file.status === 'uploading' && (
                      <Loader2 className="w-5 h-5 animate-spin text-blue-500" />
                    )}
                    {file.status === 'completed' && (
                      <CheckCircle className="w-5 h-5 text-green-500" />
                    )}
                    {file.status === 'error' && (
                      <AlertCircle className="w-5 h-5 text-red-500" />
                    )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {file.file.name}
                    </p>
                    <div className="mt-1">
                      <Progress value={file.progress} className="h-2" />
                    </div>
                    {file.error && (
                      <p className="text-xs text-red-600 mt-1">{file.error}</p>
                    )}
                  </div>
                  
                  <div className="flex-shrink-0 text-xs text-gray-500">
                    {(file.file.size / 1024 / 1024).toFixed(1)}MB
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* アクションボタン */}
      <div className="flex flex-col sm:flex-row gap-3 justify-end">
        <Button
          variant="outline"
          onClick={handleCancel}
          disabled={isUploading}
          className="w-full sm:w-auto"
        >
          キャンセル
        </Button>
        
        {allCompleted && (
          <Button
            onClick={handleComplete}
            className="w-full sm:w-auto bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            完了 ({completedCount}枚)
          </Button>
        )}
      </div>

      {/* エラーがある場合の注意 */}
      {hasErrors && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">
            一部のファイルのアップロードに失敗しました。成功したファイルのみが追加されます。
          </p>
        </div>
      )}
    </div>
  );
}

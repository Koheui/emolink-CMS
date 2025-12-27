import { NextRequest, NextResponse } from 'next/server';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Cloudflare R2設定
const R2_ACCOUNT_ID = process.env.NEXT_PUBLIC_R2_ACCOUNT_ID || '';
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID || '';
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY || '';
const R2_BUCKET_NAME = process.env.NEXT_PUBLIC_R2_BUCKET_NAME || '';
const R2_PUBLIC_DOMAIN = process.env.NEXT_PUBLIC_R2_PUBLIC_DOMAIN || '';

// R2クライアントの初期化
const r2Client = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export async function POST(request: NextRequest) {
  try {
    // デバッグログ（開発環境のみ）
    const isDevelopment = process.env.NODE_ENV === 'development';
    if (isDevelopment) {
      console.log('=== R2 Upload API: Starting ===');
      console.log('R2_ACCOUNT_ID:', R2_ACCOUNT_ID ? 'SET' : 'NOT SET');
      console.log('R2_BUCKET_NAME:', R2_BUCKET_NAME);
      console.log('R2_ACCESS_KEY_ID:', R2_ACCESS_KEY_ID ? 'SET' : 'NOT SET');
      console.log('R2_SECRET_ACCESS_KEY:', R2_SECRET_ACCESS_KEY ? 'SET' : 'NOT SET');
      console.log('R2_PUBLIC_DOMAIN:', R2_PUBLIC_DOMAIN);
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const storagePath = formData.get('path') as string;

    if (isDevelopment) {
      console.log('File received:', file?.name, file?.size, file?.type);
      console.log('Storage path:', storagePath);
    }

    if (!file || !storagePath) {
      console.error('Missing file or storagePath');
      return NextResponse.json(
        { error: 'File and path are required' },
        { status: 400 }
      );
    }

    // ファイルをバッファに変換
    const buffer = Buffer.from(await file.arrayBuffer());
    if (isDevelopment) {
      console.log('Buffer created, size:', buffer.length);
    }

    // R2にアップロード
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: storagePath,
      Body: buffer,
      ContentType: file.type,
    });

    if (isDevelopment) {
      console.log('Uploading to R2...');
    }
    await r2Client.send(command);
    if (isDevelopment) {
      console.log('Upload successful to R2');
    }

    // 公開URLを生成
    const url = R2_PUBLIC_DOMAIN 
      ? `${R2_PUBLIC_DOMAIN}/${storagePath}`
      : '';

    if (isDevelopment) {
      console.log('Generated URL:', url);
      console.log('=== R2 Upload API: Complete ===');
    }

    return NextResponse.json({
      url,
      path: storagePath,
    });
  } catch (error) {
    console.error('=== R2 Upload API: Error ===');
    console.error('R2 upload error:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { error: 'Upload failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}


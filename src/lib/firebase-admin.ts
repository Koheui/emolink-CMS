/**
 * Firebase Admin SDKの初期化
 * サーバーサイド（Next.js APIルート）で使用
 */

import * as admin from 'firebase-admin';

// 既に初期化されている場合は再初期化しない
if (!admin.apps.length) {
  try {
    // Vercel環境では環境変数から自動的に認証情報を取得
    // 環境変数が設定されている場合はそれを使用、なければapplicationDefault()を使用
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
      // 環境変数から認証情報を構築
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        projectId: process.env.FIREBASE_PROJECT_ID,
      });
      console.log('Firebase Admin SDK initialized with environment variables');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      // サービスアカウントキーファイルのパスが指定されている場合
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('Firebase Admin SDK initialized with GOOGLE_APPLICATION_CREDENTIALS');
    } else {
      // デフォルトの認証情報を使用（Vercel環境では自動的に取得される）
      admin.initializeApp({
        credential: admin.credential.applicationDefault(),
      });
      console.log('Firebase Admin SDK initialized with applicationDefault');
    }
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
    throw error;
  }
}

// Firestoreインスタンスをエクスポート
export const adminDb = admin.firestore();

// Admin SDKのその他の機能も必要に応じてエクスポート
export { admin };


'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRouter } from 'next/navigation';

export default function TestUserRegistration() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (isLogin) {
        // ログイン
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        console.log('ログイン成功:', userCredential.user.uid);
      } else {
        // 新規登録
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        console.log('ユーザー登録成功:', userCredential.user.uid);
      }
      
      // メモリ作成ページにリダイレクト
      router.push('/memories/create');
    } catch (error: any) {
      console.error('認証エラー:', error);
      let errorMessage = '認証に失敗しました';
      
      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = 'ユーザーが見つかりません';
          break;
        case 'auth/wrong-password':
          errorMessage = 'パスワードが間違っています';
          break;
        case 'auth/email-already-in-use':
          errorMessage = 'このメールアドレスは既に使用されています';
          break;
        case 'auth/weak-password':
          errorMessage = 'パスワードが弱すぎます（6文字以上）';
          break;
        case 'auth/invalid-email':
          errorMessage = '無効なメールアドレスです';
          break;
        default:
          errorMessage = `エラー: ${error.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>テスト用ユーザー登録</CardTitle>
          <CardDescription>
            メモリ作成機能をテストするためのユーザー登録
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="test@example.com"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="6文字以上"
                required
                minLength={6}
              />
            </div>

            <div className="flex space-x-2">
              <Button
                type="button"
                variant={!isLogin ? "default" : "outline"}
                onClick={() => setIsLogin(false)}
                className="flex-1"
              >
                新規登録
              </Button>
              <Button
                type="button"
                variant={isLogin ? "default" : "outline"}
                onClick={() => setIsLogin(true)}
                className="flex-1"
              >
                ログイン
              </Button>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '処理中...' : (isLogin ? 'ログイン' : '登録')}
            </Button>
          </form>

          <div className="mt-6 p-4 bg-blue-50 rounded-lg">
            <h3 className="font-medium text-blue-900 mb-2">テスト用アカウント</h3>
            <p className="text-sm text-blue-700 mb-2">
              メール: test@example.com<br />
              パスワード: test123
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setEmail('test@example.com');
                setPassword('test123');
                setIsLogin(true);
                setIsLoading(true);
                
                try {
                  // まずログインを試行
                  console.log('テストアカウントでログインを試行中...');
                  const userCredential = await signInWithEmailAndPassword(auth, 'test@example.com', 'test123');
                  console.log('テストアカウントログイン成功:', userCredential.user.uid);
                  router.push('/memories/create');
                } catch (error: any) {
                  console.error('テストアカウントログインエラー:', error);
                  
                  if (error.code === 'auth/user-not-found') {
                    // ユーザーが存在しない場合は新規登録を試行
                    try {
                      console.log('テストアカウントを新規登録中...');
                      const userCredential = await createUserWithEmailAndPassword(auth, 'test@example.com', 'test123');
                      console.log('テストアカウント登録成功:', userCredential.user.uid);
                      router.push('/memories/create');
                    } catch (createError: any) {
                      console.error('テストアカウント登録エラー:', createError);
                      alert(`テストアカウントの作成に失敗しました: ${createError.message}`);
                    }
                  } else if (error.code === 'auth/invalid-credential') {
                    // 認証情報が無効な場合
                    alert('認証情報が無効です。Firebase Authenticationの設定を確認してください。');
                  } else if (error.code === 'auth/too-many-requests') {
                    // リクエストが多すぎる場合
                    alert('リクエストが多すぎます。しばらく待ってから再試行してください。');
                  } else {
                    alert(`ログインに失敗しました: ${error.message}`);
                  }
                } finally {
                  setIsLoading(false);
                }
              }}
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? '処理中...' : 'テストアカウントでログイン'}
            </Button>
          </div>

          <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-medium text-yellow-900 mb-2">Firebase Authentication設定確認</h3>
            <p className="text-sm text-yellow-700 mb-2">
              Firebase Consoleで以下を確認してください：
            </p>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. Authentication → Sign-in method</li>
              <li>2. Email/Password が有効になっているか</li>
              <li>3. プロジェクトの設定が正しいか</li>
            </ol>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                console.log('Firebase設定:', {
                  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ? 'SET' : 'NOT SET',
                  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
                  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                });
                alert('Firebase設定をコンソールに出力しました。F12で確認してください。');
              }}
              className="w-full mt-2"
            >
              Firebase設定を確認
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

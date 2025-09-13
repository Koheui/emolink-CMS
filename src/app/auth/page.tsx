'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithEmailLink, isSignInWithEmailLink, sendSignInLinkToEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { decodeAndValidateJWT } from '@/lib/jwt';

function AuthContent() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // URLパラメータからJWTを取得
    const jwt = searchParams.get('k');
    const rid = searchParams.get('rid');
    const tenant = searchParams.get('tenant');
    const lpId = searchParams.get('lpId');

    if (jwt && rid && tenant && lpId) {
      // JWTを検証してメールアドレスを取得
      try {
        const jwtData = decodeAndValidateJWT(jwt);
        if (jwtData && jwtData.email) {
          setEmail(jwtData.email);
          setMessage('認証リンクが検証されました。メール認証を完了してください。');
        }
      } catch (error) {
        console.error('JWT検証エラー:', error);
        setMessage('認証リンクが無効です。');
      }
    }

    // メールリンクでのサインインをチェック
    if (isSignInWithEmailLink(auth, window.location.href)) {
      handleEmailLinkSignIn();
    }
  }, [searchParams]);

  const handleEmailLinkSignIn = async () => {
    setIsLoading(true);
    try {
      const result = await signInWithEmailLink(auth, email, window.location.href);
      console.log('メールリンク認証成功:', result.user.uid);
      setMessage('認証が完了しました。メモリ作成ページに移動します。');
      
      // メモリ作成ページにリダイレクト
      setTimeout(() => {
        router.push('/memories/create');
      }, 2000);
    } catch (error: any) {
      console.error('メールリンク認証エラー:', error);
      setMessage(`認証に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailLink = async () => {
    if (!email) {
      setMessage('メールアドレスを入力してください。');
      return;
    }

    setIsLoading(true);
    try {
      const actionCodeSettings = {
        url: window.location.origin + '/memories/create',
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      setMessage('認証リンクをメールに送信しました。メールを確認してください。');
    } catch (error: any) {
      console.error('メール送信エラー:', error);
      setMessage(`メール送信に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>メール認証</CardTitle>
          <CardDescription>
            LPから送信された認証リンクでメール認証を行います
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {message && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">{message}</p>
            </div>
          )}

          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              メールアドレス
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <div className="flex space-x-2">
            <Button
              onClick={handleSendEmailLink}
              disabled={isLoading || !email}
              className="flex-1"
            >
              {isLoading ? '送信中...' : '認証リンクを送信'}
            </Button>
            
            <Button
              onClick={handleEmailLinkSignIn}
              disabled={isLoading}
              variant="outline"
              className="flex-1"
            >
              {isLoading ? '認証中...' : '認証完了'}
            </Button>
          </div>

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-medium text-yellow-900 mb-2">使用方法</h3>
            <ol className="text-sm text-yellow-700 space-y-1">
              <li>1. LPから送信された認証リンクをクリック</li>
              <li>2. メールアドレスが自動入力されます</li>
              <li>3. 「認証リンクを送信」をクリック</li>
              <li>4. メールに送信されたリンクをクリック</li>
              <li>5. 「認証完了」をクリック</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductionAuth() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p>読み込み中...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}

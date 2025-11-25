'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Key, Shield, Mail, Lock } from 'lucide-react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter } from 'next/navigation';

export default function SecretKeyAuthForm() {
  const [secretKey, setSecretKey] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loginMode, setLoginMode] = useState<'secretKey' | 'email' | 'password'>('secretKey');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authenticateWithSecretKey, authenticateWithPassword } = useSecretKeyAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (loginMode === 'email') {
      // 開発環境でのみ有効なメール認証
      const enableDevEmailAuth = process.env.NEXT_PUBLIC_ENABLE_DEV_EMAIL_AUTH === 'true';
      
      if (!enableDevEmailAuth) {
        setError('メール認証は開発環境でのみ利用可能です');
        setLoading(false);
        return;
      }
      
      // メールアドレスの形式チェック
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        setError('有効なメールアドレスを入力してください');
        setLoading(false);
        return;
      }
      
      // メールアドレスでログイン（開発用ダミー認証）
      const dummyUserData = {
        uid: `user-${Date.now()}`,
        email: email,
        displayName: email.split('@')[0],
        tenant: 'futurestudio',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // セッションに保存
      sessionStorage.setItem('secretKeyUser', JSON.stringify(dummyUserData));
      sessionStorage.setItem('secretKeyTenant', 'futurestudio');
      sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
      
      localStorage.setItem('secretKeyUser', JSON.stringify(dummyUserData));
      localStorage.setItem('secretKeyTenant', 'futurestudio');
      localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
      
      router.push('/dashboard');
      setLoading(false);
      return;
    }

    if (loginMode === 'password') {
      // パスワードでログイン（開発用）
      const result = await authenticateWithPassword(password);
      
      if (result.success) {
        router.push('/dashboard');
      } else {
        setError(result.error || '認証に失敗しました');
      }
      
      setLoading(false);
      return;
    }

    // 秘密鍵でログイン
    const result = await authenticateWithSecretKey(secretKey);
    
    if (result.success) {
      router.push('/dashboard');
    } else {
      setError(result.error || '認証に失敗しました');
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* ヘッダー */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center space-x-2 mb-4">
            <Shield className="w-8 h-8 text-blue-600" />
            <span className="text-2xl font-bold text-gray-900">CMS</span>
          </div>
          <div className="text-gray-600 font-medium mb-2">
            管理システム
          </div>
          <p className="text-gray-500 text-sm">
            秘密鍵またはメールアドレスで認証してください
          </p>
        </div>

        {/* テスト用秘密鍵表示 */}
        <Card className="mb-4 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-800 mb-1">
                  テスト用秘密鍵
                </p>
                <p className="font-mono text-sm text-green-700">
                  EMOLINKEMOLINKEM
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  navigator.clipboard.writeText('EMOLINKEMOLINKEM');
                  alert('秘密鍵をコピーしました！');
                }}
              >
                コピー
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 認証カード */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2">
              <Key className="w-5 h-5 text-blue-600" />
              <span>ログイン</span>
            </CardTitle>
            <CardDescription className="text-center">
              {loginMode === 'secretKey' 
                ? '秘密鍵を入力してください' 
                : loginMode === 'password'
                ? '開発用パスワードを入力してください'
                : 'メールアドレスを入力してください（開発用）'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* ログインモード切り替え */}
            <div className={`grid gap-2 mb-4 ${process.env.NEXT_PUBLIC_ENABLE_DEV_EMAIL_AUTH === 'true' ? 'grid-cols-3' : 'grid-cols-2'}`}>
              <Button
                type="button"
                variant={loginMode === 'secretKey' ? 'default' : 'outline'}
                onClick={() => setLoginMode('secretKey')}
                className="flex-1"
              >
                <Key className="w-4 h-4 mr-2" />
                秘密鍵
              </Button>
              <Button
                type="button"
                variant={loginMode === 'password' ? 'default' : 'outline'}
                onClick={() => setLoginMode('password')}
                className="flex-1"
              >
                <Lock className="w-4 h-4 mr-2" />
                パスワード
              </Button>
              {process.env.NEXT_PUBLIC_ENABLE_DEV_EMAIL_AUTH === 'true' && (
                <Button
                  type="button"
                  variant={loginMode === 'email' ? 'default' : 'outline'}
                  onClick={() => setLoginMode('email')}
                  className="flex-1"
                >
                  <Mail className="w-4 h-4 mr-2" />
                  メール
                </Button>
              )}
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {loginMode === 'secretKey' ? (
                <div className="space-y-2">
                  <Label htmlFor="secretKey">秘密鍵</Label>
                  <Input
                    id="secretKey"
                    type="text"
                    placeholder="例: EMOLINKEMOLINKEM"
                    value={secretKey}
                    onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                    className="font-mono text-center tracking-wider"
                    maxLength={16}
                    required
                  />
                  <p className="text-xs text-gray-500 text-center">
                    秘密鍵を入力してください（16桁以下）
                  </p>
                </div>
              ) : loginMode === 'password' ? (
                <div className="space-y-2">
                  <Label htmlFor="password">開発用パスワード</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="パスワードを入力"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 text-center">
                    開発環境用: 環境変数 NEXT_PUBLIC_DEV_PASSWORD で設定
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="email">メールアドレス</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="例: customer@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <p className="text-xs text-gray-500 text-center">
                    開発用: 有効なメールアドレス形式でログイン可能
                    <br />
                    <span className="text-orange-600 font-medium">
                      ⚠️ 開発環境でのみ有効（環境変数で制御）
                    </span>
                  </p>
                </div>
              )}

              {error && (
                <div className="text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || (loginMode === 'secretKey' && secretKey.length === 0) || (loginMode === 'password' && password.length === 0)}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    認証中...
                  </>
                ) : (
                  <>
                    {loginMode === 'secretKey' ? (
                      <>
                        <Key className="w-4 h-4 mr-2" />
                        秘密鍵でログイン
                      </>
                    ) : loginMode === 'password' ? (
                      <>
                        <Lock className="w-4 h-4 mr-2" />
                        パスワードでログイン
                      </>
                    ) : (
                      <>
                        <Mail className="w-4 h-4 mr-2" />
                        メールアドレスでログイン
                      </>
                    )}
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* フッター */}
        <div className="text-center mt-8 text-sm text-gray-500">
          <p>© 2024 CMS. All rights reserved.</p>
          <p className="mt-1">Internal Management System</p>
        </div>
      </div>
    </div>
  );
}

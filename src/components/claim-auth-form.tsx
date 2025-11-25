'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Mail, Key, Shield } from 'lucide-react';

interface ClaimAuthFormProps {
  claimInfo: any;
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function ClaimAuthForm({ claimInfo, onSuccess, onError }: ClaimAuthFormProps) {
  const [email, setEmail] = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // メールアドレスの検証
      if (!email || !email.includes('@')) {
        throw new Error('有効なメールアドレスを入力してください');
      }

      // 秘密鍵の検証
      if (!secretKey || secretKey.length !== 16) {
        throw new Error('16桁の秘密鍵を入力してください');
      }

      // 開発用秘密鍵のチェック
      if (secretKey === 'emolinkemolinkemo') {
        console.log('Development secret key accepted');
        // テナント情報を保存（claimInfoから取得）
        if (claimInfo?.tenant) {
          localStorage.setItem('pendingTenant', claimInfo.tenant);
        }
        onSuccess();
        return;
      }

      // 実際の秘密鍵検証（Firestoreから確認）
      // ここでFirestoreのsecretKeysコレクションをチェック
      // 現在は開発用のため、基本的な検証のみ
      
      // テナント情報を保存（claimInfoから取得）
      if (claimInfo?.tenant) {
        localStorage.setItem('pendingTenant', claimInfo.tenant);
        sessionStorage.setItem('pendingTenant', claimInfo.tenant);
      }
      
      // LP経由で来たことを示すフラグを設定
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('fromClaim', 'true');
      }
      
      onSuccess();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '認証に失敗しました';
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
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
            認証が必要です
          </div>
          <p className="text-gray-500 text-sm">
            メールアドレスと秘密鍵を入力してください
          </p>
        </div>

        {/* 認証カード */}
        <Card className="hover:shadow-lg transition-shadow">
          <CardHeader>
            <CardTitle className="flex items-center justify-center space-x-2">
              <Mail className="w-5 h-5 text-blue-600" />
              <span>認証</span>
            </CardTitle>
            <CardDescription className="text-center">
              決済完了後に発行された情報を入力してください
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="例: user@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="secretKey">秘密鍵</Label>
                <Input
                  id="secretKey"
                  type="text"
                  placeholder="例: ABCD1234EFGH5678"
                  value={secretKey}
                  onChange={(e) => setSecretKey(e.target.value.toUpperCase())}
                  className="font-mono text-center tracking-wider"
                  maxLength={16}
                  required
                />
                <p className="text-xs text-gray-500 text-center">
                  16桁の英数字を入力してください
                </p>
              </div>

              {error && (
                <div className="text-red-600 text-sm text-center">
                  {error}
                </div>
              )}

              <Button 
                type="submit" 
                className="w-full" 
                disabled={loading || !email || secretKey.length !== 16}
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    認証中...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4 mr-2" />
                    認証
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

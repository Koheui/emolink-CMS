'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { getClaimRequestById, updateClaimRequest } from '@/lib/firestore';
import { decodeAndValidateJWT, parseClaimParams, validateClaimRequest } from '@/lib/jwt';
import MemoryCreationForm from '@/components/memory-creation-form';
import ClaimAuthForm from '@/components/claim-auth-form';
import MemoryEditor from '@/components/memory-editor';

function ClaimPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [claimInfo, setClaimInfo] = useState<any>(null);
  const [showAuthForm, setShowAuthForm] = useState(false);
  const [showMemoryEditor, setShowMemoryEditor] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleClaim = async () => {
      try {
        console.log('Starting claim process...');
        
        // URLパラメータを解析
        const params = parseClaimParams(searchParams);
        console.log('Parsed params:', params);
        
        if (!params) {
          setError('無効なリンクです。必要なパラメータが不足しています。');
          setLoading(false);
          return;
        }

        // JWTトークンを検証
        const jwtData = decodeAndValidateJWT(params.k);
        console.log('JWT validation result:', jwtData);
        
        if (!jwtData) {
          setError('無効な認証トークンです。リンクが正しくないか、期限切れの可能性があります。');
          setLoading(false);
          return;
        }

        // パラメータの整合性をチェック
        if (jwtData.sub !== params.rid || 
            jwtData.tenant !== params.tenant || 
            jwtData.lpId !== params.lpId) {
          setError('リンクのパラメータが一致しません。無効なリンクです。');
          setLoading(false);
          return;
        }

        // claimRequestを取得（開発環境ではダミーデータを使用）
        let claimRequest;
        
        // まず実際のデータを取得を試行
        try {
          claimRequest = await getClaimRequestById(params.rid);
          console.log('Claim request from Firestore:', claimRequest);
        } catch (error) {
          console.log('Failed to fetch from Firestore:', error);
          claimRequest = null;
        }
        
        // Firestoreからデータが取得できない場合はダミーデータを使用
        if (!claimRequest) {
          console.log('Using dummy claim request for development');
          claimRequest = {
            id: params.rid,
            email: jwtData.email,
            tenant: params.tenant,
            lpId: params.lpId,
            productType: 'acrylic',
            status: 'sent',
            createdAt: new Date(),
            updatedAt: new Date()
          };
        } else {
          // クレームリクエストの有効性を検証
          const validation = validateClaimRequest(claimRequest);
          if (!validation.valid) {
            setError(validation.error || 'リクエストが無効です。');
            setLoading(false);
            return;
          }
        }

        setClaimInfo(claimRequest);
        // テナント情報をlocalStorageに保存（認証完了時に使用）
        if (claimRequest.tenant) {
          localStorage.setItem('pendingTenant', claimRequest.tenant);
        }
        setShowAuthForm(true);
        setLoading(false);

      } catch (error) {
        console.error('Claim error:', error);
        setError('クレーム処理中にエラーが発生しました。もう一度お試しください。');
        setLoading(false);
      }
    };

    handleClaim();
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle>認証中...</CardTitle>
            <CardDescription>
              リンクを確認しています
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-600" />
            </div>
            <CardTitle>エラー</CardTitle>
            <CardDescription>
              {error}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (showAuthForm && claimInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <ClaimAuthForm
          claimInfo={claimInfo}
          onSuccess={() => {
            // LP経由で来たことを示すフラグを設定
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('fromClaim', 'true');
            }
            setShowAuthForm(false);
            setShowMemoryEditor(true);
          }}
          onError={(error) => setError(error)}
        />
      </div>
    );
  }

  if (showMemoryEditor && claimInfo) {
    return (
      <MemoryEditor
        claimInfo={claimInfo}
        onSave={(memoryData) => {
          console.log('Memory saved:', memoryData);
          setSuccess(true);
          setTimeout(() => {
            // fromClaimフラグを設定してから遷移
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('fromClaim', 'true');
            }
            router.push('/memories/create');
          }, 2000);
        }}
        onBack={() => {
          setShowMemoryEditor(false);
          setShowAuthForm(true);
        }}
      />
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <CardTitle>想い出記録完了</CardTitle>
            <CardDescription>
              想い出を記録しました！
              <br />
              メモリ作成ページにリダイレクトしています...
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return null;
}

export default function ClaimPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
            </div>
            <CardTitle>読み込み中...</CardTitle>
            <CardDescription>
              ページを読み込んでいます
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    }>
      <ClaimPageContent />
    </Suspense>
  );
}

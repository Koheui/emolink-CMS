'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { getClaimRequestById, updateClaimRequest } from '@/lib/firestore';
import { decodeAndValidateJWT, validateClaimRequest } from '@/lib/jwt';
import MemoryCreationForm from '@/components/memory-creation-form';
import MemoryEditor from '@/components/memory-editor';
import PasswordSetupForm from '@/components/password-setup-form';
import { getUserByEmail } from '@/lib/firestore';
import { signInWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';

function ClaimPageContent() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [claimInfo, setClaimInfo] = useState<any>(null);
  const [showPasswordSetup, setShowPasswordSetup] = useState(false);
  const [showMemoryEditor, setShowMemoryEditor] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleClaim = async () => {
      try {
        console.log('Starting claim process...');
        console.log('All URL params:', Object.fromEntries(searchParams.entries()));
        
        // JWT方式（kパラメータ）
        // kパラメータ（JWTトークン）を取得
        const jwtToken = searchParams.get('k');
        console.log('JWT token from URL:', jwtToken ? 'Found' : 'Not found');
        
        if (!jwtToken) {
          console.error('JWT token not found in URL parameters');
          setError('無効なリンクです。JWTトークンが含まれていません。');
          setLoading(false);
          return;
        }

        // Firebase FunctionsのJWT検証APIを呼び出し
        try {
          const verifyUrl = `https://asia-northeast1-memorylink-cms.cloudfunctions.net/apiV2/api/claim/verify?k=${encodeURIComponent(jwtToken)}`;
          console.log('Calling JWT verification API:', verifyUrl);
          
          const response = await fetch(verifyUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
            },
          });
          
          console.log('JWT verification API response status:', response.status);
          
          if (!response.ok) {
            let errorMessage = '認証トークンの検証に失敗しました。';
            try {
              const errorText = await response.text();
              console.error('JWT verification API error response:', errorText);
              const errorData = JSON.parse(errorText);
              if (errorData.error === 'Claim request not found') {
                errorMessage = 'この認証リンクに対応するリクエストが見つかりませんでした。リンクが無効か、既に使用済みの可能性があります。';
              } else if (errorData.error) {
                errorMessage = errorData.error;
              }
            } catch (e) {
              console.error('Failed to parse error response:', e);
            }
            setError(errorMessage);
            setLoading(false);
            return;
          }
          
          const data = await response.json();
          console.log('JWT verification API response data:', data);
          
          if (!data.ok) {
            console.error('JWT verification failed:', data.error, data.details);
            let errorMessage = data.error || '無効な認証トークンです。リンクが正しくないか、期限切れの可能性があります。';
            if (data.details) {
              errorMessage += ` (詳細: ${data.details})`;
            }
            setError(errorMessage);
            setLoading(false);
            return;
          }

          // 検証成功：APIから返されたclaimRequestを使用
          const claimRequest = data.claimRequest;
          if (!claimRequest) {
            console.error('claimRequest not found in API response:', data);
            // JWTペイロードから情報を取得してフォールバック
            if (data.payload) {
              console.log('Using JWT payload as fallback:', data.payload);
              const payload = data.payload;
              const fallbackClaimRequest = {
                id: payload.requestId || payload.sub,
                email: payload.email,
                tenant: payload.tenant,
                lpId: payload.lpId,
                productType: 'acrylic',
                status: 'sent',
                createdAt: new Date(payload.iat * 1000),
                updatedAt: new Date(),
              };
              console.log('Fallback claim request:', fallbackClaimRequest);
              
              // テナント情報をlocalStorageに保存
              if (typeof window !== 'undefined' && fallbackClaimRequest.tenant) {
                localStorage.setItem('secretKeyTenant', fallbackClaimRequest.tenant);
                localStorage.setItem('pendingTenant', fallbackClaimRequest.tenant);
              }
              
              setClaimInfo(fallbackClaimRequest);
              
              // JWT検証成功後、Firebase Authenticationでユーザーが存在するか確認
              try {
                if (!auth) {
                  throw new Error('認証サービスが利用できません');
                }
                
                // Firebase Authenticationでユーザーが存在するか確認
                const signInMethods = await fetchSignInMethodsForEmail(auth, fallbackClaimRequest.email);
                
                // 既存アカウントがある場合でも、パスワード設定画面を表示
                // これにより、既存のパスワードでログインして新しいテナントを追加できる
                if (signInMethods.length === 0) {
                  // 初回ログイン：パスワード登録画面を表示
                  setShowPasswordSetup(true);
                } else {
                  // 既存ユーザー：パスワード設定画面を表示（既存のパスワードでログイン可能）
                  // これにより、同じメールアドレスで複数の想い出ページを作成できる
                  setShowPasswordSetup(true);
                }
              } catch (error: any) {
                console.error('User check error:', error);
                // エラー時はパスワード登録画面を表示（安全側に倒す）
                setShowPasswordSetup(true);
              }
              
              setLoading(false);
              return;
            }
            setError('クレームリクエスト情報が取得できませんでした。');
            setLoading(false);
            return;
          }

          console.log('Claim request from API:', claimRequest);

          // クレームリクエストの有効性を検証
          const validation = validateClaimRequest(claimRequest);
          if (!validation.valid) {
            console.error('Claim request validation failed:', validation.error);
            setError(validation.error || 'リクエストが無効です。');
            setLoading(false);
            return;
          }

          // テナント情報をlocalStorageに保存（getClaimRequestByIdのテナント検証のため）
          if (typeof window !== 'undefined' && claimRequest.tenant) {
            localStorage.setItem('secretKeyTenant', claimRequest.tenant);
            localStorage.setItem('pendingTenant', claimRequest.tenant);
          }

          setClaimInfo(claimRequest);
          
          // JWT検証成功後、Firebase Authenticationでユーザーが存在するか確認
          try {
            if (!auth) {
              throw new Error('認証サービスが利用できません');
            }
            
            // Firebase Authenticationでユーザーが存在するか確認
            const signInMethods = await fetchSignInMethodsForEmail(auth, claimRequest.email);
            
            // 既存アカウントがある場合でも、パスワード設定画面を表示
            // これにより、既存のパスワードでログインして新しいテナントを追加できる
            if (signInMethods.length === 0) {
              // 初回ログイン：パスワード登録画面を表示
              setShowPasswordSetup(true);
            } else {
              // 既存ユーザー：パスワード設定画面を表示（既存のパスワードでログイン可能）
              // これにより、同じメールアドレスで複数の想い出ページを作成できる
              setShowPasswordSetup(true);
            }
          } catch (error: any) {
            console.error('User check error:', error);
            // エラー時はパスワード登録画面を表示（安全側に倒す）
            setShowPasswordSetup(true);
          }
          
          setLoading(false);
        } catch (error) {
          console.error('JWT verification API error:', error);
          if (error instanceof Error) {
            console.error('Error message:', error.message);
            console.error('Error stack:', error.stack);
          }
          setError('認証トークンの検証中にエラーが発生しました。もう一度お試しください。');
          setLoading(false);
        }

      } catch (error) {
        console.error('Claim error:', error);
        setError('クレーム処理中にエラーが発生しました。もう一度お試しください。');
        setLoading(false);
      }
    };

    handleClaim();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000f24] p-4">
        <Card className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
            <CardTitle className="text-white">認証中...</CardTitle>
            <CardDescription className="text-white/70">
              リンクを確認しています
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#000f24', minHeight: '100vh' }}>
        <div className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl p-6">
          <div className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center">
              <AlertCircle className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-2xl font-semibold text-white mb-2">エラー</h3>
            <p className="text-sm text-white/70 whitespace-pre-line">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // パスワード登録画面（初回ログイン時）
  if (showPasswordSetup && claimInfo) {
    return (
      <PasswordSetupForm
        email={claimInfo.email}
        tenant={claimInfo.tenant}
        claimRequestId={claimInfo.id}
        onSuccess={async () => {
            // パスワード登録成功後、自動的にログイン
            console.log('✅ PasswordSetupForm onSuccess called');
            try {
              if (!auth) {
                throw new Error('認証サービスが利用できません');
              }
              
              console.log('✅ Auth service is available');
              console.log('Current user:', auth.currentUser?.uid);
              
              // パスワード登録後、自動的にログイン（パスワードは既に登録されているため、再度入力は不要）
              // ただし、ここでは既にFirebase Authenticationでログイン済みのはずなので、
              // セッション情報を設定してメモリ作成画面に遷移
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('fromClaim', 'true');
                console.log('✅ Set fromClaim flag in sessionStorage');
              }
              
              setShowPasswordSetup(false);
              console.log('✅ Set showPasswordSetup to false');
              
              // claimRequestIdをsessionStorageに保存（初期設定フォームと編集画面でURLを表示するため）
              if (typeof window !== 'undefined' && claimInfo?.id) {
                sessionStorage.setItem('currentClaimRequestId', claimInfo.id);
                console.log('✅ Saved claimRequestId to sessionStorage:', claimInfo.id);
              } else {
                console.warn('⚠️ claimInfo.id is not available:', claimInfo?.id);
              }
              
              // 初期設定フォームにリダイレクト
              console.log('✅ Navigating to /memories/initial-setup');
              router.push('/memories/initial-setup');
            } catch (error: any) {
              console.error('❌ Auto login error:', error);
              setError('自動ログインに失敗しました。メールアドレスとパスワードでログインしてください。');
              setShowPasswordSetup(false);
              router.push('/auth');
            }
          }}
          onError={(error) => setError(error)}
        />
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
                // claimRequestIdをsessionStorageに保存（編集画面でURLを表示するため）
                if (claimInfo?.id) {
                  sessionStorage.setItem('currentClaimRequestId', claimInfo.id);
                }
              }
              router.push('/memories/create');
            }, 2000);
        }}
        onBack={() => {
          setShowMemoryEditor(false);
          // claimRequestIdをsessionStorageに保存（編集画面でURLを表示するため）
          if (typeof window !== 'undefined' && claimInfo?.id) {
            sessionStorage.setItem('currentClaimRequestId', claimInfo.id);
          }
          router.push('/auth');
        }}
      />
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000f24] p-4">
        <Card className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <CardTitle className="text-white">想い出記録完了</CardTitle>
            <CardDescription className="text-white/70">
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
      <div className="min-h-screen flex items-center justify-center bg-[#000f24] p-4">
        <Card className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 w-12 h-12 rounded-full flex items-center justify-center">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
            </div>
            <CardTitle className="text-white">読み込み中...</CardTitle>
            <CardDescription className="text-white/70">
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

'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ArrowRight, CheckCircle2, XCircle } from 'lucide-react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { createMemory, updateMemory, updatePublicPage, createPublicPage, getClaimRequestById, getMemoryById } from '@/lib/firestore';
import { getCurrentTenant } from '@/lib/security/tenant-validation';
import { generatePublicPageUrl } from '@/lib/utils';
import { PublicPage } from '@/types';

function InitialSetupPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentUser, isAuthenticated, loading: authLoading } = useSecretKeyAuth();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [claimRequestId, setClaimRequestId] = useState<string | null>(null);
  const [publicPageId, setPublicPageId] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/');
      return;
    }

    // claimRequestIdを取得（sessionStorageから、またはメールアドレスから検索）
    const loadClaimRequest = async () => {
      let claimId = typeof window !== 'undefined' ? sessionStorage.getItem('currentClaimRequestId') : null;
      
      // sessionStorageにない場合、メールアドレスから検索を試みる
      if (!claimId && currentUser?.email) {
        try {
          console.log('claimRequestId not found in sessionStorage, searching by email:', currentUser.email);
          const { query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
          const { collection } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const tenant = getCurrentTenant();
          
          // メールアドレスとテナントでclaimRequestを検索（最新のもの）
          const claimRequestsQuery = query(
            collection(db, 'claimRequests'),
            where('email', '==', currentUser.email),
            where('tenant', '==', tenant),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          const snapshot = await getDocs(claimRequestsQuery);
          
          if (!snapshot.empty) {
            const latestRequest = snapshot.docs[0];
            claimId = latestRequest.id;
            console.log('Found claimRequest by email:', claimId);
            // sessionStorageに保存
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('currentClaimRequestId', claimId);
            }
          } else {
            console.warn('No claimRequest found for email:', currentUser.email);
          }
        } catch (error) {
          console.error('Error searching claimRequest by email:', error);
        }
      }
      
      if (claimId) {
        setClaimRequestId(claimId);
        try {
          const request = await getClaimRequestById(claimId, true);
          if (request?.publicPageId) {
            setPublicPageId(request.publicPageId);
          }
        } catch (error) {
          console.error('Failed to load claim request:', error);
        }
      } else {
        console.warn('claimRequestId could not be determined, email notification may be skipped');
      }
    };
    
    if (!authLoading && isAuthenticated && currentUser?.uid) {
      loadClaimRequest();
    }
  }, [authLoading, isAuthenticated, router]);

  const handleSave = async () => {
    if (!currentUser?.uid) {
      setError('ログインが必要です');
      return;
    }

    if (!title || title.trim() === '') {
      setError('タイトルを入力してください');
      return;
    }

    let createdPublicPageId: string | null = null; // エラーハンドリング用に変数を外に出す
    
    try {
      setSaving(true);
      setError(null);
      setSuccessMessage(null); // 前回の成功メッセージをクリア

      const tenant = getCurrentTenant();
      
      // 認証情報とテナント情報を確認
      console.log('=== Authentication and Tenant Check ===');
      console.log('Current User UID:', currentUser?.uid);
      console.log('Current User Email:', currentUser?.email);
      console.log('Tenant:', tenant);
      console.log('Is Authenticated:', !!currentUser);
      
      if (!currentUser?.uid) {
        throw new Error('ユーザーが認証されていません。再度ログインしてください。');
      }
      
      if (!tenant) {
        throw new Error('テナント情報が取得できませんでした。');
      }
      
      // メモリを作成
      const memoryData = {
        ownerUid: currentUser.uid,
        tenant: tenant,
        title: title.trim(),
        description: description.trim() || '',
        type: 'personal' as const,
        status: 'draft' as const,
        blocks: [],
        storageUsed: 0,
        design: {
          theme: 'default',
          layout: 'standard',
          colors: {
            primary: '#3B82F6',
            secondary: '#6B7280',
            background: '#FFFFFF',
          },
        },
      };

      console.log('=== Creating Memory ===');
      console.log('Memory data:', {
        ownerUid: memoryData.ownerUid,
        tenant: memoryData.tenant,
        title: memoryData.title,
        hasDescription: !!memoryData.description,
      });
      
      const memoryId = await createMemory(memoryData);
      console.log('✅ Memory created with ID:', memoryId);

      // 公開ページを確定（商品代を確実に受け取るために必須）
      // 初期設定では必ず新しい公開ページを作成する（既存のpublicPageIdは無視）
      console.log('Creating new public page for initial setup...');
      const newPublicPage: Omit<PublicPage, 'id' | 'createdAt' | 'updatedAt'> = {
        tenant: tenant,
        ownerUid: currentUser.uid,
        memoryId: memoryId,
        title: title.trim(),
        about: description.trim() || '',
        design: {
          theme: 'default',
          layout: 'standard',
          colors: {
            primary: '#3B82F6',
            secondary: '#6B7280',
            background: '#FFFFFF',
          },
        },
        colors: {
          accent: '#08af86',
          text: '#ffffff',
          background: '#000f24',
          cardBackground: '#1a1a1a',
        },
        media: {},
        ordering: [],
        publish: {
          status: 'published' as const, // 初期設定で確定させるため、即座に公開
          version: 1,
          publishedAt: new Date(),
        },
        access: {
          public: true,
        },
      };
      
      console.log('=== Step 1: Creating public page ===');
      console.log('Public page data:', {
        tenant,
        ownerUid: currentUser.uid,
        memoryId,
        title: title.trim(),
        about: description.trim() || '',
        publishStatus: 'published',
      });
      console.log('Current User UID for public page creation:', currentUser.uid);
      console.log('Is Authenticated:', !!currentUser);
      
      try {
        createdPublicPageId = await createPublicPage(newPublicPage, currentUser.uid);
        console.log('✅ Step 1 completed: New public page created with ID:', createdPublicPageId);
      } catch (publicPageError: any) {
        console.error('❌ Public page creation error:', publicPageError);
        console.error('Error code:', publicPageError.code);
        console.error('Error message:', publicPageError.message);
        throw new Error(`公開ページの作成に失敗しました: ${publicPageError.message || '権限エラー'}`);
      }
      
      if (!createdPublicPageId) {
        console.error('❌ Public page creation failed: createdPublicPageId is null or empty');
        throw new Error('公開ページの作成に失敗しました');
      }
      
      // 作成された公開ページがFirestoreに存在するか確認
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const { db } = await import('@/lib/firebase');
        const verifyDoc = await getDoc(doc(db, 'publicPages', createdPublicPageId));
        if (!verifyDoc.exists()) {
          console.error('❌ Public page created but not found in Firestore:', createdPublicPageId);
          throw new Error('公開ページの作成に失敗しました（Firestoreに保存されていません）');
        }
        console.log('✅ Public page verified in Firestore');
      } catch (verifyError) {
        console.error('❌ Error verifying public page in Firestore:', verifyError);
        throw verifyError;
      }

      // メモリにpublicPageIdを設定（必須）
      console.log('=== Step 2: Updating memory with publicPageId ===');
      console.log('Memory ID:', memoryId);
      console.log('Public Page ID:', createdPublicPageId);
      await updateMemory(memoryId, { publicPageId: createdPublicPageId }, true);
      console.log('✅ Step 2 completed: Memory updated with publicPageId');
      
      // メモリの更新を確認
      const verifyMemory = await getMemoryById(memoryId, true);
      if (verifyMemory?.publicPageId === createdPublicPageId) {
        console.log('✅ Verification: Memory publicPageId is correctly set');
      } else {
        console.error('❌ Verification failed: Memory publicPageId mismatch', {
          expected: createdPublicPageId,
          actual: verifyMemory?.publicPageId,
        });
      }
      
      // エディット画面で使用するため、sessionStorageに保存
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('initialSetupPublicPageId', createdPublicPageId);
        console.log('✅ Step 3 completed: Saved initialSetupPublicPageId to sessionStorage:', createdPublicPageId);
      }

      // claimRequestにpublicPageIdとpublicPageUrlを設定（必須）
      // 注意: updateClaimRequestはclaimSetUrls関数内で実行されるため、ここでは呼び出さない
      if (claimRequestId) {
        console.log('=== Step 4: Updating claimRequest and sending email ===');
        const publicPageUrl = generatePublicPageUrl(createdPublicPageId, tenant);
        console.log('Preparing to update claimRequest and send confirmation email...', {
          claimRequestId,
          publicPageId: createdPublicPageId,
          publicPageUrl,
          tenant,
        });

        // メール送付をトリガー（商品代を確実に受け取るために必須）
        // claimSetUrls関数内でclaimRequestの更新（publicPageId, publicPageUrl）も行われる
        // ログインURLはトップページ（/）のみ（ログイン後は自動的に/memories/createにリダイレクトされる）
        const loginUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
        
        // claimRequestからメールアドレスを取得
        const claimRequestData = await getClaimRequestById(claimRequestId, true);
        const loginEmail = claimRequestData?.email || '';
        
        if (!loginEmail) {
          throw new Error('メールアドレスが取得できませんでした');
        }
        
        // パスワードはsessionStorageから取得（パスワード設定時に保存）
        const loginPassword = typeof window !== 'undefined' ? sessionStorage.getItem('tempPassword') || '' : '';
        
        if (!loginPassword) {
          throw new Error('パスワードが取得できませんでした。パスワード設定画面から再度お試しください。');
        }
        
        console.log('Calling claimSetUrls API to trigger email...', {
          requestId: claimRequestId,
          publicPageId: createdPublicPageId,
          publicPageUrl: publicPageUrl,
          loginEmail: loginEmail,
          hasPassword: !!loginPassword,
        });
        
        // Firebase Functions APIを使用してメール送付をトリガー
        const apiUrl = `https://asia-northeast1-memorylink-cms.cloudfunctions.net/claimSetUrls?requestId=${encodeURIComponent(claimRequestId)}`;
        console.log('API URL:', apiUrl);
        console.log('Request body:', {
          publicPageId: createdPublicPageId,
          publicPageUrl: publicPageUrl,
          loginUrl: loginUrl,
          loginEmail: loginEmail,
          hasPassword: !!loginPassword,
          claimedByUid: currentUser.uid,
        });
        
        let response: Response;
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              publicPageId: createdPublicPageId,
              publicPageUrl: publicPageUrl,
              loginUrl: loginUrl,
              loginEmail: loginEmail,
              loginPassword: loginPassword,
              claimedByUid: currentUser.uid,
            }),
          });
        } catch (fetchError: any) {
          console.error('❌ Fetch error (network error):', fetchError);
          throw new Error(`メール送付APIへの接続に失敗しました: ${fetchError.message || 'ネットワークエラー'}`);
        }

        console.log('Response status:', response.status);
        console.log('Response headers:', Object.fromEntries(response.headers.entries()));

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ claimSetUrls API HTTP error:', {
            status: response.status,
            statusText: response.statusText,
            body: errorText,
          });
          let errorMessage = `メール送付APIの呼び出しに失敗しました (HTTP ${response.status})`;
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.error) {
              errorMessage = errorJson.error;
            }
          } catch (e) {
            // JSONパースに失敗した場合は、そのままテキストを使用
            if (errorText) {
              errorMessage = errorText;
            }
          }
          throw new Error(errorMessage);
        }

        let result: any;
        try {
          const responseText = await response.text();
          console.log('Response text:', responseText);
          result = JSON.parse(responseText);
        } catch (parseError: any) {
          console.error('❌ Failed to parse response as JSON:', parseError);
          throw new Error('メール送付APIの応答の解析に失敗しました');
        }
        
        console.log('claimSetUrls API response:', result);
        
        if (!result.ok) {
          const errorMsg = result.error || 'メール送付に失敗しました';
          console.error('❌ claimSetUrls API error:', errorMsg);
          throw new Error(errorMsg);
        }
        
        // claimRequestの更新が成功したことを確認
        console.log('✅ Step 4-1 completed: claimRequest updated successfully in claimSetUrls:', {
          publicPageId: result.publicPageId,
          publicPageUrl: result.publicPageUrl,
          loginUrl: result.loginUrl,
        });
        
        // claimRequestの更新を確認（Firestoreから直接取得）
        const verifyClaimRequest = await getClaimRequestById(claimRequestId, true);
        if (verifyClaimRequest?.publicPageId === createdPublicPageId && verifyClaimRequest?.publicPageUrl === publicPageUrl) {
          console.log('✅ Step 4-2 completed: Verification - claimRequest publicPageId and publicPageUrl are correctly set');
        } else {
          console.error('❌ Verification failed: claimRequest data mismatch', {
            expectedPublicPageId: createdPublicPageId,
            actualPublicPageId: verifyClaimRequest?.publicPageId,
            expectedPublicPageUrl: publicPageUrl,
            actualPublicPageUrl: verifyClaimRequest?.publicPageUrl,
          });
        }
        
        // メール送信の結果を確認
        if (result.emailSent === false) {
          const errorMsg = result.emailError || 'メール送付に失敗しました（詳細不明）';
          console.error('❌ Email sending failed:', errorMsg);
          throw new Error(`メール送付に失敗しました: ${errorMsg}`);
        }
        
        console.log('✅ Step 4-3 completed: Email sent successfully:', result);
        
        // パスワードをsessionStorageから削除（セキュリティのため）
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tempPassword');
        }
        
        // 成功メッセージを表示
        console.log('✅ Initial setup completed successfully:', {
          memoryId,
          publicPageId: createdPublicPageId,
          publicPageUrl: generatePublicPageUrl(createdPublicPageId, tenant),
          claimRequestId,
        });
        setSuccessMessage('公開ページURLが確定し、確認メールを送信しました。');
      } else {
        console.warn('⚠️ claimRequestId is not available, skipping email notification');
        console.warn('This may happen if:');
        console.warn('1. User accessed initial-setup page directly (not from /claim)');
        console.warn('2. sessionStorage was cleared');
        console.warn('3. claimRequestId was not set in password setup form');
        // claimRequestIdがない場合でも、公開ページURLは確定済み
        setSuccessMessage('公開ページURLが確定しました。メール通知は送信されませんでした。');
      }

      // 成功メッセージを表示してからエディットページに遷移
      // メール送信が成功した場合のみ遷移（商品代を確実に受け取るために重要）
      // ただし、claimRequestIdがない場合でも公開ページは作成されているので遷移する
      setTimeout(() => {
        router.push(`/memories/create?memoryId=${memoryId}`);
      }, 2000);
    } catch (error: any) {
      console.error('❌ Save error:', error);
      console.error('❌ Error stack:', error.stack);
      console.error('❌ Error details:', {
        message: error.message,
        name: error.name,
        code: error.code,
      });
      const errorMessage = error.message || '不明なエラーが発生しました';
      setError(`保存に失敗しました: ${errorMessage}`);
      // エラーが発生した場合は遷移しない（商品代を確実に受け取るために重要）
      setSuccessMessage(null); // 成功メッセージをクリア
      
      // エラーが発生した場合でも、公開ページが作成されている可能性があるので確認
      if (createdPublicPageId) {
        console.warn('⚠️ Error occurred but public page was created:', createdPublicPageId);
        console.warn('⚠️ User should check if public page exists in Firestore');
      }
    } finally {
      setSaving(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000f24]">
        <Loader2 className="w-8 h-8 text-[#08af86] animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#000f24] flex items-center justify-center p-4">
      <Card className="w-full max-w-2xl bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl">
        <CardHeader>
          <CardTitle className="text-white text-2xl">初期設定</CardTitle>
          <CardDescription className="text-white/70">
            想い出ページの基本情報を入力してください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="bg-red-500/20 border border-red-500/30 text-red-400 p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          {successMessage && (
            <div className="bg-green-500/20 border border-green-500/30 text-green-400 p-3 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5" />
              <span>{successMessage}</span>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title" className="text-white/80">
              タイトル <span className="text-red-400">*</span>
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="想い出ページのタイトルを入力"
              className="bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
              disabled={saving}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="text-white/80">
              説明文
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="想い出ページの説明文を入力（任意）"
              rows={4}
              className="bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50 resize-none"
              disabled={saving}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleSave}
              disabled={saving || !title.trim()}
              className="flex-1 bg-white text-black hover:bg-white/90"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  保存中...
                </>
              ) : (
                <>
                  保存して次へ
                  <ArrowRight className="w-4 h-4 ml-2" />
                </>
              )}
            </Button>
          </div>

          <p className="text-white/50 text-xs text-center">
            保存後、エディットページで詳細な設定を行えます
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InitialSetupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#000f24]">
        <Loader2 className="w-8 h-8 text-[#08af86] animate-spin" />
      </div>
    }>
      <InitialSetupPageContent />
    </Suspense>
  );
}


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
      
      // sessionStorageにない場合、メールアドレスから検索を試みる（より確実に取得）
      if (!claimId && currentUser?.email) {
        try {
          console.log('claimRequestId not found in sessionStorage, searching by email:', currentUser.email);
          const { query, where, getDocs, orderBy, limit } = await import('firebase/firestore');
          const { collection } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const tenant = getCurrentTenant();
          
          // まず、テナント指定で検索
          let claimRequestsQuery = query(
            collection(db, 'claimRequests'),
            where('email', '==', currentUser.email),
            where('tenant', '==', tenant),
            orderBy('createdAt', 'desc'),
            limit(1)
          );
          
          let snapshot = await getDocs(claimRequestsQuery);
          
          // テナント指定で見つからない場合、テナント指定なしで検索
          if (snapshot.empty) {
            console.log('No claimRequest found with tenant, searching without tenant filter');
            claimRequestsQuery = query(
              collection(db, 'claimRequests'),
              where('email', '==', currentUser.email),
              orderBy('createdAt', 'desc'),
              limit(1)
            );
            snapshot = await getDocs(claimRequestsQuery);
          }
          
          if (!snapshot.empty) {
            const latestRequest = snapshot.docs[0];
            claimId = latestRequest.id;
            console.log('✅ Found claimRequest by email:', claimId);
            // sessionStorageに保存
            if (typeof window !== 'undefined') {
              sessionStorage.setItem('currentClaimRequestId', claimId);
            }
          } else {
            console.warn('⚠️ No claimRequest found for email:', currentUser.email, 'tenant:', tenant);
          }
        } catch (error: any) {
          console.error('❌ Error searching claimRequest by email:', error);
          // インデックスエラーの場合は、orderByなしで再試行
          if (error.message?.includes('index')) {
            try {
              console.log('Retrying without orderBy due to index error');
              const { query, where, getDocs, limit } = await import('firebase/firestore');
              const { collection } = await import('firebase/firestore');
              const { db } = await import('@/lib/firebase');
              const tenant = getCurrentTenant();
              
              let claimRequestsQuery = query(
                collection(db, 'claimRequests'),
                where('email', '==', currentUser.email),
                where('tenant', '==', tenant),
                limit(10) // 最新10件を取得して、クライアント側でソート
              );
              
              let snapshot = await getDocs(claimRequestsQuery);
              
              if (snapshot.empty) {
                claimRequestsQuery = query(
                  collection(db, 'claimRequests'),
                  where('email', '==', currentUser.email),
                  limit(10)
                );
                snapshot = await getDocs(claimRequestsQuery);
              }
              
              if (!snapshot.empty) {
                // クライアント側でソート（createdAt降順）
                const requests = snapshot.docs
                  .map(doc => ({ id: doc.id, ...doc.data() }))
                  .sort((a: any, b: any) => {
                    const aTime = a.createdAt?.toMillis?.() || 0;
                    const bTime = b.createdAt?.toMillis?.() || 0;
                    return bTime - aTime;
                  });
                
                if (requests.length > 0) {
                  claimId = requests[0].id;
                  console.log('✅ Found claimRequest by email (without orderBy):', claimId);
                  if (typeof window !== 'undefined') {
                    sessionStorage.setItem('currentClaimRequestId', claimId);
                  }
                }
              }
            } catch (retryError) {
              console.error('❌ Retry also failed:', retryError);
            }
          }
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
      // claimRequestIdが取得できていない場合、再度検索を試みる
      let finalClaimRequestId = claimRequestId;
      
      if (!finalClaimRequestId && currentUser?.email) {
        console.log('⚠️ claimRequestId not found in state, attempting to find by email:', currentUser.email);
        try {
          const { query, where, getDocs, limit } = await import('firebase/firestore');
          const { collection } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const tenant = getCurrentTenant();
          
          // テナント指定で検索（orderByなし）
          let claimRequestsQuery = query(
            collection(db, 'claimRequests'),
            where('email', '==', currentUser.email),
            where('tenant', '==', tenant),
            limit(10)
          );
          
          let snapshot = await getDocs(claimRequestsQuery);
          
          // テナント指定で見つからない場合、テナント指定なしで検索
          if (snapshot.empty) {
            console.log('No claimRequest found with tenant, searching without tenant filter');
            claimRequestsQuery = query(
              collection(db, 'claimRequests'),
              where('email', '==', currentUser.email),
              limit(10)
            );
            snapshot = await getDocs(claimRequestsQuery);
          }
          
          if (!snapshot.empty) {
            // クライアント側でソート（createdAt降順）
            const requests = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .sort((a: any, b: any) => {
                const aTime = a.createdAt?.toMillis?.() || 0;
                const bTime = b.createdAt?.toMillis?.() || 0;
                return bTime - aTime;
              });
            
            if (requests.length > 0) {
              finalClaimRequestId = requests[0].id;
              console.log('✅ Found claimRequest by email in handleSave:', finalClaimRequestId);
              setClaimRequestId(finalClaimRequestId);
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('currentClaimRequestId', finalClaimRequestId);
              }
            }
          }
        } catch (error: any) {
          console.error('❌ Error searching claimRequest by email in handleSave:', error);
        }
      }
      
      // claimRequestIdが見つかった場合のみメール送信
      if (finalClaimRequestId) {
        console.log('=== Step 4: Updating claimRequest and sending email ===');
        const publicPageUrl = generatePublicPageUrl(createdPublicPageId, tenant);
        console.log('Preparing to update claimRequest and send confirmation email...', {
          claimRequestId: finalClaimRequestId,
          publicPageId: createdPublicPageId,
          publicPageUrl,
          tenant,
        });

        // メール送付をトリガー（商品代を確実に受け取るために必須）
        // claimSetUrls関数内でclaimRequestの更新（publicPageId, publicPageUrl）も行われる
        // ログインURLはトップページ（/）のみ（ログイン後は自動的に/memories/createにリダイレクトされる）
        const loginUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : 'https://emolink-cms.web.app');
        
        // claimRequestからメールアドレスを取得
        const claimRequestData = await getClaimRequestById(finalClaimRequestId, true);
        const loginEmail = claimRequestData?.email || '';
        
        if (!loginEmail) {
          throw new Error('メールアドレスが取得できませんでした');
        }
        
        // パスワードはsessionStorageから取得（パスワード設定時に保存）
        const loginPassword = typeof window !== 'undefined' ? sessionStorage.getItem('tempPassword') || '' : '';
        
        if (!loginPassword) {
          throw new Error('パスワードが取得できませんでした。パスワード設定画面から再度お試しください。');
        }
        
        // Step 4-1: クライアントサイドから直接claimRequestを更新（認証コンテキストが利用可能）
        console.log('=== Step 4-1: Updating claimRequest from client side ===');
        console.log('Updating claimRequest:', {
          requestId: finalClaimRequestId,
          publicPageId: createdPublicPageId,
          publicPageUrl: publicPageUrl,
          loginUrl: loginUrl,
          claimedByUid: currentUser.uid,
        });
        
        try {
          const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
          const { db } = await import('@/lib/firebase');
          const claimRequestRef = doc(db, 'claimRequests', finalClaimRequestId);
          
          await updateDoc(claimRequestRef, {
            publicPageId: createdPublicPageId,
            publicPageUrl: publicPageUrl,
            loginUrl: loginUrl,
            claimedByUid: currentUser.uid,
            updatedAt: serverTimestamp(),
          });
          
          console.log('✅ Step 4-1 completed: claimRequest updated successfully from client side');
        } catch (updateError: any) {
          console.error('❌ Failed to update claimRequest from client side:', updateError);
          throw new Error(`データベースへの書き込みに失敗しました: ${updateError.message || '不明なエラー'}`);
        }
        
        // claimRequestの更新を確認（Firestoreから直接取得）
        const verifyClaimRequest = await getClaimRequestById(finalClaimRequestId, true);
        if (verifyClaimRequest?.publicPageId === createdPublicPageId && verifyClaimRequest?.publicPageUrl === publicPageUrl) {
          console.log('✅ Step 4-2 completed: Verification - claimRequest publicPageId and publicPageUrl are correctly set');
        } else {
          console.error('❌ Verification failed: claimRequest data mismatch', {
            expectedPublicPageId: createdPublicPageId,
            actualPublicPageId: verifyClaimRequest?.publicPageId,
            expectedPublicPageUrl: publicPageUrl,
            actualPublicPageUrl: verifyClaimRequest?.publicPageUrl,
          });
          throw new Error('claimRequestの更新が正しく保存されていません。');
        }
        
        // Step 4-3: メール送信のみAPIルートを呼び出す
        console.log('=== Step 4-3: Sending email via API ===');
        console.log('Calling send-email API...', {
          requestId: finalClaimRequestId,
          loginEmail: loginEmail,
          hasPassword: !!loginPassword,
        });
        
        const apiUrl = `/api/claim/${finalClaimRequestId}/send-email`;
        let response: Response;
        let emailSent = false; // メール送信の成功/失敗を追跡
        
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              loginEmail: loginEmail,
              loginPassword: loginPassword,
              publicPageUrl: publicPageUrl,
              loginUrl: loginUrl,
            }),
          });
        } catch (fetchError: any) {
          console.error('❌ Fetch error (network error):', fetchError);
          throw new Error(`メール送付APIへの接続に失敗しました: ${fetchError.message || 'ネットワークエラー'}`);
        }

        console.log('Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ send-email API HTTP error:', {
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
          // メール送信に失敗しても、URLの設定は成功しているため、警告メッセージを表示
          setSuccessMessage(`公開ページURLが確定しました。ただし、メール通知の送信に失敗しました: ${errorMessage}`);
          console.warn('⚠️ Email sending failed, but claimRequest was updated successfully');
          emailSent = false;
        } else {
          let result: any;
          try {
            result = await response.json();
          } catch (parseError: any) {
            console.error('❌ Failed to parse response as JSON:', parseError);
            setSuccessMessage(`公開ページURLが確定しました。ただし、メール通知の送信に失敗しました: 応答の解析に失敗しました`);
            console.warn('⚠️ Email sending failed (parse error), but claimRequest was updated successfully');
            emailSent = false;
          }
          
          if (result && result.ok && result.emailSent) {
            console.log('✅ Step 4-3 completed: Email sent successfully:', result);
            emailSent = true;
            // メール送信が成功した場合のみ成功メッセージを設定
            setSuccessMessage('公開ページURLが確定し、確認メールを送信しました。');
          } else {
            const errorMsg = result?.emailError || 'メール送付に失敗しました（詳細不明）';
            console.error('⚠️ Email sending failed:', errorMsg);
            setSuccessMessage(`公開ページURLが確定しました。ただし、メール通知の送信に失敗しました: ${errorMsg}`);
            emailSent = false;
          }
        }
        
        // パスワードをsessionStorageから削除（セキュリティのため）
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('tempPassword');
        }
        
        // 成功ログを表示（メッセージは既に設定済み）
        console.log('✅ Initial setup completed successfully:', {
          memoryId,
          publicPageId: createdPublicPageId,
          publicPageUrl: generatePublicPageUrl(createdPublicPageId, tenant),
          claimRequestId: finalClaimRequestId,
          emailSent: emailSent,
        });
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


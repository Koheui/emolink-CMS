'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Calendar, ExternalLink, Trash2, ArrowLeft, CheckCircle, XCircle, Clock, HardDrive, Key, Building, Store } from 'lucide-react';
import { getCustomerDetail, deleteCustomerAccount } from '@/lib/firestore-crm';
import { CustomerDetail } from '@/lib/firestore-crm';
import Link from 'next/link';
import { generatePublicPageUrl } from '@/lib/utils';
import { formatDate } from '@/lib/utils';
import { extendMemoryExpiration } from '@/lib/memory-extension';
import { createStorageSubscription } from '@/lib/storage-subscription';
import { getExpirationDate, getDaysUntilExpiration, getExpirationStatusText } from '@/lib/expiration';
import { getStorageLimit, getStorageUsed, formatStorageSize, DEFAULT_STORAGE_LIMIT } from '@/lib/storage-limit';
import { getMemoryById, updateMemory, getClaimRequestById } from '@/lib/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const customerId = params.id as string; // claimRequest IDまたはUID
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [extendingMemoryId, setExtendingMemoryId] = useState<string | null>(null);
  const [extendingStorageMemoryId, setExtendingStorageMemoryId] = useState<string | null>(null);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const [memoriesWithCompany, setMemoriesWithCompany] = useState<Array<{
    memory: any;
    companyName?: string;
    tenantName?: string;
  }>>([]);
  
  useEffect(() => {
    if (customerId) {
      fetchCustomerDetail();
    }
  }, [customerId]);
  
  useEffect(() => {
    if (customerDetail && customerDetail.memories) {
      fetchCompanyAndTenantNames();
    }
  }, [customerDetail]);
  
  const fetchCompanyAndTenantNames = async () => {
    if (!customerDetail || !customerDetail.memories) return;
    
    const memoriesWithNames = await Promise.all(
      customerDetail.memories.map(async (memory) => {
        try {
          let tenantName: string | undefined;
          let companyName: string | undefined;
          
          if (memory.tenant) {
            const tenantRef = doc(db, 'tenants', memory.tenant);
            const tenantSnap = await getDoc(tenantRef);
            if (tenantSnap.exists()) {
              const tenantData = tenantSnap.data();
              tenantName = tenantData.name;
              
              if (tenantData.companyId) {
                const companyRef = doc(db, 'companies', tenantData.companyId);
                const companySnap = await getDoc(companyRef);
                if (companySnap.exists()) {
                  const companyData = companySnap.data();
                  companyName = companyData.name;
                }
              }
            }
          }
          
          return { memory, companyName, tenantName };
        } catch (err) {
          console.error('Error fetching company and tenant names:', err);
          return { memory, companyName: undefined, tenantName: undefined };
        }
      })
    );
    
    setMemoriesWithCompany(memoriesWithNames);
  };
  
  const fetchCustomerDetail = async () => {
    try {
      setLoading(true);
      
      // customerIdがclaimRequest IDかUIDかを判定
      // まずclaimRequestとして取得を試みる
      const claimRequestRef = doc(db, 'claimRequests', customerId);
      const claimRequestSnap = await getDoc(claimRequestRef);
      
      let uid: string | null = null;
      
      if (claimRequestSnap.exists()) {
        // claimRequest IDの場合
        const claimRequestData = claimRequestSnap.data();
        uid = claimRequestData.claimedByUid || null;
        
        // claimedByUidがない場合、emailからusersを検索
        if (!uid && claimRequestData.email) {
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', claimRequestData.email));
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            uid = userSnapshot.docs[0].id;
          }
        }
      } else {
        // UIDとして扱う（後方互換性）
        uid = customerId;
      }
      
      if (!uid) {
        setError('顧客が見つかりませんでした');
        return;
      }
      
      const detail = await getCustomerDetail(uid);
      if (!detail) {
        setError('顧客が見つかりませんでした');
        return;
      }
      setCustomerDetail(detail);
    } catch (err: any) {
      console.error('Error fetching customer detail:', err);
      setError('顧客情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handleDelete = async () => {
    if (!confirm('本当にこの顧客アカウントを削除しますか？この操作は取り消せません。')) {
      return;
    }
    
    try {
      setDeleting(true);
      
      // customerIdがclaimRequest IDかUIDかを判定
      let uid: string = customerId;
      const claimRequestRef = doc(db, 'claimRequests', customerId);
      const claimRequestSnap = await getDoc(claimRequestRef);
      
      if (claimRequestSnap.exists()) {
        // claimRequest IDの場合、uidを取得
        const claimRequestData = claimRequestSnap.data();
        uid = claimRequestData.claimedByUid || customerId;
        
        // claimedByUidがない場合、emailからusersを検索
        if (!claimRequestData.claimedByUid && claimRequestData.email) {
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', claimRequestData.email));
          const userSnapshot = await getDocs(userQuery);
          if (!userSnapshot.empty) {
            uid = userSnapshot.docs[0].id;
          }
        }
      }
      
      await deleteCustomerAccount(uid);
      alert('顧客アカウントを削除しました');
      router.push('/crm/customers');
    } catch (err: any) {
      console.error('Error deleting customer:', err);
      alert('顧客アカウントの削除に失敗しました');
    } finally {
      setDeleting(false);
    }
  };

  const handleExtendExpiration = async (memoryId: string) => {
    if (!confirm('利用期限を10年延長しますか？')) {
      return;
    }
    
    try {
      setExtendingMemoryId(memoryId);
      await extendMemoryExpiration(memoryId, customerId);
      alert('利用期限を延長しました');
      await fetchCustomerDetail(); // データを再取得
    } catch (err: any) {
      console.error('Error extending expiration:', err);
      alert('利用期限の延長に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setExtendingMemoryId(null);
    }
  };

  const handleExtendStorage = async (memoryId: string) => {
    if (!confirm('ストレージを200MBに拡張しますか？（月額200円）')) {
      return;
    }
    
    try {
      setExtendingStorageMemoryId(memoryId);
      await createStorageSubscription(memoryId, customerId, 'extended');
      alert('ストレージを拡張しました');
      await fetchCustomerDetail(); // データを再取得
    } catch (err: any) {
      console.error('Error extending storage:', err);
      alert('ストレージの拡張に失敗しました: ' + (err.message || '不明なエラー'));
    } finally {
      setExtendingStorageMemoryId(null);
    }
  };
  
  const handlePasswordReset = async () => {
    if (!customerDetail?.user.email) {
      alert('メールアドレスが登録されていません');
      return;
    }
    
    if (!confirm(`${customerDetail.user.email} にパスワードリセットメールを送信しますか？`)) {
      return;
    }
    
    try {
      setResettingPassword(true);
      setPasswordResetSent(false);
      
      await sendPasswordResetEmail(auth, customerDetail.user.email, {
        url: window.location.origin + '/auth',
        handleCodeInApp: true,
      });
      
      setPasswordResetSent(true);
      alert('パスワードリセットメールを送信しました');
    } catch (err: any) {
      console.error('Error sending password reset email:', err);
      let errorMessage = 'パスワードリセットメールの送信に失敗しました';
      
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'このメールアドレスは登録されていません';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      alert(errorMessage);
    } finally {
      setResettingPassword(false);
    }
  };
  
  // デバッグ: userオブジェクトの内容を確認（早期リターンの前に配置）
  useEffect(() => {
    if (customerDetail?.user) {
      const user = customerDetail.user;
      console.log('[Customer Detail] user object:', user);
      console.log('[Customer Detail] user.tenant type:', typeof user.tenant, user.tenant);
      if (typeof user.tenant !== 'string' && user.tenant !== null && user.tenant !== undefined) {
        console.error('[Customer Detail] user.tenant is not a string:', user.tenant);
      }
    }
  }, [customerDetail]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (error || !customerDetail) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error || '顧客が見つかりませんでした'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/crm/customers">
              <Button>顧客一覧に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const { user, claimRequest, memories, publicPages, status } = customerDetail;
  
  // 公開URLを取得（優先順位: claimRequest > publicPages > memories）
  let publicPageUrl: string | null = null;
  if (claimRequest?.publicPageUrl) {
    publicPageUrl = claimRequest.publicPageUrl;
  } else if (claimRequest?.publicPageId) {
    publicPageUrl = generatePublicPageUrl(claimRequest.publicPageId);
  } else if (publicPages.length > 0) {
    publicPageUrl = generatePublicPageUrl(publicPages[0].id);
  } else {
    const memoryWithPublicPage = memories.find(m => m.publicPageId);
    if (memoryWithPublicPage?.publicPageId) {
      publicPageUrl = generatePublicPageUrl(memoryWithPublicPage.publicPageId);
    }
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">顧客詳細</h1>
              <p className="text-gray-600 mt-2">顧客情報の詳細を表示します</p>
            </div>
            <div className="flex gap-2">
              <Link href="/crm/customers">
                <Button variant="outline">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  戻る
                </Button>
              </Link>
              <Button 
                variant="destructive" 
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    削除中...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    アカウント削除
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
        
        <div className="grid gap-6">
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle>基本情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">UID</label>
                <p className="text-sm mt-1 font-mono">{user.uid}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  メールアドレス
                </label>
                <p className="text-sm mt-1">{user.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">表示名</label>
                <p className="text-sm mt-1">{user.displayName || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  登録日
                </label>
                <p className="text-sm mt-1">{formatDate(user.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">テナント</label>
                <div className="flex gap-2 mt-1">
                  <Badge variant="outline">{typeof user.tenant === 'string' ? user.tenant : String(user.tenant || '-')}</Badge>
                  {user.tenants && user.tenants.length > 0 && (
                    <>
                      {user.tenants.map((t, idx) => (
                        <Badge key={idx} variant="outline">{typeof t === 'string' ? t : String(t || '-')}</Badge>
                      ))}
                    </>
                  )}
                </div>
              </div>
              <div className="pt-4 border-t">
                <Button
                  onClick={handlePasswordReset}
                  disabled={resettingPassword || passwordResetSent}
                  variant="outline"
                  className="w-full"
                >
                  {resettingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : passwordResetSent ? (
                    <>
                      <CheckCircle className="h-4 w-4 mr-2 text-green-500" />
                      パスワードリセットメール送信済み
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      パスワードリセットメールを送信
                    </>
                  )}
                </Button>
                {passwordResetSent && (
                  <p className="text-xs text-green-600 mt-2 text-center">
                    パスワードリセットメールを送信しました。顧客にメールを確認してもらってください。
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
          
          {/* ステータス */}
          <Card>
            <CardHeader>
              <CardTitle>ステータス</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                {status.emailSent ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">メール送信済み</span>
              </div>
              <div className="flex items-center gap-2">
                {status.accountCreated ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">アカウント作成済み</span>
              </div>
              <div className="flex items-center gap-2">
                {status.publicPageCreated ? (
                  <CheckCircle className="h-5 w-5 text-green-500" />
                ) : (
                  <XCircle className="h-5 w-5 text-gray-400" />
                )}
                <span className="text-sm">公開ページ作成済み</span>
              </div>
            </CardContent>
          </Card>
          
          {/* 公開URL */}
          {publicPageUrl && (
            <Card>
              <CardHeader>
                <CardTitle>公開ページ</CardTitle>
              </CardHeader>
              <CardContent>
                <a
                  href={publicPageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-2"
                >
                  <ExternalLink className="h-4 w-4" />
                  {publicPageUrl}
                </a>
              </CardContent>
            </Card>
          )}
          
          {/* emolinkページ */}
          {memories.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>emolinkページ ({memories.length}件)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {memoriesWithCompany.length > 0 ? (
                    memoriesWithCompany.map(({ memory, companyName, tenantName }) => {
                      const getStatusBadge = (status: string) => {
                        switch (status) {
                          case 'published':
                            return <Badge className="bg-green-100 text-green-800">公開済み</Badge>;
                          case 'draft':
                            return <Badge className="bg-gray-100 text-gray-800">下書き</Badge>;
                          default:
                            return <Badge variant="outline">{status}</Badge>;
                        }
                      };
                      
                      return (
                        <div key={memory.id} className="p-4 border rounded-lg space-y-3">
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="text-xs font-medium text-gray-500">企業名</label>
                              <div className="flex items-center gap-2 mt-1">
                                <Building className="h-4 w-4 text-gray-400" />
                                <p className="text-sm">{companyName || '-'}</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">店舗名</label>
                              <div className="flex items-center gap-2 mt-1">
                                <Store className="h-4 w-4 text-gray-400" />
                                <p className="text-sm">{tenantName || '-'}</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">登録日</label>
                              <div className="flex items-center gap-2 mt-1">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <p className="text-sm">{formatDate(memory.createdAt)}</p>
                              </div>
                            </div>
                            <div>
                              <label className="text-xs font-medium text-gray-500">ステータス</label>
                              <div className="mt-1">
                                {getStatusBadge(memory.status)}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <label className="text-xs font-medium text-gray-500">タイトル</label>
                              <p className="text-sm font-medium mt-1">{memory.title || '無題'}</p>
                            </div>
                            {memory.publicPageId && (
                              <div className="col-span-2">
                                <label className="text-xs font-medium text-gray-500">公開ページリンク</label>
                                <a
                                  href={generatePublicPageUrl(memory.publicPageId)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-600 hover:underline text-sm flex items-center gap-1 mt-1"
                                >
                                  <ExternalLink className="h-3 w-3" />
                                  {generatePublicPageUrl(memory.publicPageId)}
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
                      <p>企業名・店舗名を取得中...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
          
          {/* 認証リクエスト情報 */}
          {claimRequest && (
            <Card>
              <CardHeader>
                <CardTitle>認証リクエスト情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">ステータス</label>
                  <p className="text-sm mt-1">{claimRequest.status}</p>
                </div>
                {claimRequest.publicPageUrl && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">公開ページURL</label>
                    <p className="text-sm mt-1">{claimRequest.publicPageUrl}</p>
                  </div>
                )}
                {claimRequest.loginUrl && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ログインURL</label>
                    <p className="text-sm mt-1">{claimRequest.loginUrl}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}


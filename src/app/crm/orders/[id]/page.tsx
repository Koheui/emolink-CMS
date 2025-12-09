'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowLeft, Mail, Calendar, ExternalLink, Radio, CheckCircle, XCircle, ShoppingCart, Package, Save, QrCode, User, Printer } from 'lucide-react';
import { getOrderDetail, updateOrderNFCStatus, updateOrderStatus } from '@/lib/firestore-crm';
import { Order } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { generatePublicPageUrl } from '@/lib/utils';
import { NFCWriterButton } from '@/components/nfc-writer-button';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { getCustomerDetail } from '@/lib/firestore-crm';
import { CustomerDetail } from '@/lib/firestore-crm';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function OrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const orderId = params.id as string;
  const { staff } = useSecretKeyAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [customerDetail, setCustomerDetail] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [publicPageUrl, setPublicPageUrl] = useState<string | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<Order['status'] | ''>('');
  const [companyName, setCompanyName] = useState<string | null>(null);
  const [tenantName, setTenantName] = useState<string | null>(null);
  
  useEffect(() => {
    if (orderId) {
      fetchOrderDetail();
    }
  }, [orderId]);
  
  useEffect(() => {
    if (order) {
      setSelectedStatus(order.status || '');
      fetchCompanyAndTenantNames();
    }
  }, [order]);
  
  const fetchCompanyAndTenantNames = async () => {
    if (!order) return;
    
    try {
      let targetTenantId = order.tenant;
      
      // lpIdがある場合は、lpIdから店舗名を取得
      if (order.lpId) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const tenantsRef = collection(db, 'tenants');
        const tenantsQuery = query(tenantsRef, where('allowedLpIds', 'array-contains', order.lpId));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        
        if (!tenantsSnapshot.empty) {
          // 最初に見つかったテナントを使用
          const tenantDoc = tenantsSnapshot.docs[0];
          const tenantData = tenantDoc.data();
          setTenantName(tenantData.name || null);
          targetTenantId = tenantDoc.id;
          
          // 企業名を取得（companyIdがある場合）
          if (tenantData.companyId) {
            const companyRef = doc(db, 'companies', tenantData.companyId);
            const companySnap = await getDoc(companyRef);
            if (companySnap.exists()) {
              const companyData = companySnap.data();
              setCompanyName(companyData.name || null);
            }
          }
        } else {
          // lpIdから見つからない場合は、tenantから取得
          const tenantRef = doc(db, 'tenants', order.tenant);
          const tenantSnap = await getDoc(tenantRef);
          if (tenantSnap.exists()) {
            const tenantData = tenantSnap.data();
            setTenantName(tenantData.name || null);
            
            if (tenantData.companyId) {
              const companyRef = doc(db, 'companies', tenantData.companyId);
              const companySnap = await getDoc(companyRef);
              if (companySnap.exists()) {
                const companyData = companySnap.data();
                setCompanyName(companyData.name || null);
              }
            }
          }
        }
      } else {
        // lpIdがない場合は、tenantから直接取得
        const tenantRef = doc(db, 'tenants', order.tenant);
        const tenantSnap = await getDoc(tenantRef);
        if (tenantSnap.exists()) {
          const tenantData = tenantSnap.data();
          setTenantName(tenantData.name || null);
          
          if (tenantData.companyId) {
            const companyRef = doc(db, 'companies', tenantData.companyId);
            const companySnap = await getDoc(companyRef);
            if (companySnap.exists()) {
              const companyData = companySnap.data();
              setCompanyName(companyData.name || null);
            }
          }
        }
      }
    } catch (err) {
      console.error('Error fetching company and tenant names:', err);
    }
  };
  
  const fetchOrderDetail = async () => {
    try {
      setLoading(true);
      const orderData = await getOrderDetail(orderId);
      if (!orderData) {
        setError('注文が見つかりませんでした');
        return;
      }
      setOrder(orderData);
      
      // 公開ページURLを取得
      let url: string | null = null;
      if (orderData.memoryId) {
        url = generatePublicPageUrl(orderData.memoryId);
      }
      setPublicPageUrl(url);
      
      // 顧客情報を取得（メールアドレスから）
      if (orderData.email) {
        try {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', orderData.email));
          const userSnapshot = await getDocs(userQuery);
          
          if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const detail = await getCustomerDetail(userDoc.id);
            if (detail) {
              setCustomerDetail(detail);
              
              if (detail.claimRequest?.publicPageUrl) {
                setPublicPageUrl(detail.claimRequest.publicPageUrl);
              } else if (detail.claimRequest?.publicPageId) {
                setPublicPageUrl(generatePublicPageUrl(detail.claimRequest.publicPageId));
              } else if (detail.publicPages.length > 0) {
                setPublicPageUrl(generatePublicPageUrl(detail.publicPages[0].id));
              } else if (detail.memories.length > 0) {
                const memoryWithPublicPage = detail.memories.find(m => m.publicPageId);
                if (memoryWithPublicPage?.publicPageId) {
                  setPublicPageUrl(generatePublicPageUrl(memoryWithPublicPage.publicPageId));
                }
              }
            }
          }
        } catch (err) {
          console.error('Error fetching customer detail:', err);
        }
      }
    } catch (err: any) {
      console.error('Error fetching order detail:', err);
      setError('注文情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const handleNFCWriteSuccess = async () => {
    if (!order || !staff) return;
    
    try {
      await updateOrderNFCStatus(order.id, staff.uid);
      await fetchOrderDetail();
    } catch (err) {
      console.error('Error updating NFC status:', err);
      alert('NFC書き込みステータスの更新に失敗しました');
    }
  };
  
  const handleMarkNFCWritten = async () => {
    if (!order || !staff) return;
    
    if (!confirm('NFC書き込み済みとしてマークしますか？')) {
      return;
    }
    
    try {
      setUpdatingStatus(true);
      await updateOrderNFCStatus(order.id, staff.uid);
      alert('NFC書き込み済みとしてマークしました');
      await fetchOrderDetail();
    } catch (err) {
      console.error('Error marking NFC as written:', err);
      alert('ステータスの更新に失敗しました');
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  const handleUpdateStatus = async () => {
    if (!order || !staff) {
      alert('注文情報またはスタッフ情報が取得できませんでした');
      return;
    }
    
    try {
      setUpdatingStatus(true);
      const updates: any = {};
      
      if (selectedStatus && selectedStatus !== order.status) {
        updates.status = selectedStatus;
      }
      
      if (Object.keys(updates).length === 0) {
        alert('変更がありません');
        return;
      }
      
      console.log('[Order Detail] Updating order status:', {
        orderId: order.id,
        updates,
        staffUid: staff.uid,
        staffRole: staff.role,
        staffTenant: staff.adminTenant,
        orderTenant: order.tenant
      });
      
      await updateOrderStatus(order.id, updates, staff.uid);
      alert('ステータスを更新しました');
      await fetchOrderDetail();
    } catch (err: any) {
      console.error('[Order Detail] Error updating status:', err);
      let errorMessage = 'ステータスの更新に失敗しました';
      
      if (err.code === 'permission-denied' || err.message?.includes('permission')) {
        errorMessage = '権限が不足しています。管理者に連絡してください。';
      } else if (err.message) {
        errorMessage = `ステータスの更新に失敗しました: ${err.message}`;
      }
      
      alert(errorMessage);
    } finally {
      setUpdatingStatus(false);
    }
  };
  
  const writerUrl = useMemo(() => {
    if (!publicPageUrl || !order?.id || typeof window === 'undefined') return '';
    const base = window.location.origin;
    return `${base}/nfc/write?orderId=${order.id}&url=${encodeURIComponent(publicPageUrl)}`;
  }, [publicPageUrl, order?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error || '注文が見つかりませんでした'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/crm/orders">
              <Button>注文一覧に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="h-screen bg-gray-50 p-3 overflow-hidden">
      <div className="h-full flex flex-col max-w-7xl mx-auto">
        <div className="mb-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">注文詳細</h1>
              <p className="text-gray-600 mt-0.5 text-xs">注文情報とNFC書き込み</p>
            </div>
            <div className="flex items-center gap-2">
              <Link href={`/crm/orders/${orderId}/print`} target="_blank">
                <Button variant="outline" size="sm">
                  <Printer className="h-3 w-3 mr-1" />
                  印刷
                </Button>
              </Link>
              <Link href="/crm/orders">
                <Button variant="outline" size="sm">
                  <ArrowLeft className="h-3 w-3 mr-1" />
                  戻る
                </Button>
              </Link>
            </div>
          </div>
        </div>
        
        {/* 公開URLとNFC書き込み用QRコード（トップ） */}
        {publicPageUrl && (
          <Card className="mb-2 flex-shrink-0">
            <CardHeader className="pb-2 pt-3">
              <CardTitle className="text-base flex items-center gap-2">
                <QrCode className="h-4 w-4" />
                NFC書き込み用QRコード
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">公開ページURL</label>
                  <a
                    href={publicPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline text-xs break-all flex items-center gap-1"
                  >
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                    {publicPageUrl}
                  </a>
                  <div className="mt-2 text-xs text-gray-500">
                    <p className="mb-1">📱 使い方:</p>
                    <ol className="list-decimal list-inside space-y-0.5">
                      <li>Android端末でQRコードを読み取る</li>
                      <li>書き込みページが開きます</li>
                      <li>「このURLを書き込む」ボタンを押す</li>
                      <li>NFCタグに端末を近づける</li>
                    </ol>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-0.5 block">NFC書き込み用QR</label>
                  <div className="flex justify-center">
                    {writerUrl ? (
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(writerUrl)}`}
                        alt="NFC書き込み用QRコード"
                        className="w-24 h-24"
                      />
                    ) : (
                      <div className="w-24 h-24 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-400">
                        QR生成中
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
        
        {/* 2カラムレイアウト */}
        <div className="grid grid-cols-2 gap-3 flex-1 overflow-hidden">
          {/* 左カラム */}
          <div className="space-y-3 overflow-y-auto">
            {/* 注文情報 */}
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <ShoppingCart className="h-4 w-4" />
                  注文情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div>
                  <label className="text-xs font-medium text-gray-500">メールアドレス</label>
                  <p className="text-sm mt-0.5">{order.email || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">お名前</label>
                  <p className="text-sm mt-0.5">
                    {customerDetail?.claimRequest?.customerInfo?.name || 
                     order.customerInfo?.name || 
                     order.shippingAddress?.name || 
                     '-'}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">商品名</label>
                  <p className="text-sm mt-0.5">{order.product || order.productType || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">企業名</label>
                  <p className="text-sm mt-0.5">{companyName || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">店舗名</label>
                  <p className="text-sm mt-0.5">{tenantName || '-'}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">注文日</label>
                  <p className="text-sm mt-0.5">{formatDate(order.createdAt)}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">注文ステータス</label>
                  <div className="mt-0.5">
                    {order.status ? (
                      <Badge className={
                        order.status === 'shipped' ? 'bg-blue-100 text-blue-800 text-xs' :
                        order.status === 'delivered' ? 'bg-purple-100 text-purple-800 text-xs' :
                        order.status === 'nfcReady' ? 'bg-yellow-100 text-yellow-800 text-xs' :
                        'bg-gray-100 text-gray-800 text-xs'
                      }>
                        {order.status === 'shipped' ? '発送済み' :
                         order.status === 'delivered' ? '配送完了' :
                         order.status === 'nfcReady' ? 'NFC書き込み待ち' :
                         order.status === 'paid' ? '決済完了' :
                         order.status === 'draft' ? '下書き' :
                         order.status}
                      </Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800 text-xs">未設定</Badge>
                    )}
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500">NFC書き込み情報</label>
                  <div className="mt-0.5 flex items-center gap-2">
                    {order.nfc?.written ? (
                      <>
                        <CheckCircle className="h-3 w-3 text-green-500" />
                        <span className="text-xs text-green-600">書き込み済み</span>
                        {order.nfc.writtenAt && (
                          <span className="text-xs text-gray-400">
                            ({formatDate(order.nfc.writtenAt)})
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        <XCircle className="h-3 w-3 text-gray-400" />
                        <span className="text-xs text-gray-500">未書き込み</span>
                      </>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            
            {/* 顧客情報 */}
            {customerDetail && (
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <User className="h-4 w-4" />
                    顧客情報
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  <div>
                    <label className="text-xs font-medium text-gray-500">UID</label>
                    <p className="text-sm mt-0.5 font-mono text-xs">{customerDetail.user.uid}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-500">emolinkページ数</label>
                    <p className="text-sm mt-0.5">{customerDetail.memories.length}件</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
          
          {/* 右カラム */}
          <div className="space-y-3 overflow-y-auto">
            {/* 進捗管理 */}
            <Card>
              <CardHeader className="pb-2 pt-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Package className="h-4 w-4" />
                  進捗管理
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 pt-0">
                <div>
                  <label className="text-xs font-medium text-gray-500 mb-1 block">注文ステータス</label>
                  <select
                    value={selectedStatus}
                    onChange={(e) => setSelectedStatus(e.target.value as Order['status'])}
                    className="w-full border rounded px-2 py-1.5 text-sm"
                  >
                    <option value="">変更しない</option>
                    <option value="draft">下書き</option>
                    <option value="paid">決済完了</option>
                    <option value="nfcReady">NFC書き込み待ち</option>
                    <option value="shipped">発送済み</option>
                    <option value="delivered">配送完了</option>
                  </select>
                </div>
                <div>
                  <Button
                    onClick={handleUpdateStatus}
                    disabled={updatingStatus}
                    className="w-full"
                    size="sm"
                  >
                    {updatingStatus ? (
                      <>
                        <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                        更新中...
                      </>
                    ) : (
                      <>
                        <Save className="h-3 w-3 mr-2" />
                        ステータスを更新
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
            
            {/* NFC書き込み */}
            {publicPageUrl && order.paymentStatus === 'completed' && (
              <Card>
                <CardHeader className="pb-2 pt-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Radio className="h-4 w-4" />
                    NFCタグ書き込み
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 pt-0">
                  {!order.nfc?.written && (
                    <>
                      <NFCWriterButton
                        url={publicPageUrl}
                        orderId={order.id}
                        onSuccess={handleNFCWriteSuccess}
                        disabled={false}
                        className="w-full"
                      />
                      <div className="pt-2 border-t">
                        <Button
                          onClick={handleMarkNFCWritten}
                          disabled={updatingStatus}
                          variant="outline"
                          className="w-full"
                          size="sm"
                        >
                          {updatingStatus ? (
                            <>
                              <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                              更新中...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-3 w-3 mr-2" />
                              手動で書き込み済みにマーク
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  )}
                  {order.nfc?.written && (
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <div>
                        <p className="text-xs font-medium text-green-800">NFC書き込み済み</p>
                        {order.nfc.writtenAt && (
                          <p className="text-xs text-green-600">
                            {formatDate(order.nfc.writtenAt)}
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

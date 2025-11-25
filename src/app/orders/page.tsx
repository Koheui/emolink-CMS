'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getOrdersByTenant, getAcrylicPhotosByOrder, getShippingInfoByOrder, updateOrder } from '@/lib/firestore';
import { Order, AcrylicPhoto, ShippingInfo, PRODUCT_TYPE_NAMES } from '@/types';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter } from 'next/navigation';
import AcrylicPhotoUpload from '@/components/acrylic-photo-upload';
import ShippingAddressForm from '@/components/shipping-address-form';

export default function OrderManagementDashboard() {
  const { currentUser, isAuthenticated, loading } = useSecretKeyAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [photos, setPhotos] = useState<AcrylicPhoto[]>([]);
  const [shippingInfo, setShippingInfo] = useState<ShippingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
      return;
    }

    if (isAuthenticated && currentUser) {
      loadOrders();
    }
  }, [isAuthenticated, loading, currentUser, router]);

  const loadOrders = async () => {
    try {
      setIsLoading(true);
      // テナント情報を取得（現在は固定値を使用）
      const tenant = 'futurestudio'; // TODO: 動的に取得
      const ordersData = await getOrdersByTenant(tenant);
      setOrders(ordersData);
    } catch (error) {
      console.error('Error loading orders:', error);
      setError('注文データの読み込み中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const loadOrderDetails = async (order: Order) => {
    try {
      setSelectedOrder(order);
      
      // 写真情報を取得
      const photosData = await getAcrylicPhotosByOrder(order.id);
      setPhotos(photosData);
      
      // 配送情報を取得
      const shippingData = await getShippingInfoByOrder(order.id);
      setShippingInfo(shippingData);
    } catch (error) {
      console.error('Error loading order details:', error);
      setError('注文詳細の読み込み中にエラーが発生しました。');
    }
  };

  const updateOrderStatus = async (orderId: string, status: 'payment_completed' | 'photo_upload_pending' | 'production_started' | 'production_completed' | 'shipped' | 'delivered') => {
    try {
      await updateOrder(orderId, { orderStatus: status });
      await loadOrders(); // リストを再読み込み
      if (selectedOrder?.id === orderId) {
        await loadOrderDetails({ ...selectedOrder, orderStatus: status });
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      setError('注文ステータスの更新中にエラーが発生しました。');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'payment_completed': { label: '決済完了', variant: 'default' as const },
      'photo_upload_pending': { label: '写真アップロード待ち', variant: 'secondary' as const },
      'production_started': { label: '制作開始', variant: 'outline' as const },
      'production_completed': { label: '制作完了', variant: 'outline' as const },
      'shipped': { label: '配送中', variant: 'outline' as const },
      'delivered': { label: '配送完了', variant: 'default' as const },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || { label: status, variant: 'secondary' as const };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  const sendLoginEmail = async (order: Order) => {
    if (!order.secretKey || !order.email) {
      setError('秘密鍵またはメールアドレスが設定されていません');
      return;
    }

    try {
      setSendingEmail(true);
      setError(null);

      const loginUrl = `${window.location.origin}/?mode=secretKey&key=${order.secretKey}`;
      
      // Cloud Functionを呼び出してメール送信
      const response = await fetch(
        'https://asia-northeast1-memorylink-cms.cloudfunctions.net/sendLoginEmail',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: order.email,
            secretKey: order.secretKey,
            loginUrl: loginUrl,
            tenantId: order.tenant || 'futurestudio',
            customerInfo: {
              name: order.email?.split('@')[0] || 'お客様',
            },
          }),
        }
      );

      if (!response.ok) {
        throw new Error('メール送信に失敗しました');
      }

      alert('ログイン情報をメールで送信しました');
    } catch (error) {
      console.error('Error sending email:', error);
      setError('メール送信中にエラーが発生しました');
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p>読み込み中...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">注文管理ダッシュボード</h1>
          <p className="mt-2 text-gray-600">アクリルスタンドの注文を管理します</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600">{error}</p>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 注文一覧 */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle>注文一覧</CardTitle>
                <CardDescription>
                  {orders.length}件の注文
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-4">
                    <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : orders.length === 0 ? (
                  <p className="text-gray-500 text-center py-4">注文がありません</p>
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div
                        key={order.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedOrder?.id === order.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => loadOrderDetails(order)}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-sm">#{order.id.slice(-8)}</p>
                            <p className="text-xs text-gray-500">
                              {PRODUCT_TYPE_NAMES[order.productType as keyof typeof PRODUCT_TYPE_NAMES] || order.productType}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDate(order.createdAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            {getStatusBadge(order.orderStatus || 'payment_completed')}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 注文詳細 */}
          <div className="lg:col-span-2">
            {selectedOrder ? (
              <div className="space-y-6">
                {/* 注文情報 */}
                <Card>
                  <CardHeader>
                    <CardTitle>注文詳細</CardTitle>
                    <CardDescription>
                      注文ID: {selectedOrder.id}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-500">プロダクトタイプ</p>
                        <p className="text-sm">{PRODUCT_TYPE_NAMES[selectedOrder.productType as keyof typeof PRODUCT_TYPE_NAMES] || selectedOrder.productType}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">注文ステータス</p>
                        <div className="mt-1">{getStatusBadge(selectedOrder.orderStatus || 'payment_completed')}</div>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">決済ステータス</p>
                        <p className="text-sm">{selectedOrder.paymentStatus || '未設定'}</p>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-500">作成日時</p>
                        <p className="text-sm">{formatDate(selectedOrder.createdAt)}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 写真アップロード */}
                {selectedOrder.productType === 'acrylic' && (
                  <Card>
                    <CardHeader>
                      <CardTitle>写真アップロード</CardTitle>
                      <CardDescription>
                        アクリルスタンド制作用の写真をアップロードしてください
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AcrylicPhotoUpload
                        order={selectedOrder}
                        onPhotoUploaded={(photo) => {
                          setPhotos([photo, ...photos]);
                          updateOrderStatus(selectedOrder.id, 'production_started');
                        }}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* 住所情報 */}
                <Card>
                  <CardHeader>
                    <CardTitle>配送先住所</CardTitle>
                    <CardDescription>
                      アクリルスタンドの配送先住所を設定してください
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ShippingAddressForm
                      order={selectedOrder}
                      shippingInfo={shippingInfo}
                      onAddressUpdated={(info) => setShippingInfo(info)}
                    />
                  </CardContent>
                </Card>

                {/* ログイン情報送信 */}
                {selectedOrder.secretKey && selectedOrder.email && (
                  <Card>
                    <CardHeader>
                      <CardTitle>ログイン情報</CardTitle>
                      <CardDescription>
                        顧客にログイン情報をメールで送信できます
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">秘密鍵</p>
                          <div className="font-mono bg-gray-100 p-2 rounded text-sm">
                            {selectedOrder.secretKey}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-700 mb-2">メールアドレス</p>
                          <div className="text-sm text-gray-600">
                            {selectedOrder.email}
                          </div>
                        </div>
                        <Button
                          onClick={() => sendLoginEmail(selectedOrder)}
                          disabled={sendingEmail}
                          className="w-full"
                        >
                          {sendingEmail ? (
                            <>
                              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                              送信中...
                            </>
                          ) : (
                            'ログイン情報をメール送信'
                          )}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* アクション */}
                <Card>
                  <CardHeader>
                    <CardTitle>注文アクション</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex space-x-2">
                      {selectedOrder.orderStatus === 'production_started' && (
                        <Button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'production_completed')}
                          variant="outline"
                        >
                          制作完了
                        </Button>
                      )}
                      {selectedOrder.orderStatus === 'production_completed' && (
                        <Button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'shipped')}
                          variant="outline"
                        >
                          配送開始
                        </Button>
                      )}
                      {selectedOrder.orderStatus === 'shipped' && (
                        <Button
                          onClick={() => updateOrderStatus(selectedOrder.id, 'delivered')}
                          variant="outline"
                        >
                          配送完了
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="text-center py-12">
                  <p className="text-gray-500">注文を選択してください</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

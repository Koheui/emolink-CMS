'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Users, Building, Loader2, ShoppingCart, TrendingUp } from 'lucide-react';
import { getAllUsers, getAllTenants, getAllOrders } from '@/lib/firestore-crm';
import { User, Tenant, Order } from '@/types';
import Link from 'next/link';
import { AnimatedCard } from '@/components/animated-card';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

export default function CRMPage() {
  const router = useRouter();
  const { staff } = useSecretKeyAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (staff) {
      console.log('[CRM] Staff found, fetching data...', staff);
    fetchData();
    } else {
      console.log('[CRM] No staff found, waiting...');
      // staffが存在しない場合でも、loadingをfalseにしてエラーを表示
      setLoading(false);
      setError('スタッフ情報が取得できませんでした');
    }
  }, [staff]);
  
  const fetchData = async () => {
    if (!staff) {
      setError('スタッフ情報が取得できませんでした');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // スタッフのテナント情報を渡す（superAdminの場合はnull）
      const staffTenant = staff.role === 'superAdmin' ? null : staff.adminTenant;
      console.log('[CRM] Fetching data with staffTenant:', staffTenant);
      const [usersData, tenantsData, ordersData] = await Promise.all([
        getAllUsers(staffTenant),
        getAllTenants(staffTenant),
        getAllOrders(staffTenant),
      ]);
      console.log('[CRM] Fetched users:', usersData.length, 'tenants:', tenantsData.length, 'orders:', ordersData.length);
      setUsers(usersData);
      setTenants(tenantsData);
      setOrders(ordersData);
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError('データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchData}>再試行</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in-down">
          <h1 className="text-3xl font-bold text-gray-900">CRM管理画面</h1>
          <p className="text-gray-600 mt-2">顧客情報と店舗情報を管理します</p>
        </div>
        
        <div className="grid gap-6 md:grid-cols-3">
          {/* 注文管理カード */}
          <AnimatedCard delay={0} variant="fade-in-up">
            <Card className="hover:shadow-lg transition-shadow duration-300 border-yellow-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <ShoppingCart className="h-5 w-5" />
                      注文管理
                    </CardTitle>
                    <CardDescription>新規注文とNFC書き込み</CardDescription>
                  </div>
                  <div className="text-2xl font-bold text-yellow-600">{orders.length}</div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-2">
                  全{orders.length}件の注文
                </p>
                <p className="text-sm font-semibold text-yellow-700 mb-4">
                  NFC書き込み待ち: {orders.filter(o => o.paymentStatus === 'completed' && !o.nfc?.written).length}件
                </p>
                <Link href="/crm/orders">
                  <Button className="w-full transition-transform duration-200 hover:scale-105 bg-yellow-600 hover:bg-yellow-700">注文一覧を見る</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedCard>
          
          {/* 顧客情報カード */}
          <AnimatedCard delay={100} variant="fade-in-up">
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      顧客情報
                    </CardTitle>
                    <CardDescription>登録されている顧客の一覧</CardDescription>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{users.length}</div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  全{users.length}件の顧客が登録されています
                </p>
                <Link href="/crm/customers">
                  <Button className="w-full transition-transform duration-200 hover:scale-105">顧客一覧を見る</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedCard>
          
          {/* 店舗情報カード */}
          <AnimatedCard delay={200} variant="fade-in-up">
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      店舗情報
                    </CardTitle>
                    <CardDescription>登録されている店舗の一覧</CardDescription>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{tenants.length}</div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  全{tenants.length}件の店舗が登録されています
                </p>
                <Link href="/crm/tenants">
                  <Button className="w-full transition-transform duration-200 hover:scale-105">店舗一覧を見る</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedCard>
        </div>
        
        {/* 企業情報カード（superAdminのみ表示） */}
        {staff?.role === 'superAdmin' && (
          <AnimatedCard delay={250} variant="fade-in-up" className="mt-6">
            <Card className="hover:shadow-lg transition-shadow duration-300">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building className="h-5 w-5" />
                      企業情報
                    </CardTitle>
                    <CardDescription>登録されている企業の一覧（スーパー管理者のみ）</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600 mb-4">
                  企業情報を管理します
                </p>
                <Link href="/crm/companies">
                  <Button className="w-full transition-transform duration-200 hover:scale-105">企業一覧を見る</Button>
                </Link>
              </CardContent>
            </Card>
          </AnimatedCard>
        )}
        
        {/* 販売数管理 */}
        <AnimatedCard delay={300} variant="fade-in-up" className="mt-6">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    販売数管理
                  </CardTitle>
                  <CardDescription>月締め請求用の販売リスト</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600 mb-4">
                決済完了済みの注文を月別に集計・エクスポートできます
              </p>
              <Link href="/crm/sales">
                <Button className="w-full transition-transform duration-200 hover:scale-105">販売数管理を見る</Button>
              </Link>
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>
    </div>
  );
}


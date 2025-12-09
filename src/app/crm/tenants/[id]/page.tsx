'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building, Calendar, ArrowLeft } from 'lucide-react';
import { getTenantDetail } from '@/lib/firestore-crm';
import { Tenant } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    if (tenantId) {
      fetchTenantDetail();
    }
  }, [tenantId]);
  
  const fetchTenantDetail = async () => {
    try {
      setLoading(true);
      const tenantData = await getTenantDetail(tenantId);
      if (!tenantData) {
        setError('店舗が見つかりませんでした');
        return;
      }
      setTenant(tenantData);
    } catch (err: any) {
      console.error('Error fetching tenant detail:', err);
      setError('店舗情報の取得に失敗しました');
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
  
  if (error || !tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error || '店舗が見つかりませんでした'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/crm/tenants">
              <Button>店舗一覧に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Building className="h-8 w-8" />
                店舗詳細
              </h1>
              <p className="text-gray-600 mt-2">店舗情報の詳細を表示します</p>
            </div>
            <Link href="/crm/tenants">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
            </Link>
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
                <label className="text-sm font-medium text-gray-500">店舗ID</label>
                <p className="text-sm mt-1">
                  <Badge variant="outline">{tenant.id}</Badge>
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">店舗名</label>
                <p className="text-sm mt-1">{tenant.name}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">説明</label>
                <p className="text-sm mt-1">{tenant.description || '-'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  登録日
                </label>
                <p className="text-sm mt-1">{formatDate(tenant.createdAt)}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">ステータス</label>
                <div className="mt-1">
                  <Badge 
                    variant={tenant.status === 'active' ? 'default' : 'secondary'}
                  >
                    {tenant.status === 'active' ? '有効' : tenant.status === 'inactive' ? '無効' : '停止中'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
          
          {/* 設定情報 */}
          <Card>
            <CardHeader>
              <CardTitle>設定情報</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500">許可されたLP ID</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tenant.allowedLpIds && tenant.allowedLpIds.length > 0 ? (
                    tenant.allowedLpIds.map((lpId) => (
                      <Badge key={lpId} variant="outline">{lpId}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500">有効な商品タイプ</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {tenant.enabledProductTypes && tenant.enabledProductTypes.length > 0 ? (
                    tenant.enabledProductTypes.map((productType) => (
                      <Badge key={productType} variant="outline">{productType}</Badge>
                    ))
                  ) : (
                    <span className="text-sm text-gray-500">-</span>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}




'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building, Calendar, ArrowLeft, Mail, Phone, MapPin, Users, FileText, ShoppingCart, ExternalLink } from 'lucide-react';
import { getTenantDetail, TenantDetailWithCompany } from '@/lib/firestore-crm';
import { Tenant } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;
  const [tenant, setTenant] = useState<TenantDetailWithCompany | null>(null);
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
          {/* 企業情報 */}
          {tenant.company && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building className="h-5 w-5" />
                  企業情報
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-500">企業ID</label>
                  <p className="text-sm mt-1">
                    <Badge variant="outline">{tenant.company.id}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">企業名</label>
                  <p className="text-sm mt-1 font-medium">{tenant.company.name}</p>
                </div>
                {tenant.company.legalName && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">正式名称</label>
                    <p className="text-sm mt-1">{tenant.company.legalName}</p>
                  </div>
                )}
                {tenant.company.description && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">説明</label>
                    <p className="text-sm mt-1">{tenant.company.description}</p>
                  </div>
                )}
                {tenant.company.contact && (
                  <>
                    {tenant.company.contact.name && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                          <Users className="h-4 w-4" />
                          担当者名
                        </label>
                        <p className="text-sm mt-1">{tenant.company.contact.name}</p>
                      </div>
                    )}
                    {tenant.company.contact.email && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          メールアドレス
                        </label>
                        <p className="text-sm mt-1">
                          <a href={`mailto:${tenant.company.contact.email}`} className="text-blue-600 hover:underline">
                            {tenant.company.contact.email}
                          </a>
                        </p>
                      </div>
                    )}
                    {tenant.company.contact.phone && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                          <Phone className="h-4 w-4" />
                          電話番号
                        </label>
                        <p className="text-sm mt-1">
                          <a href={`tel:${tenant.company.contact.phone}`} className="text-blue-600 hover:underline">
                            {tenant.company.contact.phone}
                          </a>
                        </p>
                      </div>
                    )}
                    {tenant.company.contact.address && (
                      <div>
                        <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                          <MapPin className="h-4 w-4" />
                          住所
                        </label>
                        <p className="text-sm mt-1">{tenant.company.contact.address}</p>
                      </div>
                    )}
                  </>
                )}
                {tenant.company.status && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ステータス</label>
                    <div className="mt-1">
                      <Badge 
                        variant={tenant.company.status === 'active' ? 'default' : 'secondary'}
                      >
                        {tenant.company.status === 'active' ? '有効' : tenant.company.status === 'inactive' ? '無効' : '停止中'}
                      </Badge>
                    </div>
                  </div>
                )}
                {tenant.companyId && (
                  <div className="pt-2 border-t">
                    <Link href={`/crm/companies/${tenant.companyId}`}>
                      <Button variant="outline" size="sm">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        企業詳細を見る
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* 基本情報 */}
          <Card>
            <CardHeader>
              <CardTitle>店舗基本情報</CardTitle>
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
                <p className="text-sm mt-1 font-medium">{tenant.name}</p>
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
                <label className="text-sm font-medium text-gray-500">更新日</label>
                <p className="text-sm mt-1">{formatDate(tenant.updatedAt)}</p>
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
          
          {/* 連絡先情報 */}
          {tenant.contact && (
            <Card>
              <CardHeader>
                <CardTitle>店舗連絡先情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tenant.contact.email && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Mail className="h-4 w-4" />
                      メールアドレス
                    </label>
                    <p className="text-sm mt-1">
                      <a href={`mailto:${tenant.contact.email}`} className="text-blue-600 hover:underline">
                        {tenant.contact.email}
                      </a>
                    </p>
                  </div>
                )}
                {tenant.contact.phone && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      電話番号
                    </label>
                    <p className="text-sm mt-1">
                      <a href={`tel:${tenant.contact.phone}`} className="text-blue-600 hover:underline">
                        {tenant.contact.phone}
                      </a>
                    </p>
                  </div>
                )}
                {tenant.contact.address && (
                  <div>
                    <label className="text-sm font-medium text-gray-500 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      住所
                    </label>
                    <p className="text-sm mt-1">
                      {tenant.contact.postalCode && (
                        <span className="mr-2">〒{tenant.contact.postalCode}</span>
                      )}
                      {tenant.contact.address}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* 統計情報 */}
          <Card>
            <CardHeader>
              <CardTitle>統計情報</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-blue-600" />
                    <label className="text-sm font-medium text-gray-700">スタッフ数</label>
                  </div>
                  <p className="text-2xl font-bold text-blue-600">{tenant.staffCount || 0}人</p>
                </div>
                <div className="p-4 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-5 w-5 text-green-600" />
                    <label className="text-sm font-medium text-gray-700">想い出ページ数</label>
                  </div>
                  <p className="text-2xl font-bold text-green-600">{tenant.memoryCount || 0}件</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <ShoppingCart className="h-5 w-5 text-yellow-600" />
                    <label className="text-sm font-medium text-gray-700">注文数</label>
                  </div>
                  <p className="text-2xl font-bold text-yellow-600">{tenant.orderCount || 0}件</p>
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
              {tenant.settings?.fulfillmentMode && (
                <div>
                  <label className="text-sm font-medium text-gray-500">履行モード</label>
                  <p className="text-sm mt-1">
                    {tenant.settings.fulfillmentMode === 'tenantDirect' ? '店舗直接' : 'ベンダー直接'}
                  </p>
                </div>
              )}
              {tenant.settings?.maxClaimRequestsPerHour && (
                <div>
                  <label className="text-sm font-medium text-gray-500">時間あたりの最大クレームリクエスト数</label>
                  <p className="text-sm mt-1">{tenant.settings.maxClaimRequestsPerHour}件/時間</p>
                </div>
              )}
            </CardContent>
          </Card>
          
          {/* ブランディング情報 */}
          {tenant.settings?.branding && (
            <Card>
              <CardHeader>
                <CardTitle>ブランディング情報</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {tenant.settings.branding.logo && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">ロゴURL</label>
                    <p className="text-sm mt-1">
                      <a href={tenant.settings.branding.logo} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        {tenant.settings.branding.logo}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                )}
                {tenant.settings.branding.bannerImageUrl && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">バナー画像URL</label>
                    <p className="text-sm mt-1">
                      <a href={tenant.settings.branding.bannerImageUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        {tenant.settings.branding.bannerImageUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                )}
                {tenant.settings.branding.bannerLinkUrl && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">バナーリンクURL</label>
                    <p className="text-sm mt-1">
                      <a href={tenant.settings.branding.bannerLinkUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline flex items-center gap-1">
                        {tenant.settings.branding.bannerLinkUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                )}
                {tenant.settings.branding.theme && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">テーマ</label>
                    <p className="text-sm mt-1">{tenant.settings.branding.theme}</p>
                  </div>
                )}
                {tenant.settings.branding.colors && tenant.settings.branding.colors.length > 0 && (
                  <div>
                    <label className="text-sm font-medium text-gray-500">カラー</label>
                    <div className="flex flex-wrap gap-2 mt-1">
                      {tenant.settings.branding.colors.map((color, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <div 
                            className="w-6 h-6 rounded border border-gray-300" 
                            style={{ backgroundColor: color }}
                          />
                          <span className="text-sm">{color}</span>
                        </div>
                      ))}
                    </div>
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






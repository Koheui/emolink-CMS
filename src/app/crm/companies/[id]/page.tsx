'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building, Calendar, ArrowLeft, Store, Users, Mail, Phone, MapPin, ExternalLink } from 'lucide-react';
import { getCompanyDetail } from '@/lib/firestore-crm';
import { Company, Tenant, Staff } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function CompanyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const companyId = params.id as string;
  const [company, setCompany] = useState<Company | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'tenants' | 'staff'>('tenants');
  
  useEffect(() => {
    if (companyId) {
      fetchCompanyDetail();
    }
  }, [companyId]);
  
  const fetchCompanyDetail = async () => {
    try {
      setLoading(true);
      const detail = await getCompanyDetail(companyId);
      if (!detail) {
        setError('企業が見つかりませんでした');
        return;
      }
      setCompany(detail.company);
      setTenants(detail.tenants);
      setStaff(detail.staff);
    } catch (err: any) {
      console.error('Error fetching company detail:', err);
      setError('企業情報の取得に失敗しました');
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
  
  if (error || !company) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error || '企業が見つかりませんでした'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/crm/companies">
              <Button>企業一覧に戻る</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // スタッフをロール別に分類
  const adminStaff = staff.filter(s => s.role === 'tenantAdmin' || s.role === 'superAdmin');
  const editorStaff = staff.filter(s => s.role === 'editor');
  const otherStaff = staff.filter(s => s.role === 'viewer' || (!adminStaff.includes(s) && !editorStaff.includes(s)));
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Building className="h-8 w-8" />
                {company.name}
              </h1>
              <p className="text-gray-600 mt-2">企業ID: {company.id}</p>
            </div>
            <Link href="/crm/companies">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                戻る
              </Button>
            </Link>
          </div>
        </div>
        
        <div className="space-y-6">
          {/* タブボタン */}
          <div className="flex gap-2 border-b">
            <button
              onClick={() => setActiveTab('tenants')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'tenants'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Store className="h-4 w-4 inline mr-2" />
              店舗 ({tenants.length})
            </button>
            <button
              onClick={() => setActiveTab('staff')}
              className={`px-4 py-2 font-medium text-sm transition-colors ${
                activeTab === 'staff'
                  ? 'border-b-2 border-blue-600 text-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              スタッフ ({staff.length})
            </button>
          </div>
          
          {/* 店舗タグ */}
          {activeTab === 'tenants' && (
            <Card>
              <CardHeader>
                <CardTitle>店舗一覧</CardTitle>
                <CardDescription>この企業に紐づく店舗情報</CardDescription>
              </CardHeader>
              <CardContent>
                {tenants.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">店舗が登録されていません</p>
                ) : (
                  <div className="space-y-4">
                    {tenants.map((tenant) => (
                      <div key={tenant.id} className="p-4 border rounded-lg space-y-3">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <label className="text-xs font-medium text-gray-500">店舗名</label>
                            <p className="text-sm font-medium mt-1">{tenant.name}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">店舗ID</label>
                            <p className="text-sm font-mono mt-1">{tenant.id}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">郵便番号</label>
                            <p className="text-sm mt-1">{tenant.contact?.postalCode || '-'}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">配送先住所</label>
                            <p className="text-sm mt-1">{tenant.contact?.address || '-'}</p>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">電話番号</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="h-4 w-4 text-gray-400" />
                              <p className="text-sm">{tenant.contact?.phone || '-'}</p>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-500">店舗メールアドレス</label>
                            <div className="flex items-center gap-2 mt-1">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <p className="text-sm">{tenant.contact?.email || '-'}</p>
                            </div>
                          </div>
                          {tenant.settings?.branding?.bannerLinkUrl && (
                            <div className="col-span-2">
                              <label className="text-xs font-medium text-gray-500">バナーリンク</label>
                              <div className="mt-1">
                                {tenant.settings?.branding?.bannerImageUrl ? (
                                  <a
                                    href={tenant.settings.branding.bannerLinkUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-blue-600 hover:underline flex items-center gap-1 text-sm"
                                  >
                                    <ExternalLink className="h-3 w-3" />
                                    {tenant.settings.branding.bannerLinkUrl}
                                  </a>
                                ) : (
                                  <p className="text-sm">{tenant.settings.branding.bannerLinkUrl}</p>
                                )}
                              </div>
                            </div>
                          )}
                          {tenant.settings?.branding?.bannerImageUrl && (
                            <div className="col-span-2">
                              <label className="text-xs font-medium text-gray-500">バナー画像URL</label>
                              <p className="text-sm break-all mt-1">{tenant.settings.branding.bannerImageUrl}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
          
          {/* スタッフタグ */}
          {activeTab === 'staff' && (
            <Card>
              <CardHeader>
                <CardTitle>スタッフ一覧</CardTitle>
                <CardDescription>この企業に紐づくスタッフ情報</CardDescription>
              </CardHeader>
              <CardContent>
                {staff.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">スタッフが登録されていません</p>
                ) : (
                  <div className="space-y-6">
                    {/* 管理者 */}
                    {adminStaff.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">管理者</h3>
                        <div className="space-y-3">
                          {adminStaff.map((s) => (
                            <div key={s.uid} className="p-4 border rounded-lg">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-gray-500">管理者名</label>
                                  <p className="text-sm font-medium mt-1">{s.displayName || '-'}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500">メールアドレス</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <p className="text-sm">{s.email}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* 編集者 */}
                    {editorStaff.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">編集者</h3>
                        <div className="space-y-3">
                          {editorStaff.map((s) => (
                            <div key={s.uid} className="p-4 border rounded-lg">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-gray-500">編集者名</label>
                                  <p className="text-sm font-medium mt-1">{s.displayName || '-'}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500">メールアドレス</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <p className="text-sm">{s.email}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* その他のスタッフ */}
                    {otherStaff.length > 0 && (
                      <div>
                        <h3 className="text-lg font-semibold mb-4">スタッフ</h3>
                        <div className="space-y-3">
                          {otherStaff.map((s) => (
                            <div key={s.uid} className="p-4 border rounded-lg">
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-xs font-medium text-gray-500">スタッフ名</label>
                                  <p className="text-sm font-medium mt-1">{s.displayName || '-'}</p>
                                </div>
                                <div>
                                  <label className="text-xs font-medium text-gray-500">メールアドレス</label>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Mail className="h-4 w-4 text-gray-400" />
                                    <p className="text-sm">{s.email}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
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


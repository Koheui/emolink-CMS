'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building, Search, Loader2, Calendar } from 'lucide-react';
import { getAllTenants, TenantWithCompany } from '@/lib/firestore-crm';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export default function TenantsPage() {
  const [tenants, setTenants] = useState<TenantWithCompany[]>([]);
  const [filteredTenants, setFilteredTenants] = useState<TenantWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [groupByCompany, setGroupByCompany] = useState<boolean>(false);
  
  useEffect(() => {
    fetchTenants();
  }, []);
  
  useEffect(() => {
    // 検索フィルタリング
    let filtered = tenants;
    if (searchTerm) {
      filtered = tenants.filter(tenant => 
        tenant.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        tenant.companyName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // 企業ごとにグループ化
    if (groupByCompany) {
      const grouped = filtered.reduce((acc, tenant) => {
        const companyKey = tenant.companyName || '企業未設定';
        if (!acc[companyKey]) {
          acc[companyKey] = [];
        }
        acc[companyKey].push(tenant);
        return acc;
      }, {} as Record<string, TenantWithCompany[]>);
      
      // グループ化されたデータをフラット化（企業名でソート）
      const sortedGroups = Object.keys(grouped).sort();
      const groupedTenants = sortedGroups.flatMap(companyName => grouped[companyName]);
      setFilteredTenants(groupedTenants);
    } else {
      setFilteredTenants(filtered);
    }
  }, [searchTerm, tenants, groupByCompany]);
  
  const fetchTenants = async () => {
    try {
      setLoading(true);
      const tenantsData = await getAllTenants();
      setTenants(tenantsData);
      setFilteredTenants(tenantsData);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
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
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchTenants}>再試行</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Building className="h-8 w-8" />
                店舗一覧
              </h1>
              <p className="text-gray-600 mt-2">全{tenants.length}件の店舗が登録されています</p>
            </div>
            <Link href="/crm">
              <Button variant="outline">戻る</Button>
            </Link>
          </div>
        </div>
        
        {/* 検索バーとフィルタ */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-5 w-5 text-gray-400" />
                <Input
                  placeholder="店舗名、ID、説明、企業名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={groupByCompany}
                  onChange={(e) => setGroupByCompany(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-medium">企業ごとにグループ化</span>
              </label>
            </div>
          </CardContent>
        </Card>
        
        {/* 店舗一覧テーブル */}
        <Card>
          <CardHeader>
            <CardTitle>店舗情報</CardTitle>
            <CardDescription>登録されている店舗の一覧</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4 font-semibold">登録日</th>
                    <th className="text-left p-4 font-semibold">企業名</th>
                    <th className="text-left p-4 font-semibold">店舗ID</th>
                    <th className="text-left p-4 font-semibold">店舗名</th>
                    <th className="text-left p-4 font-semibold">説明</th>
                    <th className="text-left p-4 font-semibold">ステータス</th>
                    <th className="text-left p-4 font-semibold">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTenants.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="text-center p-8 text-gray-500">
                        店舗が見つかりませんでした
                      </td>
                    </tr>
                  ) : (
                    filteredTenants.map((tenant, index) => {
                      // 企業ごとにグループ化する場合、企業名が変わったら区切り線を表示
                      const showCompanyDivider = groupByCompany && index > 0 && 
                        filteredTenants[index - 1].companyName !== tenant.companyName;
                      
                      return (
                        <React.Fragment key={tenant.id}>
                          {showCompanyDivider && (
                            <tr>
                              <td colSpan={7} className="p-2 bg-gray-100 border-t-2 border-gray-300"></td>
                            </tr>
                          )}
                          <tr className="border-b hover:bg-gray-50">
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Calendar className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{formatDate(tenant.createdAt)}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              {tenant.companyName ? (
                                <span className="text-sm font-medium text-blue-600">{tenant.companyName}</span>
                              ) : (
                                <span className="text-sm text-gray-400">-</span>
                              )}
                            </td>
                            <td className="p-4">
                              <Badge variant="outline">{tenant.id}</Badge>
                            </td>
                            <td className="p-4">
                              <span className="text-sm font-medium">{tenant.name}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-gray-600">{tenant.description || '-'}</span>
                            </td>
                            <td className="p-4">
                              <Badge 
                                variant={tenant.status === 'active' ? 'default' : 'secondary'}
                              >
                                {tenant.status === 'active' ? '有効' : tenant.status === 'inactive' ? '無効' : '停止中'}
                              </Badge>
                            </td>
                            <td className="p-4">
                              <Link href={`/crm/tenants/${tenant.id}`}>
                                <Button variant="outline" size="sm">詳細</Button>
                              </Link>
                            </td>
                          </tr>
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}






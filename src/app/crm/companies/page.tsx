'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Building, Search, Loader2, Mail, Phone, MapPin, Calendar, Store, Users } from 'lucide-react';
import { getAllCompanies } from '@/lib/firestore-crm';
import { Company } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { AnimatedCard } from '@/components/animated-card';
import { AnimatedTableRow } from '@/components/animated-list';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { collection, query, where, getDocs, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface CompanyWithCounts extends Company {
  tenantCount?: number;
  staffCount?: number;
}

export default function CompaniesPage() {
  const router = useRouter();
  const { staff } = useSecretKeyAuth();
  const [companies, setCompanies] = useState<CompanyWithCounts[]>([]);
  const [filteredCompanies, setFilteredCompanies] = useState<CompanyWithCounts[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    if (staff) {
      // superAdminのみ企業一覧を表示
      if (staff.role === 'superAdmin') {
        fetchCompanies();
      } else {
        setError('企業一覧はスーパー管理者のみ閲覧可能です');
        setLoading(false);
      }
    }
  }, [staff]);
  
  useEffect(() => {
    // 検索フィルタリング
    if (searchTerm) {
      const filtered = companies.filter(company => 
        company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.legalName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        company.contact?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCompanies(filtered);
    } else {
      setFilteredCompanies(companies);
    }
  }, [searchTerm, companies]);
  
  const fetchTenantAndStaffCounts = async (companyId: string): Promise<{ tenantCount: number; staffCount: number }> => {
    try {
      // 店舗登録数を取得
      const tenantsRef = collection(db, 'tenants');
      const tenantsQuery = query(tenantsRef, where('companyId', '==', companyId));
      const tenantCountSnapshot = await getCountFromServer(tenantsQuery);
      const tenantCount = tenantCountSnapshot.data().count;
      
      // スタッフ登録数を取得
      const staffRef = collection(db, 'staff');
      const staffQuery = query(staffRef, where('companyId', '==', companyId));
      const staffCountSnapshot = await getCountFromServer(staffQuery);
      const staffCount = staffCountSnapshot.data().count;
      
      return { tenantCount, staffCount };
    } catch (err) {
      console.error('Error fetching counts:', err);
      return { tenantCount: 0, staffCount: 0 };
    }
  };
  
  const fetchCompanies = async () => {
    try {
      setLoading(true);
      const companiesData = await getAllCompanies();
      
      // 各企業に対して店舗登録数とスタッフ登録数を取得
      const companiesWithCounts = await Promise.all(
        companiesData.map(async (company) => {
          const { tenantCount, staffCount } = await fetchTenantAndStaffCounts(company.id);
          return {
            ...company,
            tenantCount,
            staffCount,
          } as CompanyWithCounts;
        })
      );
      
      setCompanies(companiesWithCounts);
      setFilteredCompanies(companiesWithCounts);
    } catch (err: any) {
      console.error('Error fetching companies:', err);
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
  
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>エラー</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button onClick={fetchCompanies}>再試行</Button>
              <Link href="/crm">
                <Button variant="outline">戻る</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-100 text-green-800">アクティブ</Badge>;
      case 'inactive':
        return <Badge className="bg-gray-100 text-gray-800">非アクティブ</Badge>;
      case 'suspended':
        return <Badge className="bg-red-100 text-red-800">停止中</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in-down">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Building className="h-8 w-8" />
                企業一覧
              </h1>
              <p className="text-gray-600 mt-2">全{companies.length}件の企業が登録されています</p>
            </div>
            <Link href="/crm">
              <Button variant="outline" className="transition-transform duration-200 hover:scale-105">戻る</Button>
            </Link>
          </div>
        </div>
        
        {/* 検索バー */}
        <AnimatedCard delay={0} variant="fade-in-up" className="mb-6">
          <Card className="hover:shadow-md transition-shadow duration-300">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2">
                <Search className="h-5 w-5 text-gray-400" />
                <Input
                  placeholder="企業名、正式名称、企業ID、メールアドレスで検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
        
        {/* 企業一覧テーブル */}
        <AnimatedCard delay={100} variant="fade-in-up">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>企業情報</CardTitle>
              <CardDescription>DATABASE_DESIGN.mdの仕様に基づく企業情報一覧</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">企業名</th>
                      <th className="text-left p-4 font-semibold">企業ID</th>
                      <th className="text-left p-4 font-semibold">店舗登録数</th>
                      <th className="text-left p-4 font-semibold">スタッフ登録数</th>
                      <th className="text-left p-4 font-semibold">メールアドレス</th>
                      <th className="text-left p-4 font-semibold">担当者名</th>
                      <th className="text-left p-4 font-semibold">企業電話番号</th>
                      <th className="text-left p-4 font-semibold">企業住所</th>
                      <th className="text-left p-4 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-gray-500">
                          企業が見つかりませんでした
                        </td>
                      </tr>
                    ) : (
                      filteredCompanies.map((company, index) => {
                        return (
                          <AnimatedTableRow key={company.id} index={index} staggerDelay={30}>
                            <td className="p-4">
                              <span className="text-sm font-medium">{company.name}</span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm font-mono">{company.id}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Store className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{company.tenantCount ?? 0}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{company.staffCount ?? 0}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{company.contact?.email || '-'}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <span className="text-sm">{company.contact?.name || '-'}</span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-gray-400" />
                                <span className="text-sm">{company.contact?.phone || '-'}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                <MapPin className="h-4 w-4 text-gray-400" />
                                <span className="text-sm truncate max-w-xs">{company.contact?.address || '-'}</span>
                              </div>
                            </td>
                            <td className="p-4">
                              <Link href={`/crm/companies/${company.id}`}>
                                <Button variant="outline" size="sm" className="transition-transform duration-200 hover:scale-105">
                                  詳細
                                </Button>
                              </Link>
                            </td>
                          </AnimatedTableRow>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
      </div>
    </div>
  );
}


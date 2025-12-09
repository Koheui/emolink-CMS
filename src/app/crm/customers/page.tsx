'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Users, Search, Loader2, Mail } from 'lucide-react';
import { getAllCustomersFromClaimRequests, CustomerListItem } from '@/lib/firestore-crm';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { AnimatedCard } from '@/components/animated-card';
import { AnimatedTableRow } from '@/components/animated-list';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

export default function CustomersPage() {
  const router = useRouter();
  const { staff } = useSecretKeyAuth();
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [filteredCustomers, setFilteredCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  useEffect(() => {
    if (staff) {
      fetchCustomers();
    }
  }, [staff]);
  
  useEffect(() => {
    // 検索フィルタリング
    if (searchTerm) {
      const filtered = customers.filter(customer => 
        customer.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        customer.customerName.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredCustomers(filtered);
    } else {
      setFilteredCustomers(customers);
    }
  }, [searchTerm, customers]);
  
  const fetchCustomers = async () => {
    if (!staff) {
      setError('スタッフ情報が取得できませんでした');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // スタッフのテナント情報を渡す（superAdminの場合はnull）
      const staffTenant = staff.role === 'superAdmin' ? null : staff.adminTenant;
      console.log('[CRM Customers Page] Staff info:', {
        role: staff.role,
        adminTenant: staff.adminTenant,
        staffTenant
      });
      const customersData = await getAllCustomersFromClaimRequests(staffTenant);
      console.log('[CRM Customers Page] Fetched customers:', customersData.length);
      setCustomers(customersData);
      setFilteredCustomers(customersData);
    } catch (err: any) {
      console.error('[CRM Customers Page] Error fetching customers:', err);
      setError('顧客情報の取得に失敗しました');
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
            <Button onClick={fetchCustomers}>再試行</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in-down">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="h-8 w-8" />
                顧客一覧
              </h1>
              <p className="text-gray-600 mt-2">全{customers.length}件の顧客が登録されています</p>
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
                  placeholder="メールアドレス、顧客名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
        
        {/* 顧客一覧テーブル */}
        <AnimatedCard delay={100} variant="fade-in-up">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>顧客情報</CardTitle>
              <CardDescription>メールアドレス、顧客名、emolinkページの件数を表示</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">メールアドレス</th>
                      <th className="text-left p-4 font-semibold">顧客名</th>
                      <th className="text-left p-4 font-semibold">emolinkページの件数</th>
                      <th className="text-left p-4 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCustomers.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center p-8 text-gray-500">
                          顧客が見つかりませんでした
                        </td>
                      </tr>
                    ) : (
                      filteredCustomers.map((customer, index) => (
                        <AnimatedTableRow key={customer.customerId} index={index} staggerDelay={30}>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{customer.email}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{customer.customerName !== '-' ? customer.customerName : '-'}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-medium">{customer.memoryCount}件</span>
                          </td>
                          <td className="p-4">
                            <Link href={`/crm/customers/${customer.customerId}`}>
                              <Button variant="outline" size="sm" className="transition-transform duration-200 hover:scale-105">詳細</Button>
                            </Link>
                          </td>
                        </AnimatedTableRow>
                      ))
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


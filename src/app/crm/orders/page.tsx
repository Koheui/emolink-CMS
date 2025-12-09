'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ShoppingCart, Search, Loader2, ExternalLink, Mail, Calendar, CheckCircle, XCircle, Clock, Filter, ArrowUpDown, Building, Store } from 'lucide-react';
import { getAllOrders, getOrderDetail } from '@/lib/firestore-crm';
import { Order } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { AnimatedCard } from '@/components/animated-card';
import { AnimatedTableRow } from '@/components/animated-list';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { generatePublicPageUrl } from '@/lib/utils';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface OrderWithCompany extends Order {
  companyName?: string;
  tenantName?: string;
}

type SortField = 'createdAt' | 'companyName' | 'tenantName' | 'nfcWritten';
type SortDirection = 'asc' | 'desc';

export default function OrdersPage() {
  const router = useRouter();
  const { staff } = useSecretKeyAuth();
  const [orders, setOrders] = useState<OrderWithCompany[]>([]);
  const [filteredOrders, setFilteredOrders] = useState<OrderWithCompany[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  useEffect(() => {
    if (staff) {
      fetchOrders();
    }
  }, [staff]);
  
  useEffect(() => {
    // 検索・フィルタリング・ソート
    let filtered = [...orders];
    
    // 検索フィルタ
    if (searchTerm) {
      filtered = filtered.filter(order => 
        order.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.memoryId?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.companyName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        order.tenantName?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    // ソート
    filtered.sort((a, b) => {
      let aValue: any;
      let bValue: any;
      
      switch (sortField) {
        case 'createdAt':
          aValue = a.createdAt.getTime();
          bValue = b.createdAt.getTime();
          break;
        case 'companyName':
          aValue = a.companyName || '';
          bValue = b.companyName || '';
          break;
        case 'tenantName':
          aValue = a.tenantName || '';
          bValue = b.tenantName || '';
          break;
        case 'nfcWritten':
          aValue = a.nfc?.written ? 1 : 0;
          bValue = b.nfc?.written ? 1 : 0;
          break;
        default:
          return 0;
      }
      
      if (typeof aValue === 'string' && typeof bValue === 'string') {
        return sortDirection === 'asc' 
          ? aValue.localeCompare(bValue)
          : bValue.localeCompare(aValue);
      }
      
      return sortDirection === 'asc' 
        ? aValue - bValue
        : bValue - aValue;
    });
    
    setFilteredOrders(filtered);
  }, [searchTerm, sortField, sortDirection, orders]);
  
  const fetchCompanyAndTenantNames = async (order: Order): Promise<{ companyName?: string; tenantName?: string }> => {
    try {
      let targetTenantId = order.tenant;
      let tenantName: string | undefined;
      let companyName: string | undefined;
      
      // lpIdがある場合は、lpIdから店舗名を取得
      if (order.lpId) {
        const tenantsRef = collection(db, 'tenants');
        const tenantsQuery = query(tenantsRef, where('allowedLpIds', 'array-contains', order.lpId));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        
        if (!tenantsSnapshot.empty) {
          const tenantDoc = tenantsSnapshot.docs[0];
          const tenantData = tenantDoc.data();
          tenantName = tenantData.name;
          targetTenantId = tenantDoc.id;
          
          // 企業名を取得
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
      
      // まだ取得していない場合、tenantから直接取得
      if (!tenantName) {
        const tenantRef = doc(db, 'tenants', targetTenantId);
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
      
      return { companyName, tenantName };
    } catch (err) {
      console.error('Error fetching company and tenant names:', err);
      return {};
    }
  };
  
  const fetchOrders = async () => {
    if (!staff) {
      setError('スタッフ情報が取得できませんでした');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      // スタッフのテナント情報を渡す（superAdminの場合はnull）
      const staffTenant = staff.role === 'superAdmin' ? null : staff.adminTenant;
      const ordersData = await getAllOrders(staffTenant);
      
      // 各注文に対して企業名と店舗名を取得
      const ordersWithNames = await Promise.all(
        ordersData.map(async (order) => {
          const { companyName, tenantName } = await fetchCompanyAndTenantNames(order);
          return {
            ...order,
            companyName,
            tenantName,
          } as OrderWithCompany;
        })
      );
      
      setOrders(ordersWithNames);
      setFilteredOrders(ordersWithNames);
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      setError('注文情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };
  
  const getNFCStatus = (order: Order) => {
    if (order.nfc?.written) {
      return (
        <div className="flex items-center gap-1">
          <CheckCircle className="h-4 w-4 text-green-500" />
          <span className="text-sm text-green-600 font-medium">書き込み済み</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        <XCircle className="h-4 w-4 text-red-500" />
        <span className="text-sm text-red-600 font-medium">未書き込み</span>
      </div>
    );
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
            <Button onClick={fetchOrders}>再試行</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-blue-600 transition-colors"
    >
      {children}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? 'text-blue-600' : 'text-gray-400'}`} />
    </button>
  );
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in-down">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="h-8 w-8" />
                注文管理
              </h1>
              <p className="text-gray-600 mt-2">
                全{orders.length}件の注文
              </p>
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
                  placeholder="メールアドレス、注文ID、企業名、店舗名で検索..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 transition-all duration-200 focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
        
        {/* 注文一覧テーブル */}
        <AnimatedCard delay={100} variant="fade-in-up">
          <Card className="hover:shadow-lg transition-shadow duration-300">
            <CardHeader>
              <CardTitle>注文一覧</CardTitle>
              <CardDescription>注文情報、企業名、店舗名、NFC書き込み状況を表示</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold text-gray-700">
                        <SortButton field="createdAt">注文日</SortButton>
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700">メールアドレス</th>
                      <th className="text-left p-4 font-semibold text-gray-700">商品名</th>
                      <th className="text-left p-4 font-semibold text-gray-700">
                        <SortButton field="companyName">企業名</SortButton>
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700">
                        <SortButton field="tenantName">販売店舗名</SortButton>
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700">
                        <SortButton field="nfcWritten">NFC書き込み</SortButton>
                      </th>
                      <th className="text-left p-4 font-semibold text-gray-700">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center p-8 text-gray-500">
                          注文が見つかりませんでした
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map((order, index) => (
                        <AnimatedTableRow 
                          key={order.id} 
                          index={index} 
                          staggerDelay={30}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{formatDate(order.createdAt)}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{order.email || '-'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{order.product || order.productType || '-'}</span>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Building className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{order.companyName || '-'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <Store className="h-4 w-4 text-gray-400" />
                              <span className="text-sm">{order.tenantName || '-'}</span>
                            </div>
                          </td>
                          <td className="p-4">
                            {getNFCStatus(order)}
                          </td>
                          <td className="p-4">
                            <Link href={`/crm/orders/${order.id}`}>
                              <Button 
                                variant="outline" 
                                size="sm" 
                                className="transition-transform duration-200 hover:scale-105"
                              >
                                詳細
                              </Button>
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


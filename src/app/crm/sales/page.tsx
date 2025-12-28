'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { TrendingUp, Calendar, Download, Filter, Loader2 } from 'lucide-react';
import { getAllOrders } from '@/lib/firestore-crm';
import { Order } from '@/types';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import { AnimatedCard } from '@/components/animated-card';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

interface MonthlySales {
  year: number;
  month: number;
  count: number;
  orders: Order[];
}

export default function SalesPage() {
  const router = useRouter();
  const { staff } = useSecretKeyAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [monthlySales, setMonthlySales] = useState<MonthlySales[]>([]);
  
  // 期間選択（開始日・終了日）
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setDate(1); // 月初め
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  const [useDateRange, setUseDateRange] = useState<boolean>(true); // デフォルトで期間指定モード
  
  const fetchOrders = useCallback(async () => {
    if (!staff) {
      setError('スタッフ情報が取得できませんでした');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const staffTenant = staff.role === 'superAdmin' ? null : staff.adminTenant;
      console.log('[Sales Page] Fetching orders with tenant:', staffTenant);
      const ordersData = await getAllOrders(staffTenant);
      console.log('[Sales Page] Fetched orders:', ordersData.length);
      setOrders(ordersData);
    } catch (err: any) {
      console.error('[Sales Page] Error fetching orders:', err);
      setError(`注文情報の取得に失敗しました: ${err.message || '不明なエラー'}`);
    } finally {
      setLoading(false);
    }
  }, [staff]);
  
  useEffect(() => {
    if (staff) {
      fetchOrders();
    }
  }, [staff, fetchOrders]);
  
  useEffect(() => {
    // 月別に集計
    const salesMap = new Map<string, MonthlySales>();
    
    console.log('[Sales Page] Processing orders for monthly sales:', orders.length);
    if (orders.length > 0) {
      console.log('[Sales Page] Orders sample:', orders.slice(0, 5).map(o => ({
        id: o.id,
        createdAt: o.createdAt,
        status: o.status
      })));
    }
    
    let processedCount = 0;
    let skippedCount = 0;
    
    orders.forEach(order => {
      // 注文が存在するだけで販売実績としてカウント（決済ステータスは問わない）
      // 注文日を使用（決済完了日は使用しない）
      const date = order.createdAt;
      if (!date) {
        console.warn('[Sales Page] No date for order:', order.id);
        skippedCount++;
        return;
      }
      
      // Dateオブジェクトに変換（Firestore Timestampの場合）
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (date && typeof date === 'object' && 'toDate' in date) {
        dateObj = (date as any).toDate();
      } else {
        console.warn('[Sales Page] Invalid date type for order:', order.id, date, typeof date);
        skippedCount++;
        return;
      }
      
      if (isNaN(dateObj.getTime())) {
        console.warn('[Sales Page] Invalid date value for order:', order.id, dateObj);
        skippedCount++;
        return;
      }
      
      const year = dateObj.getFullYear();
      const month = dateObj.getMonth() + 1;
      const key = `${year}-${month}`;
      
      if (!salesMap.has(key)) {
        salesMap.set(key, {
          year,
          month,
          count: 0,
          orders: []
        });
      }
      
      const sales = salesMap.get(key)!;
      sales.count++;
      sales.orders.push(order);
      processedCount++;
    });
    
    const salesArray = Array.from(salesMap.values())
      .sort((a, b) => {
        if (a.year !== b.year) return b.year - a.year;
        return b.month - a.month;
      });
    
    console.log('[Sales Page] Monthly sales calculated:', {
      total: salesArray.length,
      processed: processedCount,
      skipped: skippedCount,
      monthlySales: salesArray.map(s => `${s.year}年${s.month}月: ${s.count}件`)
    });
    setMonthlySales(salesArray);
  }, [orders]);
  
  // 選択された期間の注文を取得
  const getSelectedPeriodOrders = (): Order[] => {
    return orders.filter(order => {
      // 注文が存在するだけで販売実績としてカウント（決済ステータスは問わない）
      // 注文日を使用（決済完了日は使用しない）
      const date = order.createdAt;
      if (!date) {
        return false;
      }
      
      // Dateオブジェクトに変換（Firestore Timestampの場合）
      let dateObj: Date;
      if (date instanceof Date) {
        dateObj = date;
      } else if (date && typeof date === 'object' && 'toDate' in date) {
        dateObj = (date as any).toDate();
      } else {
        return false;
      }
      
      if (isNaN(dateObj.getTime())) {
        return false;
      }
      
      if (useDateRange) {
        // 期間指定モード：開始日から終了日まで
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        
        return dateObj >= start && dateObj <= end;
      } else {
        // 月選択モード：選択された年月
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        
        return year === selectedYear && month === selectedMonth;
      }
    });
  };
  
  // CSVエクスポート
  const exportToCSV = () => {
    const selectedOrders = getSelectedPeriodOrders();
    const csvHeader = '注文ID,メールアドレス,商品,注文日,決済完了日,ステータス,NFC書き込み\n';
    const csvRows = selectedOrders.map(order => {
      return [
        order.id,
        order.email || '',
        order.product || order.productType || '',
        formatDate(order.createdAt),
        order.paymentCompletedAt ? formatDate(order.paymentCompletedAt) : '',
        order.status || '',
        order.nfc?.written ? '書き込み済み' : '未書き込み'
      ].join(',');
    }).join('\n');
    
    const csv = csvHeader + csvRows;
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    
    // ファイル名を期間に応じて変更
    const fileName = useDateRange
      ? `販売リスト_${startDate}_${endDate}.csv`
      : `販売リスト_${selectedYear}年${selectedMonth}月.csv`;
    link.setAttribute('download', fileName);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-7xl mx-auto">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader>
              <CardTitle>エラー</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={fetchOrders}>再試行</Button>
                <Link href="/crm">
                  <Button variant="outline">CRMダッシュボードに戻る</Button>
                </Link>
              </div>
              {staff && (
                <div className="text-xs text-gray-500 mt-4 p-3 bg-gray-50 rounded">
                  <p>スタッフ情報:</p>
                  <p>ロール: {staff.role}</p>
                  <p>テナント: {staff.adminTenant || '全テナント'}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }
  
  const selectedPeriodOrders = getSelectedPeriodOrders();
  const currentMonthSales = monthlySales.find(s => s.year === selectedYear && s.month === selectedMonth);
  
  // 統計情報
  const totalOrders = orders.length;
  
  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8 animate-fade-in-down">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="h-8 w-8" />
                販売数管理
              </h1>
              <p className="text-gray-600 mt-2">月締め請求用の販売リスト</p>
              <div className="flex gap-4 mt-2 text-sm">
                <span className="text-gray-500">全注文: {totalOrders}件</span>
              </div>
            </div>
            <Link href="/crm">
              <Button variant="outline" className="transition-transform duration-200 hover:scale-105">戻る</Button>
            </Link>
          </div>
        </div>
        
        {/* 期間選択 */}
        <AnimatedCard delay={0} variant="fade-in-up" className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                期間選択
              </CardTitle>
              <CardDescription>
                月選択または期間指定で販売データを確認できます
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* モード切り替え */}
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={!useDateRange}
                      onChange={() => setUseDateRange(false)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">月選択</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      checked={useDateRange}
                      onChange={() => setUseDateRange(true)}
                      className="w-4 h-4"
                    />
                    <span className="text-sm font-medium">期間指定</span>
                  </label>
                </div>
                
                {!useDateRange ? (
                  // 月選択モード
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">年:</label>
                      <Input
                        type="number"
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value) || new Date().getFullYear())}
                        className="w-24"
                        min="2000"
                        max="2100"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">月:</label>
                      <Input
                        type="number"
                        min="1"
                        max="12"
                        value={selectedMonth}
                        onChange={(e) => {
                          const month = parseInt(e.target.value);
                          if (month >= 1 && month <= 12) {
                            setSelectedMonth(month);
                          }
                        }}
                        className="w-20"
                      />
                    </div>
                  </div>
                ) : (
                  // 期間指定モード
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">開始日:</label>
                      <Input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-40"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-sm font-medium text-gray-700">終了日:</label>
                      <Input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-40"
                        min={startDate}
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button onClick={exportToCSV} className="ml-auto">
                    <Download className="h-4 w-4 mr-2" />
                    CSVエクスポート ({selectedPeriodOrders.length}件)
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </AnimatedCard>
        
        {/* 月別サマリー */}
        <AnimatedCard delay={100} variant="fade-in-up" className="mb-6">
          <Card>
            <CardHeader>
              <CardTitle>月別販売数</CardTitle>
              <CardDescription>注文数を月別に表示</CardDescription>
            </CardHeader>
            <CardContent>
              {monthlySales.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p className="font-medium">注文がありません</p>
                  <p className="text-sm mt-2">注文が登録されると、ここに表示されます</p>
                  {orders.length > 0 && (
                    <div className="mt-4 text-xs text-gray-400">
                      <p>全注文数: {orders.length}件</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {monthlySales.map((sales) => (
                  <Card
                    key={`${sales.year}-${sales.month}`}
                    className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                      sales.year === selectedYear && sales.month === selectedMonth
                        ? 'border-blue-500 bg-blue-50'
                        : ''
                    }`}
                    onClick={() => {
                      setSelectedYear(sales.year);
                      setSelectedMonth(sales.month);
                    }}
                  >
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <p className="text-sm text-gray-600">{sales.year}年{sales.month}月</p>
                        <p className="text-2xl font-bold text-gray-900 mt-2">{sales.count}件</p>
                      </div>
                    </CardContent>
                  </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </AnimatedCard>
        
        {/* 選択された期間の詳細リスト */}
        <AnimatedCard delay={200} variant="fade-in-up">
          <Card>
            <CardHeader>
              <CardTitle>
                {useDateRange 
                  ? `${startDate} ～ ${endDate} の販売リスト (${selectedPeriodOrders.length}件)`
                  : `${selectedYear}年${selectedMonth}月の販売リスト (${selectedPeriodOrders.length}件)`
                }
              </CardTitle>
              <CardDescription>注文一覧</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-4 font-semibold">注文ID</th>
                      <th className="text-left p-4 font-semibold">メールアドレス</th>
                      <th className="text-left p-4 font-semibold">商品</th>
                      <th className="text-left p-4 font-semibold">注文日</th>
                      <th className="text-left p-4 font-semibold">決済完了日</th>
                      <th className="text-left p-4 font-semibold">NFC書き込み</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedPeriodOrders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center p-8 text-gray-500">
                          この期間の注文はありません
                        </td>
                      </tr>
                    ) : (
                      selectedPeriodOrders.map((order) => (
                        <tr key={order.id} className="border-b hover:bg-gray-50">
                          <td className="p-4">
                            <span className="text-sm font-mono">{order.id.substring(0, 8)}...</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{order.email || '-'}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{order.product || order.productType || '-'}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">{formatDate(order.createdAt)}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm">
                              {order.paymentCompletedAt ? formatDate(order.paymentCompletedAt) : '-'}
                            </span>
                          </td>
                          <td className="p-4">
                            {order.nfc?.written ? (
                              <Badge className="bg-green-100 text-green-800">書き込み済み</Badge>
                            ) : (
                              <Badge className="bg-gray-100 text-gray-800">未書き込み</Badge>
                            )}
                          </td>
                        </tr>
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


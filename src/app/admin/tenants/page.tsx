'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Loader2, Building, Plus, Edit, Settings, Users, Package } from 'lucide-react';
import { AdminLayout } from '@/components/admin-layout';
import { collection, query, orderBy, getDocs, doc, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTenantFromOrigin, logSecurityEvent } from '@/lib/security/tenant-validation';

interface Tenant {
  id: string;
  name: string;
  description?: string;
  allowedLpIds: string[];
  enabledProductTypes: string[];
  settings: {
    maxClaimRequestsPerHour: number;
    emailTemplate: string;
    branding: {
      logo?: string;
      colors: string[];
      theme: string;
    };
    fulfillmentMode: 'tenantDirect' | 'vendorDirect';
  };
  status: 'active' | 'inactive' | 'suspended';
  createdAt: Date;
  updatedAt: Date;
}

export default function TenantsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [currentTenant, setCurrentTenant] = useState<string | null>(null);
  const [formData, setFormData] = useState<Partial<Tenant>>({
    name: '',
    description: '',
    allowedLpIds: ['direct'],
    enabledProductTypes: ['acrylic'],
    settings: {
      maxClaimRequestsPerHour: 10,
      emailTemplate: '',
      branding: {
        colors: ['#3B82F6', '#EF4444'],
        theme: 'default'
      },
      fulfillmentMode: 'tenantDirect'
    },
    status: 'active'
  });

  useEffect(() => {
    if (authLoading) return;
    
    if (!currentUser) {
      setError('認証が必要です');
      setLoading(false);
      return;
    }

    // Originベースでテナントを決定
    try {
      const origin = window.location.origin;
      const tenantInfo = getTenantFromOrigin(origin);
      setCurrentTenant(tenantInfo.tenant);
      
      logSecurityEvent('tenant_page_access', currentUser.uid, tenantInfo.tenant, {
        origin,
        lpId: tenantInfo.lpId
      });
      
      fetchTenants();
    } catch (err: any) {
      console.error('Tenant validation error:', err);
      setError('テナント検証に失敗しました');
      setLoading(false);
    }
  }, [currentUser, authLoading]);

  const fetchTenants = async () => {
    try {
      setLoading(true);
      const tenantsRef = collection(db, 'tenants');
      const q = query(tenantsRef, orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      
      const tenantsData: Tenant[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        tenantsData.push({
          id: doc.id,
          name: data.name,
          description: data.description,
          allowedLpIds: data.allowedLpIds || ['direct'],
          enabledProductTypes: data.enabledProductTypes || ['acrylic'],
          settings: data.settings || {
            maxClaimRequestsPerHour: 10,
            emailTemplate: '',
            branding: {
              colors: ['#3B82F6', '#EF4444'],
              theme: 'default'
            },
            fulfillmentMode: 'tenantDirect'
          },
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        });
      });
      
      setTenants(tenantsData);
    } catch (err: any) {
      console.error('Error fetching tenants:', err);
      setError('テナント情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTenant = async () => {
    try {
      setLoading(true);
      const tenantRef = await addDoc(collection(db, 'tenants'), {
        ...formData,
        createdAt: new Date(),
        updatedAt: new Date(),
      });

      console.log('Tenant created:', tenantRef.id);
      setShowCreateForm(false);
      setFormData({
        name: '',
        description: '',
        allowedLpIds: ['direct'],
        enabledProductTypes: ['acrylic'],
        settings: {
          maxClaimRequestsPerHour: 10,
          emailTemplate: '',
          branding: {
            colors: ['#3B82F6', '#EF4444'],
            theme: 'default'
          },
          fulfillmentMode: 'tenantDirect'
        },
        status: 'active'
      });
      fetchTenants();
    } catch (err: any) {
      console.error('Error creating tenant:', err);
      setError('テナントの作成に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTenant = async (tenantId: string, updates: Partial<Tenant>) => {
    try {
      const tenantRef = doc(db, 'tenants', tenantId);
      await updateDoc(tenantRef, {
        ...updates,
        updatedAt: new Date(),
      });
      
      setTenants(tenants.map(tenant => 
        tenant.id === tenantId 
          ? { ...tenant, ...updates, updatedAt: new Date() }
          : tenant
      ));
      setEditingTenant(null);
    } catch (err: any) {
      console.error('Error updating tenant:', err);
      setError('テナントの更新に失敗しました');
    }
  };

  const getStatusBadge = (status: Tenant['status']) => {
    const statusConfig = {
      active: { color: 'bg-green-100 text-green-800', label: 'アクティブ' },
      inactive: { color: 'bg-gray-100 text-gray-800', label: '非アクティブ' },
      suspended: { color: 'bg-red-100 text-red-800', label: '停止中' },
    };
    
    const config = statusConfig[status];
    
    return (
      <Badge className={config.color}>
        {config.label}
      </Badge>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-red-600">認証が必要です</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">テナント管理</h1>
            <p className="text-gray-600">テナント情報の管理と設定</p>
          </div>
          <div className="flex space-x-2">
            <Button onClick={fetchTenants} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              更新
            </Button>
            <Button onClick={() => setShowCreateForm(true)}>
              <Plus className="w-4 h-4 mr-2" />
              新規テナント
            </Button>
          </div>
        </div>

        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <p className="text-red-600">{error}</p>
            </CardContent>
          </Card>
        )}

        {/* 新規テナント作成フォーム */}
        {showCreateForm && (
          <Card>
            <CardHeader>
              <CardTitle>新規テナント作成</CardTitle>
              <CardDescription>
                新しいテナントの情報を入力してください
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="tenant-name">テナント名 *</Label>
                  <Input
                    id="tenant-name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="テナント名"
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="tenant-status">ステータス</Label>
                  <select
                    id="tenant-status"
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as Tenant['status'] })}
                    className="w-full p-2 border rounded-md"
                  >
                    <option value="active">アクティブ</option>
                    <option value="inactive">非アクティブ</option>
                    <option value="suspended">停止中</option>
                  </select>
                </div>
              </div>

              <div>
                <Label htmlFor="tenant-description">説明</Label>
                <Textarea
                  id="tenant-description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="テナントの説明"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>許可LP ID</Label>
                  <Input
                    value={formData.allowedLpIds?.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      allowedLpIds: e.target.value.split(',').map(s => s.trim()) 
                    })}
                    placeholder="direct, partner1, partner2"
                  />
                </div>

                <div>
                  <Label>有効商品タイプ</Label>
                  <Input
                    value={formData.enabledProductTypes?.join(', ')}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      enabledProductTypes: e.target.value.split(',').map(s => s.trim()) 
                    })}
                    placeholder="acrylic, digital, premium"
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button onClick={handleCreateTenant} disabled={loading || !formData.name}>
                  {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}
                  作成
                </Button>
                <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                  キャンセル
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* テナント一覧 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Building className="w-5 h-5" />
              <span>テナント一覧 ({tenants.length})</span>
            </CardTitle>
            <CardDescription>
              登録されているテナントの一覧と管理
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : tenants.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                テナントが見つかりません
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          テナント名
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          ステータス
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          LP ID
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          商品タイプ
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          作成日
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {tenants.map((tenant) => (
                        <tr key={tenant.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {tenant.name}
                              </div>
                              {tenant.description && (
                                <div className="text-sm text-gray-500 mt-1">
                                  {tenant.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {getStatusBadge(tenant.status)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {tenant.allowedLpIds.join(', ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {tenant.enabledProductTypes.join(', ')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {tenant.createdAt.toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                            <div className="flex items-center justify-end space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingTenant(tenant)}
                              >
                                <Edit className="w-4 h-4 mr-1" />
                                編集
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => router.push(`/admin/tenants/${tenant.id}/settings`)}
                              >
                                <Settings className="w-4 h-4 mr-1" />
                                設定
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

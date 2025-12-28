'use client';

import { useEffect, useState } from 'react';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Users, FileText, ShoppingCart, Mail } from 'lucide-react';
import { AdminLayout } from '@/components/admin-layout';
import { collection, query, orderBy, getDocs, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { logSecurityEvent } from '@/lib/security/tenant-validation';

interface UserData {
  uid: string;
  [key: string]: any; // Firestoreのすべてのフィールドを含む
}

interface UserWithStats extends UserData {
  stats: {
    memoriesCount: number;
    ordersCount: number;
    claimRequestsCount: number;
  };
}

export default function UsersPage() {
  const { staff, loading: authLoading, isSuperAdmin } = useSecretKeyAuth();
  const router = useRouter();
  const [users, setUsers] = useState<UserWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentTenant, setCurrentTenant] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    
    if (!staff) {
      setError('認証が必要です');
      setLoading(false);
      return;
    }

    // スタッフのテナント情報を使用
    try {
      const tenant = isSuperAdmin ? null : staff.adminTenant;
      setCurrentTenant(tenant);
      
      logSecurityEvent('user_page_access', staff.uid, tenant || 'all', {
        origin: window.location.origin,
      });
      
      fetchUsers(tenant);
    } catch (err: any) {
      console.error('Tenant validation error:', err);
      setError('テナント検証に失敗しました');
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff, authLoading, isSuperAdmin]);

  const fetchUsers = async (tenant: string | null) => {
    try {
      setLoading(true);
      const usersRef = collection(db, 'users');
      
      // テナントフィルタを追加（セキュリティ上重要）
      // エンドユーザーのみを取得（roleフィールドがない、または'user'のみ）
      let q;
      if (tenant) {
        q = query(
        usersRef, 
        where('tenant', '==', tenant),
        orderBy('createdAt', 'desc')
      );
      } else {
        // superAdminの場合は全テナント
        q = query(
          usersRef,
          orderBy('createdAt', 'desc')
        );
      }
      
      const querySnapshot = await getDocs(q);
      
      const usersData: UserWithStats[] = [];
      
      // 各ユーザーの統計情報を取得（並列処理で高速化）
      const userPromises = querySnapshot.docs.map(async (docSnap) => {
        const data = docSnap.data();
        // roleフィールドがない、または'user'の場合のみエンドユーザーとして扱う
        const role = data.role;
        if (!role || role === 'user') {
          const uid = docSnap.id;
          
          // 統計情報を取得（エラーが発生しても続行）
          let memoriesCount = 0;
          let ordersCount = 0;
          let claimRequestsCount = 0;
          
          try {
            const [memoriesSnap, ordersSnap, claimRequestsSnap] = await Promise.all([
              getCountFromServer(query(collection(db, 'memories'), where('ownerUid', '==', uid))).catch(() => null),
              data.email ? getCountFromServer(query(collection(db, 'orders'), where('email', '==', data.email))).catch(() => null) : Promise.resolve(null),
              data.email ? getCountFromServer(query(collection(db, 'claimRequests'), where('email', '==', data.email))).catch(() => null) : Promise.resolve(null),
            ]);
            
            memoriesCount = memoriesSnap?.data().count || 0;
            ordersCount = ordersSnap?.data().count || 0;
            claimRequestsCount = claimRequestsSnap?.data().count || 0;
          } catch (err) {
            console.warn(`Error fetching stats for user ${uid}:`, err);
            // 統計情報の取得に失敗しても続行
          }
          
          // Firestoreのすべてのフィールドを含む
          const userData: UserWithStats = {
            uid,
            ...data, // Firestoreのすべてのフィールドを展開
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
            stats: {
              memoriesCount,
              ordersCount,
              claimRequestsCount,
            },
          };
          
          return userData;
        }
        return null;
      });
      
      const resolvedUsers = await Promise.all(userPromises);
      usersData.push(...resolvedUsers.filter((u): u is UserWithStats => u !== null));
      
      setUsers(usersData);
      
      logSecurityEvent('users_fetched', staff?.uid || null, tenant || 'all', {
        count: usersData.length
      });
    } catch (err: any) {
      console.error('Error fetching users:', err);
      setError('ユーザー情報の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  // Firestoreのフィールドを表示用にフォーマット
  const formatFieldValue = (value: any): string => {
    if (value === null || value === undefined) return '-';
    if (value instanceof Date) return value.toLocaleString('ja-JP');
    if (typeof value === 'object') return JSON.stringify(value, null, 2);
    if (typeof value === 'boolean') return value ? 'はい' : 'いいえ';
    if (Array.isArray(value)) return value.length > 0 ? `${value.length}件` : 'なし';
    return String(value);
  };
      
  // 表示する主要フィールドのリスト
  const getMainFields = (user: UserWithStats): Array<{ key: string; label: string; value: any }> => {
    const fields: Array<{ key: string; label: string; value: any }> = [];
    
    // 基本情報
    if (user.email) fields.push({ key: 'email', label: 'メールアドレス', value: user.email });
    if (user.displayName) fields.push({ key: 'displayName', label: '表示名', value: user.displayName });
    if (user.tenant) fields.push({ key: 'tenant', label: 'テナント', value: user.tenant });
    if (user.tenants && Array.isArray(user.tenants) && user.tenants.length > 0) {
      fields.push({ key: 'tenants', label: '複数テナント', value: user.tenants.join(', ') });
    }
    
    // 統計情報
    fields.push({ key: 'memoriesCount', label: '想い出ページ数', value: user.stats.memoriesCount });
    fields.push({ key: 'ordersCount', label: '注文数', value: user.stats.ordersCount });
    fields.push({ key: 'claimRequestsCount', label: '購入リクエスト数', value: user.stats.claimRequestsCount });
    
    // 日時情報
    if (user.createdAt) fields.push({ key: 'createdAt', label: '作成日時', value: user.createdAt });
    if (user.updatedAt) fields.push({ key: 'updatedAt', label: '更新日時', value: user.updatedAt });
    
    return fields;
  };

  // その他のフィールド（主要フィールド以外）
  const getOtherFields = (user: UserWithStats): Array<{ key: string; value: any }> => {
    const mainFieldKeys = ['uid', 'email', 'displayName', 'tenant', 'tenants', 'createdAt', 'updatedAt', 'stats'];
    const otherFields: Array<{ key: string; value: any }> = [];
    
    Object.keys(user).forEach(key => {
      if (!mainFieldKeys.includes(key)) {
        otherFields.push({ key, value: user[key] });
      }
    });
    
    return otherFields;
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!staff) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-red-600">認証が必要です</p>
            <Button onClick={() => router.push('/auth')} className="w-full mt-4">
              ログインページへ
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6">
            <p className="text-center text-red-600">{error}</p>
            <Button onClick={() => fetchUsers(currentTenant!)} className="w-full mt-4">
              再試行
            </Button>
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
            <h1 className="text-3xl font-bold text-gray-900">ユーザー管理</h1>
            <p className="text-gray-600">Firestoreデータベースのユーザー情報一覧</p>
          </div>
          <Button onClick={() => fetchUsers(currentTenant)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            更新
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5" />
              <span>ユーザー一覧 ({users.length}人)</span>
              {currentTenant && (
                <Badge variant="outline" className="ml-2">
                  テナント: {currentTenant}
                </Badge>
              )}
              {!currentTenant && (
                <Badge variant="outline" className="ml-2">
                  全テナント
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Firestoreデータベースに保存されているユーザー情報の詳細一覧
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                ユーザーが見つかりません
              </div>
            ) : (
              <div className="space-y-6">
                {users.map((user) => {
                  const mainFields = getMainFields(user);
                  const otherFields = getOtherFields(user);
                  
                  return (
                    <Card key={user.uid} className="border">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-lg">
                            {user.displayName || user.email || user.uid}
                          </CardTitle>
                          <Badge variant="outline" className="text-xs">
                            UID: {user.uid.substring(0, 8)}...
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {/* 主要情報 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {mainFields.map((field) => (
                            <div key={field.key} className="space-y-1">
                              <div className="text-xs font-medium text-gray-500 uppercase">
                                {field.label}
                              </div>
                              <div className="text-sm text-gray-900 break-words">
                                {formatFieldValue(field.value)}
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* 統計情報（視覚的に強調） */}
                        <div className="flex items-center gap-4 pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-blue-500" />
                            <span className="text-sm">
                              <span className="font-semibold">{user.stats.memoriesCount}</span> 想い出ページ
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-green-500" />
                            <span className="text-sm">
                              <span className="font-semibold">{user.stats.ordersCount}</span> 注文
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-purple-500" />
                            <span className="text-sm">
                              <span className="font-semibold">{user.stats.claimRequestsCount}</span> 購入リクエスト
                            </span>
                          </div>
                        </div>
                        
                        {/* その他のフィールド（折りたたみ可能） */}
                        {otherFields.length > 0 && (
                          <details className="mt-4">
                            <summary className="text-sm font-medium text-gray-700 cursor-pointer hover:text-gray-900">
                              その他のフィールド ({otherFields.length}件)
                            </summary>
                            <div className="mt-2 space-y-2 pl-4 border-l-2 border-gray-200">
                              {otherFields.map((field) => (
                                <div key={field.key} className="space-y-1">
                                  <div className="text-xs font-medium text-gray-500">
                                    {field.key}
                                  </div>
                                  <div className="text-xs text-gray-700 break-words font-mono bg-gray-50 p-2 rounded">
                                    {formatFieldValue(field.value)}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </details>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

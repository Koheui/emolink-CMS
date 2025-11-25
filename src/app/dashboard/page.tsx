'use client';

import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, Users, Building, Loader2, Shield, FileText, TrendingUp, Clock } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { FirebaseStatus } from '@/components/firebase-status';
import { useMemories } from '@/hooks/use-memories';
import { AdminLayout } from '@/components/admin-layout';

export default function DashboardPage() {
  const { user, loading, currentTenant, isAuthenticated, isAdmin } = useSecretKeyAuth();
  const router = useRouter();
  const { data: memories = [], isLoading: memoriesLoading, error } = useMemories(user?.uid || '');

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/');
      return;
    }
    // エンドユーザーはダッシュボードにアクセスできない（想い出ページ作成画面へリダイレクト）
    if (!loading && isAuthenticated && !isAdmin) {
      router.push('/memories/create');
    }
  }, [isAuthenticated, loading, isAdmin, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'personal':
        return <Users className="w-4 h-4" />;
      case 'family':
        return <Users className="w-4 h-4" />;
      case 'business':
        return <Building className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'personal':
        return '個人';
      case 'family':
        return '家族';
      case 'business':
        return 'ビジネス';
      default:
        return 'その他';
    }
  };

  const getTenantLabel = (tenant: string) => {
    switch (tenant) {
      case 'petmem':
        return 'PetMemory';
      case 'client-a':
        return 'Client A';
      case 'client-b':
        return 'Client B';
      case 'dev':
        return '開発環境';
      default:
        return tenant;
    }
  };

  const publishedMemories = memories.filter(m => m.status === 'published').length;
  const draftMemories = memories.filter(m => m.status !== 'published').length;

  // 管理者向けCRMダッシュボード
  if (isAdmin) {
    return (
      <AdminLayout>
        <div className="p-6 lg:p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">管理ダッシュボード</h1>
            <p className="text-gray-600">
              顧客・注文・テナント管理
            </p>
          </div>

          <div className="grid gap-6">
            {/* クイックアクション（CRM機能） */}
            <Card>
              <CardHeader>
                <CardTitle>管理機能</CardTitle>
                <CardDescription>
                  顧客管理とシステム管理へのアクセス
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <Button
                    variant="outline"
                    onClick={() => router.push('/admin/users')}
                    className="h-24 flex flex-col items-center justify-center space-y-2"
                  >
                    <Users className="w-6 h-6" />
                    <span>ユーザー管理</span>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => router.push('/orders')}
                    className="h-24 flex flex-col items-center justify-center space-y-2"
                  >
                    <FileText className="w-6 h-6" />
                    <span>注文管理</span>
                  </Button>
                  {user?.role === 'superAdmin' && (
                    <Button
                      variant="outline"
                      onClick={() => router.push('/admin/tenants')}
                      className="h-24 flex flex-col items-center justify-center space-y-2"
                    >
                      <Building className="w-6 h-6" />
                      <span>テナント管理</span>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* セキュリティ情報 */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5 text-green-600" />
                  <span>セキュリティ状況</span>
                </CardTitle>
                <CardDescription>
                  テナント分離とアクセス制御の状況
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">テナント分離: 有効</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">Origin検証: 有効</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm">アクセス制御: 有効</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </AdminLayout>
    );
  }

  // 一般ユーザー向けCMSダッシュボード
  return (
    <AdminLayout>
      <div className="p-6 lg:p-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">マイページ</h1>
          <p className="text-gray-600">
            あなたの想い出ページを管理
          </p>
        </div>

        <div className="grid gap-6">
          {/* 統計カード（CMS機能） */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">総想い出数</CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{memories.length}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  作成した想い出ページ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">公開済み</CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">{publishedMemories}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  公開中のページ
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">下書き</CardTitle>
                <Clock className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-gray-600">{draftMemories}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  編集中のページ
                </p>
              </CardContent>
            </Card>
          </div>

          {/* クイックアクション（CMS機能） */}
          <Card>
            <CardHeader>
              <CardTitle>クイックアクション</CardTitle>
              <CardDescription>
                想い出ページの作成と管理
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button
                  onClick={() => router.push('/memories/create')}
                  className="h-24 flex flex-col items-center justify-center space-y-2"
                >
                  <Plus className="w-6 h-6" />
                  <span>新しい想い出を作成</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Firebase接続状態 */}
          <FirebaseStatus />

          {/* セキュリティ情報 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-green-600" />
                <span>セキュリティ状況</span>
              </CardTitle>
              <CardDescription>
                テナント分離とアクセス制御の状況
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">テナント分離: 有効</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">Origin検証: 有効</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-sm">アクセス制御: 有効</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>あなたの想い出</CardTitle>
              <CardDescription>
                作成した想い出ページの一覧です（テナント: {getTenantLabel(currentTenant)}）
              </CardDescription>
            </CardHeader>
            <CardContent>
              {memoriesLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin" />
                  <span className="ml-2">読み込み中...</span>
                </div>
              ) : error ? (
                <div className="text-center py-8">
                  <p className="text-red-600 mb-4">
                    データの取得に失敗しました
                  </p>
                  <Button 
                    variant="outline" 
                    onClick={() => window.location.reload()}
                  >
                    再読み込み
                  </Button>
                </div>
              ) : memories.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-4">
                    まだ想い出がありません
                  </p>
                  <Button onClick={() => router.push('/memories/new')}>
                    <Plus className="w-4 h-4 mr-2" />
                    最初の想い出を作成
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {memories.map((memory) => (
                    <div
                      key={memory.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => router.push(`/memories/${memory.id}`)}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          {getTypeIcon(memory.type)}
                        </div>
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {memory.title || '無題'}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-gray-500">
                            <span>{getTypeLabel(memory.type)}</span>
                            <span>•</span>
                            <span>
                              {memory.status === 'published' ? '公開済み' : '下書き'}
                            </span>
                            <span>•</span>
                            <span>更新: {formatDate(memory.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        {memory.status === 'published' && (
                          <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                            公開中
                          </span>
                        )}
                        <Button variant="outline" size="sm">
                          編集
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AdminLayout>
  );
}

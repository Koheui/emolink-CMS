'use client';

import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Plus, Users, Building, Loader2, Shield, FileText, TrendingUp, Clock, Search, Filter, X, CheckSquare, Square } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { FirebaseStatus } from '@/components/firebase-status';
import { useMemories } from '@/hooks/use-memories';
import { AdminLayout } from '@/components/admin-layout';
import { Memory } from '@/types';
import { updateMemory, deleteMemory } from '@/lib/firestore';

export default function DashboardPage() {
  const { user, loading, currentTenant, isAuthenticated, isAdmin } = useSecretKeyAuth();
  const router = useRouter();
  const { data: memories = [], isLoading: memoriesLoading, error } = useMemories(user?.uid || '');
  
  // 検索・フィルタ状態
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'personal' | 'family' | 'business'>('all');
  const [selectedMemories, setSelectedMemories] = useState<string[]>([]);
  const [isSelectMode, setIsSelectMode] = useState(false);

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

  // フィルタリングされたメモリー（早期リターンの前に配置）
  const filteredMemories = useMemo(() => {
    return memories.filter((memory: Memory) => {
      // 検索クエリでフィルタ
      if (searchQuery && !memory.title?.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // ステータスでフィルタ
      if (statusFilter !== 'all') {
        if (statusFilter === 'published' && memory.status !== 'published') {
          return false;
        }
        if (statusFilter === 'draft' && memory.status === 'published') {
          return false;
        }
      }
      
      // タイプでフィルタ
      if (typeFilter !== 'all' && memory.type !== typeFilter) {
        return false;
      }
      
      return true;
    });
  }, [memories, searchQuery, statusFilter, typeFilter]);

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
  
  // 選択状態の管理
  const toggleMemorySelection = (memoryId: string) => {
    setSelectedMemories(prev => 
      prev.includes(memoryId)
        ? prev.filter(id => id !== memoryId)
        : [...prev, memoryId]
    );
  };
  
  const toggleSelectAll = () => {
    if (selectedMemories.length === filteredMemories.length) {
      setSelectedMemories([]);
    } else {
      setSelectedMemories(filteredMemories.map(m => m.id));
    }
  };
  
  const clearSelection = () => {
    setSelectedMemories([]);
    setIsSelectMode(false);
  };
  
  // バルク操作
  const handleBulkPublish = async () => {
    if (selectedMemories.length === 0) return;
    
    try {
      await Promise.all(
        selectedMemories.map(memoryId =>
          updateMemory(memoryId, { status: 'published' })
        )
      );
      alert(`${selectedMemories.length}件を公開しました`);
      clearSelection();
    } catch (error) {
      console.error('Error publishing memories:', error);
      alert('公開中にエラーが発生しました');
    }
  };
  
  const handleBulkUnpublish = async () => {
    if (selectedMemories.length === 0) return;
    
    try {
      await Promise.all(
        selectedMemories.map(memoryId =>
          updateMemory(memoryId, { status: 'draft' })
        )
      );
      alert(`${selectedMemories.length}件を非公開にしました`);
      clearSelection();
    } catch (error) {
      console.error('Error unpublishing memories:', error);
      alert('非公開処理中にエラーが発生しました');
    }
  };
  
  const handleBulkDelete = async () => {
    if (selectedMemories.length === 0) return;
    
    if (!confirm(`${selectedMemories.length}件を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    
    try {
      await Promise.all(
        selectedMemories.map(memoryId => deleteMemory(memoryId))
      );
      alert(`${selectedMemories.length}件を削除しました`);
      clearSelection();
    } catch (error) {
      console.error('Error deleting memories:', error);
      alert('削除中にエラーが発生しました');
    }
  };
  
  // 個別の公開/非公開切り替え
  const handleTogglePublish = async (memoryId: string, currentStatus: string) => {
    try {
      const newStatus = currentStatus === 'published' ? 'draft' : 'published';
      await updateMemory(memoryId, { status: newStatus });
    } catch (error) {
      console.error('Error toggling publish status:', error);
      alert('ステータスの更新中にエラーが発生しました');
    }
  };
  
  // 個別の削除
  const handleDeleteMemory = async (memoryId: string, title: string) => {
    if (!confirm(`「${title || '無題'}」を削除しますか？この操作は取り消せません。`)) {
      return;
    }
    
    try {
      await deleteMemory(memoryId);
      alert('削除しました');
    } catch (error) {
      console.error('Error deleting memory:', error);
      alert('削除中にエラーが発生しました');
    }
  };

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
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>あなたの想い出</CardTitle>
                  <CardDescription>
                    作成した想い出ページの一覧です（テナント: {getTenantLabel(currentTenant)}）
                  </CardDescription>
                </div>
                {!isSelectMode ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectMode(true)}
                  >
                    <CheckSquare className="w-4 h-4 mr-2" />
                    選択モード
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearSelection}
                  >
                    <X className="w-4 h-4 mr-2" />
                    キャンセル
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {/* 検索・フィルタ */}
              <div className="mb-6 space-y-4">
                {/* 検索バー */}
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                  <Input
                    type="text"
                    placeholder="タイトルで検索..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                
                {/* フィルタ */}
                <div className="flex flex-wrap gap-2">
                  <div className="flex items-center space-x-2">
                    <Filter className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium text-gray-700">ステータス:</span>
                    <Button
                      variant={statusFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('all')}
                    >
                      すべて
                    </Button>
                    <Button
                      variant={statusFilter === 'published' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('published')}
                    >
                      公開済み
                    </Button>
                    <Button
                      variant={statusFilter === 'draft' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setStatusFilter('draft')}
                    >
                      下書き
                    </Button>
                  </div>
                  
                  <div className="flex items-center space-x-2 ml-4">
                    <span className="text-sm font-medium text-gray-700">タイプ:</span>
                    <Button
                      variant={typeFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('all')}
                    >
                      すべて
                    </Button>
                    <Button
                      variant={typeFilter === 'personal' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('personal')}
                    >
                      個人
                    </Button>
                    <Button
                      variant={typeFilter === 'family' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('family')}
                    >
                      家族
                    </Button>
                    <Button
                      variant={typeFilter === 'business' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setTypeFilter('business')}
                    >
                      ビジネス
                    </Button>
                  </div>
                </div>
                
                {/* 選択モード時のバルク操作 */}
                {isSelectMode && selectedMemories.length > 0 && (
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <span className="text-sm font-medium text-blue-900">
                      {selectedMemories.length}件選択中
                    </span>
                    <div className="flex space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={toggleSelectAll}
                      >
                        {selectedMemories.length === filteredMemories.length ? (
                          <>
                            <Square className="w-4 h-4 mr-2" />
                            すべて解除
                          </>
                        ) : (
                          <>
                            <CheckSquare className="w-4 h-4 mr-2" />
                            すべて選択
                          </>
                        )}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        onClick={handleBulkPublish}
                      >
                        一括公開
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleBulkUnpublish}
                      >
                        一括非公開
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                      >
                        一括削除
                      </Button>
                    </div>
                  </div>
                )}
              </div>
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
              ) : filteredMemories.length === 0 ? (
                <div className="text-center py-8">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600 mb-2">
                    検索条件に一致する想い出がありません
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchQuery('');
                      setStatusFilter('all');
                      setTypeFilter('all');
                    }}
                  >
                    フィルタをリセット
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* 全選択チェックボックス（選択モード時） */}
                  {isSelectMode && (
                    <div className="flex items-center space-x-2 p-2 border-b">
                      <button
                        onClick={toggleSelectAll}
                        className="flex items-center space-x-2 text-sm text-gray-700 hover:text-gray-900"
                      >
                        {selectedMemories.length === filteredMemories.length ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                        <span>すべて選択</span>
                      </button>
                    </div>
                  )}
                  
                  <div className="grid gap-4">
                    {filteredMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className={`flex items-center justify-between p-4 border rounded-lg transition-colors ${
                          isSelectMode
                            ? 'cursor-default'
                            : 'hover:bg-gray-50 cursor-pointer'
                        } ${
                          selectedMemories.includes(memory.id)
                            ? 'bg-blue-50 border-blue-300'
                            : ''
                        }`}
                        onClick={() => {
                          if (isSelectMode) {
                            toggleMemorySelection(memory.id);
                          } else {
                            router.push(`/memories/${memory.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3 flex-1">
                          {isSelectMode && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleMemorySelection(memory.id);
                              }}
                              className="flex-shrink-0"
                            >
                              {selectedMemories.includes(memory.id) ? (
                                <CheckSquare className="w-5 h-5 text-blue-600" />
                              ) : (
                                <Square className="w-5 h-5 text-gray-400" />
                              )}
                            </button>
                          )}
                          <div className="p-2 bg-blue-100 rounded-lg">
                            {getTypeIcon(memory.type)}
                          </div>
                          <div className="flex-1">
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
                          {!isSelectMode && (
                            <>
                              <Button
                                variant={memory.status === 'published' ? 'outline' : 'default'}
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleTogglePublish(memory.id, memory.status);
                                }}
                              >
                                {memory.status === 'published' ? '非公開' : '公開'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/memories/${memory.id}`);
                                }}
                              >
                                編集
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteMemory(memory.id, memory.title);
                                }}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                              >
                                削除
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* 結果数表示 */}
                  <div className="text-sm text-gray-500 text-center pt-2 border-t">
                    {filteredMemories.length}件表示（全{memories.length}件）
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

'use client';

import { ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard,
  Users,
  Building,
  FileText,
  Settings,
  LogOut,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface AdminLayoutProps {
  children: ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, currentTenant, logout } = useSecretKeyAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // ユーザーのロールに応じてナビゲーションを動的に生成
  const { isAdmin: userIsAdmin, isSuperAdmin: userIsSuperAdmin } = useSecretKeyAuth();
  
  // 管理者向けナビゲーション
  const adminNavItems: NavItem[] = [
    {
      title: 'ダッシュボード',
      href: '/dashboard',
      icon: LayoutDashboard,
    },
    {
      title: 'ユーザー管理',
      href: '/admin/users',
      icon: Users,
    },
    {
      title: '注文管理',
      href: '/orders',
      icon: FileText,
    },
  ];
  
  // スーパー管理者のみ
  const superAdminNavItems: NavItem[] = [
    {
      title: 'テナント管理',
      href: '/admin/tenants',
      icon: Building,
    },
  ];
  
  // ロールに応じてナビゲーションを組み立て
  // エンドユーザーはナビゲーションを表示しない（想い出ページ作成画面のみ）
  const navItems: NavItem[] = userIsAdmin 
    ? [...adminNavItems, ...(userIsSuperAdmin ? superAdminNavItems : [])]
    : [];

  const handleLogout = () => {
    logout();
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* モバイル用サイドバーオーバーレイ */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* サイドバー */}
      <aside
        className={cn(
          'fixed top-0 left-0 z-50 h-full w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex flex-col h-full">
          {/* ロゴ・ヘッダー */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">CMS</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* ユーザー情報 */}
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center text-white font-semibold">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.email || 'Unknown'}
                </p>
                <div className="flex items-center space-x-1 mt-1">
                  <Shield className="w-3 h-3 text-blue-600" />
                  <p className="text-xs text-blue-600 truncate">
                    {getTenantLabel(currentTenant)}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* ナビゲーション */}
          <nav className="flex-1 overflow-y-auto p-4">
            <ul className="space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <li key={item.href}>
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full justify-start',
                        isActive && 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                      )}
                      onClick={() => {
                        router.push(item.href);
                        setSidebarOpen(false);
                      }}
                    >
                      <Icon className="w-5 h-5 mr-3" />
                      {item.title}
                      {item.badge && (
                        <span className="ml-auto bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded-full">
                          {item.badge}
                        </span>
                      )}
                    </Button>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* フッター */}
          <div className="p-4 border-t border-gray-200">
            <Button
              variant="ghost"
              className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
              onClick={handleLogout}
            >
              <LogOut className="w-5 h-5 mr-3" />
              ログアウト
            </Button>
          </div>
        </div>
      </aside>

      {/* メインコンテンツ */}
      <div className="lg:pl-64">
        {/* トップバー（モバイル用） */}
        <header className="sticky top-0 z-30 bg-white border-b border-gray-200 lg:hidden">
          <div className="flex items-center justify-between p-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </Button>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-cyan-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <span className="font-bold text-lg text-gray-900">CMS</span>
            </div>
            <div className="w-10" /> {/* スペーサー */}
          </div>
        </header>

        {/* ページコンテンツ */}
        <main className="min-h-screen">
          {children}
        </main>
      </div>
    </div>
  );
}


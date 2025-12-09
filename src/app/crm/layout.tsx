'use client';

import { ReactNode, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';
import { canAccessCRM } from '@/lib/security/role-check';
import { Loader2, Home, LogOut, ShoppingCart, Users, Building, TrendingUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface CRMLayoutProps {
  children: ReactNode;
}

export default function CRMLayout({ children }: CRMLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { staff, loading, logout } = useSecretKeyAuth();
  
  useEffect(() => {
    console.log('[CRM Layout] useEffect triggered:', { loading, staff: staff ? { uid: staff.uid, role: staff.role } : null });
    if (!loading) {
      const hasAccess = staff ? canAccessCRM(staff) : false;
      console.log('[CRM Layout] Checking access:', { 
        staff: staff ? { uid: staff.uid, role: staff.role, adminTenant: staff.adminTenant } : null, 
        hasAccess 
      });
      // スタッフでない、またはCRMアクセス権限がない場合はリダイレクト
      if (!staff || !hasAccess) {
        console.log('[CRM Layout] Access denied, redirecting to /auth');
        console.log('[CRM Layout] Redirecting with window.location.href');
        // router.pushの代わりにwindow.location.hrefを使用して確実にリダイレクト
        window.location.href = '/auth';
      } else {
        console.log('[CRM Layout] Access granted');
      }
    }
  }, [staff, loading]);
  
  console.log('[CRM Layout] Render:', { loading, staff: staff ? { uid: staff.uid, role: staff.role } : null });
  
  if (loading) {
    console.log('[CRM Layout] Showing loading state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }
  
  const hasAccess = staff ? canAccessCRM(staff) : false;
  console.log('[CRM Layout] Access check result:', { hasAccess, staff: staff ? { uid: staff.uid, role: staff.role } : null });
  
  if (!staff || !hasAccess) {
    console.log('[CRM Layout] Showing redirect loading state');
    // リダイレクト中もローディング表示を出す
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">リダイレクト中...</p>
        </div>
      </div>
    );
  }
  
  const handleLogout = () => {
    logout();
    router.push('/auth');
  };
  
  console.log('[CRM Layout] Rendering children');
  
  // ナビゲーションメニュー
  const navItems = [
    {
      title: '注文管理',
      href: '/crm/orders',
      icon: ShoppingCart,
    },
    {
      title: '顧客情報',
      href: '/crm/customers',
      icon: Users,
    },
    {
      title: '店舗情報',
      href: '/crm/tenants',
      icon: Building,
    },
    {
      title: '販売数管理',
      href: '/crm/sales',
      icon: TrendingUp,
    },
  ];
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold text-gray-900">CRM管理画面</h1>
            {pathname !== '/crm' && (
              <Link href="/crm">
                <Button variant="ghost" size="sm">
                  <Home className="h-4 w-4 mr-2" />
                  CRMダッシュボード
                </Button>
              </Link>
            )}
            {/* ナビゲーションメニュー */}
            <nav className="flex items-center gap-2 ml-4">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || pathname?.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href}>
                    <Button
                      variant={isActive ? 'default' : 'ghost'}
                      size="sm"
                      className={cn(
                        'transition-colors',
                        isActive && 'bg-blue-600 text-white hover:bg-blue-700'
                      )}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {item.title}
                    </Button>
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              ログアウト
            </Button>
          </div>
        </div>
      </header>
      
      {/* メインコンテンツ */}
      <main>
        {children}
      </main>
    </div>
  );
}




'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentTenant, getTenantFromOrigin } from '@/lib/security/tenant-validation';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

export default function HomePage() {
  const { user, staff, loading: authLoading, isAuthenticated } = useSecretKeyAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // CRMサイトかどうかを判定
  const isCRMSite = useMemo(() => {
    if (typeof window === 'undefined') return false;
    try {
      const origin = window.location.origin;
      const tenantInfo = getTenantFromOrigin(origin);
      return tenantInfo.lpId === 'crm';
    } catch {
      return false;
    }
  }, []);
  
  // /public/**パスの場合は公開ページを表示
  useEffect(() => {
    if (pathname?.startsWith('/public/')) {
      const match = pathname.match(/^\/public\/([^\/]+)/);
      if (match && match[1]) {
        // 公開ページの場合は、このコンポーネントで処理しない
        return;
      }
    }
  }, [pathname]);

  // /public/**パスの場合は公開ページを表示
  const [showPublicPage, setShowPublicPage] = useState(false);
  const [publicPageId, setPublicPageId] = useState<string>('');
  
  useEffect(() => {
    if (pathname?.startsWith('/public/')) {
      const match = pathname.match(/^\/public\/([^\/]+)/);
      if (match && match[1]) {
        setPublicPageId(match[1]);
        setShowPublicPage(true);
      } else {
        setShowPublicPage(false);
      }
    } else {
      setShowPublicPage(false);
    }
  }, [pathname]);
  
  // ログイン済みの場合のリダイレクト処理（条件付きreturnの前に配置）
  useEffect(() => {
    if (!authLoading) {
      if (staff) {
        // スタッフ（管理者）がログインしている場合
        if (isCRMSite) {
          // CRMサイトの場合はCRMダッシュボードへ
          router.push('/crm');
        } else {
          // CMSサイトの場合は管理画面へ
          router.push('/admin/users');
        }
      } else if (isAuthenticated && user) {
        // エンドユーザーがログインしている場合
        router.push('/memories/create');
      }
    }
  }, [authLoading, isAuthenticated, user, staff, router, isCRMSite]);
  
  // 公開ページコンポーネントを動的インポート
  const PublicPageClient = dynamic<{ initialPageId?: string }>(
    () => import('@/components/public-page-client').then(mod => ({ default: mod.PublicPageClient })),
    {
      ssr: false,
      loading: () => (
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#00ff00] border-t-transparent rounded-full animate-spin"></div>
        </div>
      ),
    }
  );
  
  if (showPublicPage && publicPageId) {
    return (
      <Suspense fallback={
        <div className="min-h-screen bg-[#0f0f0f] flex items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#00ff00] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }>
        <PublicPageClient initialPageId={publicPageId} />
      </Suspense>
    );
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (!email || !password) {
        setError('メールアドレスとパスワードを入力してください');
        setIsLoading(false);
        return;
      }

      if (!auth) {
        throw new Error('認証サービスが利用できません');
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // まずstaffコレクションを確認（管理者の場合）
      const { getStaffByUid } = await import('@/lib/firestore');
      const staffData = await getStaffByUid(firebaseUser.uid);
      
      if (staffData) {
        // 管理者（スタッフ）の場合
        const staffInfo = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || email,
          displayName: staffData.displayName || firebaseUser.displayName || email.split('@')[0],
          tenant: staffData.adminTenant,
          role: staffData.role,
          createdAt: staffData.createdAt,
          updatedAt: staffData.updatedAt,
        };
        
        // SecretKeyAuthContextにスタッフ情報を設定
        sessionStorage.setItem('secretKeyStaff', JSON.stringify(staffInfo));
        sessionStorage.setItem('secretKeyTenant', staffData.adminTenant);
        sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        localStorage.setItem('secretKeyStaff', JSON.stringify(staffInfo));
        localStorage.setItem('secretKeyTenant', staffData.adminTenant);
        localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
      } else {
        // エンドユーザーの場合
        // Firestoreからユーザー情報を取得または作成
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        let userData: any;
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || email,
            displayName: data.displayName || firebaseUser.displayName || email.split('@')[0],
            tenant: data.tenant || getCurrentTenant(),
            tenants: data.tenants,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };
        } else {
          const currentTenant = getCurrentTenant();
          userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || email,
            displayName: firebaseUser.displayName || email.split('@')[0],
            tenant: currentTenant,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await setDoc(userDocRef, userData);
        }

        // SecretKeyAuthContextにユーザー情報を設定
        sessionStorage.setItem('secretKeyUser', JSON.stringify(userData));
        sessionStorage.setItem('secretKeyTenant', userData.tenant);
        sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        localStorage.setItem('secretKeyUser', JSON.stringify(userData));
        localStorage.setItem('secretKeyTenant', userData.tenant);
        localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
      }

      // ログイン成功後、ページをリロードして認証状態を反映
      // router.pushでは認証状態が反映されない可能性があるため、window.location.hrefを使用
      if (staffData) {
        // 管理者（スタッフ）の場合
        if (isCRMSite) {
          // CRMサイトの場合はCRMダッシュボードへ
          window.location.href = '/crm';
        } else {
          // CMSサイトの場合は管理画面へ
        window.location.href = '/admin/users';
        }
      } else {
        // エンドユーザーの場合は想い出ページ作成画面へ
        window.location.href = '/memories/create';
      }
    } catch (err: any) {
      console.error('Login error:', err);
      let errorMessage = 'ログインに失敗しました';
      
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'このメールアドレスは登録されていません。';
      } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        errorMessage = 'パスワードが正しくありません。以前にもemolinkをご利用いただいている方は同じパスワードを使用してください。';
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません。';
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください。';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#000f24]">
        <div className="w-12 h-12 border-4 border-[#08af86] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  // ログイン済みの場合でもログインフォームを表示（ログアウトボタンを追加）
  // if (isAuthenticated && user) {
  //   return null;
  // }

  return (
    <div className="min-h-screen bg-[#000f24] flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-[#1a1a1a] rounded-2xl border border-white/10 shadow-xl">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center space-x-2 text-white">
            <Lock className="w-6 h-6 text-blue-400" />
            <span>ログイン</span>
          </CardTitle>
          <CardDescription className="text-white/70">
            メールアドレスとパスワードでログインしてください
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded border border-red-500/20">
              {error}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-white/80">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                disabled={isLoading}
                className="bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80">パスワード</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="パスワードを入力"
                  required
                  disabled={isLoading}
                  className="pr-10 bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button 
              type="submit" 
              className="w-full bg-white text-black hover:bg-white/90" 
              disabled={isLoading || !email || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ログイン中...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4 mr-2" />
                  ログイン
                </>
              )}
            </Button>
          </form>

          <div className="space-y-2">
            <div className="text-center">
              <Button 
                variant="link" 
                onClick={() => router.push('/auth')} 
                disabled={isLoading} 
                className="text-white/60 hover:text-white/80"
              >
                パスワードを忘れた場合
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

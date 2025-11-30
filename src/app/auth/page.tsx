'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { signInWithEmailLink, isSignInWithEmailLink, sendSignInLinkToEmail, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { decodeAndValidateJWT } from '@/lib/jwt';
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react';

function AuthContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [tenantFromLink, setTenantFromLink] = useState<string | null>(null);
  const [loginMode, setLoginMode] = useState<'password' | 'emailLink'>('password');
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [passwordResetEmail, setPasswordResetEmail] = useState('');
  const [passwordResetSent, setPasswordResetSent] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // リダイレクトメッセージをチェック（/claimからリダイレクトされた場合）
    if (typeof window !== 'undefined') {
      const redirectMessage = sessionStorage.getItem('redirectMessage');
      const redirectEmail = sessionStorage.getItem('redirectEmail');
      if (redirectMessage && redirectEmail) {
        setMessage(redirectMessage);
        setEmail(redirectEmail);
        sessionStorage.removeItem('redirectMessage');
        sessionStorage.removeItem('redirectEmail');
      }
    }

    // URLパラメータからJWTを取得
    const jwt = searchParams.get('k');
    const rid = searchParams.get('rid');
    const tenant = searchParams.get('tenant');
    const lpId = searchParams.get('lpId');

    if (jwt && rid && tenant && lpId) {
      // JWTを検証してメールアドレスを取得
      try {
        const jwtData = decodeAndValidateJWT(jwt);
        if (jwtData && jwtData.email) {
          setEmail(jwtData.email);
          // テナント情報を保存（認証完了時に使用）
          setTenantFromLink(tenant);
          // テナント情報をlocalStorageに一時保存（認証完了時に使用）
          localStorage.setItem('pendingTenant', tenant);
          setMessage('認証リンクが検証されました。メール認証を完了してください。');
        }
      } catch (error) {
        console.error('JWT検証エラー:', error);
        setMessage('認証リンクが無効です。');
      }
    }

    // メールリンクでのサインインをチェック
    if (isSignInWithEmailLink(auth, window.location.href)) {
      // メールアドレスが設定されていない場合は、ローカルストレージから取得
      const savedEmail = localStorage.getItem('emailForSignIn');
      if (savedEmail && !email) {
        setEmail(savedEmail);
      }
      // 少し遅延させてから認証処理を実行（email stateが更新されるのを待つ）
      const timer = setTimeout(() => {
        handleEmailLinkSignIn();
      }, 200);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const handleEmailLinkSignIn = async () => {
    setIsLoading(true);
    try {
      // ローカルストレージからメールアドレスを取得
      let emailForAuth = email || localStorage.getItem('emailForSignIn');
      
      if (!emailForAuth) {
        setMessage('メールアドレスが必要です。メールアドレスを入力してください。');
        setIsLoading(false);
        return;
      }

      const result = await signInWithEmailLink(auth, emailForAuth, window.location.href);
      console.log('メールリンク認証成功:', result.user.uid);
      
      // ローカルストレージからメールアドレスを削除
      localStorage.removeItem('emailForSignIn');
      
      // 認証リンクから取得したテナント情報を取得（優先）
      const pendingTenant = tenantFromLink || localStorage.getItem('pendingTenant');
      localStorage.removeItem('pendingTenant');
      
      // Firebase Authのユーザー情報をSecretKey認証システムに統合
      const firebaseUser = result.user;
      
      // まずstaffコレクションを確認（管理者の場合）
      const { getStaffByUid } = await import('@/lib/firestore');
      const staffData = await getStaffByUid(firebaseUser.uid);
      
      if (staffData) {
        // 管理者（スタッフ）の場合
        const staffInfo = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || emailForAuth,
          displayName: staffData.displayName || firebaseUser.displayName || emailForAuth.split('@')[0],
          tenant: staffData.adminTenant,
          role: staffData.role,
          createdAt: staffData.createdAt,
          updatedAt: staffData.updatedAt,
        };
        
        // SecretKey認証システムのセッションに保存
        sessionStorage.setItem('secretKeyStaff', JSON.stringify(staffInfo));
        sessionStorage.setItem('secretKeyTenant', staffData.adminTenant);
        sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        
        localStorage.setItem('secretKeyStaff', JSON.stringify(staffInfo));
        localStorage.setItem('secretKeyTenant', staffData.adminTenant);
        localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        
        setMessage('認証が完了しました。管理画面に移動します。');
        
        // 管理画面にリダイレクト
        setTimeout(() => {
          window.location.href = '/admin/users';
        }, 1500);
      } else {
        // エンドユーザーの場合
        // テナント情報の決定：認証リンクから取得したテナント、なければデフォルト
        const { getCurrentTenant } = await import('@/lib/security/tenant-validation');
        const finalTenant = pendingTenant || getCurrentTenant();
        
        // Firestoreからユーザー情報を取得または作成
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let userData: any;
        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || emailForAuth,
            displayName: data.displayName || firebaseUser.displayName || emailForAuth.split('@')[0],
            tenant: data.tenant || finalTenant,
            tenants: data.tenants,
            createdAt: data.createdAt?.toDate() || new Date(),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };
        } else {
          userData = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || emailForAuth,
            displayName: firebaseUser.displayName || emailForAuth.split('@')[0],
            tenant: finalTenant,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          await setDoc(userDocRef, userData);
        }
        
        // SecretKey認証システムのセッションに保存
        sessionStorage.setItem('secretKeyUser', JSON.stringify(userData));
        sessionStorage.setItem('secretKeyTenant', userData.tenant);
        sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        
        localStorage.setItem('secretKeyUser', JSON.stringify(userData));
        localStorage.setItem('secretKeyTenant', userData.tenant);
        localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
        
        setMessage('認証が完了しました。想い出ページ作成画面に移動します。');
        
        // 想い出ページ作成画面にリダイレクト（エンドユーザーはダッシュボードを経由しない）
        setTimeout(() => {
          window.location.href = '/memories/create';
      }, 1500);
    } catch (error: any) {
      console.error('メールリンク認証エラー:', error);
      setMessage(`認証に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('メールアドレスとパスワードを入力してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage('');

    try {
      if (!auth) {
        throw new Error('認証サービスが利用できません');
      }

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const firebaseUser = userCredential.user;

      // Firestoreからユーザー情報を取得
      const { doc, getDoc } = await import('firebase/firestore');
      const { db } = await import('@/lib/firebase');
      const userDocRef = doc(db, 'users', firebaseUser.uid);
      const userDocSnap = await getDoc(userDocRef);

      let userData: any;
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || email,
          displayName: data.displayName || firebaseUser.displayName || email.split('@')[0],
          tenant: data.tenant || 'futurestudio',
          role: data.role || 'user',
          createdAt: data.createdAt?.toDate() || new Date(),
          updatedAt: data.updatedAt?.toDate() || new Date(),
        };
      } else {
        // Firestoreにユーザー情報がない場合、新規作成
        const { setDoc } = await import('firebase/firestore');
        const { getCurrentTenant } = await import('@/lib/security/tenant-validation');
        const currentTenant = getCurrentTenant();
        
        userData = {
          uid: firebaseUser.uid,
          email: firebaseUser.email || email,
          displayName: firebaseUser.displayName || email.split('@')[0],
          tenant: currentTenant,
          role: 'user',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await setDoc(userDocRef, userData);
      }

      // SecretKey認証システムのセッションに保存
      sessionStorage.setItem('secretKeyUser', JSON.stringify(userData));
      sessionStorage.setItem('secretKeyTenant', userData.tenant);
      sessionStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());

      localStorage.setItem('secretKeyUser', JSON.stringify(userData));
      localStorage.setItem('secretKeyTenant', userData.tenant);
      localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());

      setMessage('ログインに成功しました。');
      
      // fromClaimフラグがある場合、メモリ作成画面にリダイレクト
      // それ以外はダッシュボードにリダイレクト
      setTimeout(() => {
        if (typeof window !== 'undefined' && sessionStorage.getItem('fromClaim') === 'true') {
          router.push('/memories/create');
        } else {
          router.push('/dashboard');
        }
      }, 1500);
    } catch (error: any) {
      console.error('パスワードログインエラー:', error);
      let errorMessage = 'ログインに失敗しました';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'このメールアドレスは登録されていません。';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'パスワードが正しくありません。以前にもemolinkをご利用いただいている方は同じパスワードを使用してください。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません。';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください。';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordResetEmail) {
      setError('メールアドレスを入力してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage('');

    try {
      if (!auth) {
        throw new Error('認証サービスが利用できません');
      }

      await sendPasswordResetEmail(auth, passwordResetEmail, {
        url: window.location.origin + '/auth',
        handleCodeInApp: true,
      });

      setPasswordResetSent(true);
      setMessage('パスワード再発行用のメールを送信しました。メールを確認してください。');
    } catch (error: any) {
      console.error('パスワード再発行エラー:', error);
      let errorMessage = 'パスワード再発行に失敗しました';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'このメールアドレスは登録されていません。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません。';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendEmailLink = async () => {
    if (!email) {
      setError('メールアドレスを入力してください。');
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage('');
    
    try {
      // メールアドレスをローカルストレージに保存（認証時に使用）
      localStorage.setItem('emailForSignIn', email);
      
      const actionCodeSettings = {
        url: window.location.origin + '/auth',
        handleCodeInApp: true,
      };

      await sendSignInLinkToEmail(auth, email, actionCodeSettings);
      setMessage('認証リンクをメールに送信しました。メールを確認してください。');
    } catch (error: any) {
      console.error('メール送信エラー:', error);
      setError(`メール送信に失敗しました: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center justify-center space-x-2 mb-2">
            <Lock className="w-6 h-6 text-blue-600" />
            <CardTitle>CMS ログイン</CardTitle>
          </div>
          <CardDescription className="text-center">
            メールアドレスとパスワードでログイン
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ログインモード切り替え */}
          <div className="flex gap-2 mb-4">
            <Button
              type="button"
              variant={loginMode === 'password' ? 'default' : 'outline'}
              onClick={() => setLoginMode('password')}
              className="flex-1"
              size="sm"
            >
              パスワード
            </Button>
            <Button
              type="button"
              variant={loginMode === 'emailLink' ? 'default' : 'outline'}
              onClick={() => setLoginMode('emailLink')}
              className="flex-1"
              size="sm"
            >
              メールリンク
            </Button>
          </div>

          {message && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">{message}</p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {showPasswordReset ? (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reset-email">メールアドレス</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="reset-email"
                    type="email"
                    value={passwordResetEmail}
                    onChange={(e) => setPasswordResetEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pl-10"
                    disabled={isLoading || passwordResetSent}
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">
                  パスワード再発行用のメールを送信します
                </p>
              </div>

              {passwordResetSent && (
                <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800">
                    パスワード再発行用のメールを送信しました。メールを確認して、新しいパスワードを設定してください。
                  </p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={isLoading || !passwordResetEmail || passwordResetSent}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    <>
                      <Mail className="w-4 h-4 mr-2" />
                      再発行メールを送信
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordReset(false);
                    setPasswordResetEmail('');
                    setPasswordResetSent(false);
                    setError(null);
                    setMessage('');
                  }}
                  disabled={isLoading}
                >
                  キャンセル
                </Button>
              </div>
            </form>
          ) : loginMode === 'password' ? (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">メールアドレス</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pl-10"
                    disabled={isLoading}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">パスワード</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="パスワードを入力"
                    className="pl-10 pr-10"
                    disabled={isLoading}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowPasswordReset(true);
                    setPasswordResetEmail(email);
                    setError(null);
                    setMessage('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  パスワードを忘れた場合
                </button>
              </div>

              <Button
                type="submit"
                className="w-full"
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
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email-link">メールアドレス</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    id="email-link"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="pl-10"
                    disabled={isLoading}
                  />
                </div>
              </div>

              <div className="flex space-x-2">
                <Button
                  onClick={handleSendEmailLink}
                  disabled={isLoading || !email}
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      送信中...
                    </>
                  ) : (
                    '認証リンクを送信'
                  )}
                </Button>
                
                <Button
                  onClick={handleEmailLinkSignIn}
                  disabled={isLoading}
                  variant="outline"
                  className="flex-1"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      認証中...
                    </>
                  ) : (
                    '認証完了'
                  )}
                </Button>
              </div>
            </div>
          )}

          <div className="mt-6 p-4 bg-yellow-50 rounded-lg">
            <h3 className="font-medium text-yellow-900 mb-2">初回ログインについて</h3>
            <p className="text-sm text-yellow-700">
              LPから送信された認証リンク（JWTトークン）から初回ログインした際に、パスワードを設定できます。
              次回からはメールアドレスとパスワードでログインできます。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProductionAuth() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p>読み込み中...</p>
          </CardContent>
        </Card>
      </div>
    }>
      <AuthContent />
    </Suspense>
  );
}

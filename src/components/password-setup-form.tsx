'use client';

import { useState } from 'react';
import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Lock, Eye, EyeOff } from 'lucide-react';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, setDoc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentTenant } from '@/lib/security/tenant-validation';

interface PasswordSetupFormProps {
  email: string;
  tenant: string;
  claimRequestId?: string; // 初期設定ページで使用するために必要
  onSuccess: () => void;
  onError: (error: string) => void;
}

export default function PasswordSetupForm({ email, tenant, claimRequestId, onSuccess, onError }: PasswordSetupFormProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExistingAccount, setIsExistingAccount] = useState(false);
  
  // コンポーネントマウント時に既存アカウントをチェック
  React.useEffect(() => {
    const checkExistingAccount = async () => {
      if (!auth) return;
      try {
        const methods = await fetchSignInMethodsForEmail(auth, email);
        setIsExistingAccount(methods.length > 0);
      } catch (error) {
        console.error('Error checking existing account:', error);
      }
    };
    checkExistingAccount();
  }, [email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // バリデーション
      if (!password || password.length < 6) {
        throw new Error('パスワードは6文字以上で入力してください');
      }

      // 新規アカウントの場合のみ、パスワード確認をチェック
      if (!isExistingAccount && password !== confirmPassword) {
        throw new Error('パスワードが一致しません');
      }

      if (!auth) {
        throw new Error('認証サービスが利用できません');
      }

      const currentTenant = tenant || getCurrentTenant();

      // まず、メールアドレスが既に使用されているか確認
      let methods: string[] = [];
      try {
        methods = await fetchSignInMethodsForEmail(auth, email);
        console.log('Sign-in methods for email:', methods);
      } catch (error: any) {
        console.error('Error fetching sign-in methods:', error);
        // エラーが発生しても処理を続行（新規アカウントとして扱う）
      }
      
      if (methods.length > 0) {
        console.log('Existing account detected, attempting login', {
          email,
          methods,
          passwordLength: password.length,
        });
        // 既存のFirebase Authアカウントがある場合、ログインを試みる
        try {
          console.log('Attempting signInWithEmailAndPassword...');
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;
          console.log('Login successful, user UID:', firebaseUser.uid);

          // Firestoreで同じテナントのユーザーが既に存在するか確認
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);

          if (userDocSnap.exists()) {
            const userData = userDocSnap.data();
            // 既存のユーザーデータにテナント情報を追加または更新
            // 複数のテナントに対応するため、tenants配列を使用
            const existingTenants = userData.tenants || [];
            const tenantInfo = {
              tenant: currentTenant,
              role: 'user',
              createdAt: new Date(),
              updatedAt: new Date(),
            };

            // 同じテナントが既に存在するか確認
            const tenantExists = existingTenants.some((t: any) => t.tenant === currentTenant);
            
            if (!tenantExists) {
              // 新しいテナントを追加
              existingTenants.push(tenantInfo);
            } else {
              // 既存のテナント情報を更新
              const index = existingTenants.findIndex((t: any) => t.tenant === currentTenant);
              existingTenants[index] = {
                ...existingTenants[index],
                updatedAt: new Date(),
              };
            }

            // 現在のテナントをデフォルトとして設定
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              tenant: currentTenant, // 現在のテナントをデフォルトとして設定
              tenants: existingTenants,
              role: 'user',
              createdAt: userData.createdAt || new Date(),
              updatedAt: new Date(),
            }, { merge: true });
          } else {
            // Firestoreにユーザー情報がない場合、新規作成
            const newTenantInfo = {
              tenant: currentTenant,
              role: 'user',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              tenant: currentTenant,
              tenants: [newTenantInfo],
              role: 'user',
              createdAt: new Date(),
              updatedAt: new Date(),
            });
          }

          console.log('✅ Login successful for existing account:', email);
          
          // パスワードを一時的にsessionStorageに保存（メール送信用）
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('tempPassword', password);
            // claimRequestIdをsessionStorageに保存して、初期設定ページで使用する
            if (claimRequestId) {
              sessionStorage.setItem('currentClaimRequestId', claimRequestId);
              console.log('✅ Saved claimRequestId to sessionStorage for initial setup:', claimRequestId);
            } else {
              console.warn('⚠️ claimRequestId is not provided');
            }
          }
          
          // 公開ページの作成は初期設定ページで行うため、ここでは作成しない
          console.log('✅ Calling onSuccess callback');
          onSuccess();
          return;
        } catch (loginError: any) {
          // ログインに失敗した場合（パスワードが間違っているなど）
          console.error('Login error details:', {
            code: loginError.code,
            message: loginError.message,
            email: email,
          });
          
          if (loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
            throw new Error('パスワードが正しくありません。以前にもemolinkをご利用いただいている方は同じパスワードを使用してください。');
          } else if (loginError.code === 'auth/user-not-found') {
            // この場合は通常発生しないが、念のため
            throw new Error('アカウントが見つかりませんでした。');
          } else if (loginError.code === 'auth/user-disabled') {
            throw new Error('このアカウントは無効化されています。サポートにお問い合わせください。');
          } else if (loginError.code === 'auth/too-many-requests') {
            throw new Error('ログイン試行回数が多すぎます。しばらく待ってから再試行してください。');
          } else {
            // その他のエラーも適切なメッセージに変換
            throw new Error(`ログインに失敗しました: ${loginError.message || 'パスワードを確認してください'}`);
          }
        }
      } else {
        // 新規アカウント作成を試みる
        console.log('No existing account detected, attempting to create new account');
        try {
          const userCredential = await createUserWithEmailAndPassword(auth, email, password);
          const firebaseUser = userCredential.user;

          // Firestoreにユーザー情報を保存
          try {
            const userDocRef = doc(db, 'users', firebaseUser.uid);
            const newTenantInfo = {
              tenant: currentTenant,
              role: 'user',
              createdAt: new Date(),
              updatedAt: new Date(),
            };
            
            console.log('Saving user to Firestore:', {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              tenant: currentTenant,
            });
            
            await setDoc(userDocRef, {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              tenant: currentTenant,
              tenants: [newTenantInfo], // テナント配列を追加
              role: 'user',
              createdAt: new Date(),
              updatedAt: new Date(),
            });

            console.log('✅ User saved to Firestore successfully');
          } catch (firestoreError: any) {
            console.error('❌ Error saving user to Firestore:', firestoreError);
            // Firestoreへの保存に失敗しても、認証は成功しているので続行
            // ただし、エラーをログに記録
          }

          console.log('✅ Password setup successful for:', email);
          
          // パスワードを一時的にsessionStorageに保存（メール送信用）
          if (typeof window !== 'undefined') {
            sessionStorage.setItem('tempPassword', password);
            // claimRequestIdをsessionStorageに保存して、初期設定ページで使用する
            if (claimRequestId) {
              sessionStorage.setItem('currentClaimRequestId', claimRequestId);
              console.log('✅ Saved claimRequestId to sessionStorage for initial setup:', claimRequestId);
            } else {
              console.warn('⚠️ claimRequestId is not provided');
            }
          }
          
          // 公開ページの作成は初期設定ページで行うため、ここでは作成しない
          console.log('✅ Calling onSuccess callback');
          onSuccess();
        } catch (createError: any) {
          // アカウント作成に失敗した場合、既存アカウントの可能性がある
          if (createError.code === 'auth/email-already-in-use') {
            // 既存アカウントとしてログインを試みる
            console.log('Email already in use, attempting login instead');
            try {
              const userCredential = await signInWithEmailAndPassword(auth, email, password);
              const firebaseUser = userCredential.user;

              // Firestoreでユーザー情報を確認・更新
              const userDocRef = doc(db, 'users', firebaseUser.uid);
              const userDocSnap = await getDoc(userDocRef);

              if (userDocSnap.exists()) {
                const userData = userDocSnap.data();
                const existingTenants = userData.tenants || [];
                const tenantInfo = {
                  tenant: currentTenant,
                  role: 'user',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };

                const tenantExists = existingTenants.some((t: any) => t.tenant === currentTenant);
                
                if (!tenantExists) {
                  existingTenants.push(tenantInfo);
                } else {
                  const index = existingTenants.findIndex((t: any) => t.tenant === currentTenant);
                  existingTenants[index] = {
                    ...existingTenants[index],
                    updatedAt: new Date(),
                  };
                }

                await setDoc(userDocRef, {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  tenant: currentTenant,
                  tenants: existingTenants,
                  role: 'user',
                  createdAt: userData.createdAt || new Date(),
                  updatedAt: new Date(),
                }, { merge: true });
              } else {
                // Firestoreにユーザー情報がない場合、新規作成
                const newTenantInfo = {
                  tenant: currentTenant,
                  role: 'user',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                };
                await setDoc(userDocRef, {
                  uid: firebaseUser.uid,
                  email: firebaseUser.email,
                  tenant: currentTenant,
                  tenants: [newTenantInfo],
                  role: 'user',
                  createdAt: new Date(),
                  updatedAt: new Date(),
                });
              }

              console.log('✅ Login successful for existing account (after createUser error):', email);
              
              // パスワードを一時的にsessionStorageに保存（メール送信用）
              if (typeof window !== 'undefined') {
                sessionStorage.setItem('tempPassword', password);
                // claimRequestIdをsessionStorageに保存して、初期設定ページで使用する
                if (claimRequestId) {
                  sessionStorage.setItem('currentClaimRequestId', claimRequestId);
                  console.log('✅ Saved claimRequestId to sessionStorage for initial setup:', claimRequestId);
                } else {
                  console.warn('⚠️ claimRequestId is not provided');
                }
              }
              
              // 公開ページの作成は初期設定ページで行うため、ここでは作成しない
              console.log('✅ Calling onSuccess callback');
              onSuccess();
              return;
            } catch (loginError: any) {
              // ログインにも失敗した場合
              console.error('Login error after email-already-in-use:', {
                code: loginError.code,
                message: loginError.message,
              });
              
              if (loginError.code === 'auth/wrong-password' || loginError.code === 'auth/invalid-credential') {
                throw new Error('パスワードが正しくありません。以前にもemolinkをご利用いただいている方は同じパスワードを使用してください。');
              } else if (loginError.code === 'auth/user-disabled') {
                throw new Error('このアカウントは無効化されています。サポートにお問い合わせください。');
              } else if (loginError.code === 'auth/too-many-requests') {
                throw new Error('ログイン試行回数が多すぎます。しばらく待ってから再試行してください。');
              } else {
                throw new Error(`ログインに失敗しました: ${loginError.message || 'パスワードを確認してください'}`);
              }
            }
          } else {
            // その他のエラーはそのままスロー
            throw createError;
          }
        }
      }
    } catch (error: any) {
      console.error('Password setup error:', {
        code: error.code,
        message: error.message,
        email: email,
        stack: error.stack,
      });
      let errorMessage = 'パスワード登録に失敗しました';
      
      if (error.code === 'auth/email-already-in-use') {
        // このエラーは通常発生しない（fetchSignInMethodsForEmailで確認済み）
        errorMessage = 'このメールアドレスは既に登録されています。メールアドレスとパスワードでログインしてください。';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'パスワードが弱すぎます。より強力なパスワードを設定してください。';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'メールアドレスの形式が正しくありません。';
      } else if (error.code === 'auth/wrong-password' || error.code === 'auth/invalid-credential') {
        errorMessage = 'パスワードが正しくありません。以前にもemolinkをご利用いただいている方は同じパスワードを使用してください。';
      } else if (error.code === 'auth/user-disabled') {
        errorMessage = 'このアカウントは無効化されています。サポートにお問い合わせください。';
      } else if (error.code === 'auth/too-many-requests') {
        errorMessage = 'ログイン試行回数が多すぎます。しばらく待ってから再試行してください。';
      } else if (error.message) {
        // エラーメッセージが既に適切に設定されている場合はそのまま使用
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      onError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      className="min-h-screen flex items-center justify-center p-4" 
      style={{ 
        backgroundColor: '#000f24', 
        minHeight: '100vh', 
        width: '100%',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0
      }}
    >
      <div 
        className="rounded-2xl border border-white/10 shadow-xl p-8 max-w-md w-full text-center" 
        style={{ 
          backgroundColor: '#1a1a1a',
          color: '#ffffff'
        }}
      >
        <p className="text-white font-medium mb-4">
          {isExistingAccount ? 'ログインしてください' : 'パスワードを設定してください'}
        </p>
        <p className="text-white/70 text-sm mb-6">
          {isExistingAccount ? (
            <>
              既にアカウントが存在します。既存のパスワードを入力してください。
              <br />
              <span className="text-white/60 text-xs mt-1 block">
                新しい想い出ページを追加できます。
              </span>
            </>
          ) : (
            <>
              次回からメールアドレスとパスワードでログインできます
            </>
          )}
          <br />
          <span className="text-white/60 text-xs mt-1 block">
            メールアドレス: {email}
          </span>
        </p>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-white/80">パスワード</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder={isExistingAccount ? "パスワードを入力" : "6文字以上で入力"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10 bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {!isExistingAccount && (
              <p className="text-xs text-white/50">
                6文字以上のパスワードを設定してください
              </p>
            )}
          </div>

          {!isExistingAccount && (
            <div className="space-y-2">
              <Label htmlFor="confirmPassword" className="text-white/80">パスワード（確認）</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                placeholder="パスワードを再入力"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
                className="pr-10 bg-[#2a2a2a] border-white/20 text-white placeholder:text-white/50"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/70"
              >
                {showConfirmPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
          )}

          {error && (
            <div className="text-red-400 text-sm text-center bg-red-500/10 p-3 rounded border border-red-500/20">
              {error}
            </div>
          )}

          <Button 
            type="submit" 
            className="w-full bg-white text-black hover:bg-white/90" 
            disabled={loading || !password || password.length < 6 || (!isExistingAccount && (!confirmPassword || password !== confirmPassword))}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                {isExistingAccount ? 'ログイン中...' : '登録中...'}
              </>
            ) : (
              isExistingAccount ? 'ログイン' : 'パスワードを設定'
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}

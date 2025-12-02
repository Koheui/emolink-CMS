'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Staff } from '@/types';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { getCurrentTenant } from '@/lib/security/tenant-validation';
import { isAdminSecretKey } from '@/lib/secret-key-utils';
import { getStaffByUid } from '@/lib/firestore';
import {
  canAccessCRM,
  canEditOrders,
  canEditCustomers,
  canWriteNFC,
  canManageStaff,
  canManageTenants,
  getStaffPermissions,
  type StaffPermissions,
} from '@/lib/security/role-check';

interface SecretKeyAuthContextType {
  user: User | null; // エンドユーザー（顧客）
  staff: Staff | null; // 店舗スタッフ（管理者）
  currentUser: User | null; // 互換性のため（userまたはstaffの情報）
  loading: boolean;
  currentTenant: string;
  isAuthenticated: boolean;
  isAdmin: boolean; // 管理者かどうか（staff !== null）
  isSuperAdmin: boolean; // スーパー管理者かどうか
  // CRM権限チェック関数（スタッフ専用）
  canAccessCRM: boolean; // CRM閲覧権限
  canEditOrders: boolean; // 注文編集権限
  canEditCustomers: boolean; // 顧客編集権限
  canWriteNFC: boolean; // NFC書き込み権限
  canManageStaff: boolean; // スタッフ管理権限
  canManageTenants: boolean; // テナント管理権限
  staffPermissions: StaffPermissions | null; // スタッフの権限情報
  // 秘密鍵認証は廃止（JWTトークン認証リンク + メール/パスワードログインに変更）
  // authenticateWithSecretKey: (secretKey: string) => Promise<{ success: boolean; error?: string }>;
  // authenticateWithPassword: (password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const SecretKeyAuthContext = createContext<SecretKeyAuthContextType>({
  user: null,
  staff: null,
  currentUser: null,
  loading: true,
  currentTenant: 'unknown',
  isAuthenticated: false,
  isAdmin: false,
  isSuperAdmin: false,
  canAccessCRM: false,
  canEditOrders: false,
  canEditCustomers: false,
  canWriteNFC: false,
  canManageStaff: false,
  canManageTenants: false,
  staffPermissions: null,
  // authenticateWithSecretKey: async () => ({ success: false }),
  // authenticateWithPassword: async () => ({ success: false }),
  logout: () => {},
});

export function SecretKeyAuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [staff, setStaff] = useState<Staff | null>(null);
  const [loading, setLoading] = useState(true);
  const [currentTenant, setCurrentTenant] = useState<string>('unknown');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // 管理者判定（staffコレクションから取得）
  const isAdmin = staff !== null;
  const isSuperAdmin = staff?.role === 'superAdmin';
  
  // CRM権限チェック（スタッフ専用）
  const canAccessCRMValue = canAccessCRM(staff);
  const canEditOrdersValue = canEditOrders(staff);
  const canEditCustomersValue = canEditCustomers(staff);
  const canWriteNFCValue = canWriteNFC(staff);
  const canManageStaffValue = canManageStaff(staff);
  const canManageTenantsValue = canManageTenants(staff);
  const staffPermissionsValue = staff ? getStaffPermissions(staff) : null;

  // Firebase Authenticationの認証状態を監視
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log('=== Auth State Changed ===');
      console.log('firebaseUser:', firebaseUser?.uid);
      
      if (firebaseUser) {
        // Firebase Authenticationで認証されている場合
        try {
          // Firestoreからユーザー情報を取得
          const userDocRef = doc(db, 'users', firebaseUser.uid);
          const userDocSnap = await getDoc(userDocRef);
          
          // まずstaffコレクションを確認（管理者の場合）
          const staffData = await getStaffByUid(firebaseUser.uid);
          
          if (staffData) {
            // 管理者（スタッフ）の場合
            setStaff(staffData);
            setCurrentTenant(staffData.adminTenant);
            setIsAuthenticated(true);
            console.log('Staff authenticated:', firebaseUser.uid);
            
            // localStorageにも保存
            localStorage.setItem('secretKeyStaff', JSON.stringify(staffData));
            localStorage.setItem('secretKeyTenant', staffData.adminTenant);
            localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
          } else if (userDocSnap.exists()) {
            // エンドユーザーの場合
            const userData = userDocSnap.data();
            const user: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: userData.displayName || firebaseUser.displayName || undefined,
              tenant: userData.tenant || getCurrentTenant(),
              tenants: userData.tenants,
              createdAt: userData.createdAt?.toDate() || new Date(),
              updatedAt: userData.updatedAt?.toDate() || new Date(),
            };
            setUser(user);
            setCurrentTenant(user.tenant || getCurrentTenant());
            setIsAuthenticated(true);
            console.log('Firebase Authentication state restored:', firebaseUser.uid);
            console.log('User data set:', user);
            
            // localStorageにも保存（別ブラウザ対応）
            localStorage.setItem('secretKeyUser', JSON.stringify(user));
            localStorage.setItem('secretKeyTenant', user.tenant || getCurrentTenant());
            localStorage.setItem('secretKeyExpiry', (Date.now() + 24 * 60 * 60 * 1000).toString());
          } else {
            // Firestoreにユーザー情報がない場合、localStorageから復元を試みる
            // まずstaffを確認
            const savedStaff = localStorage.getItem('secretKeyStaff');
            const savedUser = localStorage.getItem('secretKeyUser');
            const savedTenant = localStorage.getItem('secretKeyTenant');
            
            if (savedStaff && savedTenant) {
              try {
                const staffData = JSON.parse(savedStaff);
                if (staffData.uid === firebaseUser.uid) {
                  setStaff(staffData);
                  setCurrentTenant(staffData.adminTenant);
                  setIsAuthenticated(true);
                  console.log('Staff data restored from storage');
                } else {
                  console.warn('Saved staff UID does not match Firebase user UID');
                }
              } catch (error) {
                console.error('Error parsing saved staff data:', error);
              }
            } else if (savedUser && savedTenant) {
              try {
                const userData = JSON.parse(savedUser);
                if (userData.uid === firebaseUser.uid) {
                  setUser(userData);
                  setCurrentTenant(savedTenant);
                  setIsAuthenticated(true);
                  console.log('User data restored from storage');
                } else {
                  console.warn('Saved user UID does not match Firebase user UID');
                }
              } catch (error) {
                console.error('Error parsing saved user data:', error);
              }
            } else {
              console.warn('No user or staff data found in Firestore or localStorage');
            }
          }
        } catch (error) {
          console.error('Error fetching user data:', error);
        }
      } else {
        // Firebase Authenticationで認証されていない場合、localStorageから復元を試みる
        const persistentStaff = localStorage.getItem('secretKeyStaff');
        const persistentUser = localStorage.getItem('secretKeyUser');
        const persistentTenant = localStorage.getItem('secretKeyTenant');
        const persistentExpiry = localStorage.getItem('secretKeyExpiry');
        
        if (persistentStaff && persistentTenant && persistentExpiry) {
          try {
            const expiryTime = parseInt(persistentExpiry);
            const now = Date.now();
            
            // 有効期限をチェック（24時間）
            if (now < expiryTime) {
              const staffData = JSON.parse(persistentStaff);
              setStaff(staffData);
              setCurrentTenant(staffData.adminTenant);
              setIsAuthenticated(true);
              console.log('Staff authentication state restored from storage');
            } else {
              console.log('Authentication expired, clearing storage');
              localStorage.removeItem('secretKeyStaff');
              localStorage.removeItem('secretKeyTenant');
              localStorage.removeItem('secretKeyExpiry');
              sessionStorage.removeItem('secretKeyStaff');
              sessionStorage.removeItem('secretKeyTenant');
              sessionStorage.removeItem('secretKeyExpiry');
            }
          } catch (error) {
            console.error('Error parsing saved staff data:', error);
            localStorage.removeItem('secretKeyStaff');
            localStorage.removeItem('secretKeyTenant');
            localStorage.removeItem('secretKeyExpiry');
            sessionStorage.removeItem('secretKeyStaff');
            sessionStorage.removeItem('secretKeyTenant');
            sessionStorage.removeItem('secretKeyExpiry');
          }
        } else if (persistentUser && persistentTenant && persistentExpiry) {
          try {
            const expiryTime = parseInt(persistentExpiry);
            const now = Date.now();
            
            // 有効期限をチェック（24時間）
            if (now < expiryTime) {
              const userData = JSON.parse(persistentUser);
              setUser(userData);
              setCurrentTenant(persistentTenant);
              setIsAuthenticated(true);
              console.log('User authentication state restored from storage');
            } else {
              console.log('Authentication expired, clearing storage');
              localStorage.removeItem('secretKeyUser');
              localStorage.removeItem('secretKeyTenant');
              localStorage.removeItem('secretKeyExpiry');
              sessionStorage.removeItem('secretKeyUser');
              sessionStorage.removeItem('secretKeyTenant');
              sessionStorage.removeItem('secretKeyExpiry');
            }
          } catch (error) {
            console.error('Error parsing saved user data:', error);
            localStorage.removeItem('secretKeyUser');
            localStorage.removeItem('secretKeyTenant');
            localStorage.removeItem('secretKeyExpiry');
            sessionStorage.removeItem('secretKeyUser');
            sessionStorage.removeItem('secretKeyTenant');
            sessionStorage.removeItem('secretKeyExpiry');
          }
        } else {
          setUser(null);
          setStaff(null);
          setCurrentTenant('unknown');
          setIsAuthenticated(false);
        }
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 秘密鍵認証は廃止（JWTトークン認証リンク + メール/パスワードログインに変更）
  // 認証は /auth ページでFirebase Authenticationを使用
  // const authenticateWithSecretKey = async (secretKey: string) => { ... };
  // const authenticateWithPassword = async (password: string) => { ... };

  const logout = () => {
    sessionStorage.removeItem('secretKeyUser');
    sessionStorage.removeItem('secretKeyStaff');
    sessionStorage.removeItem('secretKeyTenant');
    sessionStorage.removeItem('secretKeyExpiry');
    localStorage.removeItem('secretKeyUser');
    localStorage.removeItem('secretKeyStaff');
    localStorage.removeItem('secretKeyTenant');
    localStorage.removeItem('secretKeyExpiry');
    setUser(null);
    setStaff(null);
    setCurrentTenant('unknown');
    setIsAuthenticated(false);
  };

  return (
    <SecretKeyAuthContext.Provider value={{
      user,
      staff,
      currentUser: user || (staff ? {
        uid: staff.uid,
        email: staff.email,
        displayName: staff.displayName,
        tenant: staff.adminTenant,
        createdAt: staff.createdAt,
        updatedAt: staff.updatedAt,
      } : null), // 互換性のため（userまたはstaffの情報）
      loading,
      currentTenant,
      isAuthenticated,
      isAdmin,
      isSuperAdmin,
      canAccessCRM: canAccessCRMValue,
      canEditOrders: canEditOrdersValue,
      canEditCustomers: canEditCustomersValue,
      canWriteNFC: canWriteNFCValue,
      canManageStaff: canManageStaffValue,
      canManageTenants: canManageTenantsValue,
      staffPermissions: staffPermissionsValue,
      // authenticateWithSecretKey,
      // authenticateWithPassword,
      logout,
    }}>
      {children}
    </SecretKeyAuthContext.Provider>
  );
}

export function useSecretKeyAuth() {
  const context = useContext(SecretKeyAuthContext);
  if (!context) {
    throw new Error('useSecretKeyAuth must be used within a SecretKeyAuthProvider');
  }
  return context;
}

/**
 * CRM権限チェック関数
 * 
 * 注意: CRMの権限体系は弊社スタッフ専用で、LPの権限とは異なります
 */

import { Staff } from '@/types';

export type StaffRole = 'tenantAdmin' | 'superAdmin' | 'editor' | 'viewer';

export interface StaffPermissions {
  canViewCRM?: boolean;        // CRM閲覧権限
  canEditOrders?: boolean;      // 注文編集権限
  canEditCustomers?: boolean;   // 顧客編集権限
  canManageStaff?: boolean;     // スタッフ管理権限（管理者のみ）
  canWriteNfc?: boolean;        // NFC書き込み権限
  canManageTenants?: boolean;   // テナント管理権限（superAdminのみ）
}

/**
 * CRMにアクセスできるかどうか
 * 閲覧者以上であればアクセス可能
 */
export function canAccessCRM(staff: Staff | null): boolean {
  if (!staff) return false;
  return ['tenantAdmin', 'superAdmin', 'editor', 'viewer'].includes(staff.role);
}

/**
 * 注文を編集できるかどうか
 * 編集者以上であれば編集可能
 */
export function canEditOrders(staff: Staff | null): boolean {
  if (!staff) return false;
  return ['tenantAdmin', 'superAdmin', 'editor'].includes(staff.role);
}

/**
 * 顧客を編集できるかどうか
 * 編集者以上であれば編集可能
 */
export function canEditCustomers(staff: Staff | null): boolean {
  if (!staff) return false;
  return ['tenantAdmin', 'superAdmin', 'editor'].includes(staff.role);
}

/**
 * NFC書き込みができるかどうか
 * 編集者以上であれば書き込み可能
 */
export function canWriteNFC(staff: Staff | null): boolean {
  if (!staff) return false;
  return ['tenantAdmin', 'superAdmin', 'editor'].includes(staff.role);
}

/**
 * スタッフを管理できるかどうか
 * 管理者のみ可能
 */
export function canManageStaff(staff: Staff | null): boolean {
  if (!staff) return false;
  return ['tenantAdmin', 'superAdmin'].includes(staff.role);
}

/**
 * テナントを管理できるかどうか
 * スーパー管理者のみ可能
 */
export function canManageTenants(staff: Staff | null): boolean {
  if (!staff) return false;
  return staff.role === 'superAdmin';
}

/**
 * スタッフの権限を取得
 * permissionsフィールドが設定されている場合はそれを優先し、
 * ない場合はroleから自動判定
 */
export function getStaffPermissions(staff: Staff): StaffPermissions {
  // permissionsフィールドが設定されている場合はそれを優先
  if (staff.permissions) {
    return {
      canViewCRM: staff.permissions.canViewCRM ?? canAccessCRM(staff),
      canEditOrders: staff.permissions.canEditOrders ?? canEditOrders(staff),
      canEditCustomers: staff.permissions.canEditCustomers ?? canEditCustomers(staff),
      canManageStaff: staff.permissions.canManageStaff ?? canManageStaff(staff),
      canWriteNfc: staff.permissions.canWriteNfc ?? canWriteNFC(staff),
      canManageTenants: staff.permissions.canManageTenants ?? canManageTenants(staff),
    };
  }
  
  // permissionsフィールドがない場合はroleから自動判定
  return {
    canViewCRM: canAccessCRM(staff),
    canEditOrders: canEditOrders(staff),
    canEditCustomers: canEditCustomers(staff),
    canManageStaff: canManageStaff(staff),
    canWriteNfc: canWriteNFC(staff),
    canManageTenants: canManageTenants(staff),
  };
}

/**
 * ロールの優先順位を取得（数値が大きいほど権限が高い）
 */
export function getRolePriority(role: StaffRole): number {
  const priorities: Record<StaffRole, number> = {
    viewer: 1,
    editor: 2,
    tenantAdmin: 3,
    superAdmin: 4,
  };
  return priorities[role] || 0;
}

/**
 * ロールAがロールB以上の権限を持っているかどうか
 */
export function hasRoleOrHigher(staff: Staff | null, requiredRole: StaffRole): boolean {
  if (!staff) return false;
  return getRolePriority(staff.role) >= getRolePriority(requiredRole);
}
















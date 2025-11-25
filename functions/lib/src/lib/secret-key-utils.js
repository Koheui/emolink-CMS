"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSecretKey = generateSecretKey;
exports.validateSecretKeyFormat = validateSecretKeyFormat;
exports.isAdminSecretKey = isAdminSecretKey;
/**
 * 16桁の秘密鍵を生成する
 * @returns 16桁の英数字文字列
 */
function generateSecretKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 16; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}
/**
 * 秘密鍵の形式を検証する
 * @param secretKey 検証する秘密鍵
 * @returns 有効な場合はtrue
 */
function validateSecretKeyFormat(secretKey) {
    // 16桁の英数字のみ
    const regex = /^[A-Z0-9]{16}$/;
    return regex.test(secretKey);
}
/**
 * 管理者用秘密鍵かどうかをチェックする
 * @param secretKey チェックする秘密鍵
 * @returns 管理者用の場合はtrue
 */
function isAdminSecretKey(secretKey) {
    // 管理者用秘密鍵（16桁）
    const ADMIN_KEY = 'EMOLINKEMOLINKEM';
    // 大文字小文字を区別しないで比較
    return secretKey.toUpperCase() === ADMIN_KEY;
}
//# sourceMappingURL=secret-key-utils.js.map
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.claimSetUrls = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const email_service_1 = require("./email-service");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
/**
 * 公開ページURL設定とメール送信API
 * POST /claimSetUrls?requestId={requestId}
 * または
 * POST /claimSetUrls/{requestId}
 */
exports.claimSetUrls = functions.region('asia-northeast1').https.onRequest(async (req, res) => {
    // CORS対応
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }
    if (req.method !== 'POST') {
        res.status(405).json({ ok: false, error: 'Method not allowed' });
        return;
    }
    try {
        // URLパラメータまたはパスからrequestIdを取得
        let requestId = req.query.requestId;
        if (!requestId) {
            // パスから取得を試みる（例: /claimSetUrls/{requestId}）
            const pathParts = req.path.split('/').filter((p) => p);
            const requestIdIndex = pathParts.findIndex((p) => p === 'claimSetUrls');
            if (requestIdIndex >= 0 && pathParts.length > requestIdIndex + 1) {
                requestId = pathParts[requestIdIndex + 1];
            }
        }
        if (!requestId) {
            res.status(400).json({ ok: false, error: 'Request ID is required' });
            return;
        }
        const { publicPageId, publicPageUrl, loginUrl, loginEmail, loginPassword, claimedByUid } = req.body;
        // バリデーション
        if (!publicPageId || !publicPageUrl || !loginUrl) {
            res.status(400).json({
                ok: false,
                error: 'Missing required fields: publicPageId, publicPageUrl, loginUrl'
            });
            return;
        }
        // claimRequestを取得
        const claimRequestDoc = await db.collection('claimRequests').doc(requestId).get();
        if (!claimRequestDoc.exists) {
            res.status(404).json({ ok: false, error: 'Claim request not found' });
            return;
        }
        const claimRequest = claimRequestDoc.data();
        if (!claimRequest) {
            res.status(404).json({ ok: false, error: 'Claim request data not found' });
            return;
        }
        // claimRequestを更新
        console.log('Updating claimRequest with URLs:', {
            requestId,
            publicPageId,
            publicPageUrl,
            loginUrl,
        });
        await db.collection('claimRequests').doc(requestId).update(Object.assign({ publicPageId: publicPageId, publicPageUrl: publicPageUrl, loginUrl: loginUrl, updatedAt: admin.firestore.FieldValue.serverTimestamp() }, (claimedByUid && { claimedByUid: claimedByUid })));
        console.log('claimRequest updated successfully');
        // 更新後のデータを確認
        const updatedDoc = await db.collection('claimRequests').doc(requestId).get();
        const updatedData = updatedDoc.data();
        console.log('Updated claimRequest data:', {
            publicPageId: updatedData === null || updatedData === void 0 ? void 0 : updatedData.publicPageId,
            publicPageUrl: updatedData === null || updatedData === void 0 ? void 0 : updatedData.publicPageUrl,
            loginUrl: updatedData === null || updatedData === void 0 ? void 0 : updatedData.loginUrl,
        });
        // メール送信
        const email = loginEmail || claimRequest.email;
        let emailSent = false;
        let emailError = null;
        if (email && loginPassword) {
            try {
                console.log('Attempting to send public page confirmation email:', {
                    to: email,
                    tenant: claimRequest.tenant,
                    hasPublicPageUrl: !!publicPageUrl,
                    hasLoginUrl: !!loginUrl
                });
                await (0, email_service_1.sendPublicPageConfirmationEmail)(email, loginUrl, email, loginPassword, publicPageUrl, {
                    tenantId: claimRequest.tenant
                });
                emailSent = true;
                console.log('Public page confirmation email sent successfully to:', email);
            }
            catch (error) {
                emailError = error.message;
                console.error('Error sending public page confirmation email:', {
                    error: error.message,
                    stack: error.stack,
                    to: email
                });
                // メール送信に失敗しても、URLの設定は成功とする
            }
        }
        else {
            console.warn('Email or password not provided, skipping email send:', {
                email: !!email,
                password: !!loginPassword,
                emailValue: email ? `${email.substring(0, 5)}...` : 'NOT SET',
                passwordValue: loginPassword ? 'SET' : 'NOT SET'
            });
        }
        res.json(Object.assign({ ok: true, publicPageId,
            publicPageUrl,
            loginUrl,
            emailSent }, (emailError && { emailError })));
    }
    catch (error) {
        console.error('Error in set-urls API:', error);
        res.status(500).json({
            ok: false,
            error: error.message || 'Internal server error'
        });
    }
});
//# sourceMappingURL=claim-set-urls.js.map
import * as functions from 'firebase-functions/v1';
import * as admin from 'firebase-admin';
import { sendPublicPageConfirmationEmail } from './email-service';

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
export const claimSetUrls = functions.region('asia-northeast1').https.onRequest(async (req: functions.Request, res: functions.Response) => {
  // CORS対応: OPTIONSリクエスト（preflight）を最初に処理
  // Firebase Functions v1では、res.set()を使用
  const setCorsHeaders = () => {
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.set('Access-Control-Max-Age', '3600');
  };

  // OPTIONSリクエスト（preflight）を処理
  if (req.method === 'OPTIONS') {
    setCorsHeaders();
    res.status(204).send('');
    return;
  }

  // すべてのレスポンスにCORSヘッダーを設定
  setCorsHeaders();

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  try {
    // URLパラメータまたはパスからrequestIdを取得
    let requestId = req.query.requestId as string;
    if (!requestId) {
      // パスから取得を試みる（例: /claimSetUrls/{requestId}）
      const pathParts = req.path.split('/').filter((p: string) => p);
      const requestIdIndex = pathParts.findIndex((p: string) => p === 'claimSetUrls');
      if (requestIdIndex >= 0 && pathParts.length > requestIdIndex + 1) {
        requestId = pathParts[requestIdIndex + 1];
      }
    }
    
    if (!requestId) {
      res.status(400).json({ ok: false, error: 'Request ID is required' });
      return;
    }

    const { 
      publicPageId, 
      publicPageUrl, 
      loginUrl, 
      loginEmail,
      loginPassword,
      claimedByUid 
    } = req.body;

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
    
    await db.collection('claimRequests').doc(requestId).update({
      publicPageId: publicPageId,
      publicPageUrl: publicPageUrl,
      loginUrl: loginUrl,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      ...(claimedByUid && { claimedByUid: claimedByUid }),
    });
    
    console.log('claimRequest updated successfully');
    
    // 更新後のデータを確認
    const updatedDoc = await db.collection('claimRequests').doc(requestId).get();
    const updatedData = updatedDoc.data();
    console.log('Updated claimRequest data:', {
      publicPageId: updatedData?.publicPageId,
      publicPageUrl: updatedData?.publicPageUrl,
      loginUrl: updatedData?.loginUrl,
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
        
        await sendPublicPageConfirmationEmail(
          email,
          loginUrl,
          email,
          loginPassword,
          publicPageUrl,
          {
            tenantId: claimRequest.tenant,
            productName: claimRequest.product || undefined  // 商品名を渡す（claimRequest.productから取得）
          }
        );
        emailSent = true;
        console.log('Public page confirmation email sent successfully to:', email);
      } catch (error: any) {
        emailError = error.message;
        console.error('Error sending public page confirmation email:', {
          error: error.message,
          stack: error.stack,
          to: email
        });
        // メール送信に失敗しても、URLの設定は成功とする
      }
    } else {
      console.warn('Email or password not provided, skipping email send:', {
        email: !!email,
        password: !!loginPassword,
        emailValue: email ? `${email.substring(0, 5)}...` : 'NOT SET',
        passwordValue: loginPassword ? 'SET' : 'NOT SET'
      });
    }

    // 成功レスポンス（CORSヘッダーは既に設定済み）
    res.json({
      ok: true,
      publicPageId,
      publicPageUrl,
      loginUrl,
      emailSent,
      ...(emailError && { emailError })
    });
  } catch (error: any) {
    console.error('Error in set-urls API:', error);
    // エラーレスポンスにもCORSヘッダーを設定
    res.status(500).json({
      ok: false,
      error: error.message || 'Internal server error'
    });
  }
});


import { NextRequest, NextResponse } from 'next/server';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getTenantFromOrigin } from '@/lib/security/tenant-validation';

// CORSヘッダーを設定する関数
function setCorsHeaders(response: NextResponse): NextResponse {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Origin, Referer');
  response.headers.set('Access-Control-Max-Age', '3600');
  return response;
}

// OPTIONSリクエスト（preflight）を処理
export async function OPTIONS(request: NextRequest) {
  const response = new NextResponse(null, { status: 204 });
  return setCorsHeaders(response);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      email, 
      tenant, 
      lpId, 
      productType, 
      recaptchaToken, 
      testMode, 
      link, 
      secretKey,
      // メール本文カスタマイズ情報（LP側から送信、オプション）
      emailHeaderTitle,
      emailHeaderSubtitle,
      emailMainMessage,
      emailFooterMessage
    } = body;

    // バリデーション
    if (!email || !tenant || !lpId || !productType) {
      const response = NextResponse.json(
        { ok: false, error: 'Missing required fields' },
        { status: 400 }
      );
      return setCorsHeaders(response);
    }

    // LP側で生成されたリンクと秘密鍵を受け取る
    if (!link || !secretKey) {
      const response = NextResponse.json(
        { ok: false, error: 'Missing link or secretKey from LP' },
        { status: 400 }
      );
      return setCorsHeaders(response);
    }

    // Originベースのテナント検証
    const origin = request.headers.get('origin') || request.headers.get('referer') || '';
    let actualTenant: string;
    let actualLpId: string;

    try {
      const tenantInfo = getTenantFromOrigin(origin);
      actualTenant = tenantInfo.tenant;
      actualLpId = tenantInfo.lpId;
    } catch (error) {
      // 開発環境ではクライアントの値を許可
      if (process.env.NODE_ENV === 'development') {
        actualTenant = tenant;
        actualLpId = lpId;
      } else {
        const response = NextResponse.json(
          { ok: false, error: 'Invalid origin' },
          { status: 403 }
        );
        return setCorsHeaders(response);
      }
    }

    // reCAPTCHA検証（開発環境ではスキップ）
    let recaptchaScore = 0.5; // デフォルトスコア
    if (process.env.NODE_ENV !== 'development') {
      if (!recaptchaToken || recaptchaToken === 'dev-token') {
        const response = NextResponse.json(
          { ok: false, error: 'Invalid reCAPTCHA token' },
          { status: 400 }
        );
        return setCorsHeaders(response);
      }
      
      // reCAPTCHA検証を実行
      const recaptchaSecret = process.env.RECAPTCHA_SECRET;
      if (!recaptchaSecret) {
        console.warn('RECAPTCHA_SECRET is not set, skipping reCAPTCHA verification');
      } else {
        try {
          const verifyUrl = 'https://www.google.com/recaptcha/api/siteverify';
          const verifyResponse = await fetch(verifyUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({
              secret: recaptchaSecret,
              response: recaptchaToken,
              remoteip: request.headers.get('x-forwarded-for') || request.ip || '',
            }),
          });
          
          const verifyData = await verifyResponse.json();
          
          if (!verifyData.success) {
            const response = NextResponse.json(
              { ok: false, error: 'reCAPTCHA verification failed', details: verifyData['error-codes'] },
              { status: 400 }
            );
            return setCorsHeaders(response);
          }
          
          // スコアを取得（v3の場合）
          recaptchaScore = verifyData.score || 0.5;
          
          // スコアが0.5未満の場合は拒否
          if (recaptchaScore < 0.5) {
            const response = NextResponse.json(
              { ok: false, error: 'reCAPTCHA score too low', score: recaptchaScore },
              { status: 400 }
            );
            return setCorsHeaders(response);
          }
        } catch (error) {
          console.error('reCAPTCHA verification error:', error);
          const response = NextResponse.json(
            { ok: false, error: 'reCAPTCHA verification error' },
            { status: 500 }
          );
          return setCorsHeaders(response);
        }
      }
    } else {
      // 開発環境ではdev-tokenの場合にスコア1.0を設定
      recaptchaScore = recaptchaToken === 'dev-token' ? 1.0 : 0.5;
    }

    // 1. claimRequestsに保存
    const claimRequest = {
      email,
      tenant: actualTenant,
      lpId: actualLpId,
      productType,
      origin,
      ip: request.headers.get('x-forwarded-for') || request.ip || 'unknown',
      ua: request.headers.get('user-agent') || 'unknown',
      recaptchaScore: recaptchaScore,
      status: 'pending',
      source: 'lp_form', // LPフォーム経由
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    // LP側で生成されたリンクからJWTトークンを抽出
    // リンク形式: https://app.example.com/claim?k={jwt} または /claim?k={jwt}
    let jwtToken = '';
    try {
      const url = new URL(link, 'http://localhost'); // 相対URL対応のためbase URLを追加
      jwtToken = url.searchParams.get('k') || '';
      if (!jwtToken) {
        // リンクにkパラメータがない場合、リンク自体がJWTトークンの可能性
        jwtToken = link;
      }
    } catch (error) {
      // URL解析に失敗した場合、リンク自体がJWTトークンの可能性
      jwtToken = link;
    }

    // claimRequestsにリンクと秘密鍵、メール本文情報を保存
    const claimRequestWithLink: any = {
      ...claimRequest,
      link: link,
      secretKey: secretKey,
      jwtToken: jwtToken, // 検証用に保存
    };

    // メール本文カスタマイズ情報を保存（LP側から送信された場合）
    if (emailHeaderTitle) {
      claimRequestWithLink.emailHeaderTitle = emailHeaderTitle;
    }
    if (emailHeaderSubtitle) {
      claimRequestWithLink.emailHeaderSubtitle = emailHeaderSubtitle;
    }
    if (emailMainMessage) {
      claimRequestWithLink.emailMainMessage = emailMainMessage;
    }
    if (emailFooterMessage) {
      claimRequestWithLink.emailFooterMessage = emailFooterMessage;
    }

    const docRef = await addDoc(collection(db, 'claimRequests'), claimRequestWithLink);
    const requestId = docRef.id;

    // 2. 注文（orders）を作成（BtoB店舗受付用）
    const orderData = {
      orderId: requestId,
      email,
      tenant: actualTenant,
      lpId: actualLpId,
      productType,
      product: productType, // 商品名は後でカスタマイズ可能
      status: 'paid', // すでに決済済み
      orderStatus: 'photo_upload_pending', // 写真アップロード待ち
      secretKey: secretKey, // LP側で生成された秘密鍵を使用
      secretKeyExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日
      paymentStatus: 'completed', // 決済済み
      source: 'lp_form', // LPフォーム経由
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await addDoc(collection(db, 'orders'), orderData);

    // 監査ログに記録
    await addDoc(collection(db, 'auditLogs'), {
      action: 'lpForm.received',
      target: requestId,
      payload: { email, tenant: actualTenant, lpId: actualLpId, link, hasSecretKey: !!secretKey },
      ts: serverTimestamp(),
    });

    // CMS側でメール送信を行うため、URL設定時に自動送信される
    const response = NextResponse.json({
      ok: true,
      message: 'Claim request received and saved',
      requestId,
      link: link,
    });
    return setCorsHeaders(response);

  } catch (error) {
    console.error('LP form error:', error);
    const response = NextResponse.json(
      { ok: false, error: 'Internal server error' },
      { status: 500 }
    );
    return setCorsHeaders(response);
  }
}

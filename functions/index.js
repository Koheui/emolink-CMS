const functions = require('firebase-functions');
const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');

const dev = process.env.NODE_ENV !== 'production';
const app = next({ dev });
const handle = app.getRequestHandler();

exports.nextjs = functions.https.onRequest((req, res) => {
  const parsedUrl = parse(req.url, true);
  handle(req, res, parsedUrl);
});

// Stripe Webhook関数をエクスポート（コンパイル後のパス）
try {
  const { stripeWebhook } = require('./lib/functions/src/stripe-webhook');
  exports.stripeWebhook = stripeWebhook;
} catch (e) {
  console.warn('stripe-webhook not found, skipping');
}

// 公開ページURL設定とメール送信API（コンパイル後のパス）
try {
  const { claimSetUrls } = require('./lib/functions/src/claim-set-urls');
  exports.claimSetUrls = claimSetUrls;
} catch (e) {
  console.warn('claim-set-urls not found, skipping');
}

// メール送信用のCloud Function
exports.sendLoginEmail = functions.https.onCall(async (data, context) => {
  // CORS対応
  functions.cors()(data, context);
  
  const { sendCustomerLoginEmail } = require('./lib/src/email-service');
  
  try {
    const { email, secretKey, loginUrl, tenantId, customerInfo } = data;
    
    // バリデーション
    if (!email || !secretKey || !loginUrl) {
      throw new functions.https.HttpsError(
        'invalid-argument',
        'Missing required parameters'
      );
    }
    
    // メール送信
    await sendCustomerLoginEmail(email, secretKey, loginUrl, {
      customerInfo,
      tenantId
    });
    
    return { success: true, message: 'Email sent successfully' };
  } catch (error) {
    console.error('Error sending login email:', error);
    throw new functions.https.HttpsError(
      'internal',
      'Failed to send email',
      error.message
    );
  }
});

// OGP取得API（コンパイル後のパス）
try {
  const { getOgp } = require('./lib/functions/src/get-ogp');
  exports.getOgp = getOgp;
} catch (e) {
  console.warn('get-ogp not found, skipping');
}


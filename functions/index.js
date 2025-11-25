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

// Stripe Webhook関数をエクスポート
const { stripeWebhook } = require('./src/stripe-webhook');
exports.stripeWebhook = stripeWebhook;

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


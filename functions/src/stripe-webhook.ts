import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import Stripe from 'stripe';
import { generateSecretKey } from '../../src/lib/secret-key-utils';
import { sendSecretKeyEmail } from './email-service';

// Stripe設定
const stripe = new Stripe(functions.config().stripe.secret_key, {
  apiVersion: '2023-10-16',
});

const db = admin.firestore();

/**
 * Stripe Webhook処理
 * 決済完了後に秘密鍵を生成・メール送信
 */
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
  const sig = req.headers['stripe-signature'] as string;
  const endpointSecret = functions.config().stripe.webhook_secret;

  let event: Stripe.Event;

  try {
    // Webhook署名の検証
    event = stripe.webhooks.constructEvent(req.rawBody, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    res.status(400).send('Webhook Error');
    return;
  }

  console.log('Received Stripe webhook event:', event.type);

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * 決済成功時の処理
 */
async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  console.log('Processing payment success:', paymentIntent.id);

  try {
    // メタデータから注文情報を取得
    const metadata = paymentIntent.metadata;
    const email = metadata.email;
    const tenant = metadata.tenant || metadata.tenantId;
    const productType = metadata.productType;
    const lpId = metadata.lpId;
    const orderId = metadata.orderId || paymentIntent.id;

    if (!email) {
      throw new Error('Email not found in payment metadata');
    }

    // 1. 秘密鍵生成
    const secretKey = generateSecretKey();
    console.log('Generated secret key:', secretKey);

    // 2. Firestoreに秘密鍵を保存
    await db.collection('secretKeys').doc(secretKey).set({
      secretKey: secretKey,
      email: email,
      tenant: tenant,
      productType: productType,
      lpId: lpId,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30日
      paymentIntentId: paymentIntent.id,
      orderId: orderId,
      // 既存ラベル情報
      tenantId: tenant
    });

    // 3. 注文情報を更新
    await updateOrderStatus(orderId, {
      paymentStatus: 'completed',
      orderStatus: 'payment_completed',
      secretKey: secretKey,
      secretKeyExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      stripePaymentIntentId: paymentIntent.id,
      paymentCompletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // 4. 顧客に秘密鍵をメール送信
    await sendSecretKeyEmail(email, secretKey, {
      tenantId: tenant,
      lpId: lpId,
      productType: productType,
      orderId: orderId
    });

    console.log('Payment success processing completed for order:', orderId);
  } catch (error) {
    console.error('Error in handlePaymentSuccess:', error);
    throw error;
  }
}

/**
 * チェックアウトセッション完了時の処理
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout session completed:', session.id);

  try {
    // セッションのメタデータから注文情報を取得
    const metadata = session.metadata || {};
    const email = session.customer_email || metadata.email;
    // 将来的に使用する可能性がある変数（現在は未使用）
    // const tenant = metadata.tenant || metadata.tenantId;
    // const productType = metadata.productType;
    // const lpId = metadata.lpId;
    const orderId = metadata.orderId || session.id;

    if (!email) {
      throw new Error('Email not found in session metadata');
    }

    // 注文情報を更新
    await updateOrderStatus(orderId, {
      paymentStatus: 'completed',
      orderStatus: 'checkout_completed',
      stripeSessionId: session.id,
      checkoutCompletedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log('Checkout session processing completed for order:', orderId);
  } catch (error) {
    console.error('Error in handleCheckoutSessionCompleted:', error);
    throw error;
  }
}

/**
 * 注文ステータスを更新
 */
async function updateOrderStatus(orderId: string, updateData: any) {
  try {
    const orderRef = db.collection('orders').doc(orderId);
    await orderRef.update({
      ...updateData,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    console.log('Order status updated:', orderId);
  } catch (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}

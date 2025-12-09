import { NextRequest, NextResponse } from 'next/server';
import { getClaimRequestById } from '@/lib/firestore';
import { sendPublicPageConfirmationEmailWithBackup, getGmailCredentials } from '@/lib/email-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const requestId = params.requestId;
    const body = await request.json();
    const { 
      loginEmail,
      loginPassword,
      publicPageUrl,
      loginUrl
    } = body;

    // バリデーション
    if (!loginEmail || !loginPassword || !publicPageUrl || !loginUrl) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: loginEmail, loginPassword, publicPageUrl, loginUrl' },
        { status: 400 }
      );
    }

    // claimRequestを取得（メール送信に必要な情報を取得）
    const claimRequest = await getClaimRequestById(requestId, true);
    if (!claimRequest) {
      return NextResponse.json(
        { ok: false, error: 'Claim request not found' },
        { status: 404 }
      );
    }

    // メール送信
    let emailSent = false;
    let emailError: string | undefined;
    
    console.log('Attempting to send email:', {
      email: loginEmail,
      hasPassword: !!loginPassword,
      tenant: claimRequest.tenant,
      publicPageUrl,
      loginUrl
    });
    
    try {
      // Gmail認証情報の確認（Firebase Functions Configまたは環境変数から取得）
      // デバッグ: 環境変数を直接確認
      console.log('🔍 Direct environment variable check in API route:', {
        GMAIL_USER: process.env.GMAIL_USER ? `${process.env.GMAIL_USER.substring(0, 5)}...` : 'NOT SET',
        GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? 'SET (hidden)' : 'NOT SET',
        hasGmailUser: !!process.env.GMAIL_USER,
        hasGmailAppPassword: !!process.env.GMAIL_APP_PASSWORD,
        allEnvKeysWithGmail: Object.keys(process.env).filter(key => key.includes('GMAIL') || key.includes('MAIL')).join(', ') || 'NONE'
      });
      
      const gmailCreds = getGmailCredentials();
      console.log('Gmail credentials check:', {
        isConfigured: gmailCreds.isConfigured,
        hasUser: !!gmailCreds.user,
        hasPassword: !!gmailCreds.password,
        userPrefix: gmailCreds.user ? `${gmailCreds.user.substring(0, 5)}...` : 'NOT SET'
      });
      
      if (!gmailCreds.isConfigured) {
        console.error('❌ Gmail credentials not configured:', {
          hasGmailUser: !!gmailCreds.user,
          hasGmailAppPassword: !!gmailCreds.password,
          directEnvCheck: {
            GMAIL_USER: process.env.GMAIL_USER ? 'SET' : 'NOT SET',
            GMAIL_APP_PASSWORD: process.env.GMAIL_APP_PASSWORD ? 'SET' : 'NOT SET'
          }
        });
        emailError = 'メール送信設定が完了していません（Gmail認証情報が設定されていません）';
      } else {
        // バックアップメールアドレスにも送信（リトライ機能付き）
        await sendPublicPageConfirmationEmailWithBackup(
          loginEmail,
          loginUrl,
          loginEmail,
          loginPassword,
          publicPageUrl,
          {
            tenantId: claimRequest.tenant,
            backupEmail: 'emolink.guide@gmail.com'
          }
        );
        emailSent = true;
        console.log('✅ Public page confirmation email sent successfully to:', loginEmail, '(with backup)');
      }
    } catch (emailErrorObj: any) {
      console.error('❌ Error sending public page confirmation email:', emailErrorObj);
      emailError = emailErrorObj.message || 'メール送信に失敗しました（詳細不明）';
    }

    return NextResponse.json({
      ok: true,
      emailSent,
      ...(emailError && { emailError })
    });
  } catch (error: any) {
    console.error('Error in send-email API:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


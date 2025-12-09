import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getClaimRequestById } from '@/lib/firestore';
import { sendPublicPageConfirmationEmailWithBackup } from '@/lib/email-service';

export async function POST(
  request: NextRequest,
  { params }: { params: { requestId: string } }
) {
  try {
    const requestId = params.requestId;
    const body = await request.json();
    const { 
      publicPageId, 
      publicPageUrl, 
      loginUrl, 
      loginEmail,
      loginPassword,
      claimedByUid 
    } = body;

    // バリデーション
    if (!publicPageId || !publicPageUrl || !loginUrl) {
      return NextResponse.json(
        { ok: false, error: 'Missing required fields: publicPageId, publicPageUrl, loginUrl' },
        { status: 400 }
      );
    }

    // claimRequestを取得
    const claimRequest = await getClaimRequestById(requestId, true);
    if (!claimRequest) {
      return NextResponse.json(
        { ok: false, error: 'Claim request not found' },
        { status: 404 }
      );
    }

    // claimRequestを更新（DB書き込み）
    console.log('Updating claimRequest in Firestore:', {
      requestId,
      publicPageId,
      publicPageUrl,
      loginUrl,
      claimedByUid
    });
    
    const claimRequestRef = doc(db, 'claimRequests', requestId);
    try {
      await updateDoc(claimRequestRef, {
        publicPageId: publicPageId,
        publicPageUrl: publicPageUrl,
        loginUrl: loginUrl,
        updatedAt: serverTimestamp(),
        ...(claimedByUid && { claimedByUid: claimedByUid }),
      });
      console.log('✅ claimRequest updated successfully in Firestore');
    } catch (updateError: any) {
      console.error('❌ Failed to update claimRequest in Firestore:', updateError);
      throw new Error(`データベースへの書き込みに失敗しました: ${updateError.message || '不明なエラー'}`);
    }

    // メール送信（DB書き込み成功後、独立して実行）
    const email = loginEmail || claimRequest.email;
    let emailSent = false;
    let emailError: string | undefined;
    
    console.log('Attempting to send email:', {
      email: !!email,
      hasPassword: !!loginPassword,
      tenant: claimRequest.tenant
    });
    
    if (email && loginPassword) {
      try {
        // 環境変数の確認
        if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
          console.error('Gmail credentials not configured:', {
            hasGmailUser: !!process.env.GMAIL_USER,
            hasGmailAppPassword: !!process.env.GMAIL_APP_PASSWORD
          });
          emailError = 'メール送信設定が完了していません（Gmail認証情報が設定されていません）';
        } else {
          // バックアップメールアドレスにも送信（リトライ機能付き）
          await sendPublicPageConfirmationEmailWithBackup(
            email,
            loginUrl,
            email,
            loginPassword,
            publicPageUrl,
            {
              tenantId: claimRequest.tenant,
              backupEmail: 'emolink.guide@gmail.com'
            }
          );
          emailSent = true;
          console.log('✅ Public page confirmation email sent successfully to:', email, '(with backup)');
        }
      } catch (emailErrorObj: any) {
        console.error('❌ Error sending public page confirmation email:', emailErrorObj);
        emailError = emailErrorObj.message || 'メール送信に失敗しました（詳細不明）';
        // メール送信に失敗しても、URLの設定は成功とする（DB書き込みは既に完了）
      }
    } else {
      console.warn('⚠️ Email or password not provided, skipping email send:', {
        email: !!email,
        password: !!loginPassword
      });
      emailError = !email ? 'メールアドレスが取得できませんでした' : 'パスワードが取得できませんでした';
    }

    // DB書き込みは成功しているため、メール送信の結果に関わらず成功レスポンスを返す
    console.log('Returning response:', {
      ok: true,
      publicPageId,
      publicPageUrl,
      loginUrl,
      emailSent,
      emailError
    });
    
    return NextResponse.json({
      ok: true,
      publicPageId,
      publicPageUrl,
      loginUrl,
      emailSent,
      ...(emailError && { emailError })
    });
  } catch (error: any) {
    console.error('Error in set-urls API:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getClaimRequestById } from '@/lib/firestore';
import { sendPublicPageConfirmationEmail } from '@/lib/email-service';

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

    // claimRequestを更新
    const claimRequestRef = doc(db, 'claimRequests', requestId);
    await updateDoc(claimRequestRef, {
      publicPageId: publicPageId,
      publicPageUrl: publicPageUrl,
      loginUrl: loginUrl,
      updatedAt: serverTimestamp(),
      ...(claimedByUid && { claimedByUid: claimedByUid }),
    });

    // メール送信
    const email = loginEmail || claimRequest.email;
    if (email && loginPassword) {
      try {
        await sendPublicPageConfirmationEmail(
          email,
          loginUrl,
          email,
          loginPassword,
          publicPageUrl,
          {
            tenantId: claimRequest.tenant
          }
        );
        console.log('Public page confirmation email sent successfully to:', email);
      } catch (emailError: any) {
        console.error('Error sending public page confirmation email:', emailError);
        // メール送信に失敗しても、URLの設定は成功とする
        return NextResponse.json({
          ok: true,
          publicPageId,
          publicPageUrl,
          loginUrl,
          emailSent: false,
          emailError: emailError.message
        });
      }
    } else {
      console.warn('Email or password not provided, skipping email send:', {
        email: !!email,
        password: !!loginPassword
      });
    }

    return NextResponse.json({
      ok: true,
      publicPageId,
      publicPageUrl,
      loginUrl,
      emailSent: !!(email && loginPassword)
    });
  } catch (error: any) {
    console.error('Error in set-urls API:', error);
    return NextResponse.json(
      { ok: false, error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}


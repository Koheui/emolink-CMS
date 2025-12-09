'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, XCircle, Radio, AlertCircle, RefreshCcw, Link as LinkIcon } from 'lucide-react';
import { writeNFCUrl } from '@/lib/nfc/writer';
import { updateOrderNFCStatus } from '@/lib/firestore-crm';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

export default function NFCWritePage() {
  return (
    <Suspense fallback={<LoadingCard />}>
      <NFCWriteContent />
    </Suspense>
  );
}

function NFCWriteContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { staff } = useSecretKeyAuth();

  const url = searchParams?.get('url') || '';
  const orderId = searchParams?.get('orderId') || '';

  const [status, setStatus] = useState<'idle' | 'writing' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const safeUrl = useMemo(() => {
    try {
      return decodeURIComponent(url);
    } catch {
      return url;
    }
  }, [url]);

  const canWrite = typeof window !== 'undefined' && 'NDEFWriter' in window;
  const isHTTPS = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');

  useEffect(() => {
    if (!url) {
      setErrorMessage('書き込み用URLが指定されていません。QRを再度読み込んでください。');
    }
  }, [url]);

  const handleWrite = async () => {
    if (!safeUrl) return;

    setStatus('writing');
    setErrorMessage(null);

    try {
      await writeNFCUrl({
        url: safeUrl,
        onSuccess: async () => {
          // ステータス更新（注文IDとスタッフがある場合）
          if (orderId && staff?.uid) {
            try {
              await updateOrderNFCStatus(orderId, staff.uid);
            } catch (err) {
              console.error('Failed to update order NFC status:', err);
            }
          }
          setStatus('success');
        },
        onError: (err) => {
          setStatus('error');
          setErrorMessage(err.message);
        }
      });
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || '書き込みに失敗しました');
    }
  };

  const handleReset = () => {
    setStatus('idle');
    setErrorMessage(null);
  };

  const showUnsupported = !canWrite || !isHTTPS;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            NFCタグ書き込み
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!safeUrl ? (
            <div className="flex items-start gap-2 text-red-600 text-sm">
              <XCircle className="h-4 w-4 mt-0.5" />
              <div>
                書き込み用URLが取得できませんでした。QRコードを再度読み込んでください。
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-lg bg-gray-100 text-sm break-all flex items-start gap-2">
              <LinkIcon className="h-4 w-4 text-gray-500 mt-0.5" />
              <div>
                <div className="text-gray-600">書き込み先URL</div>
                <div className="text-gray-900">{safeUrl}</div>
              </div>
            </div>
          )}

          {showUnsupported && (
            <div className="flex items-start gap-2 text-red-600 text-sm">
              <AlertCircle className="h-4 w-4 mt-0.5" />
              <div>
                このデバイス/環境はNFC書き込みに対応していません。Android端末のChrome（HTTPS接続）でお試しください。
              </div>
            </div>
          )}

          <Button
            onClick={handleWrite}
            disabled={!safeUrl || status === 'writing' || showUnsupported}
            className="w-full"
          >
            {status === 'writing' ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                書き込み中...
              </>
            ) : (
              <>
                <Radio className="h-4 w-4 mr-2" />
                このURLを書き込む
              </>
            )}
          </Button>

          {status === 'success' && (
            <div className="p-3 rounded-lg bg-green-50 text-green-800 text-sm flex items-start gap-2">
              <CheckCircle className="h-4 w-4 mt-0.5" />
              <div>
                書き込みが完了しました。次のタグを書き込む場合は「続けて書く」を押してください。
              </div>
            </div>
          )}

          {status === 'error' && errorMessage && (
            <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm flex items-start gap-2">
              <XCircle className="h-4 w-4 mt-0.5" />
              <div>{errorMessage}</div>
            </div>
          )}

          <div className="flex items-center gap-2 justify-between">
            <Button variant="outline" onClick={() => router.push('/crm/orders')} className="flex-1">
              CRMに戻る
            </Button>
            <Button variant="secondary" onClick={handleReset} className="flex-1">
              <RefreshCcw className="h-4 w-4 mr-2" />
              続けて書く
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function LoadingCard() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            NFCタグ書き込み
          </CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </CardContent>
      </Card>
    </div>
  );
}


'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, Radio, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { writeNFCUrl } from '@/lib/nfc/writer';

interface NFCWriterButtonProps {
  url: string;
  orderId?: string;
  onSuccess?: () => void;
  className?: string;
  disabled?: boolean;
}

export function NFCWriterButton({ url, orderId, onSuccess, className, disabled }: NFCWriterButtonProps) {
  const [isWriting, setIsWriting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const handleWrite = async () => {
    setIsWriting(true);
    setStatus('idle');
    setErrorMessage(null);
    
    try {
      await writeNFCUrl({
        url,
        onSuccess: async () => {
          setStatus('success');
          setIsWriting(false);
          
          // 書き込み履歴を記録
          if (orderId) {
            const { useSecretKeyAuth } = await import('@/contexts/secret-key-auth-context');
            const { updateOrderNFCStatus } = await import('@/lib/firestore-crm');
            // スタッフのUIDを取得する必要があるが、コンポーネント内では取得できないため、
            // 親コンポーネントから渡すか、別の方法で取得する必要がある
            // ここでは、親コンポーネントからoperatorUidを渡すようにする
          }
          
          // 成功アナウンス
          if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance('書き込みが成功しました！');
            utterance.lang = 'ja-JP';
            window.speechSynthesis.speak(utterance);
          }
          
          onSuccess?.();
          
          // 3秒後にステータスをリセット
          setTimeout(() => {
            setStatus('idle');
          }, 3000);
        },
        onError: (error) => {
          setStatus('error');
          setErrorMessage(error.message);
          setIsWriting(false);
        }
      });
    } catch (error: any) {
      setStatus('error');
      setErrorMessage(error.message || 'NFC書き込みに失敗しました。');
      setIsWriting(false);
    }
  };
  
  // NFC APIのサポートチェック
  const isNFCSupported = typeof window !== 'undefined' && 'NDEFWriter' in window;
  const isHTTPS = typeof window !== 'undefined' && (window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  
  if (!isNFCSupported) {
    return (
      <div className={className}>
        <Button disabled className="w-full" variant="outline">
          <AlertCircle className="h-4 w-4 mr-2" />
          NFC非対応ブラウザ
        </Button>
        <p className="text-xs text-gray-500 mt-1">Chrome 89以降が必要です</p>
      </div>
    );
  }
  
  if (!isHTTPS) {
    return (
      <div className={className}>
        <Button disabled className="w-full" variant="outline">
          <AlertCircle className="h-4 w-4 mr-2" />
          HTTPS環境が必要
        </Button>
        <p className="text-xs text-gray-500 mt-1">HTTPS環境でアクセスしてください</p>
      </div>
    );
  }
  
  return (
    <div className={className}>
      <Button
        onClick={handleWrite}
        disabled={isWriting || disabled || status === 'success'}
        className="w-full"
        variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'default'}
      >
        {isWriting ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            書き込み中...
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle className="h-4 w-4 mr-2" />
            書き込み成功
          </>
        ) : status === 'error' ? (
          <>
            <XCircle className="h-4 w-4 mr-2" />
            書き込み失敗
          </>
        ) : (
          <>
            <Radio className="h-4 w-4 mr-2" />
            NFCタグに書き込む
          </>
        )}
      </Button>
      {errorMessage && (
        <p className="text-xs text-red-500 mt-1">{errorMessage}</p>
      )}
      {status === 'success' && (
        <p className="text-xs text-green-600 mt-1">NFCタグへの書き込みが完了しました</p>
      )}
    </div>
  );
}


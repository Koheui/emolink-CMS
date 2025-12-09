'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { getOrderDetail, getCustomerDetail } from '@/lib/firestore-crm';
import { Order } from '@/types';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

interface PrintData {
  order: Order;
  email: string;
  name: string;
  productName: string;
  notes?: string;
  postalCode?: string;
  address?: string;
  companyName?: string;
  tenantName?: string;
}

export default function OrderPrintPage() {
  const params = useParams();
  const orderId = params.id as string;
  const { staff } = useSecretKeyAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [printData, setPrintData] = useState<PrintData | null>(null);

  useEffect(() => {
    if (orderId) {
      fetchPrintData();
    }
  }, [orderId]);

  useEffect(() => {
    if (printData) {
      // 印刷ダイアログを表示
      window.print();
    }
  }, [printData]);

  const fetchPrintData = async () => {
    try {
      setLoading(true);
      const orderData = await getOrderDetail(orderId);
      if (!orderData) {
        setError('注文が見つかりませんでした');
        return;
      }

      // テナント情報を取得
      let targetTenantId = orderData.tenant;
      let tenantData: any = null;
      let companyData: any = null;

      // lpIdがある場合は、lpIdから店舗名を取得
      if (orderData.lpId) {
        const { collection, query, where, getDocs } = await import('firebase/firestore');
        const tenantsRef = collection(db, 'tenants');
        const tenantsQuery = query(tenantsRef, where('allowedLpIds', 'array-contains', orderData.lpId));
        const tenantsSnapshot = await getDocs(tenantsQuery);
        
        if (!tenantsSnapshot.empty) {
          const tenantDoc = tenantsSnapshot.docs[0];
          tenantData = tenantDoc.data();
          targetTenantId = tenantDoc.id;
        }
      }

      // テナント情報を取得（まだ取得していない場合）
      if (!tenantData) {
        const tenantRef = doc(db, 'tenants', targetTenantId);
        const tenantSnap = await getDoc(tenantRef);
        if (tenantSnap.exists()) {
          tenantData = tenantSnap.data();
        }
      }

      // 企業情報を取得
      if (tenantData?.companyId) {
        const companyRef = doc(db, 'companies', tenantData.companyId);
        const companySnap = await getDoc(companyRef);
        if (companySnap.exists()) {
          companyData = companySnap.data();
        }
      }

      // 顧客情報を取得（claimRequestからcustomerInfoを取得するため）
      let customerName = orderData.customerInfo?.name || orderData.shippingAddress?.name || '-';
      if (orderData.email) {
        try {
          const usersRef = collection(db, 'users');
          const userQuery = query(usersRef, where('email', '==', orderData.email));
          const userSnapshot = await getDocs(userQuery);
          
          if (!userSnapshot.empty) {
            const userDoc = userSnapshot.docs[0];
            const detail = await getCustomerDetail(userDoc.id);
            if (detail?.claimRequest?.customerInfo?.name) {
              customerName = detail.claimRequest.customerInfo.name;
            }
          }
        } catch (err) {
          console.error('Error fetching customer detail for print:', err);
        }
      }

      // 印刷データを構築
      const data: PrintData = {
        order: orderData,
        email: orderData.email || '-',
        name: customerName,
        productName: orderData.product || orderData.productType || '-',
        notes: orderData.shippingAddress?.address2 || undefined,
        postalCode: '', // 企業のcontactにはpostalCodeフィールドがないため空文字
        address: companyData?.contact?.address || '',
        companyName: companyData?.name || '-',
        tenantName: tenantData?.name || '-',
      };

      setPrintData(data);
    } catch (err: any) {
      console.error('Error fetching print data:', err);
      setError('印刷データの取得に失敗しました');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !printData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'データが見つかりませんでした'}</p>
          <button onClick={() => window.close()} className="px-4 py-2 bg-gray-200 rounded">
            閉じる
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          @page {
            size: A4;
            margin: 20mm;
          }
          body {
            margin: 0;
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
        @media screen {
          body {
            background: #f3f4f6;
            padding: 20px;
          }
          .print-container {
            max-width: 210mm;
            margin: 0 auto;
            background: white;
            padding: 20mm;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
        }
        .print-container {
          font-family: 'Hiragino Sans', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif;
          font-size: 12pt;
          line-height: 1.6;
          color: #000;
        }
        .print-header {
          border-bottom: 2px solid #000;
          padding-bottom: 10px;
          margin-bottom: 20px;
        }
        .print-title {
          font-size: 18pt;
          font-weight: bold;
          margin-bottom: 5px;
        }
        .print-section {
          margin-bottom: 20px;
        }
        .print-label {
          font-weight: bold;
          display: inline-block;
          min-width: 100px;
          margin-right: 10px;
        }
        .print-value {
          display: inline-block;
        }
        .print-row {
          margin-bottom: 12px;
        }
        .print-divider {
          border-top: 1px solid #ccc;
          margin: 20px 0;
          padding-top: 20px;
        }
      `}</style>
      
      <div className="no-print" style={{ padding: '20px', textAlign: 'center' }}>
        <button
          onClick={() => window.print()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
            marginRight: '10px',
          }}
        >
          印刷
        </button>
        <button
          onClick={() => window.close()}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6b7280',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '16px',
          }}
        >
          閉じる
        </button>
      </div>

      <div className="print-container">
        <div className="print-header">
          <div className="print-title">注文情報</div>
          <div style={{ fontSize: '10pt', color: '#666' }}>
            注文ID: {printData.order.id}
          </div>
        </div>

        <div className="print-section">
          <div className="print-row">
            <span className="print-label">メールアドレス:</span>
            <span className="print-value">{printData.email}</span>
          </div>
          <div className="print-row">
            <span className="print-label">お名前:</span>
            <span className="print-value">{printData.name}</span>
          </div>
          <div className="print-row">
            <span className="print-label">商品名:</span>
            <span className="print-value">{printData.productName}</span>
          </div>
          {printData.notes && (
            <div className="print-row">
              <span className="print-label">備考:</span>
              <span className="print-value">{printData.notes}</span>
            </div>
          )}
        </div>

        <div className="print-divider"></div>

        <div className="print-section">
          <div style={{ fontSize: '14pt', fontWeight: 'bold', marginBottom: '15px' }}>
            送り先
          </div>
          <div className="print-row">
            <span className="print-label">郵便番号:</span>
            <span className="print-value">〒{printData.postalCode}</span>
          </div>
          <div className="print-row">
            <span className="print-label">住所:</span>
            <span className="print-value">{printData.address}</span>
          </div>
          <div className="print-row">
            <span className="print-label">企業名:</span>
            <span className="print-value">{printData.companyName}</span>
          </div>
          <div className="print-row">
            <span className="print-label">販売店名:</span>
            <span className="print-value">{printData.tenantName}</span>
          </div>
        </div>
      </div>
    </>
  );
}


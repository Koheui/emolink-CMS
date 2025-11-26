'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { createShippingInfo, updateShippingInfo } from '@/lib/firestore';
import { Order, ShippingInfo } from '@/types';
import { useSecretKeyAuth } from '@/contexts/secret-key-auth-context';

interface ShippingAddressFormProps {
  order: Order;
  shippingInfo?: ShippingInfo | null;
  onAddressUpdated: (shippingInfo: ShippingInfo) => void;
}

export default function ShippingAddressForm({ order, shippingInfo, onAddressUpdated }: ShippingAddressFormProps) {
  const { currentUser } = useSecretKeyAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    postalCode: order.shippingAddress?.postalCode || '',
    prefecture: order.shippingAddress?.prefecture || '',
    city: order.shippingAddress?.city || '',
    address1: order.shippingAddress?.address1 || '',
    address2: order.shippingAddress?.address2 || '',
    name: order.shippingAddress?.name || '',
    phone: order.shippingAddress?.phone || '',
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.postalCode.trim()) {
      setError('郵便番号を入力してください。');
      return false;
    }
    if (!formData.prefecture.trim()) {
      setError('都道府県を入力してください。');
      return false;
    }
    if (!formData.city.trim()) {
      setError('市区町村を入力してください。');
      return false;
    }
    if (!formData.address1.trim()) {
      setError('住所1を入力してください。');
      return false;
    }
    if (!formData.name.trim()) {
      setError('お名前を入力してください。');
      return false;
    }
    if (!formData.phone.trim()) {
      setError('電話番号を入力してください。');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    try {
      // 1. 注文の住所情報を更新（v3.3仕様により、クライアント側からの更新は不要）
      // 注文ステータスの更新はNFC Writerアプリで行われます
      // await updateOrder(order.id, {
      //   shippingAddress: {
      //     postalCode: formData.postalCode,
      //     prefecture: formData.prefecture,
      //     city: formData.city,
      //     address1: formData.address1,
      //     address2: formData.address2,
      //     name: formData.name,
      //     phone: formData.phone,
      //   }
      // });

      // 2. 配送情報を更新または作成
      if (shippingInfo) {
        await updateShippingInfo(shippingInfo.id, {
          status: 'pending',
          notes: '住所情報が更新されました。'
        });
      } else {
        const shippingInfoId = await createShippingInfo({
          orderId: order.id,
          status: 'pending',
          notes: '住所情報が設定されました。'
        });
        
        const newShippingInfo: ShippingInfo = {
          id: shippingInfoId,
          orderId: order.id,
          status: 'pending',
          notes: '住所情報が設定されました。',
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        onAddressUpdated(newShippingInfo);
      }

      setSuccess('住所情報が更新されました。');
    } catch (error) {
      console.error('Address update error:', error);
      setError('住所情報の更新中にエラーが発生しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const prefectures = [
    '北海道', '青森県', '岩手県', '宮城県', '秋田県', '山形県', '福島県',
    '茨城県', '栃木県', '群馬県', '埼玉県', '千葉県', '東京都', '神奈川県',
    '新潟県', '富山県', '石川県', '福井県', '山梨県', '長野県', '岐阜県',
    '静岡県', '愛知県', '三重県', '滋賀県', '京都府', '大阪府', '兵庫県',
    '奈良県', '和歌山県', '鳥取県', '島根県', '岡山県', '広島県', '山口県',
    '徳島県', '香川県', '愛媛県', '高知県', '福岡県', '佐賀県', '長崎県',
    '熊本県', '大分県', '宮崎県', '鹿児島県', '沖縄県'
  ];

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle>配送先住所</CardTitle>
        <CardDescription>
          アクリルスタンドの配送先住所を入力してください。
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* 郵便番号 */}
        <div className="space-y-2">
          <Label htmlFor="postalCode">郵便番号 *</Label>
          <Input
            id="postalCode"
            type="text"
            value={formData.postalCode}
            onChange={(e) => handleInputChange('postalCode', e.target.value)}
            placeholder="123-4567"
            className="w-full"
          />
        </div>

        {/* 都道府県 */}
        <div className="space-y-2">
          <Label htmlFor="prefecture">都道府県 *</Label>
          <select
            id="prefecture"
            value={formData.prefecture}
            onChange={(e) => handleInputChange('prefecture', e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md"
          >
            <option value="">選択してください</option>
            {prefectures.map(pref => (
              <option key={pref} value={pref}>{pref}</option>
            ))}
          </select>
        </div>

        {/* 市区町村 */}
        <div className="space-y-2">
          <Label htmlFor="city">市区町村 *</Label>
          <Input
            id="city"
            type="text"
            value={formData.city}
            onChange={(e) => handleInputChange('city', e.target.value)}
            placeholder="渋谷区"
            className="w-full"
          />
        </div>

        {/* 住所1 */}
        <div className="space-y-2">
          <Label htmlFor="address1">住所1 *</Label>
          <Input
            id="address1"
            type="text"
            value={formData.address1}
            onChange={(e) => handleInputChange('address1', e.target.value)}
            placeholder="1-2-3"
            className="w-full"
          />
        </div>

        {/* 住所2 */}
        <div className="space-y-2">
          <Label htmlFor="address2">住所2（任意）</Label>
          <Input
            id="address2"
            type="text"
            value={formData.address2}
            onChange={(e) => handleInputChange('address2', e.target.value)}
            placeholder="テストマンション101"
            className="w-full"
          />
        </div>

        {/* お名前 */}
        <div className="space-y-2">
          <Label htmlFor="name">お名前 *</Label>
          <Input
            id="name"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange('name', e.target.value)}
            placeholder="田中太郎"
            className="w-full"
          />
        </div>

        {/* 電話番号 */}
        <div className="space-y-2">
          <Label htmlFor="phone">電話番号 *</Label>
          <Input
            id="phone"
            type="tel"
            value={formData.phone}
            onChange={(e) => handleInputChange('phone', e.target.value)}
            placeholder="090-1234-5678"
            className="w-full"
          />
        </div>

        {/* エラー・成功メッセージ */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-600 text-sm">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="p-3 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-600 text-sm">{success}</p>
          </div>
        )}

        {/* 保存ボタン */}
        <Button
          onClick={handleSubmit}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? '保存中...' : '住所情報を保存'}
        </Button>
      </CardContent>
    </Card>
  );
}

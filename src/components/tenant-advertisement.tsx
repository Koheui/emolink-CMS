'use client';

import React, { useEffect, useState } from 'react';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { getCurrentTenant } from '@/lib/security/tenant-validation';
import { fetchOGP } from '@/lib/ogp-service';
import { Loader2 } from 'lucide-react';

interface TenantAdvertisementProps {
  tenantId?: string; // テナントID（指定がない場合は現在のテナントを使用）
  className?: string; // 追加のCSSクラス
}

interface BannerData {
  imageUrl?: string; // バナー画像URL（tenants.settings.branding.bannerImageUrl）
  linkUrl?: string; // バナーリンクURL（tenants.settings.branding.bannerLinkUrl）
  ogpImage?: string; // OGPから取得した画像URL
  ogpTitle?: string; // OGPから取得したタイトル
}

/**
 * テナントIDに紐付いた広告バナーを表示するコンポーネント
 * LP側の設計に合わせて、tenantsコレクションのsettings.brandingから取得
 */
export function TenantAdvertisement({
  tenantId,
  className = '',
}: TenantAdvertisementProps) {
  const [banner, setBanner] = useState<BannerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingOGP, setLoadingOGP] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchBanner = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // テナントIDが指定されていない場合は現在のテナントを使用
        let targetTenantId = tenantId || getCurrentTenant();
        
        console.log('TenantAdvertisement: Initial tenant ID:', {
          tenantId,
          getCurrentTenant: getCurrentTenant(),
          targetTenantId,
        });
        
        if (!targetTenantId || targetTenantId === 'unknown') {
          console.warn('Tenant ID not available, skipping banner fetch');
          setBanner(null);
          setLoading(false);
          return;
        }
        
        // まず、targetTenantIdをtenantIdとして直接取得を試みる
        let tenantRef = doc(db, 'tenants', targetTenantId);
        let tenantDoc = await getDoc(tenantRef);
        const originalTargetTenantId = targetTenantId;
        
        // tenantIdとして存在しない場合、companyIdとして検索
        if (!tenantDoc.exists()) {
          console.log(`TenantAdvertisement: "${targetTenantId}" not found as tenantId, searching as companyId...`);
          const tenantsQuery = query(
            collection(db, 'tenants'),
            where('companyId', '==', targetTenantId),
            where('status', '==', 'active'),
            limit(1)
          );
          const tenantsSnapshot = await getDocs(tenantsQuery);
          
          if (!tenantsSnapshot.empty) {
            const firstTenant = tenantsSnapshot.docs[0];
            targetTenantId = firstTenant.id;
            console.log(`TenantAdvertisement: Found tenantId "${targetTenantId}" for companyId "${originalTargetTenantId}"`);
            tenantRef = doc(db, 'tenants', targetTenantId);
            tenantDoc = await getDoc(tenantRef);
          } else {
            console.warn(`TenantAdvertisement: No tenant found for companyId "${originalTargetTenantId}"`);
            setBanner(null);
            setLoading(false);
            return;
          }
        }
        
        console.log('TenantAdvertisement: Final tenant ID:', targetTenantId);
        
        if (!tenantDoc.exists()) {
          console.warn(`Tenant ${targetTenantId} not found in Firestore.`);
          setBanner(null);
          setLoading(false);
          return;
        }
        
        const tenantData = tenantDoc.data();
        const bannerImageUrl = tenantData?.settings?.branding?.bannerImageUrl?.trim() || '';
        const bannerLinkUrl = tenantData?.settings?.branding?.bannerLinkUrl?.trim() || '';
        
        console.log('Banner data from tenant:', {
          tenantId: targetTenantId,
          bannerImageUrl,
          bannerLinkUrl,
          hasBannerImageUrl: !!bannerImageUrl,
          hasBannerLinkUrl: !!bannerLinkUrl,
        });
        
        // 画像URLがある場合はそのまま使用
        if (bannerImageUrl && bannerImageUrl.length > 0) {
          console.log('Using banner image URL:', bannerImageUrl);
          setBanner({
            imageUrl: bannerImageUrl,
            linkUrl: bannerLinkUrl,
          });
          setLoading(false);
        } else if (bannerLinkUrl && bannerLinkUrl.length > 0) {
          // 画像がない場合、linkUrlからOGPを取得
          console.log('=== OGP Fetch Start ===');
          console.log('No banner image URL, fetching OGP for URL:', bannerLinkUrl);
          setLoadingOGP(true);
          setLoading(false); // メインのローディングは終了、OGP取得中はloadingOGPを使用
          try {
            console.log('Calling fetchOGP...');
            const ogp = await fetchOGP(bannerLinkUrl);
            console.log('=== OGP Fetch Complete ===');
            console.log('OGP fetch result:', ogp);
            if (ogp?.image) {
              console.log('OGP image found:', ogp.image);
              setBanner({
                imageUrl: '',
                linkUrl: bannerLinkUrl,
                ogpImage: ogp.image,
                ogpTitle: ogp.title || '',
              });
            } else {
              // OGP画像が取得できなくても、リンクURLがあれば表示（画像なし）
              console.log('OGP image not found, showing link text');
              console.log('OGP data:', ogp);
              setBanner({
                imageUrl: '',
                linkUrl: bannerLinkUrl,
                ogpTitle: ogp?.title || '',
              });
            }
          } catch (err) {
            console.error('=== OGP Fetch Error ===');
            console.error('Error fetching OGP:', err);
            // OGP取得に失敗しても、リンクURLがあれば表示（画像なし）
            console.log('OGP fetch failed, showing link text');
            setBanner({
              imageUrl: '',
              linkUrl: bannerLinkUrl,
            });
          } finally {
            setLoadingOGP(false);
          }
        } else {
          // 画像もリンクもない場合は非表示
          console.log('No banner image or link URL found');
          setBanner(null);
          setLoading(false);
        }
      } catch (err: any) {
        // テナントが見つからない場合は警告のみ（エラーとして扱わない）
        if (err?.code === 'permission-denied' || err?.message?.includes('not found')) {
          console.warn('Tenant not found or access denied:', err);
        } else {
          console.error('Error fetching banner:', err);
        }
        setError(null); // エラーを表示しない（静かに失敗）
        setBanner(null);
      } finally {
        setLoading(false);
      }
    };

    fetchBanner();
  }, [tenantId]);

  // ローディング中はローディング表示
  if (loading || loadingOGP) {
    return (
      <div className={`tenant-advertisement ${className}`}>
        <div className="mt-6 mb-4 flex justify-center">
          <div className="flex items-center gap-2 text-white/50 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>バナーを読み込み中...</span>
          </div>
        </div>
      </div>
    );
  }

  // エラーまたはバナーがない場合は非表示
  if (error || !banner) {
    console.log('Banner not displayed:', { error, banner });
    return null;
  }

  // 表示する画像URLを決定（imageUrl > ogpImage）
  const imageUrl = banner.imageUrl || banner.ogpImage;
  const title = banner.ogpTitle || '店舗広告バナー';

  // デバッグログを削除（必要に応じて開発環境のみ出力）
  // if (process.env.NODE_ENV === 'development') {
  //   console.log('Banner display state:', {
  //     imageUrl,
  //     linkUrl: banner.linkUrl,
  //     title,
  //   });
  // }

  // 画像もリンクURLもない場合は表示しない
  if (!imageUrl && !banner.linkUrl) {
    console.log('No image or link URL, not displaying banner');
    return null;
  }

  return (
    <div className={`tenant-advertisement ${className}`}>
      <div className="mt-8 mb-12 flex justify-center">
        {banner.linkUrl ? (
          <a
            href={banner.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block transition-opacity hover:opacity-80"
            onClick={(e) => {
              // クリックイベントをログに記録（必要に応じて）
              console.log('Banner clicked:', banner.linkUrl);
            }}
          >
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={title}
                className="max-w-full h-auto rounded-lg"
                style={{ maxHeight: '80px', width: 'auto' }}
                loading="lazy"
                onError={(e) => {
                  // 画像の読み込みに失敗した場合、非表示にする
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              // 画像がない場合はリンクテキストを表示
              <div className="px-4 py-2 bg-[#2a2a2a] border border-white/20 rounded-lg text-white text-sm hover:bg-[#3a3a3a] transition">
                {title || banner.linkUrl}
              </div>
            )}
          </a>
        ) : imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            className="max-w-full h-auto rounded-lg"
            style={{ maxHeight: '80px', width: 'auto' }}
            loading="lazy"
            onError={(e) => {
              // 画像の読み込みに失敗した場合、非表示にする
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : null}
      </div>
    </div>
  );
}


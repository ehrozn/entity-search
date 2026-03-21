import React, { useEffect, useRef } from 'react';

interface AdBannerProps {
  slot: string;
  format?: 'auto' | 'fluid' | 'rectangle';
  responsive?: boolean;
  className?: string;
}

export const AdBanner: React.FC<AdBannerProps> = ({ 
  slot, 
  format = 'auto', 
  responsive = true,
  className = ''
}) => {
  const adsenseClientId = import.meta.env.VITE_ADSENSE_CLIENT_ID || "ca-pub-7207480086274037";
  const defaultSlot = slot === import.meta.env.VITE_ADSENSE_SLOT_SIDEBAR ? "1234567890" : "0987654321";
  const adSlot = slot || defaultSlot;
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Ensure the element exists and hasn't been processed yet
    if (adRef.current && !adRef.current.getAttribute('data-adsbygoogle-status')) {
      try {
        // @ts-ignore
        (window.adsbygoogle = window.adsbygoogle || []).push({});
      } catch (e) {
        // Ignore the specific error about all elements having ads, as it's common in SPAs
        if (e instanceof Error && e.message.includes('already have ads')) {
          return;
        }
        console.error('AdSense error:', e);
      }
    }
  }, [adSlot]);

  return (
    <div className={`overflow-hidden ${className}`}>
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block' }}
        data-ad-client={adsenseClientId}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive={responsive ? 'true' : 'false'}
      />
    </div>
  );
};

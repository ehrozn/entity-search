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
  let adsenseClientId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  
  // Robustness: Add ca- prefix if user provided only the pub- part
  if (adsenseClientId && !adsenseClientId.startsWith('ca-')) {
    adsenseClientId = adsenseClientId.startsWith('pub-') 
      ? `ca-${adsenseClientId}` 
      : `ca-pub-${adsenseClientId}`;
  }

  const adSlot = slot || import.meta.env.VITE_ADSENSE_SLOT_DEFAULT;
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    if (!adsenseClientId) return;
    
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
      {!adsenseClientId ? (
        <div className="bg-slate-50 border border-dashed border-slate-200 rounded-lg p-4 flex items-center justify-center text-slate-400 text-xs text-center">
          Ad Space<br/>(Configure VITE_ADSENSE_CLIENT_ID)
        </div>
      ) : (
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block' }}
          data-ad-client={adsenseClientId}
          data-ad-slot={adSlot}
          data-ad-format={format}
          data-full-width-responsive={responsive ? 'true' : 'false'}
        />
      )}
    </div>
  );
};

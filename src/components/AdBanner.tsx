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
  // Use the environment variable, but fallback to the user's ID if it's not set
  const envId = import.meta.env.VITE_ADSENSE_CLIENT_ID;
  console.log('DEBUG: envId =', JSON.stringify(envId));
  
  let adsenseClientId = 'ca-pub-7207480086274037'; // Default to user's ID
  
  if (envId && typeof envId === 'string' && envId.trim() !== '' && envId !== 'undefined') {
    adsenseClientId = envId;
  }
  
  console.log('DEBUG: final adsenseClientId =', adsenseClientId);

  // Robustness: Add ca- prefix if user provided only the pub- part
  if (adsenseClientId && !adsenseClientId.startsWith('ca-')) {
    adsenseClientId = adsenseClientId.startsWith('pub-') 
      ? `ca-${adsenseClientId}` 
      : `ca-pub-${adsenseClientId}`;
  }

  // Fallback for the slot ID as well
  const envSlot = import.meta.env.VITE_ADSENSE_SLOT_DEFAULT;
  const adSlot = slot || (envSlot && envSlot.trim() !== '' && envSlot !== 'undefined' ? envSlot : '5935814652');
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
          Ad Space<br/>(VERSION: 3 - FORCED ID)
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

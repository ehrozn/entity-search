import React, { useState, useEffect } from 'react';

export const CookieConsent: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem('cookie_consent');
    if (!consent) {
      setIsVisible(true);
    }
  }, []);

  const accept = () => {
    localStorage.setItem('cookie_consent', 'true');
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div className="fixed bottom-6 left-6 right-6 md:left-auto md:right-6 md:w-96 bg-white border border-slate-200 shadow-2xl rounded-3xl p-6 z-[100] animate-in slide-in-from-bottom-10 duration-500">
      <h3 className="text-lg font-bold mb-2">We value your privacy</h3>
      <p className="text-sm text-slate-500 mb-6 leading-relaxed">
        We use cookies to enhance your browsing experience, serve personalized ads, and analyze our traffic. By clicking "Accept", you consent to our use of cookies.
      </p>
      <div className="flex gap-3">
        <button 
          onClick={accept}
          className="flex-1 py-2.5 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-all text-sm"
        >
          Accept
        </button>
        <button 
          onClick={() => setIsVisible(false)}
          className="flex-1 py-2.5 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 transition-all text-sm"
        >
          Decline
        </button>
      </div>
    </div>
  );
};

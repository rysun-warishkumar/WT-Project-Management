import React, { useEffect, useState } from 'react';

const STORAGE_KEY = 'cms_mobile_notice_dismissed';

const MobileDeviceNotice = () => {
  const [shouldShow, setShouldShow] = useState(false);

  useEffect(() => {
    const dismissed = localStorage.getItem(STORAGE_KEY) === 'true';

    const checkIsMobile = () => {
      if (dismissed) {
        setShouldShow(false);
        return;
      }

      // Basic mobile / small-screen detection
      const isSmallScreen = window.matchMedia('(max-width: 768px)').matches;
      const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

      setShouldShow(isSmallScreen && isTouchDevice);
    };

    checkIsMobile();

    window.addEventListener('resize', checkIsMobile);
    return () => window.removeEventListener('resize', checkIsMobile);
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setShouldShow(false);
  };

  if (!shouldShow) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">
          Best viewed on desktop
        </h2>
        <p className="text-sm text-gray-700 mb-4">
          This version of <strong>W | Technology CMS</strong> is primarily optimised for
          larger screens. For the best experience with client, project and workspace
          management, please open this site on a desktop or laptop, or enable
          <strong> &quot;Desktop site&quot;</strong> / <strong>&quot;Request desktop site&quot;</strong> in your mobile browser.
        </p>
        <p className="text-xs text-gray-500 mb-4">
          You can continue on mobile, but some layouts and complex screens may not appear
          perfectly on smaller displays.
        </p>
        <div className="flex justify-end space-x-2">
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex justify-center rounded-md border border-transparent bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  );
};

export default MobileDeviceNotice;


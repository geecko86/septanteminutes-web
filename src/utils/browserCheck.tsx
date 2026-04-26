import { useEffect } from 'react';

/**
 * React hook that checks the browser version on mount and alerts + redirects
 * the user to the app store if their browser is too old to run the site.
 *
 * All navigator access happens inside useEffect so this is safe during
 * static export (where navigator is undefined on the server).
 */
const useBrowserCheck = (): null => {
  useEffect(() => {
    // Parse the browser identity and version directly from the UA string,
    // so we never touch navigator at module scope (which would break static export).
    const ua = navigator.userAgent;

    // Detect browser family via UA patterns (order matters: Edge/Opera ship a
    // Chrome token too, so check them before the generic Chrome check).
    const isChromium = /Chrome\/(\d+)/.test(ua) && !/Edg|OPR|Opera/.test(ua);
    const isFirefox  = /Firefox\/(\d+)/.test(ua);
    // Safari ships without "Chrome" in the UA; Chromium-based browsers do not.
    const isSafari   = /Safari\/(\d+)/.test(ua) && !/Chrome\//.test(ua);

    // Extract the version number for whichever browser matched.
    let version = 0;
    if (isChromium) {
      const m = ua.match(/Chrome\/(\d+)/);
      if (m) version = parseInt(m[1], 10);
    } else if (isFirefox) {
      const m = ua.match(/Firefox\/(\d+)/);
      if (m) version = parseInt(m[1], 10);
    } else if (isSafari) {
      // Safari's own version sits after "Version/", not after "Safari/".
      const m = ua.match(/Version\/(\d+)/);
      if (m) version = parseInt(m[1], 10);
    }

    const isAndroid = /Android/.test(ua);
    const isIOS     = /iPhone|iPad|iPod/.test(ua);

    const minVersions: Record<string, number> = {
      Chromium: 120,
      Firefox: 121,
      Safari: 16,
    };

    const isUnsupportedChromium = isChromium && version < minVersions.Chromium;
    const isUnsupportedFirefox  = isFirefox  && version < minVersions.Firefox;
    const isUnsupportedSafari   = isSafari   && version < minVersions.Safari;

    const redirectToStore = () => {
      if (isAndroid) {
        if (isChromium) {
          window.location.href = 'https://play.google.com/store/apps/details?id=com.android.chrome';
        } else if (isFirefox) {
          window.location.href = 'https://play.google.com/store/apps/details?id=org.mozilla.firefox';
        }
      } else if (isIOS) {
        if (isChromium) {
          window.location.href = 'https://apps.apple.com/us/app/google-chrome/id535886823';
        } else if (isFirefox) {
          window.location.href = 'https://apps.apple.com/us/app/firefox-private-safe-browser/id989804926';
        } else if (isSafari) {
          // Safari updates are handled through iOS updates, so no direct link.
        }
      }
    };

    if (isUnsupportedChromium || isUnsupportedFirefox || isUnsupportedSafari) {
      alert('Votre navigateur est obsolète. Veuillez le mettre à jour.');
      redirectToStore();
    }
  }, []);

  return null;
};

export default useBrowserCheck;

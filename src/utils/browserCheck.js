import { useEffect } from 'react';
import { isChromium, isFirefox, isSafari, browserVersion, isAndroid, isIOS } from 'react-device-detect';

const BrowserCheck = () => {
  useEffect(() => {
    const minVersions = {
      Chromium: 120,
      Firefox: 121,
      Safari: 16,
    };

    const version = parseInt(browserVersion, 10);

    const isChromiumBrowser = isChromium && version < minVersions.Chromium;
    const isUnsupportedFirefox = isFirefox && version < minVersions.Firefox;
    const isUnsupportedSafari = isSafari && version < minVersions.Safari;

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

    if (isChromiumBrowser || isUnsupportedFirefox || isUnsupportedSafari) {
      alert('Votre navigateur est obsolète. Veuillez le mettre à jour.');
      redirectToStore();
    }
  }, []);

  return null;
};

export default BrowserCheck;
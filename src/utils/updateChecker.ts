import { useEffect, useState } from 'react';
import { BUILD_ID, isValidBuildId } from './buildId';

const UPDATE_ATTEMPT_KEY = 'septante:last-build-update-attempt';
const LEGACY_CACHE_RETIREMENT_KEY = 'septante:legacy-cache-retired-v1';

async function retireLegacyClientCache(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    if (window.localStorage.getItem(LEGACY_CACHE_RETIREMENT_KEY) === 'done') return;
  } catch {
    // Storage can be unavailable in privacy modes; cache retirement can still run.
  }

  try {
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(registration => registration.unregister()));
    }
  } catch {
    // A versioned build-ID request below still bypasses the legacy precache.
  }

  try {
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map(cacheName => window.caches.delete(cacheName)));
    }
  } catch {
    // Cache Storage is optional and may be blocked by the browser.
  }

  try {
    window.localStorage.setItem(LEGACY_CACHE_RETIREMENT_KEY, 'done');
  } catch {
    // A failed marker only means the harmless cleanup may run again.
  }
}

export async function getDeployedBuildId(): Promise<string | null> {
  try {
    await retireLegacyClientCache();
    const response = await fetch(`/api/buildId.txt?compiled=${encodeURIComponent(BUILD_ID)}`, {
      cache: 'no-store',
      headers: {
        Pragma: 'no-cache',
        Expires: '-1',
        'Cache-Control': 'no-cache',
      },
    });
    if (!response.ok) return null;

    const contentType = response.headers.get('content-type') || '';
    if (contentType && !contentType.toLowerCase().startsWith('text/plain')) return null;

    const buildId = (await response.text()).trim();
    return isValidBuildId(buildId) ? buildId : null;
  } catch {
    return null;
  }
}

const useUpdateChecker = (callback: (buildId: string) => void) => {

  const [updateAvailableChecked, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      if (updateAvailableChecked) return;
      setUpdateAvailable(true);

      const buildId = await getDeployedBuildId();
      
      console.log("buildId", buildId);
      console.log("compiled buildId", BUILD_ID);
      if (buildId && buildId !== BUILD_ID) {
        // Never redirect to the same reported build more than once per tab.
        // This is the safety net for browsers that still return a stale
        // service-worker response despite the versioned request above.
        let alreadyAttempted = false;
        try {
          alreadyAttempted = window.sessionStorage.getItem(UPDATE_ATTEMPT_KEY) === buildId;
          if (!alreadyAttempted) window.sessionStorage.setItem(UPDATE_ATTEMPT_KEY, buildId);
        } catch {
          // Session Storage can be unavailable; the versioned request remains sufficient.
        }
        if (!alreadyAttempted) callback(buildId);
      } else if (buildId === BUILD_ID) {
        try {
          window.sessionStorage.removeItem(UPDATE_ATTEMPT_KEY);
        } catch {
          // Nothing to clean up when Session Storage is unavailable.
        }
      }
    };

    checkForUpdates();
  }, [callback, updateAvailableChecked]);
};

export default useUpdateChecker;

import { useEffect, useState } from 'react';
import { BUILD_ID, isValidBuildId } from './buildId';

export async function getDeployedBuildId(): Promise<string | null> {
  try {
    const response = await fetch('/api/buildId.txt', {
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

const useUpdateChecker = (callback: () => void) => {

  const [updateAvailableChecked, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      if (updateAvailableChecked) return;
      setUpdateAvailable(true);

      const buildId = await getDeployedBuildId();
      
      console.log("buildId", buildId);
      console.log("compiled buildId", BUILD_ID);
      if (buildId && buildId !== BUILD_ID) {
        // There's a new version deployed that we need to load
        callback();
      }
    };

    checkForUpdates();
  }, [callback, updateAvailableChecked]);
};

export default useUpdateChecker;

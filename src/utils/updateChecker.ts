import { useEffect, useState } from 'react';

const useUpdateChecker = (callback: () => void) => {

  const [updateAvailableChecked, setUpdateAvailable] = useState(false);

  useEffect(() => {
    const checkForUpdates = async () => {
      if (updateAvailableChecked) return;
      setUpdateAvailable(true);

      const response = await fetch('/api/buildId.txt', {
        headers: {
            Pragma: 'no-cache',
            Expires: '-1',
            'Cache-Control': 'no-cache',
        },
      });
      const buildId = await response.text();
      
      console.log("buildId", buildId);
      console.log("process.env.BUILD_ID", process.env.BUILD_ID);
      if (buildId && process.env.BUILD_ID && buildId !== process.env.BUILD_ID) {
        // There's a new version deployed that we need to load
        callback();
      }
    };

    checkForUpdates();
  }, [callback, updateAvailableChecked]);
};

export default useUpdateChecker;
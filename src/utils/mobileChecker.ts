/**
 * Client-side check for old or low-powered mobile devices.
 * Must only be called inside a useEffect or event handler — never at module
 * scope, since navigator is undefined during static export on the server.
 */

function isAndroidVersionBelow10(userAgent: string | undefined): boolean {
    const androidVersion = userAgent?.match(/Android\s(\d+)/);
    if (androidVersion) {
        const versionNumber = parseInt(androidVersion[1]);
        return versionNumber < 10;
    }
    return false;
}

function isLowRamDevice(): boolean {
    // navigator.deviceMemory is not in the standard TS lib yet, so we cast.
    const ram = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    return !!ram && ram <= 4;
}

export default function isOldPhone(): boolean {
    // Inline UA check — avoids a module-scope navigator read (which would fail
    // during static export where navigator is undefined on the server).
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return isIOS || isAndroidVersionBelow10(navigator.userAgent) || isLowRamDevice();
}

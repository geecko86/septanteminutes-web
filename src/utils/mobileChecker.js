import { isIOS, isMobile } from "react-device-detect";

function isAndroidVersionBelow10(userAgent) {
    const androidVersion = userAgent?.match(/Android\s(\d+)/);
    if (androidVersion) {
        const versionNumber = parseInt(androidVersion[1]);
        return versionNumber < 10;
    }
    return false;
}

function isLowRamDevice() {
    const ram = navigator.deviceMemory;
    return !!ram && ram <= 4;
}

export default function isOldPhone() {
    return isIOS || isAndroidVersionBelow10(navigator.userAgent) || isLowRamDevice();
}
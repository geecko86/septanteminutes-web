const lockOrientation = () => {
    const lockFunction = window.screen.orientation.lock || screen.lockOrientation || screen.mozLockOrientation || screen.msLockOrientation;

    if (lockFunction) {
        lockFunction('portrait').then(() => {
            console.log('Orientation locked successfully');
        }).catch((e) => {
            return;
        });
    } else {
        console.warn("no orientation lock function");
    }
}

// Call the lockOrientation function when the page loads
window.addEventListener('load', lockOrientation);
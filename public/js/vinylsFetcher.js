onmessage = function (event) {
    const { buildId } = event.data || {};
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(buildId || '')) {
        postMessage([]);
        return;
    }

    fetch(`/js/data.json?buildId=${encodeURIComponent(buildId)}`, {
        headers: {
            Pragma: 'no-cache',
            Priority: 'u=1, i',
            Expires: '-1',
            'Cache-Control': 'no-cache',
        },
    })
        .then(response => {
            if (!response.ok) throw new Error('Network response was not ok');
            return response.json();
        })
        .then(data => {
            const vinyls = Array.from(
                { length: Object.keys(data.episodes).length },
                (_, k) => data.episodes[(k + 1).toString()]
            );
            postMessage(vinyls);
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            postMessage([]);
        });
}

onmessage = function (event) {
    const { buildId, cachedSeasons = '[]' } = event.data || {};
    const localSeasons = typeof cachedSeasons === 'string' ? JSON.parse(cachedSeasons) : cachedSeasons;

    if (localSeasons && localSeasons.length > 3) {
        postMessage(localSeasons);
    }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(buildId || '')) {
        if (!localSeasons?.length) postMessage([]);
        return;
    }

    fetch(`/js/data.json?buildId=${encodeURIComponent(buildId)}`, {
        headers: {
            Pragma: 'no-cache',
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
            const seasons = [...new Set(vinyls.map(v => v.season))].map(season => ({
                name: season,
                episodes: vinyls.filter(ep => ep.season === season)
            }));
            postMessage([...seasons].reverse());
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            if (!localSeasons?.length) postMessage([]);
        });
}

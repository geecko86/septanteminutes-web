onmessage = function (event) {
    const { buildId, cachedSeasons = '[]' } = event.data || {};
    let localSeasons = [];
    try {
        const parsed = typeof cachedSeasons === 'string' ? JSON.parse(cachedSeasons) : cachedSeasons;
        if (Array.isArray(parsed)) localSeasons = parsed;
    } catch {
        // Ignore corrupt legacy cache entries; the versioned network request
        // below replaces them without asking the user to clear site data.
    }

    if (localSeasons.length > 3) {
        postMessage({ source: 'cache', seasons: localSeasons });
    }
    if (!/^[A-Za-z0-9_-]{8,64}$/.test(buildId || '')) {
        return;
    }

    fetch(`/js/data.json?buildId=${encodeURIComponent(buildId)}`, {
        cache: 'no-store',
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
            postMessage({ source: 'network', seasons: [...seasons].reverse() });
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
        });
}

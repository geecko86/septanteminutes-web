onmessage = function (_) {
    fetch('/api/buildId.txt', {
        headers: {
            Pragma: 'no-cache',
            Expires: '-1',
            'Cache-Control': 'no-cache',
        },
    }).then(response => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.text();
    }).then(buildId => {
        // const timestamp = getTimestamp();
        fetch(`/js/data.json?buildId=${buildId}`, {
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
                // const data = e.data.default;
                const vinyls = Array.from(
                    { length: Object.keys(data.episodes).length },
                    (v, k) => data.episodes[(k + 1).toString()]
                );
                const seasons = [...new Set(vinyls.map(v => v.season))].map(season => ({
                    name: season,
                    episodes: vinyls.filter(ep => ep.season === season)
                }));
                postMessage([...seasons].reverse());
            })
            .catch(error => {
                console.error('There was a problem with the fetch operation:', error);
                postMessage([]);
            });
    });
}

// function getTimestamp() {
//     const now = new Date();
//     const diff = now - new Date(now.getFullYear(), 0, 0);
//     const day = Math.floor(diff / (1000 * 60 * 60 * 24));
//     return `${day}_${now.getHours()}_${Math.ceil(now.getMinutes() / 5)}`;
// }
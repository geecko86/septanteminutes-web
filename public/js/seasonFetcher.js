onmessage = function(e) {
    if (e.data) {
        const data = e.data.default;
        const vinyls = Array.from(
            { length: Object.keys(data.episodes).length },
            (v, k) => data.episodes[(k + 1).toString()]
        );
        const seasons = [...new Set(vinyls.map(v => v.season))].map(season => ({
            name: season,
            episodes: vinyls.filter(ep => ep.season === season)
        }));
        postMessage([...seasons].reverse());
    }
}
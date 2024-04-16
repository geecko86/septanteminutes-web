onmessage = function(_) {
    fetch('/js/data.json')
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
            postMessage(vinyls);
        })
        .catch(error => {
            console.error('There was a problem with the fetch operation:', error);
            postMessage([]);
        });
}
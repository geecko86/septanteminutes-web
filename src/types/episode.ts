export type Episode = {
    title: string,
    img: string,
    spotifyLink: string,
    mp3: string,
    season: string,
    appleLink: string,
    desc: string,
    descText?: string,
    num: string,
    date: string,
    /* Set by the getEpisodesFromRSS Cloud Function only for episodes that have a
       real (16:9) video version on YouTube — absent or "" for most episodes. */
    youtubeLink?: string
};

export type Season = {
    name: string,
    episodes: Episode[]
};
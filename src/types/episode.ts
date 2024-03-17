export type Episode = {
    title: string,
    img: string,
    spotifyLink: string,
    mp3: string,
    season: string,
    appleLink: string,
    desc: string,
    num: string
};

export type Season = {
    name: string,
    episodes: Episode[]
};
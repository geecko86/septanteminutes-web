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
    date: string
};

export type Season = {
    name: string,
    episodes: Episode[]
};
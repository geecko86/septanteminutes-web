import React from 'react';

import EpisodePage from "@/pages/[episodeNum]";
import normalizeString from "@/utils/normalizeStr";
import { stripHtmlTags } from "@/utils/stripHtml";
import { getGuestName } from "@/utils/episodeTitle";

import type {
    GetStaticProps,
    GetStaticPaths,
} from 'next';

import { Episode } from "@/types/episode";

export default function GuestPage(props: any) {
    return (
        <EpisodePage {...props} />
    );
};

export const getStaticPaths = (async () => {
    const count = Number(process.env.EPISODES_COUNT);
    const paths = Array.from(Array(count).keys()).map(async (i) => {
        const mod = await import("@/../public/js/data.json");
        const episode: Episode = (mod.episodes as Record<string, Episode>)[`${i + 1}`];
        const guestName = normalizeString(getGuestName(episode.title));
                
        return {
            params: {
                episodeName: `${episode.num}-${guestName}`,
            }
        }
    });

    return {
        paths: await Promise.all(paths),
        fallback: false // anything not included will 404
    }
}) satisfies GetStaticPaths

export const getStaticProps = (async (context) => {
    const { episodeName } = context.params as { episodeName: string };
    const episodeNum = episodeName.split("-")[0];
    const mod = await import("@/../public/js/data.json");
    const episode: Episode = (mod.episodes as Record<string, Episode>)[`${episodeNum}`];

    episode.descText = stripHtmlTags(episode.desc) || "";
    episode.descText = episode.descText?.split(/(\nRéférence|\n0)/i)[0].slice(0, 198) + "…";

    return { props: { episode, episodeNum } }
}) satisfies GetStaticProps<{
}>;
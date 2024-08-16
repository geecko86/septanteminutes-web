import React from 'react';

import EpisodePage from "@/pages/[episodeNum]";
import normalizeString from "@/utils/normalizeStr";

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

type key = "1" | "2"; // Etc.

export const getStaticPaths = (async () => {
    const count = Number(process.env.EPISODES_COUNT);
    const paths = Array.from(Array(count).keys()).map(async (i) => {
        const mod = await import("@/../public/js/data.json");
        const episode: Episode = mod.episodes[`${i + 1}` as key];
        const guestName = normalizeString(episode.title?.split(/\s(-|–)\s?/g)[0]?.trim());
                
        return {
            params: {
                episodeName: `${episode.num}-${guestName}`,
                guestPage: "index"
            }
        }
    });

    return {
        paths: await Promise.all(paths),
        fallback: false // anything not included will 404
    }
}) satisfies GetStaticPaths

export const getStaticProps = (async (context) => {
    function stripHtmlTags(html: string): string {
        return html.replace(/<\/?[^>]+(>|$)/g, "").replace(/\n/g, " ");
    }

    const { episodeName } = (context.params as any);
    const episodeNum = episodeName.split("-")[0];
    const mod = await import("@/../public/js/data.json");
    const episode: Episode = mod.episodes[`${episodeNum}` as key];

    episode.descText = stripHtmlTags(episode.desc) || "";
    episode.descText = episode.descText?.split(/(\nRéférence|\n0)/i)[0].slice(0, 198) + "…";

    return { props: { episode } }
}) satisfies GetStaticProps<{
}>;
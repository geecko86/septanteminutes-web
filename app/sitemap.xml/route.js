// app/sitemap.xml/route.js

import normalizeString from '../../src/utils/normalizeStr';
import { getGuestName } from '../../src/utils/episodeTitle';

const EXTERNAL_DATA_URL = 'https://www.septanteminutes.be';

const generateSiteMap = (episodes) => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
    <?xml-stylesheet type="text/xsl" href="/sitemap.xsl"?>
    <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
        <url>
          <loc>${EXTERNAL_DATA_URL}</loc>
        </url>
        <url>
          <loc>${EXTERNAL_DATA_URL}/faq</loc>
        </url>${episodes.map(({ num, title }) => `
        <url>
          <loc>${EXTERNAL_DATA_URL}/podcast/interview/${num}-${normalizeString(getGuestName(title))}</loc>
        </url>`).join('')}
    </urlset>`;
  return xml;
}


export async function GET() {
  const data = await import("../../public/js/data.json");
  const episodes = Object.keys(data.episodes)
    .filter(key => /^\d+$/.test(key))
    .map((i) => (data.episodes[i]));

  const sitemapXml = generateSiteMap(episodes);

  return new Response(sitemapXml, {
    status: 200,
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}

// Ensure the route is statically generated
export const dynamic = "force-static";
export const dynamicParams = false;
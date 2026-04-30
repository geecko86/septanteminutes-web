// src/app/rss.xml/route.js

import normalizeString from '../../utils/normalizeStr';
import { getGuestName } from '../../utils/episodeTitle';
import { withBuildId } from '../../utils/buildId';

const EXTERNAL_DATA_URL = 'https://www.septanteminutes.be';

function escapeXml(unsafe) {
  return unsafe.replace(/[<>&'"]/g, function (c) {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '"': return '&quot;';
      case "'": return '&apos;';
    }
  });
}

export async function GET() {
  // Read the JSON file
  const data = await import("../../../public/js/data.json");
  const episodes = Object.keys(data.episodes)
    .filter(key => /^\d+$/.test(key))
    .map((i) => (data.episodes[i]))
    .toReversed();

  // Construct the RSS feed XML
  const rssFeedXml = `<?xml version="1.0" encoding="UTF-8"?><?xml-stylesheet type="text/xsl" href="/rss.xslt"?><rss xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:media="https://search.yahoo.com/mrss/" xmlns:content="http://purl.org/rss/1.0/modules/content/" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:googleplay="http://www.google.com/schemas/play-podcasts/1.0" xmlns:spotify="http://www.spotify.com/ns/rss" xmlns:podcast="https://podcastindex.org/namespace/1.0" xmlns:audmns="https://audmns.com/namespace/1.0" version="2.0"><channel><title>Septante Minutes Avec</title><link>![CDATA[https://www.septanteminutes.be]]</link><description>Septante Minutes Avec est un podcast belge proposant des interviews approfondies sur des sujets de société, culturels ou politiques. Les personnalités invitées peuvent être issues des sphères académiques, politiques, militantes ou simplement les porte-voix d'une cause. Pami les thématiques abordées, on retrouve la politique belge et internationale, la santé mentale, le journalisme, le féminisme, la neurodiversité, et bien plus encore.</description><language>fr</language><copyright>Ignite Ventures SRL</copyright><pubDate>${new Date().toUTCString()}</pubDate><webMaster>contact@septanteminutes.be</webMaster><image><url>/img/SMA_sleeve_768.webp</url><title><![CDATA[Septante Minutes Avec]]></title><link><![CDATA[https://www.septanteminutes.be]]></link></image>
        ${episodes.map(({ num, title, desc, date, img, mp3 }) => `<item>
            <title>${escapeXml(title)}</title>
            <link>${EXTERNAL_DATA_URL}/podcast/interview/${num}-${normalizeString(getGuestName(title))}</link>
            <description><![CDATA[\n${desc}\n]]></description>
            ${img ? `<enclosure url="${withBuildId(img.replace("/upload/", `/upload/c_scale,w_${200},f_webp,q_${70}/`))}" type="image/jpeg" />` : ''}
            ${img ? `<itunes:image href="${withBuildId(img.replace("/upload/", `/upload/c_scale,w_${200},f_webp,q_${70}/`))}"/>` : ''}
            ${num ? `<itunes:episode>${num}</itunes:episode>` : ''}
            ${mp3 ? `<enclosure url="${mp3}" type="audio/mpeg" />` : ''}
            <pubDate>${date}</pubDate>
          </item>
        `).join('')}
      </channel></rss>
  `;

  return new Response(rssFeedXml, {
    status: 200,
    headers: { 'Content-Type': 'text/xml; charset=utf-8' },
  });
}

// Ensure the route is statically generated
export const dynamic = "force-static";
export const dynamicParams = false;

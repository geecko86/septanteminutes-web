// app/feed/route.js

const EXTERNAL_DATA_URL = 'https://www.septanteminutes.be'; // Replace with your actual URL

function normalizeString(str) {
  return str
    .normalize('NFD') // Decompose accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritical marks
    .toLowerCase() // Convert to lowercase
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/[^\w\-]+/g, '') // Remove all non-word characters except hyphens
    .replace(/\-\-+/g, '-') // Replace multiple hyphens with a single hyphen
    .replace(/^-+/, '') // Trim hyphens from the start
    .replace(/-+$/, ''); // Trim hyphens from the end
}

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
  const data = await import("../../public/js/data.json");
  const episodes = Object.keys(data.episodes)
    .filter(key => /^\d+$/.test(key))
    .map((i) => (data.episodes[i]))
    .toReversed();

  // Construct the RSS feed XML
  const rssFeedXml = `<rss version="2.0">
      <?xml-stylesheet type="text/xsl" href="/rss-atom.xsl"?>
      <channel>
        <title>Septante Minutes Avec</title>
        <link>https://www.septanteminutes.be</link>
        <description>Septante Minutes Avec est un podcast belge proposant des interviews approfondies sur des sujets de société, culturels ou politiques. Les personnalités invitées peuvent être issues des sphères académiques, politiques, militantes ou simplement les porte-voix d'une cause. Pami les thématiques abordées, on retrouve la politique belge et internationale, la santé mentale, le journalisme, le féminisme, la neurodiversité, et bien plus encore.</description>
        ${episodes.map(({ num, title, desc, date, img }) => `
          <item>
            <title>${escapeXml(title)}</title>
            <link>${EXTERNAL_DATA_URL}/podcast/interview/${num}-${normalizeString(title.split(/\s(-|–)\s?/g)[0]?.trim())}</link>
            <description><![CDATA[\n${desc}\n]]></description>
            ${img ? `<enclosure url="${img}" type="image/jpeg" />` : ''}
            <pubDate>${date}</pubDate>
          </item>
        `).join('')}
      </channel>
    </rss>
  `;

  return new Response(rssFeedXml, {
    status: 200,
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}

// Ensure the route is statically generated
export const dynamic = "force-static";
export const dynamicParams = false;
// /api/yt-feed.js  (Edge-safe, no DOMParser)
export const config = { runtime: 'edge' };

// Resolve @handle -> UC... channelId (tries multiple variants)
async function resolveChannelId(handle) {
  if (!handle) throw new Error('Missing handle');
  if (handle.startsWith('UC')) return handle; // already an ID
  const h = handle.replace(/^@/, '');
  const urls = [
    `https://www.youtube.com/@${h}`,
    `https://www.youtube.com/@${h}/about`,
    `https://www.youtube.com/@${h}/videos`,
    `https://www.youtube.com/@${h}?hl=en`,
    `https://www.youtube.com/@${h}/about?hl=en`,
  ];
  const patterns = [
    /"channelId":"(UC[0-9A-Za-z_-]{22})"/,
    /"externalId":"(UC[0-9A-Za-z_-]{22})"/,
    /<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[0-9A-Za-z_-]{22})"/
  ];
  for (const url of urls) {
    const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const html = await r.text();
    for (const p of patterns) {
      const m = html.match(p);
      if (m && m[1]) return m[1];
    }
  }
  throw new Error('channelId not found');
}

// Tiny XML parser for the RSS feed (Edge-safe)
function parseFeedXML(xml) {
  const out = [];
  const entryRe = /<entry>([\s\S]*?)<\/entry>/g;
  let m;
  while ((m = entryRe.exec(xml)) !== null) {
    const b = m[1];
    const pick = (re, d = '') => (b.match(re) || [ , d ])[1];
    const id   = pick(/<yt:videoId>(.*?)<\/yt:videoId>/);
    const title= pick(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const published = pick(/<published>(.*?)<\/published>/);
    const link = pick(/<link rel="alternate" href="(.*?)"/, `https://www.youtube.com/watch?v=${id}`);
    const thumb= pick(/<media:thumbnail url="(.*?)"/, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    if (id) out.push({ id, title, published, link, thumb });
  }
  return out;
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const handle = searchParams.get('handle') || '@nkoralage9386';

    const channelId = await resolveChannelId(handle);

    const rss = await fetch(
      `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
      { headers: { 'user-agent': 'Mozilla/5.0' } }
    );
    if (!rss.ok) throw new Error('Feed fetch failed: ' + rss.status);
    const xml = await rss.text();
    const items = parseFeedXML(xml);

    return new Response(JSON.stringify({ channelId, items }), {
      headers: {
        'content-type': 'application/json',
        'cache-control': 's-maxage=3600, stale-while-revalidate=18000'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { 'content-type': 'application/json' }
    });
  }
}

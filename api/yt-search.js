import play from 'play-dl';

export default async function handler(req, res) {
  // CORS headers so the Vite dev server can reach this
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing query param: q' });

  try {
    const result = await play.search(String(q), { limit: 1 });
    const video = result[0];
    if (!video) return res.status(404).json({ error: 'No results found' });
    res.json({
      videoId: video.id,
      title: video.title,
      author: video.channel?.name || 'Unknown',
      duration: video.durationInSec,
    });
  } catch (err) {
    console.error('[yt-search]', err);
    res.status(500).json({ error: String(err) });
  }
}

import ytdl from '@distube/ytdl-core';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { videoId, title = 'audio' } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const safeTitle = String(title).replace(/[^\w\s\-]/g, '_').trim();

  try {
    const audioStream = ytdl(ytUrl, {
      filter: 'audioonly',
      quality: 'highestaudio',
    });

    res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.webm"`);
    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Transfer-Encoding', 'chunked');

    audioStream.pipe(res);

    audioStream.on('error', (err) => {
      console.error('[download stream error]', err);
      if (!res.headersSent) res.status(500).json({ error: String(err) });
    });

    req.on('close', () => audioStream.destroy());
  } catch (err) {
    console.error('[download]', err);
    if (!res.headersSent) res.status(500).json({ error: String(err) });
  }
}

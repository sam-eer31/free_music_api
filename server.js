// server.js — local proxy server (runs alongside Vite dev server)
// Uses yt-search for search and yt-dlp for audio streaming. No 3rd-party API needed.
import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import { spawn } from 'child_process';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

// GET /api/yt-search?q=song+name
// Returns the top YouTube video ID for the query
app.get('/api/yt-search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ error: 'Missing query param: q' });

  try {
    const result = await ytSearch(String(q));
    const video = result.videos[0];
    if (!video) return res.status(404).json({ error: 'No results found' });
    res.json({
      videoId: video.videoId,
      title: video.title,
      author: video.author.name,
      duration: video.duration.seconds,
    });
  } catch (err) {
    console.error('[yt-search] error:', err);
    res.status(500).json({ error: String(err) });
  }
});

// GET /api/download?videoId=xxx&title=Song+Name
// Streams the audio as MP3 directly via yt-dlp piped output
app.get('/api/download', (req, res) => {
  const { videoId, title = 'audio' } = req.query;
  if (!videoId) return res.status(400).json({ error: 'Missing videoId' });

  const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const safeTitle = String(title).replace(/[/\\?%*:|"<>]/g, '-');

  console.log(`[download] Starting: ${ytUrl}`);

  // Set headers for file download
  res.setHeader('Content-Disposition', `attachment; filename="${safeTitle}.mp3"`);
  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Transfer-Encoding', 'chunked');

  // Spawn yt-dlp: extract audio, convert to mp3, pipe to stdout
  const ytdlp = spawn('yt-dlp', [
    '--no-playlist',
    '-x',                        // extract audio
    '--audio-format', 'mp3',
    '--audio-quality', '0',      // best quality
    '--extractor-args', 'youtube:client=android,ios', // SPOOF MOBILE CLIENT TO BYPASS BLOCKS
    '-o', '-',                   // output to stdout
    '--no-part',
    '--quiet',
    ytUrl,
  ]);

  ytdlp.stdout.pipe(res);

  ytdlp.stderr.on('data', (data) => {
    console.error('[yt-dlp stderr]', data.toString().trim());
  });

  ytdlp.on('error', (err) => {
    console.error('[yt-dlp spawn error]', err);
    if (!res.headersSent) res.status(500).json({ error: 'yt-dlp failed to start' });
  });

  ytdlp.on('close', (code) => {
    console.log(`[download] yt-dlp exited with code ${code}`);
    if (code !== 0 && !res.writableEnded) res.end();
  });

  // If client disconnects, kill yt-dlp
  req.on('close', () => {
    console.log('[download] Client disconnected, killing yt-dlp');
    ytdlp.kill();
  });
});

app.listen(PORT, () => {
  console.log(`✅ SoundDrop proxy server running at http://localhost:${PORT}`);
  console.log(`   • Search: GET /api/yt-search?q=song+name`);
  console.log(`   • Download: GET /api/download?videoId=xxx&title=song+name`);
});

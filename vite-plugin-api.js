// vite-plugin-api.js
// Handles /api/ routes inside the Vite dev server so npm run dev is all you need.
// Uses yt-search for search and yt-dlp (installed on machine) for audio.

import ytSearch from 'yt-search';
import { spawn } from 'child_process';
import { parse } from 'url';

export function apiPlugin() {
  return {
    name: 'local-api-routes',

    configureServer(server) {

      // GET /api/yt-search?q=...
      server.middlewares.use('/api/yt-search', async (req, res) => {
        const { query } = parse(req.url, true);
        const q = query.q;
        if (!q) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing q' }));
        }
        try {
          const result = await ytSearch(String(q));
          const video = result.videos[0];
          if (!video) {
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'No results found' }));
          }
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            videoId: video.videoId,
            title: video.title,
            author: video.author.name,
            duration: video.duration.seconds,
          }));
        } catch (err) {
          console.error('[api/yt-search]', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // GET /api/loader-proxy?url=...
      server.middlewares.use('/api/loader-proxy', async (req, res) => {
        const { query } = parse(req.url, true);
        const urlToFetch = query.url;
        if (!urlToFetch) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing url parameter' }));
        }
        
        try {
          // Dynamic import for fetch since it's global in newer Node, but just to be safe
          const response = await fetch(String(urlToFetch));
          const data = await response.json();
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        } catch (err) {
          console.error('[api/loader-proxy]', err);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: String(err) }));
        }
      });

      // GET /api/download?videoId=...&title=...
      // Spawns yt-dlp to extract + convert audio to MP3, piped directly to response
      server.middlewares.use('/api/download', (req, res) => {
        const { query } = parse(req.url, true);
        const { videoId, title = 'audio' } = query;

        if (!videoId) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          return res.end(JSON.stringify({ error: 'Missing videoId' }));
        }

        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const safeTitle = String(title).replace(/[/\\?%*:|"<>]/g, '-');

        console.log(`[api/download] Starting: "${safeTitle}" (${videoId})`);

        res.writeHead(200, {
          'Content-Disposition': `attachment; filename="${safeTitle}.mp3"`,
          'Content-Type': 'audio/mpeg',
          'Transfer-Encoding': 'chunked',
        });

        const ytdlp = spawn('yt-dlp', [
          '--no-playlist',
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '0',
          '-o', '-',
          '--no-part',
          '--quiet',
          ytUrl,
        ]);

        ytdlp.stdout.pipe(res);

        ytdlp.stderr.on('data', (d) => {
          const msg = d.toString().trim();
          if (msg) console.error('[yt-dlp]', msg);
        });

        ytdlp.on('error', (err) => {
          console.error('[yt-dlp spawn error]', err);
          if (!res.writableEnded) res.end();
        });

        ytdlp.on('close', (code) => {
          if (code !== 0) console.warn(`[yt-dlp] exited with code ${code}`);
          if (!res.writableEnded) res.end();
        });

        req.on('close', () => ytdlp.kill('SIGTERM'));
      });
    },
  };
}

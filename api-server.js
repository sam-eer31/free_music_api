import express from 'express';
import cors from 'cors';
import ytSearch from 'yt-search';
import fs from 'fs';
import path from 'path';
import { pipeline } from 'stream/promises';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json());

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// GET /api/search?q=query
// Returns top 10 search results
app.get('/api/search', async (req, res) => {
  const q = req.query.q;
  if (!q) return res.status(400).json({ success: false, error: 'Missing query param: q' });

  try {
    const result = await ytSearch(String(q));
    const videos = result.videos.slice(0, 10).map(v => ({
      videoId: v.videoId,
      title: v.title,
      author: v.author.name,
      duration: v.duration.seconds
    }));
    
    res.json({ success: true, data: videos });
  } catch (err) {
    console.error('[search] error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// GET /api/upload?videoId=xxx
// Converts, downloads, and uploads the MP3 to tmpfiles.org
app.get('/api/upload', async (req, res) => {
  const { videoId } = req.query;
  if (!videoId) return res.status(400).json({ success: false, error: 'Missing videoId' });

  try {
    const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const loaderApiUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=mp3&url=${encodeURIComponent(ytUrl)}`;
    
    // 1. Initialize Conversion
    const initRes = await fetch(loaderApiUrl);
    if (!initRes.ok) throw new Error("Conversion API failed to respond");
    const initData = await initRes.json();

    if (!initData.progress_url) {
      throw new Error("Download servers are currently busy. Please try again.");
    }

    // 2. Poll for download URL
    let downloadUrl = '';
    for (let i = 0; i < 40; i++) {
      await sleep(2500); // Check every 2.5 seconds
      const progRes = await fetch(initData.progress_url);
      const progData = await progRes.json();
      
      if (progData.success === 1 && progData.download_url) {
        downloadUrl = progData.download_url;
        break;
      }
    }

    if (!downloadUrl) {
      throw new Error("Conversion timed out after 100 seconds");
    }

    // 3. Download MP3 to local disk
    const tmpPath = path.join(process.cwd(), `tmp_${videoId}_${Date.now()}.mp3`);
    const dlRes = await fetch(downloadUrl);
    if (!dlRes.ok) throw new Error("Failed to download MP3 from proxy");
    
    const fileStream = fs.createWriteStream(tmpPath);
    await pipeline(dlRes.body, fileStream);

    // 4. Upload to tmpfiles.org with 48h retention (172800 seconds)
    const fileBuffer = await fs.promises.readFile(tmpPath);
    const blob = new Blob([fileBuffer], { type: 'audio/mpeg' });
    
    const formData = new FormData();
    formData.append('file', blob, `audio_${videoId}.mp3`);
    formData.append('expire', '172800'); // exactly 48 hours

    const uploadRes = await fetch('https://tmpfiles.org/api/v1/upload', {
      method: 'POST',
      body: formData
    });
    
    const uploadData = await uploadRes.json();
    
    // 5. Cleanup temp file
    await fs.promises.unlink(tmpPath).catch(() => {});

    if (uploadData.status !== 'success') {
      throw new Error("Failed to upload to tmpfiles.org");
    }

    // tmpfiles returns URL like https://tmpfiles.org/12345/file.mp3
    // Direct stream URL is https://tmpfiles.org/dl/12345/file.mp3
    const publicUrl = uploadData.data.url;
    const streamUrl = publicUrl.replace('tmpfiles.org/', 'tmpfiles.org/dl/');

    res.json({
      success: true,
      data: {
        videoId,
        tmpfiles_url: publicUrl,
        stream_url: streamUrl,
        expires_in: '48 hours'
      }
    });

  } catch (err) {
    console.error('[upload] error:', err);
    res.status(500).json({ success: false, error: String(err) });
  }
});

// Health check endpoint
app.get('/', (req, res) => {
  res.json({ success: true, message: 'SoundDrop API is running' });
});

app.listen(PORT, () => {
  console.log(`✅ SoundDrop API running at http://localhost:${PORT}`);
});

// A simple Vercel serverless function to proxy requests to loader.to API.
// This bypasses CORS and DNS issues on the user's browser.
// Because it only returns tiny JSON responses (not the actual MP3), it completely bypasses Vercel's 4.5MB limits.

export default async function handler(req, res) {
  // Enable CORS for the frontend
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  try {
    // Only allow proxying to loader.to, affadaffa.com, or tmpfiles.org
    if (!url.includes('loader.to') && !url.includes('affadaffa.com') && !url.includes('tmpfiles.org')) {
       return res.status(403).json({ error: 'Forbidden domain' });
    }

    if (url.includes('tmpfiles.org')) {
      const checkRes = await fetch(url);
      const contentType = checkRes.headers.get('Content-Type') || '';
      if (contentType.includes('text/html')) {
        const html = await checkRes.text();
        const match = html.match(/href="([^"]+tmpfiles\.org\/dl\/[^"]+)"/);
        if (match && match[1]) {
          return res.status(200).json({ success: true, download_url: match[1] });
        }
      }
      return res.status(400).json({ error: 'Could not resolve tmpfiles download link' });
    }

    const response = await fetch(url);
    const data = await response.json();
    res.status(200).json(data);
  } catch (err) {
    console.error('[loader-proxy]', err);
    res.status(500).json({ error: String(err) });
  }
}

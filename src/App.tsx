import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, Download, Music, Play, Pause, Clock, Settings, X } from 'lucide-react';
import './index.css';

interface Song {
  trackId: number;
  trackName: string;
  artistName: string;
  albumName: string;
  artworkUrl: string;
  durationMs: number;
  previewUrl: string;
  genre: string;
}

type DownloadState = 'idle' | 'searching' | 'fetching' | 'done' | 'error';

// Uses loader.to API to bypass Vercel backend limits entirely.
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function findYouTubeVideoId(query: string, proxyUrl: string): Promise<{ videoId: string; duration: number }> {
  const res = await fetch(
    `${proxyUrl}/api/yt-search?q=${encodeURIComponent(query)}`,
    { signal: AbortSignal.timeout(12000) }
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `YouTube search failed (HTTP ${res.status})`);
  }
  const data = await res.json();
  if (!data.videoId) throw new Error('No video found for this song.');
  return { videoId: data.videoId, duration: data.duration ?? 0 };
}

function formatSecs(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDuration(ms: number): string {
  return formatSecs(ms / 1000);
}

function App() {
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [results, setResults] = useState<Song[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [downloadStates, setDownloadStates] = useState<Record<number, DownloadState>>({});
  const [downloadErrors, setDownloadErrors] = useState<Record<number, string>>({});
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);       // 0–1
  const [currentSecs, setCurrentSecs] = useState(0);
  const [totalSecs, setTotalSecs] = useState(0);
  
  // Settings State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [downloadEngine, setDownloadEngine] = useState<'render' | 'client'>(() => {
    return (localStorage.getItem('downloadEngine') as 'render' | 'client') || 'render';
  });
  const [renderUrl, setRenderUrl] = useState(() => {
    return localStorage.getItem('renderUrl') || 'https://your-app-name.onrender.com';
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

  // Save settings on change
  useEffect(() => {
    localStorage.setItem('downloadEngine', downloadEngine);
    localStorage.setItem('renderUrl', renderUrl);
  }, [downloadEngine, renderUrl]);

  // Determine which proxy to use based on settings
  // Localdev always uses '' so vite proxy catches it, otherwise use Render URL or Vercel ''
  const isLocalDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  const proxyUrl = isLocalDev ? '' : (downloadEngine === 'render' ? renderUrl.replace(/\/$/, '') : '');

  // Tick animation frame to update progress bar smoothly
  const tick = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const dur = audio.duration || 0;
    const cur = audio.currentTime || 0;
    setProgress(dur > 0 ? cur / dur : 0);
    setCurrentSecs(cur);
    setTotalSecs(dur);
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopTick = () => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  };

  const stopPreview = useCallback(() => {
    stopTick();
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
    setProgress(0);
    setCurrentSecs(0);
    setTotalSecs(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => () => stopPreview(), [stopPreview]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setIsLoading(true);
    setHasSearched(true);
    setResults([]);
    setDownloadStates({});
    setDownloadErrors({});
    stopPreview();

    try {
      const res = await fetch(
        `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=25`
      );
      const data = await res.json();
      const songs: Song[] = data.results.map((s: any) => ({
        trackId: s.trackId,
        trackName: s.trackName,
        artistName: s.artistName,
        albumName: s.collectionName ?? '',
        artworkUrl: s.artworkUrl100?.replace('100x100bb', '300x300bb') ?? '',
        durationMs: s.trackTimeMillis ?? 0,
        previewUrl: s.previewUrl ?? '',
        genre: s.primaryGenreName ?? '',
      }));
      setResults(songs);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const togglePreview = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!song.previewUrl) return;

    if (playingId === song.trackId) {
      stopPreview();
      return;
    }

    stopPreview();
    const audio = new Audio(song.previewUrl);
    audioRef.current = audio;

    audio.addEventListener('loadedmetadata', () => {
      setTotalSecs(audio.duration);
    });

    audio.addEventListener('ended', () => {
      stopTick();
      setPlayingId(null);
      setProgress(0);
      setCurrentSecs(0);
    });

    audio.play().then(() => {
      setPlayingId(song.trackId);
      rafRef.current = requestAnimationFrame(tick);
    }).catch(console.error);
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>, song: Song) => {
    e.stopPropagation();
    if (!audioRef.current || playingId !== song.trackId) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audioRef.current.currentTime = ratio * (audioRef.current.duration || 0);
    setProgress(ratio);
  };

  const handleDownload = async (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    const id = song.trackId;
    // Only block if currently in-flight for THIS song
    if (downloadStates[id] === 'searching' || downloadStates[id] === 'fetching') return;

    setDownloadStates(prev => ({ ...prev, [id]: 'searching' }));
    setDownloadErrors(prev => { const n = { ...prev }; delete n[id]; return n; });

    try {
      const searchQuery = `${song.trackName} ${song.artistName} official audio`;
      const { videoId } = await findYouTubeVideoId(searchQuery, proxyUrl);

      setDownloadStates(prev => ({ ...prev, [id]: 'fetching' }));

      let downloadUrl = '';

      if (downloadEngine === 'render' || isLocalDev) {
        // Render Backend / Local Dev - Stream directly!
        const title = encodeURIComponent(`${song.trackName} - ${song.artistName}`);
        downloadUrl = `${proxyUrl}/api/download?videoId=${videoId}&title=${title}&t=${Date.now()}`;
      } else {
        // Client-side fallback (Vercel Backend bypass)
        const ytUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const loaderApiUrl = `https://loader.to/ajax/download.php?button=1&start=1&end=1&format=mp3&url=${encodeURIComponent(ytUrl)}`;
        
        const initRes = await fetch(`${proxyUrl}/api/loader-proxy?url=${encodeURIComponent(loaderApiUrl)}`);
        const initData = await initRes.json();

        if (!initData.progress_url) {
          throw new Error("Download servers are currently busy. Please try again.");
        }

        // Poll progress URL every 2 seconds until conversion finishes (max 60s)
        for (let i = 0; i < 30; i++) {
          await sleep(2000);
          const progRes = await fetch(`${proxyUrl}/api/loader-proxy?url=${encodeURIComponent(initData.progress_url)}`);
          const progData = await progRes.json();
          
          if (progData.success === 1 && progData.download_url) {
            downloadUrl = progData.download_url;
            break;
          }
        }
      }

      if (!downloadUrl) {
        throw new Error("All download servers are busy. Please try again.");
      }

      // We have the direct download URL! Trigger it using a hidden iframe.
      // Since this happens asynchronously after polling, using a.click() triggers the browser's pop-up blocker.
      // An iframe seamlessly initiates the download without a warning.
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      // Clean up iframe after the download has had time to initiate
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 60000);

      setDownloadStates(prev => ({ ...prev, [id]: 'done' }));
      setTimeout(() => setDownloadStates(prev => ({ ...prev, [id]: 'idle' })), 2500);
    } catch (err: any) {
      setDownloadErrors(prev => ({ ...prev, [id]: err.message }));
      setDownloadStates(prev => ({ ...prev, [id]: 'error' }));
      setTimeout(() => setDownloadStates(prev => ({ ...prev, [id]: 'idle' })), 4000);
    }
  };

  const renderDownloadBtn = (song: Song) => {
    const state = downloadStates[song.trackId] ?? 'idle';
    if (state === 'searching') return (
      <button className="dl-btn dl-btn--loading" disabled title="Finding on YouTube...">
        <Loader2 size={16} className="spin" />
        <span>Finding...</span>
      </button>
    );
    if (state === 'fetching') return (
      <button className="dl-btn dl-btn--loading" disabled title="Getting audio link...">
        <Loader2 size={16} className="spin" />
        <span>Getting link...</span>
      </button>
    );
    if (state === 'done') return (
      <button className="dl-btn dl-btn--done" disabled>
        <span>✓ Downloading!</span>
      </button>
    );
    if (state === 'error') return (
      <button className="dl-btn dl-btn--error" onClick={(e) => handleDownload(song, e)} title={downloadErrors[song.trackId]}>
        <span>✗ Retry</span>
      </button>
    );
    return (
      <button className="dl-btn" onClick={(e) => handleDownload(song, e)} title="Download full MP3">
        <Download size={16} />
        <span>Download</span>
      </button>
    );
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header" style={{ paddingTop: hasSearched ? '2rem' : '18vh', transition: 'padding 0.5s ease' }}>
        <div className="brand" style={{ position: 'relative', width: '100%', display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div className="brand-icon"><Music size={22} /></div>
            <span className="brand-name">SoundDrop</span>
          </div>
          <button 
            className="settings-toggle"
            onClick={() => setIsSettingsOpen(true)}
            style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#6366f1', cursor: 'pointer', padding: '0.5rem' }}
          >
            <Settings size={22} />
          </button>
        </div>
        <form onSubmit={handleSearch} className="search-wrapper">
          <Search className="search-icon" size={18} strokeWidth={2.5} />
          <input
            type="text"
            id="song-search-input"
            className="search-input"
            placeholder="Search songs, artists, albums..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          <button type="submit" className="search-btn">Search</button>
        </form>
        {!hasSearched && <p className="hero-sub">Search any song. Get the full MP3 — free.</p>}
      </header>

      {/* Results */}
      <main className="main-content">
        {isLoading && (
          <div className="loader-container">
            <Loader2 className="spin" size={36} />
            <span>Searching...</span>
          </div>
        )}

        {!isLoading && hasSearched && results.length === 0 && (
          <div className="no-results">
            <Music size={48} opacity={0.2} />
            <p>No results for "<strong>{query}</strong>"</p>
            <span>Try a different song name or artist.</span>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="results-list">
            <div className="results-header">
              <span className="rh-num">#</span>
              <span className="rh-title">Title</span>
              <span className="rh-album">Album</span>
              <span className="rh-genre">Genre</span>
              <span className="rh-dur"><Clock size={14} /></span>
              <span className="rh-dl"></span>
            </div>

            {results.map((song, i) => {
              const isPlaying = playingId === song.trackId;
              return (
                <div key={song.trackId} className={`song-row ${isPlaying ? 'song-row--playing' : ''}`}>
                  {/* Main row content */}
                  <div className="row-num">
                    <span className="num-index">{i + 1}</span>
                    <button
                      className="row-play-btn"
                      onClick={(e) => togglePreview(song, e)}
                      title={isPlaying ? 'Pause preview' : 'Play 30s preview'}
                      disabled={!song.previewUrl}
                    >
                      {isPlaying ? <Pause size={14} /> : <Play size={14} />}
                    </button>
                  </div>

                  <div className="row-title-col">
                    <img src={song.artworkUrl} alt="" className="row-thumb" loading="lazy" />
                    <div className="row-title-info">
                      <span className="row-track-name">{song.trackName}</span>
                      <span className="row-artist-name">{song.artistName}</span>
                    </div>
                  </div>

                  <span className="row-album" title={song.albumName}>{song.albumName}</span>
                  <span className="row-genre">{song.genre}</span>
                  <span className="row-dur">{song.durationMs ? formatDuration(song.durationMs) : '--:--'}</span>
                  <div className="row-dl">{renderDownloadBtn(song)}</div>

                  {/* Progress bar — only visible when this row is playing */}
                  {isPlaying && (
                    <div className="preview-bar">
                      <span className="preview-time">{formatSecs(currentSecs)}</span>
                      <div
                        className="preview-track"
                        onClick={(e) => handleSeek(e, song)}
                        title="Click to seek"
                      >
                        <div
                          className="preview-fill"
                          style={{ width: `${progress * 100}%` }}
                        />
                        <div
                          className="preview-thumb"
                          style={{ left: `${progress * 100}%` }}
                        />
                      </div>
                      <span className="preview-time">{formatSecs(totalSecs)}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setIsSettingsOpen(false)}>
              <X size={20} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', color: '#1e1b4b', fontSize: '1.25rem' }}>Settings</h2>
            
            <div className="setting-group">
              <label style={{ display: 'block', fontWeight: 600, marginBottom: '0.5rem', color: '#312e81' }}>Download Engine</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="engine" 
                    value="render" 
                    checked={downloadEngine === 'render'} 
                    onChange={() => setDownloadEngine('render')}
                  />
                  <div>
                    <strong>Render Backend (Fast)</strong>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>Instant real-time downloads via yt-dlp.</div>
                  </div>
                </label>
                
                {downloadEngine === 'render' && (
                  <div style={{ paddingLeft: '1.5rem', marginTop: '-0.25rem' }}>
                    <input 
                      type="url" 
                      value={renderUrl} 
                      onChange={e => setRenderUrl(e.target.value)}
                      placeholder="https://your-app.onrender.com"
                      style={{ width: '100%', padding: '0.5rem', borderRadius: '4px', border: '1px solid #c7d2fe', fontSize: '0.85rem' }}
                    />
                    <div style={{ fontSize: '0.75rem', color: '#6366f1', marginTop: '0.3rem' }}>Paste your deployed Render Web Service URL here.</div>
                  </div>
                )}

                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', marginTop: '0.5rem' }}>
                  <input 
                    type="radio" 
                    name="engine" 
                    value="client" 
                    checked={downloadEngine === 'client'} 
                    onChange={() => setDownloadEngine('client')}
                  />
                  <div>
                    <strong>Client-Side Polling (Slow)</strong>
                    <div style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: '0.1rem' }}>Uses loader.to API. Bypasses Vercel limits. Takes 10-30s.</div>
                  </div>
                </label>
              </div>
            </div>

            <div style={{ marginTop: '2rem', textAlign: 'right' }}>
              <button 
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: '#6366f1', color: 'white', padding: '0.5rem 1.5rem', borderRadius: '99px', border: 'none', cursor: 'pointer', fontWeight: 600 }}
              >
                Save & Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

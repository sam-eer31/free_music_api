import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Search, Loader2, Download, Music, Play, Pause, Clock } from 'lucide-react';
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

// /api/ routes are handled by the Vite plugin in dev and Vercel functions in production.
// Always relative — no server URL needed.
const PROXY = '';

async function findYouTubeVideoId(query: string): Promise<{ videoId: string; duration: number }> {
  const res = await fetch(
    `${PROXY}/api/yt-search?q=${encodeURIComponent(query)}`,
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);

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
      const { videoId } = await findYouTubeVideoId(searchQuery);

      setDownloadStates(prev => ({ ...prev, [id]: 'fetching' }));

      // Build URL with unique timestamp to prevent ANY browser caching
      const title = encodeURIComponent(`${song.trackName} - ${song.artistName}`);
      const downloadUrl = `${PROXY}/api/download?videoId=${videoId}&title=${title}&t=${Date.now()}`;

      // Use a hidden iframe — the most reliable way to trigger streaming downloads
      // without navigating away, and works for repeated calls unlike a.click()
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.src = downloadUrl;
      document.body.appendChild(iframe);
      // Clean up iframe after the download has had time to initiate
      setTimeout(() => document.body.removeChild(iframe), 60000);

      setDownloadStates(prev => ({ ...prev, [id]: 'done' }));
      // Reset quickly so user can download again immediately
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
        <div className="brand">
          <div className="brand-icon"><Music size={22} /></div>
          <span className="brand-name">SoundDrop</span>
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
    </div>
  );
}

export default App;

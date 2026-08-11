"use client";

import Link from "next/link";

export default function ApiDocs() {
  return (
    <>
      <main className="container" style={{ padding: "var(--space-3xl) var(--space-xl)", maxWidth: "800px" }}>
        
        <div style={{ textAlign: "center", marginBottom: "var(--space-2xl)", animation: "fadeIn 600ms ease" }}>
          <div className="hero__icon" style={{ width: "70px", height: "70px", marginBottom: "var(--space-md)" }}>
            <img src="/logo.svg" alt="TuneBox Logo" style={{ width: "32px", height: "32px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }} />
          </div>
          <h1 className="hero__title" style={{ fontSize: "var(--font-size-3xl)" }}>
            TuneBox <span className="hero__title-accent">Developer API</span>
          </h1>
          <p className="hero__subtitle" style={{ fontSize: "var(--font-size-base)" }}>
            Integrate our high-quality music search and download capabilities into your own applications.
          </p>
        </div>

        <div className="song-card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "var(--space-xl)", display: "block" }}>
          <h2 style={{ fontSize: "var(--font-size-xl)", marginBottom: "var(--space-md)", color: "var(--charcoal)" }}>
            1. Search API
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
            Search for songs by title, artist, or album. This endpoint returns a list of results along with a direct <code>downloadUrl</code> for each song.
          </p>
          
          <div style={{ background: "rgba(0,0,0,0.05)", padding: "16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)", width: "100%", overflowX: "auto" }}>
            <code style={{ color: "var(--deep-rose)", fontWeight: "600" }}>GET /api/v1/search?q=&#123;query&#125;</code>
          </div>

          <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "var(--font-size-sm)", color: "var(--charcoal)" }}>Example Response:</p>
          <pre style={{ background: "rgba(255,255,255,0.5)", padding: "16px", borderRadius: "var(--radius-md)", width: "100%", fontSize: "13px", overflowX: "auto", color: "var(--text-secondary)", border: "var(--glass-border)" }}>
{`{
  "success": true,
  "query": "arijit singh",
  "count": 1,
  "results": [
    {
      "title": "Tum Hi Ho",
      "artist": "Arijit Singh",
      "album": "Aashiqui 2",
      "slug": "tum-hi-ho",
      "downloadUrl": "https://yourdomain.com/api/v1/download?slug=tum-hi-ho"
    }
  ]
}`}
          </pre>
        </div>

        <div className="song-card" style={{ flexDirection: "column", alignItems: "flex-start", marginBottom: "var(--space-xl)", display: "block" }}>
          <h2 style={{ fontSize: "var(--font-size-xl)", marginBottom: "var(--space-md)", color: "var(--charcoal)" }}>
            2. Download API
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "var(--space-md)" }}>
            Downloads the requested song in 320kbps MP3 format and temporarily hosts it on <strong>tmpfiles.org</strong> for 48 hours. You will receive a direct URL to access the file.
          </p>
          
          <div style={{ background: "rgba(0,0,0,0.05)", padding: "16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)", width: "100%", overflowX: "auto" }}>
            <code style={{ color: "var(--deep-rose)", fontWeight: "600" }}>GET /api/v1/download?slug=&#123;song-slug&#125;</code>
          </div>
          
          <div style={{ background: "rgba(231, 76, 60, 0.1)", border: "1px solid rgba(231, 76, 60, 0.3)", padding: "12px 16px", borderRadius: "var(--radius-md)", marginBottom: "var(--space-md)" }}>
            <p style={{ margin: 0, fontSize: "var(--font-size-sm)", color: "var(--danger)", fontWeight: "500" }}>
              <strong>Note:</strong> This request may take several seconds to complete, as the file is being downloaded and uploaded synchronously. The resulting link is valid for <strong>48 hours</strong>.
            </p>
          </div>

          <p style={{ fontWeight: "600", marginBottom: "8px", fontSize: "var(--font-size-sm)", color: "var(--charcoal)" }}>Example Response:</p>
          <pre style={{ background: "rgba(255,255,255,0.5)", padding: "16px", borderRadius: "var(--radius-md)", width: "100%", fontSize: "13px", overflowX: "auto", color: "var(--text-secondary)", border: "var(--glass-border)" }}>
{`{
  "success": true,
  "message": "Song downloaded and uploaded to tmpfiles.org successfully",
  "expires_in": "48 hours",
  "downloadUrl": "https://tmpfiles.org/dl/12345/tum-hi-ho.mp3"
}`}
          </pre>
        </div>

        <div style={{ textAlign: "center", marginTop: "var(--space-2xl)" }}>
          <Link href="/" className="search-btn" style={{ width: "auto", padding: "0 24px", borderRadius: "var(--radius-pill)", display: "inline-flex", textDecoration: "none", fontWeight: "600" }}>
            Back to Home
          </Link>
        </div>

      </main>
    </>
  );
}

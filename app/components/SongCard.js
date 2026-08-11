"use client";

import { useState } from "react";

export default function SongCard({ song, index }) {
  const [downloading, setDownloading] = useState(false);
  const [downloaded, setDownloaded] = useState(false);

  const handleDownload = async () => {
    if (downloading) return;
    setDownloading(true);

    try {
      // Step 1: Fetch the song page to get the download ID
      const songRes = await fetch(`/api/song/${song.slug}`);
      if (!songRes.ok) {
        throw new Error("Failed to fetch song details");
      }

      const songData = await songRes.json();

      if (!songData.downloadId) {
        throw new Error("Download link not found");
      }

      // Step 2: Trigger the download via our proxy and wait for it
      const downloadUrl = `/api/download/${songData.downloadId}`;
      const response = await fetch(downloadUrl);
      if (!response.ok) {
        let errorMsg = "Download failed";
        try {
          const errorData = await response.json();
          if (errorData.error) errorMsg = errorData.error;
        } catch (e) {
          // Not JSON
        }
        throw new Error(errorMsg);
      }
      
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      // Create a temporary link to trigger browser download
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = `${song.songName || "song"}.mp3`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);

      setDownloaded(true);
      setTimeout(() => setDownloaded(false), 3000);
    } catch (err) {
      console.error("Download error:", err);
      alert("Failed to download. Please try again.");
    } finally {
      setDownloading(false);
    }
  };

  // Staggered animation delay
  const animationDelay = `${index * 80}ms`;

  return (
    <div className="song-card" style={{ animationDelay }}>
      {/* Cover Image */}
      <div className="song-card__image-wrapper">
        {song.image ? (
          <img
            className="song-card__image"
            src={song.image}
            alt={song.songName || "Song cover"}
            loading="lazy"
            onError={(e) => {
              // Replace broken image with placeholder
              e.target.style.display = "none";
              e.target.nextElementSibling.style.display = "flex";
            }}
          />
        ) : null}
        <div
          className="song-card__image-placeholder"
          style={{ display: song.image ? "none" : "flex" }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M9 18V5l12-2v13" />
            <circle cx="6" cy="18" r="3" />
            <circle cx="18" cy="16" r="3" />
          </svg>
        </div>
      </div>

      {/* Song Info */}
      <div className="song-card__info">
        <h3 className="song-card__title">{song.songName}</h3>
        {song.artist && (
          <p className="song-card__artist">{song.artist}</p>
        )}
        <div className="song-card__meta">
          {song.album && (
            <span className="song-card__album">{song.album}</span>
          )}
          {song.category && (
            <span className="song-card__category">{song.category}</span>
          )}
        </div>
      </div>

      {/* Download Button */}
      <button
        className={`download-btn ${
          downloading ? "download-btn--loading" : ""
        } ${downloaded ? "download-btn--success" : ""}`}
        onClick={handleDownload}
        disabled={downloading}
        aria-label={`Download ${song.songName} in 320kbps`}
        title="Download 320kbps"
      >
        {downloading ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : downloaded ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

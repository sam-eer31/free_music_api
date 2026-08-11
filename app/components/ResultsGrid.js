"use client";

import SongCard from "./SongCard";

export default function ResultsGrid({ results }) {
  return (
    <div className="results-grid">
      {results.map((song, index) => (
        <SongCard
          key={`${song.slug}-${index}`}
          song={song}
          index={index}
        />
      ))}
    </div>
  );
}

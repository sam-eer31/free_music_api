"use client";

import { useState } from "react";
import SearchBar from "./SearchBar";
import ResultsGrid from "./ResultsGrid";
import EmptyState from "./EmptyState";
import Loader from "./Loader";

export default function SearchApp() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  const handleSearch = async (searchQuery) => {
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setQuery(trimmed);
    setLoading(true);
    setError(null);
    setHasSearched(true);

    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(trimmed)}`
      );

      if (!res.ok) {
        throw new Error("Search failed. Please try again.");
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err) {
      console.error("Search error:", err);
      setError(err.message || "Something went wrong. Please try again.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <SearchBar onSearch={handleSearch} loading={loading} />

      <section className="results-section">
        {loading && <Loader />}

        {!loading && error && (
          <div className="error-state">
            <div className="error-state__icon">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="15" y1="9" x2="9" y2="15" />
                <line x1="9" y1="9" x2="15" y2="15" />
              </svg>
            </div>
            <p className="error-state__text">{error}</p>
          </div>
        )}

        {!loading && !error && hasSearched && results?.length === 0 && (
          <EmptyState
            title="No songs found"
            text={`We couldn't find any songs matching "${query}". Try a different search term.`}
          />
        )}

        {!loading && !error && !hasSearched && (
          <EmptyState
            title="Discover your music"
            text="Type a song name above and hit search to find your favorite tracks."
          />
        )}

        {!loading && !error && results?.length > 0 && (
          <>
            <div className="results-header">
              <h2 className="results-title">
                Results for &ldquo;{query}&rdquo;
              </h2>
              <span className="results-count">
                {results.length} song{results.length !== 1 ? "s" : ""}
              </span>
            </div>
            <ResultsGrid results={results} />
          </>
        )}
      </section>
    </>
  );
}

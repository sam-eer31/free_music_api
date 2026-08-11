"use client";

import { useState } from "react";

export default function SearchBar({ onSearch, loading }) {
  const [input, setInput] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (input.trim()) {
      onSearch(input);
    }
  };

  return (
    <div className="search-wrapper">
      <form className="search-form" onSubmit={handleSubmit} role="search">
        <label htmlFor="search-input" className="sr-only">
          Search for a song
        </label>
        <input
          id="search-input"
          className="search-input"
          type="text"
          placeholder="Search for a song..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          maxLength={60}
          autoComplete="off"
          autoFocus
        />
        <button
          type="submit"
          className={`search-btn ${loading ? "search-btn--loading" : ""}`}
          disabled={loading || !input.trim()}
          aria-label="Search"
        >
          {loading ? (
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
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
}

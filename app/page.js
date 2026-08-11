import SearchApp from "./components/SearchApp";

export default function Home() {
  return (
    <>
      <main className="container">
        <section className="hero">
          <div className="hero__icon">
            <img src="/logo.svg" alt="TuneBox Logo" style={{ width: "42px", height: "42px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.2))" }} />
          </div>
          <h1 className="hero__title">
            <span className="hero__title-accent">TuneBox</span> Search
          </h1>
          <p className="hero__subtitle">
            Search and download your favorite songs in high quality 320kbps
          </p>
        </section>

        <SearchApp />
      </main>

      <footer className="footer">
        <p className="footer__text">
          Built with <span className="footer__heart">♥</span> — Powered by
          TuneBox
        </p>
        <p style={{ marginTop: "8px", fontSize: "12px" }}>
          <a href="/api-docs" style={{ color: "var(--deep-rose)", textDecoration: "none", fontWeight: "600" }}>Developer API Documentation</a>
        </p>
      </footer>
    </>
  );
}

export default function Loader() {
  return (
    <div className="loader" role="status" aria-label="Loading search results">
      <div className="skeleton-grid">
        {[...Array(4)].map((_, i) => (
          <div className="skeleton-card" key={i}>
            <div className="skeleton-image" />
            <div className="skeleton-lines">
              <div className="skeleton-line skeleton-line--medium" />
              <div className="skeleton-line skeleton-line--short" />
              <div className="skeleton-line skeleton-line--short" />
            </div>
            <div className="skeleton-circle" />
          </div>
        ))}
      </div>
    </div>
  );
}

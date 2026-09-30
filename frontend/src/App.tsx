import { useState } from "react";
import { filterMovies } from "./api/client";
import BulkEditPanel from "./components/BulkEditPanel";
import FilterBuilder from "./components/FilterBuilder";
import { IconAlert, IconRefresh, IconSearch, Spinner } from "./components/Icons";
import MovieTable from "./components/MovieTable";
import type { FilterGroup, Movie } from "./types";
import { newGroup } from "./types";

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState<"search" | "refresh" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterGroup>(newGroup("AND"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const search = async (refresh = false) => {
    setLoading(refresh ? "refresh" : "search");
    setError(null);
    try {
      const data = await filterMovies(filter.children.length > 0 ? filter : null, refresh);
      setMovies(data);
      setSelected(new Set());
      setHasSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(null);
    }
  };

  const busy = loading !== null;

  return (
    <>
      <a className="skip-link" href="#results">
        Skip to results
      </a>
      <div className="app">
        <header className="app-header">
          <h1>jelly_stat</h1>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => search(true)}
            disabled={busy}
            title="Reload the movie list from Jellyfin, bypassing the cache"
          >
            {loading === "refresh" ? <Spinner /> : <IconRefresh />}
            Refresh from Jellyfin
          </button>
        </header>

        <main>
          <section aria-labelledby="filters-title">
            <h2 id="filters-title">Filters</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                search(false);
              }}
            >
              <FilterBuilder node={filter} onChange={setFilter} />
              <div className="form-actions">
                <button type="submit" className="btn btn-primary" disabled={busy}>
                  {loading === "search" ? <Spinner /> : <IconSearch />}
                  Search
                </button>
                <span className="muted">Leave the filters empty to list every movie.</span>
              </div>
            </form>
          </section>

          {error && (
            <p className="alert alert-error" role="alert">
              <IconAlert /> <span>{error}</span>
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => search(false)} disabled={busy}>
                Retry
              </button>
            </p>
          )}

          <section id="results" aria-labelledby="results-title" aria-busy={busy}>
            <h2 id="results-title">
              Movies
              {hasSearched && <span className="count">{movies.length}</span>}
            </h2>
            {busy && !hasSearched ? (
              <div className="skeleton-list" aria-label="Loading movies" role="status">
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="skeleton-row" />
                ))}
              </div>
            ) : hasSearched ? (
              <div className={busy ? "is-loading" : undefined}>
                <MovieTable movies={movies} selected={selected} onSelectionChange={setSelected} />
              </div>
            ) : (
              <p className="muted">Set up your filters (or none) and press Search to see movies.</p>
            )}
          </section>
        </main>
      </div>

      <BulkEditPanel
        selectedIds={[...selected]}
        onClear={() => setSelected(new Set())}
        onApplied={() => search(true)}
      />
    </>
  );
}

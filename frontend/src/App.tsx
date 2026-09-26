import { useState } from "react";
import { filterMovies } from "./api/client";
import BulkEditPanel from "./components/BulkEditPanel";
import FilterBuilder from "./components/FilterBuilder";
import MovieTable from "./components/MovieTable";
import type { FilterGroup, Movie } from "./types";
import { newGroup } from "./types";

export default function App() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterGroup>(newGroup("AND"));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const search = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await filterMovies(filter.children.length > 0 ? filter : null, refresh);
      setMovies(data);
      setSelected(new Set());
      setHasSearched(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header>
        <h1>jelly_stat</h1>
        <button type="button" onClick={() => search(true)} disabled={loading}>
          Refresh from Jellyfin
        </button>
      </header>

      <section>
        <h2>Filters</h2>
        <FilterBuilder node={filter} onChange={setFilter} />
        <button type="button" onClick={() => search(false)} disabled={loading}>
          Search
        </button>
        <p>Leave the filters empty and search to see every movie.</p>
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading...</p>}

      <section>
        <h2>Movies {hasSearched ? `(${movies.length})` : ""}</h2>
        {hasSearched ? (
          <MovieTable movies={movies} selected={selected} onSelectionChange={setSelected} />
        ) : (
          <p>Choose a filter (or none) and press Search to see movies.</p>
        )}
      </section>

      <section>
        <h2>Bulk edit</h2>
        <BulkEditPanel selectedIds={[...selected]} onApplied={() => search(true)} />
      </section>
    </div>
  );
}

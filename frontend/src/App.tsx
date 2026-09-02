import { useEffect, useState } from "react";
import { filterMovies, getMovies } from "./api/client";
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

  const loadAll = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const data = await getMovies(refresh);
      setMovies(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await filterMovies(filter.children.length > 0 ? filter : null);
      setMovies(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  return (
    <div className="app">
      <header>
        <h1>jelly_stat</h1>
        <button type="button" onClick={() => loadAll(true)} disabled={loading}>
          Refresh from Jellyfin
        </button>
      </header>

      <section>
        <h2>Filters</h2>
        <FilterBuilder node={filter} onChange={setFilter} />
        <button type="button" onClick={applyFilter} disabled={loading}>
          Apply filter
        </button>
      </section>

      {error && <p className="error">{error}</p>}
      {loading && <p>Loading...</p>}

      <section>
        <h2>Movies ({movies.length})</h2>
        <MovieTable movies={movies} selected={selected} onSelectionChange={setSelected} />
      </section>

      <section>
        <h2>Bulk edit</h2>
        <BulkEditPanel selectedIds={[...selected]} onApplied={() => loadAll(true)} />
      </section>
    </div>
  );
}

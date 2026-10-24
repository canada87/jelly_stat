import { useEffect, useMemo, useRef, useState } from "react";
import { movieImageUrl } from "../api/client";
import type { Movie } from "../types";
import { IconFilm, IconSort } from "./Icons";

type SortKey = "name" | "official_rating" | "date_created";

const PAGE_SIZE = 100;

interface Props {
  movies: Movie[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

export default function MovieTable({ movies, selected, onSelectionChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => setVisible(PAGE_SIZE), [movies]);

  const sorted = useMemo(() => {
    const copy = [...movies];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp =
        sortKey === "name"
          ? String(av).localeCompare(String(bv), undefined, { sensitivity: "base" })
          : av < bv
            ? -1
            : av > bv
              ? 1
              : 0;
      return sortAsc ? cmp : -cmp;
    });
    return copy;
  }, [movies, sortKey, sortAsc]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectionChange(next);
  };

  const allSelected = movies.length > 0 && movies.every((m) => selected.has(m.id));
  const someSelected = selected.size > 0 && !allSelected;
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(movies.map((m) => m.id)));
  };

  if (movies.length === 0) {
    return (
      <div className="empty-state">
        <IconFilm />
        <p>No movies match these filters.</p>
        <p className="muted">Adjust or remove a condition and search again.</p>
      </div>
    );
  }

  const rows = sorted.slice(0, visible);

  const sortHeader = (key: SortKey, label: string) => {
    const active = sortKey === key;
    return (
      <th scope="col" aria-sort={active ? (sortAsc ? "ascending" : "descending") : "none"}>
        <button type="button" className="th-sort" onClick={() => toggleSort(key)}>
          {label}
          <IconSort dir={active ? (sortAsc ? "asc" : "desc") : null} />
        </button>
      </th>
    );
  };

  return (
    <>
      <div className="table-scroll">
        <table className="movie-table">
          <thead>
            <tr>
              <th scope="col" className="col-check">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={`Select all ${movies.length} movies`}
                />
              </th>
              <th scope="col" className="col-cover">
                <span className="visually-hidden">Cover</span>
              </th>
              {sortHeader("name", "Name")}
              <th scope="col">Tags</th>
              <th scope="col">Collections</th>
              {sortHeader("official_rating", "Parental rating")}
              {sortHeader("date_created", "Added on")}
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => {
              const isSelected = selected.has(m.id);
              return (
                <tr key={m.id} className={isSelected ? "is-selected" : undefined}>
                  <td className="col-check">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleOne(m.id)}
                      aria-label={`Select ${m.name}`}
                    />
                  </td>
                  <td className="col-cover">
                    <div className="movie-cover">
                      <img
                        src={movieImageUrl(m.id)}
                        alt=""
                        width={64}
                        height={96}
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.style.visibility = "hidden";
                        }}
                      />
                    </div>
                  </td>
                  <th scope="row" className="cell-name">
                    {m.name}
                  </th>
                  <td>
                    {m.tags.length > 0 ? (
                      <ul className="chips">
                        {m.tags.map((t) => (
                          <li key={t} className="chip">
                            {t}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>
                    {m.collections.length > 0 ? (
                      <ul className="chips">
                        {m.collections.map((c) => (
                          <li key={c.id} className="chip chip-collection">
                            {c.name}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td>{m.official_rating ?? <span className="muted">—</span>}</td>
                  <td className="num">
                    {m.date_created ? dateFormat.format(new Date(m.date_created)) : <span className="muted">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {visible < sorted.length && (
        <div className="table-more">
          <span className="muted">
            Showing {rows.length} of {sorted.length}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => setVisible((v) => v + PAGE_SIZE)}>
            Show {Math.min(PAGE_SIZE, sorted.length - visible)} more
          </button>
        </div>
      )}
    </>
  );
}

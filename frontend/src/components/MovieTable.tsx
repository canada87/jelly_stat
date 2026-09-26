import { useMemo, useState } from "react";
import { movieImageUrl } from "../api/client";
import type { Movie } from "../types";

type SortKey = "name" | "official_rating" | "date_created";

interface Props {
  movies: Movie[];
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
}

export default function MovieTable({ movies, selected, onSelectionChange }: Props) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = useMemo(() => {
    const copy = [...movies];
    copy.sort((a, b) => {
      const av = a[sortKey] ?? "";
      const bv = b[sortKey] ?? "";
      const cmp = av < bv ? -1 : av > bv ? 1 : 0;
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
  const toggleAll = () => {
    if (allSelected) onSelectionChange(new Set());
    else onSelectionChange(new Set(movies.map((m) => m.id)));
  };

  return (
    <table className="movie-table">
      <thead>
        <tr>
          <th>
            <input type="checkbox" checked={allSelected} onChange={toggleAll} />
          </th>
          <th>Cover</th>
          <th onClick={() => toggleSort("name")}>Name</th>
          <th>Tags</th>
          <th onClick={() => toggleSort("official_rating")}>Parental rating</th>
          <th onClick={() => toggleSort("date_created")}>Added on</th>
        </tr>
      </thead>
      <tbody>
        {sorted.map((m) => (
          <tr key={m.id}>
            <td>
              <input type="checkbox" checked={selected.has(m.id)} onChange={() => toggleOne(m.id)} />
            </td>
            <td>
              <img
                className="movie-cover"
                src={movieImageUrl(m.id)}
                alt=""
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.style.visibility = "hidden";
                }}
              />
            </td>
            <td>{m.name}</td>
            <td>{m.tags.join(", ")}</td>
            <td>{m.official_rating ?? "—"}</td>
            <td>{m.date_created ? new Date(m.date_created).toLocaleDateString() : "—"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

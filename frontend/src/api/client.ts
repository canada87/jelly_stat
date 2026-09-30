import type { BulkEditRequest, BulkEditResult, FilterNode, Movie } from "../types";

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function stripIds(node: FilterNode): unknown {
  if (node.kind === "group") {
    const { id: _id, children, ...rest } = node;
    return { ...rest, children: children.map(stripIds) };
  }
  const { id: _id, ...rest } = node;
  return rest;
}

export function filterMovies(filter: FilterNode | null, refresh = false): Promise<Movie[]> {
  return fetch("/api/movies/filter", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ filter: filter ? stripIds(filter) : null, refresh }),
  }).then((r) => handle<Movie[]>(r));
}

export function movieImageUrl(itemId: string): string {
  return `/api/movies/${itemId}/image`;
}

export function bulkEdit(request: BulkEditRequest): Promise<BulkEditResult[]> {
  return fetch("/api/movies/bulk-edit", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  }).then((r) => handle<BulkEditResult[]>(r));
}

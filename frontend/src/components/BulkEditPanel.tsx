import { useState } from "react";
import { bulkEdit } from "../api/client";
import type { BulkEditResult } from "../types";

interface Props {
  selectedIds: string[];
  onApplied: () => void;
}

export default function BulkEditPanel({ selectedIds, onApplied }: Props) {
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const [changeRating, setChangeRating] = useState(false);
  const [rating, setRating] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkEditResult[] | null>(null);

  const splitTags = (s: string) =>
    s
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

  const apply = async () => {
    setBusy(true);
    setResults(null);
    try {
      const res = await bulkEdit({
        item_ids: selectedIds,
        add_tags: splitTags(addTags),
        remove_tags: splitTags(removeTags),
        official_rating: rating,
        change_rating: changeRating,
      });
      setResults(res);
      setAddTags("");
      setRemoveTags("");
      onApplied();
    } finally {
      setBusy(false);
    }
  };

  const failures = results?.filter((r) => !r.ok) ?? [];

  return (
    <div className="bulk-edit-panel">
      <strong>{selectedIds.length} selected</strong>
      <label>
        Add tags (comma separated)
        <input value={addTags} onChange={(e) => setAddTags(e.target.value)} placeholder="e.g. kids, favorites" />
      </label>
      <label>
        Remove tags (comma separated)
        <input value={removeTags} onChange={(e) => setRemoveTags(e.target.value)} placeholder="e.g. unwatched" />
      </label>
      <label>
        <input type="checkbox" checked={changeRating} onChange={(e) => setChangeRating(e.target.checked)} />
        Change parental rating to:
      </label>
      <input
        type="text"
        disabled={!changeRating}
        value={rating}
        onChange={(e) => setRating(e.target.value)}
        placeholder="e.g. PG-13 (empty = clear)"
      />
      <button
        type="button"
        disabled={busy || selectedIds.length === 0 || (!addTags && !removeTags && !changeRating)}
        onClick={apply}
      >
        {busy ? "Applying..." : "Apply to selection"}
      </button>
      {results && (
        <p>
          {results.length - failures.length}/{results.length} applied successfully.
          {failures.length > 0 && ` Failures: ${failures.map((f) => f.item_id).join(", ")}`}
        </p>
      )}
    </div>
  );
}

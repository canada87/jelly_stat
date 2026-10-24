import { useEffect, useId, useMemo, useRef, useState } from "react";
import { bulkEdit } from "../api/client";
import type { BulkEditResponse, Collection, CollectionEditResult, Movie } from "../types";
import { IconAlert, IconCheck, IconClose, IconEdit, IconPlus, Spinner } from "./Icons";

interface Props {
  selectedMovies: Movie[];
  collections: Collection[];
  onClear: () => void;
  onApplied: () => void;
}

type Step = "form" | "confirm" | "result";

const splitTags = (s: string) =>
  s
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

const plural = (n: number) => `${n} movie${n === 1 ? "" : "s"}`;

const ACTION_LABELS: Record<CollectionEditResult["action"], string> = {
  add: "Add to",
  remove: "Remove from",
  create: "Create",
};

export default function BulkEditPanel({ selectedMovies, collections, onClear, onApplied }: Props) {
  const selectedIds = selectedMovies.map((m) => m.id);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const [changeRating, setChangeRating] = useState(false);
  const [rating, setRating] = useState("");
  // Collection names typed by the user: existing ones are added to, unknown ones are created.
  const [addCollections, setAddCollections] = useState<string[]>([]);
  const [collectionInput, setCollectionInput] = useState("");
  const [removeCollectionIds, setRemoveCollectionIds] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkEditResponse | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Selection is cleared after a successful apply; keep the count for the result screen.
  const [targetCount, setTargetCount] = useState(0);

  const count = open ? targetCount : selectedIds.length;
  const add = splitTags(addTags);
  const remove = splitTags(removeTags);

  const collectionByName = useMemo(
    () => new Map(collections.map((c) => [c.name.toLowerCase(), c])),
    [collections]
  );
  const existingToAdd = addCollections.flatMap((n) => collectionByName.get(n.toLowerCase()) ?? []);
  const newToCreate = addCollections.filter((n) => !collectionByName.has(n.toLowerCase()));

  // Collections at least one selected movie belongs to, with how many of the selection are in each.
  const removable = useMemo(() => {
    const counts = new Map<string, { id: string; name: string; count: number }>();
    for (const m of selectedMovies) {
      for (const c of m.collections) {
        const entry = counts.get(c.id) ?? { ...c, count: 0 };
        entry.count++;
        counts.set(c.id, entry);
      }
    }
    return [...counts.values()].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [selectedMovies]);
  const toRemove = removable.filter((c) => removeCollectionIds.has(c.id));

  const hasChanges =
    add.length > 0 || remove.length > 0 || changeRating || addCollections.length > 0 || toRemove.length > 0;

  useEffect(() => {
    const d = dialogRef.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  const openDialog = () => {
    setTargetCount(selectedIds.length);
    setStep("form");
    setResults(null);
    setRequestError(null);
    setOpen(true);
  };

  const closeDialog = () => {
    if (busy) return;
    setOpen(false);
  };

  const pushCollection = () => {
    const name = collectionInput.trim();
    if (!name) return;
    // Use the existing collection's exact spelling when the name matches one case-insensitively.
    const canonical = collectionByName.get(name.toLowerCase())?.name ?? name;
    if (!addCollections.some((n) => n.toLowerCase() === canonical.toLowerCase())) {
      setAddCollections([...addCollections, canonical]);
    }
    setCollectionInput("");
  };

  const toggleRemove = (id: string) => {
    const next = new Set(removeCollectionIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setRemoveCollectionIds(next);
  };

  const collectionName = (r: CollectionEditResult) =>
    r.collection_name ?? collections.find((c) => c.id === r.collection_id)?.name ?? r.collection_id ?? "?";

  const apply = async () => {
    setBusy(true);
    setRequestError(null);
    try {
      const res = await bulkEdit({
        item_ids: selectedIds,
        add_tags: add,
        remove_tags: remove,
        official_rating: rating,
        change_rating: changeRating,
        add_to_collections: existingToAdd.map((c) => c.id),
        new_collections: newToCreate,
        remove_from_collections: toRemove.map((c) => c.id),
      });
      setResults(res);
      setStep("result");
      setAddTags("");
      setRemoveTags("");
      setChangeRating(false);
      setRating("");
      setAddCollections([]);
      setCollectionInput("");
      setRemoveCollectionIds(new Set());
      onApplied();
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : String(e));
      setStep("form");
    } finally {
      setBusy(false);
    }
  };

  const failures = results?.items.filter((r) => !r.ok) ?? [];
  const collectionFailures = results?.collections.filter((r) => !r.ok) ?? [];
  const allOk = failures.length === 0 && collectionFailures.length === 0;

  return (
    <>
      {selectedIds.length > 0 && (
        <div className="action-bar" role="region" aria-label="Actions for selected movies">
          <div className="action-bar-inner">
            <p className="action-bar-count" aria-live="polite">
              <strong>{plural(selectedIds.length)}</strong> selected
            </p>
            <div className="action-bar-buttons">
              <button type="button" className="btn btn-ghost" onClick={onClear}>
                <IconClose /> Clear selection
              </button>
              <button type="button" className="btn btn-primary" onClick={openDialog}>
                <IconEdit /> Edit selected…
              </button>
            </div>
          </div>
        </div>
      )}

      <dialog
        ref={dialogRef}
        className="dialog"
        aria-labelledby={titleId}
        onCancel={(e) => {
          e.preventDefault();
          closeDialog();
        }}
        onClose={() => setOpen(false)}
      >
        <div className="dialog-header">
          <h2 id={titleId}>
            {step === "result" ? "Bulk edit results" : step === "confirm" ? "Confirm changes" : "Edit selected movies"}
          </h2>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={closeDialog}
            disabled={busy}
            aria-label="Close"
          >
            <IconClose />
          </button>
        </div>

        {step === "form" && (
          <form
            className="dialog-body"
            onSubmit={(e) => {
              e.preventDefault();
              if (hasChanges) setStep("confirm");
            }}
          >
            <p className="muted">Changes apply to {plural(count)}.</p>
            {requestError && (
              <p className="alert alert-error" role="alert">
                <IconAlert /> <span>Request failed: {requestError}</span>
              </p>
            )}
            <div className="field">
              <label htmlFor={`${titleId}-add`}>Add tags</label>
              <input
                id={`${titleId}-add`}
                value={addTags}
                onChange={(e) => setAddTags(e.target.value)}
                placeholder="kids, favorites"
                aria-describedby={`${titleId}-tags-help`}
              />
            </div>
            <div className="field">
              <label htmlFor={`${titleId}-remove`}>Remove tags</label>
              <input
                id={`${titleId}-remove`}
                value={removeTags}
                onChange={(e) => setRemoveTags(e.target.value)}
                placeholder="unwatched"
                aria-describedby={`${titleId}-tags-help`}
              />
              <span id={`${titleId}-tags-help`} className="help">
                Separate multiple tags with commas.
              </span>
            </div>
            <fieldset className="field">
              <legend>Parental rating</legend>
              <label className="check">
                <input type="checkbox" checked={changeRating} onChange={(e) => setChangeRating(e.target.checked)} />
                Change the parental rating
              </label>
              <input
                type="text"
                aria-label="New parental rating"
                disabled={!changeRating}
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                placeholder="e.g. PG-13"
                aria-describedby={`${titleId}-rating-help`}
              />
              <span id={`${titleId}-rating-help`} className="help">
                Leave empty to clear the rating.
              </span>
            </fieldset>
            <fieldset className="field">
              <legend>Collections</legend>
              <label htmlFor={`${titleId}-col`} className="sub-label">
                Add to collections
              </label>
              <div className="inline-input">
                <input
                  id={`${titleId}-col`}
                  list="collection-names"
                  value={collectionInput}
                  onChange={(e) => setCollectionInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      pushCollection();
                    }
                  }}
                  placeholder="Existing or new collection name"
                  aria-describedby={`${titleId}-col-help`}
                />
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={pushCollection}
                  disabled={!collectionInput.trim()}
                >
                  <IconPlus /> Add
                </button>
              </div>
              <span id={`${titleId}-col-help`} className="help">
                A name that doesn't match an existing collection creates a new one.
              </span>
              {addCollections.length > 0 && (
                <ul className="chips" aria-label="Collections to add to">
                  {addCollections.map((n) => (
                    <li key={n} className="chip chip-removable">
                      {n}
                      {!collectionByName.has(n.toLowerCase()) && <span className="chip-badge">new</span>}
                      <button
                        type="button"
                        className="chip-remove"
                        onClick={() => setAddCollections(addCollections.filter((x) => x !== n))}
                        aria-label={`Don't add to ${n}`}
                      >
                        <IconClose />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <span className="sub-label">Remove from collections</span>
              {removable.length === 0 ? (
                <span className="help">None of the selected movies is in a collection.</span>
              ) : (
                <div className="check-list">
                  {removable.map((c) => (
                    <label key={c.id} className="check">
                      <input
                        type="checkbox"
                        checked={removeCollectionIds.has(c.id)}
                        onChange={() => toggleRemove(c.id)}
                      />
                      {c.name}
                      <span className="muted">
                        ({c.count} of {count} selected)
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </fieldset>
            <div className="dialog-footer">
              <button type="button" className="btn btn-ghost" onClick={closeDialog}>
                Cancel
              </button>
              <button type="submit" className="btn btn-primary" disabled={!hasChanges}>
                Review changes
              </button>
            </div>
          </form>
        )}

        {step === "confirm" && (
          <div className="dialog-body">
            <p>
              You are about to modify <strong>{plural(count)}</strong>:
            </p>
            <ul className="summary">
              {add.length > 0 && (
                <li>
                  Add tags: <b>{add.join(", ")}</b>
                </li>
              )}
              {remove.length > 0 && (
                <li>
                  Remove tags: <b>{remove.join(", ")}</b>
                </li>
              )}
              {changeRating && (
                <li>
                  {rating.trim() ? (
                    <>
                      Set parental rating to <b>{rating.trim()}</b>
                    </>
                  ) : (
                    <b>Clear the parental rating</b>
                  )}
                </li>
              )}
              {toRemove.map((c) => (
                <li key={`rm-${c.id}`}>
                  Remove from collection <b>{c.name}</b>
                </li>
              ))}
              {existingToAdd.map((c) => (
                <li key={`add-${c.id}`}>
                  Add to collection <b>{c.name}</b>
                </li>
              ))}
              {newToCreate.map((n) => (
                <li key={`new-${n}`}>
                  Create collection <b>{n}</b> with these movies
                </li>
              ))}
            </ul>
            <p className="alert alert-warn">
              <IconAlert /> <span>These changes are written to Jellyfin and cannot be undone from here.</span>
            </p>
            <div className="dialog-footer">
              <button type="button" className="btn btn-ghost" onClick={() => setStep("form")} disabled={busy}>
                Back
              </button>
              <button type="button" className="btn btn-primary" onClick={apply} disabled={busy}>
                {busy && <Spinner />}
                {busy ? "Applying…" : `Apply to ${plural(count)}`}
              </button>
            </div>
          </div>
        )}

        {step === "result" && results && (
          <div className="dialog-body" aria-live="polite">
            <p className={`alert ${allOk ? "alert-ok" : "alert-warn"}`}>
              {allOk ? <IconCheck /> : <IconAlert />}
              <span>
                {results.items.length > 0 &&
                  `Metadata: ${results.items.length - failures.length} of ${results.items.length} applied successfully. `}
                {results.collections.length > 0 &&
                  `Collections: ${results.collections.length - collectionFailures.length} of ${results.collections.length} changes applied.`}
              </span>
            </p>
            {failures.length > 0 && (
              <ul className="bulk-edit-errors">
                {failures.map((f) => (
                  <li key={f.item_id}>
                    <code>{f.item_id}</code>: {f.error}
                  </li>
                ))}
              </ul>
            )}
            {collectionFailures.length > 0 && (
              <ul className="bulk-edit-errors">
                {collectionFailures.map((f, i) => (
                  <li key={i}>
                    {ACTION_LABELS[f.action]} <b>{collectionName(f)}</b>: {f.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="dialog-footer">
              <button type="button" className="btn btn-primary" onClick={closeDialog}>
                Done
              </button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}

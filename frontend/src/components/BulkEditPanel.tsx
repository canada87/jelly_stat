import { useEffect, useId, useRef, useState } from "react";
import { bulkEdit } from "../api/client";
import type { BulkEditResult } from "../types";
import { IconAlert, IconCheck, IconClose, IconEdit, Spinner } from "./Icons";

interface Props {
  selectedIds: string[];
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

export default function BulkEditPanel({ selectedIds, onClear, onApplied }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("form");
  const [addTags, setAddTags] = useState("");
  const [removeTags, setRemoveTags] = useState("");
  const [changeRating, setChangeRating] = useState(false);
  const [rating, setRating] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<BulkEditResult[] | null>(null);
  const [requestError, setRequestError] = useState<string | null>(null);
  // Selection is cleared after a successful apply; keep the count for the result screen.
  const [targetCount, setTargetCount] = useState(0);

  const count = open ? targetCount : selectedIds.length;
  const add = splitTags(addTags);
  const remove = splitTags(removeTags);
  const hasChanges = add.length > 0 || remove.length > 0 || changeRating;

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
      });
      setResults(res);
      setStep("result");
      setAddTags("");
      setRemoveTags("");
      setChangeRating(false);
      setRating("");
      onApplied();
    } catch (e) {
      setRequestError(e instanceof Error ? e.message : String(e));
      setStep("form");
    } finally {
      setBusy(false);
    }
  };

  const failures = results?.filter((r) => !r.ok) ?? [];

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
            <p className={`alert ${failures.length === 0 ? "alert-ok" : "alert-warn"}`}>
              {failures.length === 0 ? <IconCheck /> : <IconAlert />}
              <span>
                {results.length - failures.length} of {results.length} applied successfully.
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

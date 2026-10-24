import { useId } from "react";
import type { ConditionOp, FilterField, FilterGroup, FilterNode } from "../types";
import { newCondition, newGroup } from "../types";
import { IconClose, IconGroup, IconPlus } from "./Icons";

interface Props {
  node: FilterGroup;
  onChange: (node: FilterGroup) => void;
  onRemove?: () => void;
  depth?: number;
}

const FIELD_LABELS: Record<FilterField, string> = {
  name: "Name",
  tags: "Tag",
  officialRating: "Parental rating",
  dateCreated: "Date added",
  collection: "Collection",
};

const OP_LABELS: Record<ConditionOp, string> = {
  include: "contains",
  exclude: "does not contain",
  before: "is before",
  after: "is after",
  on: "is on",
};

const FIELD_OPTIONS = Object.keys(FIELD_LABELS) as FilterField[];

function opsForField(field: FilterField): ConditionOp[] {
  return field === "dateCreated" ? ["before", "after", "on"] : ["include", "exclude"];
}

const PLACEHOLDERS: Record<FilterField, string> = {
  name: "Part of the movie name",
  tags: "Tag name",
  officialRating: "e.g. PG-13",
  dateCreated: "",
  collection: "Collection name",
};

/** <datalist> ids rendered by the app, used to suggest existing values. */
const SUGGESTIONS: Partial<Record<FilterField, string>> = {
  collection: "collection-names",
};

function ConditionRow({
  node,
  onChange,
  onRemove,
}: {
  node: Extract<FilterNode, { kind: "condition" }>;
  onChange: (n: FilterNode) => void;
  onRemove: () => void;
}) {
  const ops = opsForField(node.field);

  return (
    <div className="condition-row" role="group" aria-label="Filter condition">
      <select
        aria-label="Field"
        value={node.field}
        onChange={(e) => {
          const field = e.target.value as FilterField;
          onChange({ ...node, field, op: opsForField(field)[0], value: "" });
        }}
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f} value={f}>
            {FIELD_LABELS[f]}
          </option>
        ))}
      </select>
      <select
        aria-label="Operator"
        value={node.op}
        onChange={(e) => onChange({ ...node, op: e.target.value as ConditionOp })}
      >
        {ops.map((op) => (
          <option key={op} value={op}>
            {OP_LABELS[op]}
          </option>
        ))}
      </select>
      {node.field === "dateCreated" ? (
        <input
          type="date"
          aria-label="Date"
          value={node.value}
          onChange={(e) => onChange({ ...node, value: e.target.value })}
        />
      ) : (
        <input
          type="text"
          aria-label="Value"
          placeholder={PLACEHOLDERS[node.field]}
          list={SUGGESTIONS[node.field]}
          value={node.value}
          onChange={(e) => onChange({ ...node, value: e.target.value })}
        />
      )}
      <button type="button" className="btn btn-ghost btn-icon" onClick={onRemove} aria-label="Remove condition">
        <IconClose />
      </button>
    </div>
  );
}

export default function FilterBuilder({ node, onChange, onRemove, depth = 0 }: Props) {
  const opId = useId();

  const updateChild = (index: number, child: FilterNode) => {
    const children = [...node.children];
    children[index] = child;
    onChange({ ...node, children });
  };

  const removeChild = (index: number) => {
    const children = node.children.filter((_, i) => i !== index);
    onChange({ ...node, children });
  };

  return (
    <div className="filter-group" data-depth={depth % 4}>
      <div className="filter-group-header">
        <label htmlFor={opId} className="filter-group-label">
          Match
        </label>
        <select
          id={opId}
          value={node.operator}
          onChange={(e) => onChange({ ...node, operator: e.target.value as "AND" | "OR" })}
        >
          <option value="AND">all of these conditions</option>
          <option value="OR">at least one of these</option>
        </select>
        <div className="filter-group-actions">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onChange({ ...node, children: [...node.children, newCondition()] })}
          >
            <IconPlus /> Condition
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onChange({ ...node, children: [...node.children, newGroup()] })}
          >
            <IconGroup /> Group
          </button>
          {onRemove && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onRemove}>
              <IconClose /> Remove group
            </button>
          )}
        </div>
      </div>
      <div className="filter-group-children">
        {node.children.length === 0 && (
          <p className="muted filter-empty">
            {depth === 0
              ? "No conditions: every movie will match. Add a condition to narrow the results."
              : "Empty group. Add a condition or remove the group."}
          </p>
        )}
        {node.children.map((child, i) =>
          child.kind === "group" ? (
            <FilterBuilder
              key={child.id}
              node={child}
              depth={depth + 1}
              onChange={(n) => updateChild(i, n)}
              onRemove={() => removeChild(i)}
            />
          ) : (
            <ConditionRow
              key={child.id}
              node={child}
              onChange={(n) => updateChild(i, n)}
              onRemove={() => removeChild(i)}
            />
          )
        )}
      </div>
    </div>
  );
}

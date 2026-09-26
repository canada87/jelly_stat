import type { ConditionOp, FilterField, FilterGroup, FilterNode } from "../types";
import { newCondition, newGroup } from "../types";

interface Props {
  node: FilterGroup;
  onChange: (node: FilterGroup) => void;
  onRemove?: () => void;
}

const FIELD_OPTIONS: FilterField[] = ["name", "tags", "officialRating", "dateCreated"];

function opsForField(field: FilterField): ConditionOp[] {
  return field === "dateCreated" ? ["before", "after", "on"] : ["include", "exclude"];
}

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
    <div className="condition-row">
      <select
        value={node.field}
        onChange={(e) => {
          const field = e.target.value as FilterField;
          onChange({ ...node, field, op: opsForField(field)[0] });
        }}
      >
        {FIELD_OPTIONS.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
      <select value={node.op} onChange={(e) => onChange({ ...node, op: e.target.value as ConditionOp })}>
        {ops.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>
      {node.field === "dateCreated" ? (
        <input type="date" value={node.value} onChange={(e) => onChange({ ...node, value: e.target.value })} />
      ) : (
        <input
          type="text"
          placeholder={
            node.field === "name"
              ? "part of the movie name"
              : node.field === "tags"
                ? "tag name"
                : "rating (e.g. PG-13)"
          }
          value={node.value}
          onChange={(e) => onChange({ ...node, value: e.target.value })}
        />
      )}
      <button type="button" onClick={onRemove} aria-label="remove condition">
        ✕
      </button>
    </div>
  );
}

export default function FilterBuilder({ node, onChange, onRemove }: Props) {
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
    <div className="filter-group">
      <div className="filter-group-header">
        <select
          value={node.operator}
          onChange={(e) => onChange({ ...node, operator: e.target.value as "AND" | "OR" })}
        >
          <option value="AND">AND</option>
          <option value="OR">OR</option>
        </select>
        <button type="button" onClick={() => onChange({ ...node, children: [...node.children, newCondition()] })}>
          + condition
        </button>
        <button type="button" onClick={() => onChange({ ...node, children: [...node.children, newGroup()] })}>
          + group
        </button>
        {onRemove && (
          <button type="button" onClick={onRemove} aria-label="remove group">
            ✕ group
          </button>
        )}
      </div>
      <div className="filter-group-children">
        {node.children.map((child, i) =>
          child.kind === "group" ? (
            <FilterBuilder key={i} node={child} onChange={(n) => updateChild(i, n)} onRemove={() => removeChild(i)} />
          ) : (
            <ConditionRow key={i} node={child} onChange={(n) => updateChild(i, n)} onRemove={() => removeChild(i)} />
          )
        )}
      </div>
    </div>
  );
}

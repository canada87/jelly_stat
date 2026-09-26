export type FilterField = "name" | "tags" | "officialRating" | "dateCreated";
export type ConditionOp = "include" | "exclude" | "before" | "after" | "on";

export interface FilterCondition {
  kind: "condition";
  field: FilterField;
  op: ConditionOp;
  value: string;
}

export interface FilterGroup {
  kind: "group";
  operator: "AND" | "OR";
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

export interface Movie {
  id: string;
  name: string;
  tags: string[];
  official_rating: string | null;
  date_created: string | null;
}

export interface BulkEditRequest {
  item_ids: string[];
  add_tags: string[];
  remove_tags: string[];
  official_rating: string | null;
  change_rating: boolean;
}

export interface BulkEditResult {
  item_id: string;
  ok: boolean;
  error: string | null;
}

export function newGroup(operator: "AND" | "OR" = "AND"): FilterGroup {
  return { kind: "group", operator, children: [] };
}

export function newCondition(): FilterCondition {
  return { kind: "condition", field: "name", op: "include", value: "" };
}

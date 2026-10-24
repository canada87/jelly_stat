export type FilterField = "name" | "tags" | "officialRating" | "dateCreated" | "collection";
export type ConditionOp = "include" | "exclude" | "before" | "after" | "on";

export interface FilterCondition {
  kind: "condition";
  /** UI-only stable React key; stripped before sending to the API. */
  id: string;
  field: FilterField;
  op: ConditionOp;
  value: string;
}

export interface FilterGroup {
  kind: "group";
  /** UI-only stable React key; stripped before sending to the API. */
  id: string;
  operator: "AND" | "OR";
  children: FilterNode[];
}

export type FilterNode = FilterCondition | FilterGroup;

export interface CollectionRef {
  id: string;
  name: string;
}

export interface Movie {
  id: string;
  name: string;
  tags: string[];
  official_rating: string | null;
  date_created: string | null;
  collections: CollectionRef[];
}

export interface Collection {
  id: string;
  name: string;
  movie_count: number;
}

export interface BulkEditRequest {
  item_ids: string[];
  add_tags: string[];
  remove_tags: string[];
  official_rating: string | null;
  change_rating: boolean;
  add_to_collections: string[];
  new_collections: string[];
  remove_from_collections: string[];
}

export interface BulkEditResult {
  item_id: string;
  ok: boolean;
  error: string | null;
}

export interface CollectionEditResult {
  action: "add" | "remove" | "create";
  collection_id: string | null;
  collection_name: string | null;
  ok: boolean;
  error: string | null;
}

export interface BulkEditResponse {
  items: BulkEditResult[];
  collections: CollectionEditResult[];
}

let nextId = 0;
const uid = () => `n${++nextId}`;

export function newGroup(operator: "AND" | "OR" = "AND"): FilterGroup {
  return { kind: "group", id: uid(), operator, children: [] };
}

export function newCondition(): FilterCondition {
  return { kind: "condition", id: uid(), field: "name", op: "include", value: "" };
}

from datetime import datetime
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field


class CollectionRef(BaseModel):
    id: str
    name: str


class Movie(BaseModel):
    id: str
    name: str
    tags: list[str] = []
    official_rating: Optional[str] = None
    date_created: Optional[datetime] = None
    collections: list[CollectionRef] = []


class Collection(BaseModel):
    id: str
    name: str
    movie_count: int = 0


class Library(BaseModel):
    movies: list[Movie]
    collections: list[Collection]


class FilterCondition(BaseModel):
    kind: Literal["condition"] = "condition"
    field: Literal["name", "tags", "officialRating", "dateCreated", "collection"]
    op: Literal["include", "exclude", "before", "after", "on"]
    value: str


class FilterGroup(BaseModel):
    kind: Literal["group"] = "group"
    operator: Literal["AND", "OR"]
    children: list["FilterNode"] = []


FilterNode = Annotated[Union[FilterGroup, FilterCondition], Field(discriminator="kind")]
FilterGroup.model_rebuild()


class FilterRequest(BaseModel):
    filter: Optional[FilterNode] = None
    refresh: bool = False


class BulkEditRequest(BaseModel):
    item_ids: list[str]
    add_tags: list[str] = []
    remove_tags: list[str] = []
    # None = leave unchanged, "" = clear rating, any other string = set rating
    official_rating: Optional[str] = None
    change_rating: bool = False
    # Collection membership: ids of existing collections, plus names of collections to create
    # with the selected items in them.
    add_to_collections: list[str] = []
    new_collections: list[str] = []
    remove_from_collections: list[str] = []


class BulkEditResult(BaseModel):
    item_id: str
    ok: bool
    error: Optional[str] = None


class CollectionEditResult(BaseModel):
    action: Literal["add", "remove", "create"]
    collection_id: Optional[str] = None
    collection_name: Optional[str] = None
    ok: bool
    error: Optional[str] = None


class BulkEditResponse(BaseModel):
    items: list[BulkEditResult] = []
    collections: list[CollectionEditResult] = []

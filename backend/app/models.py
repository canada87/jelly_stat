from datetime import datetime
from typing import Annotated, Literal, Optional, Union

from pydantic import BaseModel, Field


class Movie(BaseModel):
    id: str
    name: str
    tags: list[str] = []
    official_rating: Optional[str] = None
    date_created: Optional[datetime] = None


class FilterCondition(BaseModel):
    kind: Literal["condition"] = "condition"
    field: Literal["tags", "officialRating", "dateCreated"]
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


class BulkEditRequest(BaseModel):
    item_ids: list[str]
    add_tags: list[str] = []
    remove_tags: list[str] = []
    # None = leave unchanged, "" = clear rating, any other string = set rating
    official_rating: Optional[str] = None
    change_rating: bool = False


class BulkEditResult(BaseModel):
    item_id: str
    ok: bool
    error: Optional[str] = None

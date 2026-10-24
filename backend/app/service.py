"""Library reads and bulk edits, shared by the REST API and the MCP server.

`state` is the FastAPI `app.state`, which holds the Jellyfin client and the library cache.
"""

import asyncio
import logging
from typing import Any, Awaitable, Callable, Optional

from app.config import settings
from app.models import BulkEditRequest, BulkEditResponse, BulkEditResult, CollectionEditResult, Library

logger = logging.getLogger("jelly_stat.bulk")


async def get_library(state: Any, force_refresh: bool = False) -> Library:
    cache = state.library_cache
    if not force_refresh:
        cached = cache.get()
        if cached is not None:
            return cached
    library = await state.jellyfin.get_library()
    cache.set(library)
    return library


def _apply_edits(dto: dict, body: BulkEditRequest) -> dict:
    tags = list(dto.get("Tags") or [])
    for tag in body.add_tags:
        if tag not in tags:
            tags.append(tag)
    if body.remove_tags:
        remove_lower = {t.lower() for t in body.remove_tags}
        tags = [t for t in tags if t.lower() not in remove_lower]
    dto["Tags"] = tags

    if body.change_rating:
        dto["OfficialRating"] = body.official_rating or None

    return dto


async def _edit_one(jellyfin: Any, item_id: str, body: BulkEditRequest, sem: asyncio.Semaphore) -> BulkEditResult:
    async with sem:
        try:
            dto = await jellyfin.get_item_raw(item_id)
            dto = _apply_edits(dto, body)
            await jellyfin.update_item_raw(item_id, dto)
            return BulkEditResult(item_id=item_id, ok=True)
        except Exception as exc:  # noqa: BLE001 - surface per-item error to the caller
            logger.exception("bulk edit failed for item %s", item_id)
            return BulkEditResult(item_id=item_id, ok=False, error=str(exc))


def _has_item_edits(body: BulkEditRequest) -> bool:
    return bool(body.add_tags or body.remove_tags or body.change_rating)


async def _collection_op(
    action: str,
    collection_id: Optional[str],
    collection_name: Optional[str],
    op: Callable[[], Awaitable[object]],
) -> CollectionEditResult:
    try:
        result = await op()
        if action == "create":
            collection_id = str(result)
        return CollectionEditResult(
            action=action, collection_id=collection_id, collection_name=collection_name, ok=True
        )
    except Exception as exc:  # noqa: BLE001 - surface per-collection error to the caller
        logger.exception("collection %s failed for %s", action, collection_id or collection_name)
        return CollectionEditResult(
            action=action, collection_id=collection_id, collection_name=collection_name, ok=False, error=str(exc)
        )


async def bulk_edit(state: Any, body: BulkEditRequest) -> BulkEditResponse:
    jellyfin = state.jellyfin
    response = BulkEditResponse()

    # Collection membership lives on the collection, not the item: skip the per-item
    # metadata round-trip when only collections change.
    if _has_item_edits(body):
        sem = asyncio.Semaphore(settings.max_concurrent_updates)
        response.items = list(
            await asyncio.gather(*(_edit_one(jellyfin, item_id, body, sem) for item_id in body.item_ids))
        )

    ids = body.item_ids
    for cid in body.remove_from_collections:
        response.collections.append(
            await _collection_op("remove", cid, None, lambda cid=cid: jellyfin.remove_from_collection(cid, ids))
        )
    for cid in body.add_to_collections:
        response.collections.append(
            await _collection_op("add", cid, None, lambda cid=cid: jellyfin.add_to_collection(cid, ids))
        )
    for name in (n.strip() for n in body.new_collections):
        if name:
            response.collections.append(
                await _collection_op("create", None, name, lambda name=name: jellyfin.create_collection(name, ids))
            )

    state.library_cache.invalidate()
    return response

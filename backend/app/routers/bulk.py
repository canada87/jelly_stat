import asyncio
import logging

from fastapi import APIRouter, Request

from app.config import settings
from app.models import BulkEditRequest, BulkEditResult

logger = logging.getLogger("jelly_stat.bulk")

router = APIRouter(prefix="/api/movies", tags=["bulk"])


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


async def _edit_one(request: Request, item_id: str, body: BulkEditRequest, sem: asyncio.Semaphore) -> BulkEditResult:
    jellyfin = request.app.state.jellyfin
    async with sem:
        try:
            dto = await jellyfin.get_item_raw(item_id)
            dto = _apply_edits(dto, body)
            await jellyfin.update_item_raw(item_id, dto)
            return BulkEditResult(item_id=item_id, ok=True)
        except Exception as exc:  # noqa: BLE001 - surface per-item error to the caller
            logger.exception("bulk edit failed for item %s", item_id)
            return BulkEditResult(item_id=item_id, ok=False, error=str(exc))


@router.post("/bulk-edit", response_model=list[BulkEditResult])
async def bulk_edit(request: Request, body: BulkEditRequest) -> list[BulkEditResult]:
    sem = asyncio.Semaphore(settings.max_concurrent_updates)
    results = await asyncio.gather(
        *(_edit_one(request, item_id, body, sem) for item_id in body.item_ids)
    )
    request.app.state.movie_cache.invalidate()
    return list(results)

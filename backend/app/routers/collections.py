from fastapi import APIRouter, Request

from app.models import Collection
from app.routers.movies import get_library

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=list[Collection])
async def list_collections(request: Request, refresh: bool = False) -> list[Collection]:
    return (await get_library(request, force_refresh=refresh)).collections

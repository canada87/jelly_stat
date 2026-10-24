from fastapi import APIRouter, Request

from app import service
from app.models import Collection

router = APIRouter(prefix="/api/collections", tags=["collections"])


@router.get("", response_model=list[Collection])
async def list_collections(request: Request, refresh: bool = False) -> list[Collection]:
    return (await service.get_library(request.app.state, force_refresh=refresh)).collections

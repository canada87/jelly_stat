from fastapi import APIRouter, Request

from app import service
from app.models import BulkEditRequest, BulkEditResponse

router = APIRouter(prefix="/api/movies", tags=["bulk"])


@router.post("/bulk-edit", response_model=BulkEditResponse)
async def bulk_edit(request: Request, body: BulkEditRequest) -> BulkEditResponse:
    return await service.bulk_edit(request.app.state, body)

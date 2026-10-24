from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.filters import apply_filter
from app.models import FilterRequest, Library, Movie

router = APIRouter(prefix="/api/movies", tags=["movies"])


async def get_library(request: Request, force_refresh: bool = False) -> Library:
    cache = request.app.state.library_cache
    if not force_refresh:
        cached = cache.get()
        if cached is not None:
            return cached
    library = await request.app.state.jellyfin.get_library()
    cache.set(library)
    return library


async def _get_movies(request: Request, force_refresh: bool = False) -> list[Movie]:
    return (await get_library(request, force_refresh)).movies


@router.get("", response_model=list[Movie])
async def list_movies(request: Request, refresh: bool = False) -> list[Movie]:
    return await _get_movies(request, force_refresh=refresh)


@router.post("/filter", response_model=list[Movie])
async def filter_movies(request: Request, body: FilterRequest) -> list[Movie]:
    movies = await _get_movies(request, force_refresh=body.refresh)
    return apply_filter(body.filter, movies)


@router.get("/{item_id}/image")
async def get_movie_image(request: Request, item_id: str) -> Response:
    try:
        content, content_type = await request.app.state.jellyfin.get_primary_image(item_id)
    except RuntimeError:
        raise HTTPException(status_code=404, detail="Image not found")
    return Response(content=content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})

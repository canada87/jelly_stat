from fastapi import APIRouter, Request

from app.filters import apply_filter
from app.models import FilterRequest, Movie

router = APIRouter(prefix="/api/movies", tags=["movies"])


async def _get_movies(request: Request, force_refresh: bool = False) -> list[Movie]:
    cache = request.app.state.movie_cache
    if not force_refresh:
        cached = cache.get()
        if cached is not None:
            return cached
    movies = await request.app.state.jellyfin.get_movies()
    cache.set(movies)
    return movies


@router.get("", response_model=list[Movie])
async def list_movies(request: Request, refresh: bool = False) -> list[Movie]:
    return await _get_movies(request, force_refresh=refresh)


@router.post("/filter", response_model=list[Movie])
async def filter_movies(request: Request, body: FilterRequest) -> list[Movie]:
    movies = await _get_movies(request)
    return apply_filter(body.filter, movies)

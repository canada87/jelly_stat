from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.cache import MovieCache
from app.config import settings
from app.jellyfin_client import JellyfinClient
from app.routers import bulk, movies

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.jellyfin = JellyfinClient(settings.jellyfin_url, settings.jellyfin_api_key)
    app.state.movie_cache = MovieCache(settings.cache_ttl_seconds)
    yield
    await app.state.jellyfin.aclose()


app = FastAPI(title="jelly_stat", lifespan=lifespan)

# Only relevant when running the Vite dev server separately from the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(movies.router)
app.include_router(bulk.router)

if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

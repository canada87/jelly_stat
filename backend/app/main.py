import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import mcp_server
from app.cache import LibraryCache
from app.config import settings
from app.jellyfin_client import JellyfinClient
from app.routers import bulk, collections, movies

STATIC_DIR = Path(__file__).resolve().parent.parent / "static"

# Creating the app also creates the session manager that the lifespan below has to run.
mcp_app = mcp_server.mcp.streamable_http_app()


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.jellyfin = JellyfinClient(settings.jellyfin_url, settings.jellyfin_api_key)
    app.state.library_cache = LibraryCache(settings.cache_ttl_seconds)
    mcp_server.bind(app.state)
    try:
        async with mcp_server.mcp.session_manager.run():
            yield
    finally:
        await app.state.jellyfin.aclose()


app = FastAPI(title="jelly_stat", lifespan=lifespan)

# Only relevant when running the Vite dev server separately from the API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def require_mcp_token(request: Request, call_next):
    if settings.mcp_token and request.url.path.startswith("/mcp"):
        expected = f"Bearer {settings.mcp_token}"
        if not secrets.compare_digest(request.headers.get("authorization", ""), expected):
            return JSONResponse({"detail": "Missing or invalid MCP token"}, status_code=401)
    return await call_next(request)


app.include_router(movies.router)
app.include_router(bulk.router)
app.include_router(collections.router)
app.router.routes.extend(mcp_app.routes)

if STATIC_DIR.is_dir():
    app.mount("/", StaticFiles(directory=STATIC_DIR, html=True), name="static")

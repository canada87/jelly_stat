import time

from app.models import Movie


class MovieCache:
    def __init__(self, ttl_seconds: int):
        self._ttl = ttl_seconds
        self._movies: list[Movie] | None = None
        self._fetched_at: float = 0.0

    def get(self) -> list[Movie] | None:
        if self._movies is None:
            return None
        if time.monotonic() - self._fetched_at > self._ttl:
            return None
        return self._movies

    def set(self, movies: list[Movie]) -> None:
        self._movies = movies
        self._fetched_at = time.monotonic()

    def invalidate(self) -> None:
        self._movies = None

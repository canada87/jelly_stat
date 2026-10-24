import time

from app.models import Library


class LibraryCache:
    def __init__(self, ttl_seconds: int):
        self._ttl = ttl_seconds
        self._library: Library | None = None
        self._fetched_at: float = 0.0

    def get(self) -> Library | None:
        if self._library is None:
            return None
        if time.monotonic() - self._fetched_at > self._ttl:
            return None
        return self._library

    def set(self, library: Library) -> None:
        self._library = library
        self._fetched_at = time.monotonic()

    def invalidate(self) -> None:
        self._library = None

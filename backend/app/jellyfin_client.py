import asyncio
from typing import Any, Optional

import httpx

from app.models import Collection, CollectionRef, Library, Movie

# Collection endpoints take item ids in the query string; chunk them so the request line stays
# well under Kestrel's default 8 KB limit (a Jellyfin id is 32 chars).
_IDS_PER_REQUEST = 100
_MAX_CONCURRENT_READS = 8


def _chunks(ids: list[str]) -> list[list[str]]:
    return [ids[i : i + _IDS_PER_REQUEST] for i in range(0, len(ids), _IDS_PER_REQUEST)]


class JellyfinClient:
    def __init__(self, base_url: str, api_key: str):
        self._base_url = base_url.rstrip("/")
        self._client = httpx.AsyncClient(
            base_url=self._base_url,
            headers={"X-Emby-Token": api_key, "Accept": "application/json"},
            timeout=30.0,
        )
        self._admin_user_id: Optional[str] = None
        self._admin_user_lock = asyncio.Lock()

    async def aclose(self) -> None:
        await self._client.aclose()

    @staticmethod
    def _raise_for_status(resp: httpx.Response) -> None:
        if resp.is_success:
            return
        # Jellyfin puts the actual .NET exception message in the response body;
        # httpx's default raise_for_status() message discards it.
        raise RuntimeError(
            f"Jellyfin {resp.request.method} {resp.request.url} -> {resp.status_code}: {resp.text[:2000]}"
        )

    async def _get_admin_user_id(self) -> str:
        if self._admin_user_id is not None:
            return self._admin_user_id
        async with self._admin_user_lock:
            if self._admin_user_id is not None:
                return self._admin_user_id
            resp = await self._client.get("/Users")
            self._raise_for_status(resp)
            users = resp.json()
            if not users:
                raise RuntimeError("No Jellyfin users found for the configured API key")
            admin = next(
                (u for u in users if u.get("Policy", {}).get("IsAdministrator")),
                users[0],
            )
            self._admin_user_id = admin["Id"]
            return self._admin_user_id

    @staticmethod
    def _to_movie(raw: dict[str, Any]) -> Movie:
        return Movie(
            id=raw["Id"],
            name=raw.get("Name", ""),
            tags=raw.get("Tags", []) or [],
            official_rating=raw.get("OfficialRating"),
            date_created=raw.get("DateCreated"),
        )

    async def get_movies(self) -> list[Movie]:
        user_id = await self._get_admin_user_id()
        resp = await self._client.get(
            f"/Users/{user_id}/Items",
            params={
                "IncludeItemTypes": "Movie",
                "Recursive": "true",
                "Fields": "Tags,DateCreated,ProviderIds",
            },
        )
        self._raise_for_status(resp)
        data = resp.json()
        return [self._to_movie(item) for item in data.get("Items", [])]

    async def get_collections_raw(self) -> list[dict[str, Any]]:
        user_id = await self._get_admin_user_id()
        resp = await self._client.get(
            f"/Users/{user_id}/Items",
            params={"IncludeItemTypes": "BoxSet", "Recursive": "true"},
        )
        self._raise_for_status(resp)
        return resp.json().get("Items", [])

    async def get_collection_movie_ids(self, collection_id: str) -> list[str]:
        user_id = await self._get_admin_user_id()
        resp = await self._client.get(
            f"/Users/{user_id}/Items",
            params={"ParentId": collection_id, "IncludeItemTypes": "Movie"},
        )
        self._raise_for_status(resp)
        return [item["Id"] for item in resp.json().get("Items", [])]

    async def get_library(self) -> Library:
        movies = await self.get_movies()
        raw_collections = await self.get_collections_raw()

        sem = asyncio.Semaphore(_MAX_CONCURRENT_READS)

        async def members(collection_id: str) -> list[str]:
            async with sem:
                return await self.get_collection_movie_ids(collection_id)

        member_lists = await asyncio.gather(*(members(c["Id"]) for c in raw_collections))

        collections: list[Collection] = []
        by_movie: dict[str, list[CollectionRef]] = {}
        for raw, movie_ids in zip(raw_collections, member_lists):
            ref = CollectionRef(id=raw["Id"], name=raw.get("Name", ""))
            collections.append(Collection(id=ref.id, name=ref.name, movie_count=len(movie_ids)))
            for movie_id in movie_ids:
                by_movie.setdefault(movie_id, []).append(ref)
        for movie in movies:
            movie.collections = sorted(by_movie.get(movie.id, []), key=lambda c: c.name.lower())
        collections.sort(key=lambda c: c.name.lower())
        return Library(movies=movies, collections=collections)

    async def create_collection(self, name: str, item_ids: list[str]) -> str:
        chunks = _chunks(item_ids) or [[]]
        resp = await self._client.post("/Collections", params={"name": name, "ids": ",".join(chunks[0])})
        self._raise_for_status(resp)
        collection_id = resp.json()["Id"]
        for chunk in chunks[1:]:
            await self.add_to_collection(collection_id, chunk)
        return collection_id

    async def add_to_collection(self, collection_id: str, item_ids: list[str]) -> None:
        for chunk in _chunks(item_ids):
            resp = await self._client.post(f"/Collections/{collection_id}/Items", params={"ids": ",".join(chunk)})
            self._raise_for_status(resp)

    async def remove_from_collection(self, collection_id: str, item_ids: list[str]) -> None:
        for chunk in _chunks(item_ids):
            resp = await self._client.delete(f"/Collections/{collection_id}/Items", params={"ids": ",".join(chunk)})
            self._raise_for_status(resp)

    async def get_item_raw(self, item_id: str) -> dict[str, Any]:
        user_id = await self._get_admin_user_id()
        resp = await self._client.get(f"/Users/{user_id}/Items/{item_id}")
        self._raise_for_status(resp)
        return resp.json()

    async def get_primary_image(self, item_id: str, max_height: int = 300) -> tuple[bytes, str]:
        resp = await self._client.get(
            f"/Items/{item_id}/Images/Primary",
            params={"maxHeight": max_height, "quality": 90},
        )
        self._raise_for_status(resp)
        content_type = resp.headers.get("content-type", "image/jpeg")
        return resp.content, content_type

    async def update_item_raw(self, item_id: str, dto: dict[str, Any]) -> None:
        # UserData is per-user watch state that leaks in from the user-scoped GET;
        # Trickplay has a known server-side deserialization bug. Neither belongs in
        # an update payload, and both have been observed to make this endpoint 500.
        dto = {k: v for k, v in dto.items() if k not in ("UserData", "Trickplay")}
        resp = await self._client.post(f"/Items/{item_id}", json=dto)
        self._raise_for_status(resp)

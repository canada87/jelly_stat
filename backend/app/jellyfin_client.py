import asyncio
from typing import Any, Optional

import httpx

from app.models import Movie


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

    async def get_item_raw(self, item_id: str) -> dict[str, Any]:
        user_id = await self._get_admin_user_id()
        resp = await self._client.get(f"/Users/{user_id}/Items/{item_id}")
        self._raise_for_status(resp)
        return resp.json()

    async def update_item_raw(self, item_id: str, dto: dict[str, Any]) -> None:
        # UserData is per-user watch state that leaks in from the user-scoped GET;
        # Trickplay has a known server-side deserialization bug. Neither belongs in
        # an update payload, and both have been observed to make this endpoint 500.
        dto = {k: v for k, v in dto.items() if k not in ("UserData", "Trickplay")}
        resp = await self._client.post(f"/Items/{item_id}", json=dto)
        self._raise_for_status(resp)

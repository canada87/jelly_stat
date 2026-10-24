"""MCP server exposing the movie library to Claude: browse, filter, and bulk-edit tags,
parental rating and collection membership. Served over streamable HTTP at /mcp by the main app.
"""

from collections import Counter
from typing import Any, Optional

from mcp.server.fastmcp import FastMCP
from mcp.server.transport_security import TransportSecuritySettings
from mcp.types import ToolAnnotations

from app import service
from app.filters import apply_filter
from app.models import BulkEditRequest, Collection, FilterNode, Movie

INSTRUCTIONS = """\
Tools for a Jellyfin movie library: list movies, filter them, and bulk-edit tags, parental rating
and collection membership. Changes are written straight to Jellyfin.

Filters are a JSON tree, the same one the jelly_stat web UI builds:
- condition: {"kind": "condition", "field": F, "op": OP, "value": "..."}
  - field "name": op "include"/"exclude", case-insensitive substring of the title
  - field "tags": op "include"/"exclude", case-insensitive exact tag
  - field "officialRating": op "include"/"exclude", exact parental rating (e.g. "PG-13")
  - field "collection": op "include"/"exclude", case-insensitive exact collection name
  - field "dateCreated" (date added): op "before"/"after"/"on", value "YYYY-MM-DD"
- group: {"kind": "group", "operator": "AND" | "OR", "children": [conditions or groups]}

Typical flow: library_overview to learn the existing tags, ratings and collections; search_movies
to check what a filter matches; edit_movies with dry_run=true to preview, then without it to apply.
Prefer passing the same filter to edit_movies over copying long lists of ids.
"""

mcp = FastMCP(
    "jelly_stat",
    instructions=INSTRUCTIONS,
    stateless_http=True,
    json_response=True,
    streamable_http_path="/mcp",
    # The SDK turns on DNS-rebinding protection for localhost-only servers, which would reject
    # requests addressed to this host's LAN name or IP. This service is LAN-only by design.
    transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=False),
)

_state: Any = None


def bind(state: Any) -> None:
    """Give the tools access to the app's Jellyfin client and library cache."""
    global _state
    _state = state


def _movie_out(m: Movie) -> dict[str, Any]:
    return {
        "id": m.id,
        "name": m.name,
        "tags": m.tags,
        "official_rating": m.official_rating,
        "date_added": m.date_created.date().isoformat() if m.date_created else None,
        "collections": [c.name for c in m.collections],
    }


def _by_name(movies: list[Movie]) -> list[Movie]:
    return sorted(movies, key=lambda m: m.name.lower())


def _resolve_collections(names: list[str], collections: list[Collection]) -> list[Collection]:
    by_name: dict[str, list[Collection]] = {}
    for c in collections:
        by_name.setdefault(c.name.lower(), []).append(c)
    resolved, unknown, ambiguous = [], [], []
    for name in names:
        matches = by_name.get(name.strip().lower(), [])
        if not matches:
            unknown.append(name)
        elif len(matches) > 1:
            ambiguous.append(name)
        else:
            resolved.append(matches[0])
    if unknown:
        raise ValueError(
            f"Unknown collection(s): {', '.join(unknown)}. "
            "Use create_collections to make new ones, or library_overview to see existing names."
        )
    if ambiguous:
        raise ValueError(f"More than one collection is named: {', '.join(ambiguous)}.")
    return resolved


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
async def library_overview(refresh: bool = False) -> dict[str, Any]:
    """Summary of the library: movie count, and every tag, parental rating and collection in use
    with how many movies have it. Set refresh=true to bypass the 30-second cache."""
    library = await service.get_library(_state, force_refresh=refresh)
    tags = Counter(t for m in library.movies for t in m.tags)
    ratings = Counter(m.official_rating or "(none)" for m in library.movies)
    return {
        "movie_count": len(library.movies),
        "tags": dict(tags.most_common()),
        "official_ratings": dict(ratings.most_common()),
        "collections": {c.name: c.movie_count for c in library.collections},
    }


@mcp.tool(annotations=ToolAnnotations(readOnlyHint=True))
async def search_movies(
    filter: Optional[FilterNode] = None,
    limit: int = 100,
    offset: int = 0,
    refresh: bool = False,
) -> dict[str, Any]:
    """List movies matching a filter (see the server instructions for its format; omit it for
    every movie), sorted by name. Returns the total match count and one page of movies with
    id, name, tags, official_rating, date_added and collections."""
    library = await service.get_library(_state, force_refresh=refresh)
    matched = _by_name(apply_filter(filter, library.movies))
    page = matched[offset : offset + max(limit, 0)]
    return {
        "total": len(matched),
        "offset": offset,
        "returned": len(page),
        "movies": [_movie_out(m) for m in page],
    }


@mcp.tool(annotations=ToolAnnotations(destructiveHint=True))
async def edit_movies(
    item_ids: Optional[list[str]] = None,
    filter: Optional[FilterNode] = None,
    add_tags: Optional[list[str]] = None,
    remove_tags: Optional[list[str]] = None,
    set_official_rating: Optional[str] = None,
    clear_official_rating: bool = False,
    add_to_collections: Optional[list[str]] = None,
    create_collections: Optional[list[str]] = None,
    remove_from_collections: Optional[list[str]] = None,
    dry_run: bool = False,
) -> dict[str, Any]:
    """Bulk-edit movies in Jellyfin. Target them with either item_ids (from search_movies) or a
    filter, not both. Changes:
    - add_tags / remove_tags: tag names (removal is case-insensitive)
    - set_official_rating: new parental rating, or clear_official_rating=true to remove it
    - add_to_collections / remove_from_collections: names of existing collections
    - create_collections: names of new collections, created containing the targeted movies
    With dry_run=true nothing is written; the response shows which movies would change."""
    if (item_ids is None) == (filter is None):
        raise ValueError("Pass exactly one of item_ids or filter.")
    if set_official_rating is not None and clear_official_rating:
        raise ValueError("Pass set_official_rating or clear_official_rating, not both.")

    library = await service.get_library(_state)
    if item_ids is not None:
        by_id = {m.id: m for m in library.movies}
        missing = [i for i in item_ids if i not in by_id]
        if missing:
            raise ValueError(f"Unknown movie id(s): {', '.join(missing)}")
        targets = [by_id[i] for i in dict.fromkeys(item_ids)]
    else:
        targets = apply_filter(filter, library.movies)
    if not targets:
        raise ValueError("No movies match; nothing to edit.")

    to_add = _resolve_collections(add_to_collections or [], library.collections)
    to_remove = _resolve_collections(remove_from_collections or [], library.collections)
    new_names = [n.strip() for n in create_collections or [] if n.strip()]
    existing_names = {c.name.lower() for c in library.collections}
    clashing = [n for n in new_names if n.lower() in existing_names]
    if clashing:
        raise ValueError(f"Collection(s) already exist, use add_to_collections instead: {', '.join(clashing)}")

    change_rating = set_official_rating is not None or clear_official_rating
    changes = {
        "add_tags": add_tags or [],
        "remove_tags": remove_tags or [],
        "official_rating": (set_official_rating or None) if change_rating else "(unchanged)",
        "add_to_collections": [c.name for c in to_add],
        "create_collections": new_names,
        "remove_from_collections": [c.name for c in to_remove],
    }
    if not (add_tags or remove_tags or change_rating or to_add or to_remove or new_names):
        raise ValueError("No changes requested.")

    if dry_run:
        return {
            "dry_run": True,
            "movie_count": len(targets),
            "changes": changes,
            "movies": [_movie_out(m) for m in _by_name(targets)[:50]],
            "note": "Only the first 50 movies are listed." if len(targets) > 50 else None,
        }

    result = await service.bulk_edit(
        _state,
        BulkEditRequest(
            item_ids=[m.id for m in targets],
            add_tags=add_tags or [],
            remove_tags=remove_tags or [],
            official_rating=set_official_rating or "",
            change_rating=change_rating,
            add_to_collections=[c.id for c in to_add],
            new_collections=new_names,
            remove_from_collections=[c.id for c in to_remove],
        ),
    )
    names = {m.id: m.name for m in targets}
    collection_names = {c.id: c.name for c in library.collections}
    return {
        "dry_run": False,
        "movie_count": len(targets),
        "changes": changes,
        "metadata_failures": [
            {"id": r.item_id, "name": names.get(r.item_id), "error": r.error} for r in result.items if not r.ok
        ],
        "collection_results": [
            {
                "action": r.action,
                "collection": r.collection_name or collection_names.get(r.collection_id or "", r.collection_id),
                "ok": r.ok,
                "error": r.error,
            }
            for r in result.collections
        ],
    }

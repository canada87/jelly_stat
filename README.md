# jelly_stat

Standalone tool to browse Jellyfin movies (tags, parental rating, date added), filter them with
nested AND/OR + include/exclude conditions, and bulk-edit tags/parental rating. Talks to Jellyfin
over its REST API with an API key; stores nothing of its own — Jellyfin stays the single source of
truth.

## Requirements

- A Jellyfin API key: Jellyfin dashboard → Admin → API Keys → create one.
- Docker (recommended), or Python 3.12 + Node 20 for local dev.

## Run with Docker (recommended)

```bash
cp .env.example .env
# edit .env: set JELLYFIN_URL and JELLYFIN_API_KEY
docker compose up --build
```

Then open `http://<host>:8080`.

**Security note:** the service has no login of its own. Only expose it on your homelab's internal
network (or behind your own reverse proxy / VPN) — do not expose it to the internet.

## Local development

Backend:

```bash
cd backend
python -m venv .venv && source .venv/bin/activate  # or .venv\Scripts\activate on Windows
pip install -r requirements.txt
export JELLYFIN_URL=http://<your-jellyfin>:8096
export JELLYFIN_API_KEY=<your-api-key>
uvicorn app.main:app --reload --port 8080
```

Frontend (in a second terminal, proxies `/api` to the backend on port 8080):

```bash
cd frontend
npm install
npm run dev
```

Open the URL Vite prints (defaults to `http://localhost:5173`).

## Notes

- Movie list is cached in memory for `CACHE_TTL_SECONDS` (default 30s) to keep filtering snappy;
  use the "Refresh from Jellyfin" button to force a re-fetch. Bulk edits invalidate the cache
  automatically.
- There is no native bulk-update endpoint in Jellyfin: the backend reads each item's full metadata,
  applies the tag/rating change, and writes it back, with limited concurrency
  (`MAX_CONCURRENT_UPDATES`, default 5).
- Collections (Jellyfin BoxSets) can be filtered on, and the bulk-edit dialog can add the selected
  movies to existing collections, create new collections with them, or remove them from
  collections. Membership changes go through Jellyfin's `/Collections` endpoints, so they don't
  rewrite the movies' own metadata. Loading the library makes one extra request per collection to
  read its members.

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    jellyfin_url: str
    jellyfin_api_key: str
    port: int = 8080
    cache_ttl_seconds: int = 30
    max_concurrent_updates: int = 5
    # When set, MCP clients must send "Authorization: Bearer <token>".
    mcp_token: str | None = None


settings = Settings()

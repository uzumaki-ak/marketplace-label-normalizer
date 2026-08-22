from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "Marketplace Shipping Label Normalizer API"
    environment: Literal["development", "test", "production"] = "development"
    database_url: str = "postgresql+psycopg://labels:labels@postgres:5432/labels"
    valkey_url: str = "redis://valkey:6379/0"
    storage_provider: Literal["local", "imagekit"] = "local"
    local_storage_root: Path = Path("/var/lib/label-normalizer")
    max_file_bytes: int = Field(default=25 * 1024 * 1024, ge=1024)
    max_batch_documents: int = Field(default=20, ge=1, le=100)
    max_pdf_pages: int = Field(default=200, ge=1, le=1000)
    processing_timeout_seconds: int = Field(default=120, ge=10, le=900)
    temp_file_ttl_seconds: int = Field(default=3600, ge=60)
    worker_concurrency: int = Field(default=2, ge=1, le=16)
    imagekit_private_key: str = ""
    imagekit_public_key: str = ""
    imagekit_url_endpoint: str = ""
    ai_enabled: bool = False
    local_vision_enabled: bool = False
    gemini_api_key: str = ""
    openai_api_key: str = ""
    openai_model: str = "gpt-5.4"
    gemini_model: str = "gemini-3.6-flash"
    vision_max_image_bytes: int = Field(default=5 * 1024 * 1024, ge=1024)
    vision_auto_approve_confidence: float = Field(default=0.85, ge=0, le=1)

    @property
    def imagekit_enabled(self) -> bool:
        return bool(
            self.imagekit_private_key and self.imagekit_public_key and self.imagekit_url_endpoint
        )

    @property
    def database_provider(self) -> Literal["local_postgres", "neon"]:
        return "neon" if "neon.tech" in self.database_url.lower() else "local_postgres"

    @property
    def effective_storage_provider(self) -> Literal["local", "imagekit"]:
        if self.storage_provider == "imagekit" and self.imagekit_enabled:
            return "imagekit"
        return "local"

    @property
    def cloud_ai_enabled(self) -> bool:
        return self.ai_enabled and bool(self.gemini_api_key or self.openai_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()

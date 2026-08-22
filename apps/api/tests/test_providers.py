from pathlib import Path

from app.config import Settings
from app.providers.database import build_database_provider
from app.providers.storage import LocalTempStorage, build_storage


def test_neon_is_optional_configuration_not_a_boot_dependency():
    local = build_database_provider(Settings())
    hosted = build_database_provider(
        Settings(database_url="postgresql+psycopg://user:secret@example.neon.tech/db")
    )
    assert local.id == "local_postgres"
    assert hosted.id == "neon"


def test_missing_imagekit_keys_fall_back_to_local(tmp_path: Path):
    settings = Settings(
        storage_provider="imagekit",
        local_storage_root=tmp_path,
        imagekit_private_key="",
    )
    assert isinstance(build_storage(settings), LocalTempStorage)

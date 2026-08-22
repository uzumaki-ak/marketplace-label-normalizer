from dataclasses import dataclass

from ..config import Settings


@dataclass(frozen=True)
class DatabaseProvider:
    id: str
    connection_url: str


def build_database_provider(settings: Settings) -> DatabaseProvider:
    """Neon and local PostgreSQL share the SQLAlchemy contract; only configuration differs."""
    return DatabaseProvider(
        id=settings.database_provider,
        connection_url=settings.database_url,
    )

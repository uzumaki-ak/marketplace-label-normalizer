from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import Settings
from app.database import Base, get_session
from app.dependencies import get_queue, get_storage, settings_dependency
from app.main import app
from app.providers.storage import LocalTempStorage


class FakeQueue:
    id = "fake"

    def __init__(self):
        self.document_ids: list[str] = []

    def enqueue_document(self, document_id: str) -> str:
        self.document_ids.append(document_id)
        return "test-task"


@pytest.fixture
def client(tmp_path: Path):
    engine = create_engine(
        "sqlite+pysqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSession = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(engine)
    settings = Settings(
        environment="test",
        database_url="sqlite+pysqlite:///:memory:",
        local_storage_root=tmp_path,
        max_file_bytes=4096,
    )
    storage = LocalTempStorage(tmp_path)
    queue = FakeQueue()

    def session_override():
        with TestingSession() as session:
            yield session

    app.dependency_overrides[get_session] = session_override
    app.dependency_overrides[settings_dependency] = lambda: settings
    app.dependency_overrides[get_storage] = lambda: storage
    app.dependency_overrides[get_queue] = lambda: queue
    test_client = TestClient(app)
    yield test_client, queue, tmp_path
    test_client.close()
    app.dependency_overrides.clear()

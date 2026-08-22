from collections.abc import Generator

from .celery_app import celery_app
from .config import Settings, get_settings
from .providers.queue import CeleryTaskQueue, TaskQueue
from .providers.storage import StorageProvider, build_storage


def get_storage() -> Generator[StorageProvider]:
    yield build_storage(get_settings())


def get_queue() -> Generator[TaskQueue]:
    yield CeleryTaskQueue(celery_app)


def settings_dependency() -> Settings:
    return get_settings()

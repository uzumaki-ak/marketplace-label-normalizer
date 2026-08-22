from typing import Protocol

from celery import Celery


class TaskQueue(Protocol):
    id: str

    def enqueue_document(self, document_id: str) -> str: ...


class CeleryTaskQueue:
    id = "celery-valkey"

    def __init__(self, celery_app: Celery):
        self.celery_app = celery_app

    def enqueue_document(self, document_id: str) -> str:
        result = self.celery_app.send_task("documents.process", args=[document_id])
        return str(result.id)

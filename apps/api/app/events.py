from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .models import BatchRecord, ProcessingEventRecord
from .schemas import ProcessingEventOut


def append_event(
    session: Session,
    *,
    batch_id: str,
    stage: str,
    status: str,
    message: str,
    document_id: str | None = None,
    page_id: str | None = None,
    progress: float | None = None,
    metadata: dict[str, Any] | None = None,
) -> ProcessingEventRecord:
    session.execute(
        select(BatchRecord).where(BatchRecord.id == batch_id).with_for_update()
    ).scalar_one()
    sequence = (
        session.scalar(
            select(func.coalesce(func.max(ProcessingEventRecord.sequence), -1)).where(
                ProcessingEventRecord.batch_id == batch_id
            )
        )
        + 1
    )
    record = ProcessingEventRecord(
        batch_id=batch_id,
        document_id=document_id,
        page_id=page_id,
        sequence=sequence,
        stage=stage,
        status=status,
        progress=None if progress is None else max(0.0, min(1.0, progress)),
        message=message,
        event_metadata=metadata,
    )
    session.add(record)
    session.flush()
    return record


def serialize_event(record: ProcessingEventRecord) -> ProcessingEventOut:
    return ProcessingEventOut(
        id=f"{record.batch_id}:event:{record.sequence}",
        sequence=record.sequence,
        batchId=record.batch_id,
        documentId=record.document_id,
        pageId=record.page_id,
        stage=record.stage,
        status=record.status,
        progress=record.progress,
        message=record.message,
        timestamp=record.created_at,
        metadata=record.event_metadata,
    )

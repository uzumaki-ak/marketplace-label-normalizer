import re
from hashlib import sha256
from pathlib import Path

from fastapi import HTTPException, UploadFile, status

PDF_MAGIC = b"%PDF-"
SAFE_FILENAME = re.compile(r"[^A-Za-z0-9._-]+")


def sanitize_filename(filename: str | None) -> str:
    leaf = Path(filename or "document.pdf").name
    cleaned = SAFE_FILENAME.sub("_", leaf).strip("._")[:170]
    if not cleaned:
        cleaned = "document.pdf"
    if not cleaned.lower().endswith(".pdf"):
        cleaned += ".pdf"
    return cleaned


async def read_bounded_pdf(upload: UploadFile, max_bytes: int) -> tuple[bytes, str]:
    content = bytearray()
    while chunk := await upload.read(min(1024 * 1024, max_bytes + 1 - len(content))):
        content.extend(chunk)
        if len(content) > max_bytes:
            raise HTTPException(status.HTTP_413_CONTENT_TOO_LARGE, "PDF exceeds file limit")
    data = bytes(content)
    if not data.startswith(PDF_MAGIC):
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "File is not a PDF")
    if upload.content_type not in {None, "", "application/pdf", "application/octet-stream"}:
        raise HTTPException(status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, "Unexpected MIME type")
    return data, sha256(data).hexdigest()

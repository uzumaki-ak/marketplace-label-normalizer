from io import BytesIO

from pypdf import PdfReader


def inspect_pdf(data: bytes, max_pages: int) -> int:
    """Perform bounded structural inspection without extracting customer text."""
    reader = PdfReader(BytesIO(data), strict=False)
    if reader.is_encrypted:
        raise ValueError("encrypted_pdf")
    page_count = len(reader.pages)
    if page_count < 1:
        raise ValueError("empty_pdf")
    if page_count > max_pages:
        raise ValueError("page_limit_exceeded")
    for page in reader.pages:
        # Resolve geometry to catch malformed page objects; never execute embedded actions.
        _ = page.mediabox.width
        _ = page.mediabox.height
    return page_count

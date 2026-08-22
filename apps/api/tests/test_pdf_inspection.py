from io import BytesIO

import pytest
from pypdf import PdfWriter
from pypdf.errors import PdfReadError

from app.pdf_inspection import inspect_pdf


def build_pdf(page_count: int) -> bytes:
    writer = PdfWriter()
    for _ in range(page_count):
        writer.add_blank_page(width=100, height=150)
    output = BytesIO()
    writer.write(output)
    return output.getvalue()


def test_inspection_enforces_page_limit_without_extracting_text():
    assert inspect_pdf(build_pdf(2), max_pages=2) == 2
    with pytest.raises(ValueError, match="page_limit_exceeded"):
        inspect_pdf(build_pdf(3), max_pages=2)


def test_malformed_pdf_failure_is_isolated_as_an_exception():
    with pytest.raises(PdfReadError):
        inspect_pdf(b"%PDF-not-valid", max_pages=20)

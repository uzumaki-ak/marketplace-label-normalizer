from io import BytesIO

from pypdf import PdfWriter


def minimal_pdf() -> bytes:
    output = BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=150)
    writer.write(output)
    return output.getvalue()


def test_optional_providers_are_disabled_without_keys(client):
    test_client, _, _ = client
    response = test_client.get("/health/ready")
    assert response.status_code == 200
    assert response.json() == {
        "database": "local_postgres",
        "storage": "local",
        "queue": "celery-valkey",
        "imagekit_enabled": False,
        "ai_enabled": False,
        "vision_providers": [],
    }


def test_upload_is_sanitized_private_bounded_and_queued(client):
    test_client, queue, storage_root = client
    batch = test_client.post("/api/v1/batches").json()
    response = test_client.post(
        f"/api/v1/batches/{batch['id']}/documents",
        files={"file": ("../../Customer Address (1).pdf", minimal_pdf(), "application/pdf")},
    )
    assert response.status_code == 202
    document = response.json()
    assert document["safe_name"] == "Customer_Address_1_.pdf"
    assert queue.document_ids == [document["id"]]
    stored = list((storage_root / "objects").glob("*.pdf"))
    assert len(stored) == 1
    assert "Customer" not in stored[0].name

    events = test_client.get(f"/api/v1/batches/{batch['id']}/events").json()
    assert [event["stage"] for event in events] == ["ingest", "ingest"]
    assert all(event["batchId"] == batch["id"] for event in events)
    assert "Address" not in str(events)


def test_invalid_document_does_not_remove_existing_batch(client):
    test_client, _, _ = client
    batch = test_client.post("/api/v1/batches").json()
    response = test_client.post(
        f"/api/v1/batches/{batch['id']}/documents",
        files={"file": ("bad.pdf", b"not a pdf", "application/pdf")},
    )
    assert response.status_code == 415
    assert test_client.get(f"/api/v1/batches/{batch['id']}").status_code == 200


def test_file_limit_is_enforced(client):
    test_client, _, _ = client
    batch = test_client.post("/api/v1/batches").json()
    oversized = b"%PDF-" + b"x" * 5000
    response = test_client.post(
        f"/api/v1/batches/{batch['id']}/documents",
        files={"file": ("too-large.pdf", oversized, "application/pdf")},
    )
    assert response.status_code == 413

import json

import cv2
import httpx
import numpy as np

from app.config import Settings
from app.vision import (
    DeterministicValidationSnapshot,
    GeminiProvider,
    LocalVisionProvider,
    OpenAIProvider,
    VisionCrop,
    VisionFallbackCoordinator,
    VisionFallbackInput,
    VisionFallbackResult,
    build_vision_providers,
)


def validation(*, confidence: float, decoded: bool = True, clipping: bool = False):
    return DeterministicValidationSnapshot(
        confidence=confidence,
        output_dimensions_valid=True,
        machine_readable_decoded=decoded,
        clipping_risk=clipping,
        marketplace_anchors=True,
        layout_fingerprint_match=True,
    )


def input_image(data: bytes = b"small") -> VisionFallbackInput:
    return VisionFallbackInput(
        image_bytes=data,
        mime_type="image/png",
        pixel_width=100,
        pixel_height=150,
        marketplace_hint="generic",
    )


class CountingProvider:
    id = "fake/vision/v1"

    def __init__(self):
        self.calls = 0

    def analyze(self, input_data):
        self.calls += 1
        return VisionFallbackResult(
            provider_id=self.id,
            crop=VisionCrop(x=0.05, y=0.05, width=0.9, height=0.9),
            rotation=0,
            model_confidence=0.99,
            evidence_codes=["model_claim"],
        )


def test_deterministic_success_never_calls_ai():
    provider = CountingProvider()
    coordinator = VisionFallbackCoordinator([provider])
    decision = coordinator.run(input_image(), validation(confidence=0.95), lambda *_: None)
    assert decision.disposition == "deterministic"
    assert provider.calls == 0


def test_model_confidence_cannot_override_failed_barcode_validation():
    provider = CountingProvider()
    coordinator = VisionFallbackCoordinator([provider])
    decision = coordinator.run(
        input_image(),
        validation(confidence=0.3, decoded=False),
        lambda *_: validation(confidence=0.99, decoded=False),
    )
    assert decision.disposition == "review"
    assert decision.attempts[0].status == "rejected"
    assert provider.calls == 1


def test_ai_proposal_is_accepted_only_after_deterministic_revalidation():
    provider = CountingProvider()
    coordinator = VisionFallbackCoordinator([provider])
    decision = coordinator.run(
        input_image(),
        validation(confidence=0.2, decoded=False),
        lambda *_: validation(confidence=0.94, decoded=True),
    )
    assert decision.disposition == "accepted"
    assert decision.selected is not None
    assert decision.attempts[0].reason == "deterministic_post_validation_passed"


def test_missing_cloud_keys_disable_providers_even_when_ai_flag_is_true():
    settings = Settings(ai_enabled=True, local_vision_enabled=False)
    assert build_vision_providers(settings) == []
    assert settings.cloud_ai_enabled is False


def test_provider_order_is_local_then_optional_cloud():
    settings = Settings(
        ai_enabled=True,
        local_vision_enabled=True,
        gemini_api_key="gemini-test",
        openai_api_key="openai-test",
    )
    assert [provider.id for provider in build_vision_providers(settings)] == [
        "local-vision/opencv-content-bounds/v1",
        "gemini/interactions-vision/v1",
        "openai/responses-vision/v1",
    ]


def test_local_vision_finds_padded_meaningful_content_bounds():
    image = np.full((150, 100), 255, dtype=np.uint8)
    cv2.rectangle(image, (10, 20), (90, 120), color=0, thickness=2)
    encoded = cv2.imencode(".png", image)[1].tobytes()
    result = LocalVisionProvider().analyze(input_image(encoded))
    assert result.crop.x < 0.1
    assert result.crop.y < 20 / 150
    assert result.crop.x + result.crop.width > 0.9
    assert result.crop.y + result.crop.height > 120 / 150


def test_openai_uses_responses_image_input_schema_and_disables_storage():
    captured = {}

    def handler(request: httpx.Request):
        captured.update(json.loads(request.content))
        return httpx.Response(
            200,
            json={
                "output": [
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": json.dumps(model_payload()),
                            }
                        ],
                    }
                ]
            },
        )

    provider = OpenAIProvider(
        "test-key",
        "gpt-5.4",
        httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = provider.analyze(input_image(b"minimum-region-only"))
    assert result.provider_id == provider.id
    assert captured["store"] is False
    assert captured["text"]["format"]["type"] == "json_schema"
    image_url = captured["input"][0]["content"][1]["image_url"]
    assert image_url.startswith("data:image/png;base64,")
    assert "%PDF" not in image_url


def test_gemini_uses_inline_image_and_structured_interactions_output():
    captured = {}

    def handler(request: httpx.Request):
        captured.update(json.loads(request.content))
        return httpx.Response(200, json={"output_text": json.dumps(model_payload())})

    provider = GeminiProvider(
        "test-key",
        "gemini-3.6-flash",
        httpx.Client(transport=httpx.MockTransport(handler)),
    )
    result = provider.analyze(input_image(b"minimum-region-only"))
    assert result.provider_id == provider.id
    assert captured["input"][1]["type"] == "image"
    assert captured["response_format"]["mime_type"] == "application/json"
    assert "%PDF" not in captured["input"][1]["data"]


def model_payload():
    return {
        "crop": {"x": 0.05, "y": 0.05, "width": 0.9, "height": 0.9},
        "rotation": 0,
        "model_confidence": 0.97,
        "evidence_codes": ["label_border"],
    }

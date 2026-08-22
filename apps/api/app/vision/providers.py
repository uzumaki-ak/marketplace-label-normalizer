import base64
import json
from typing import Any

import httpx

from ..config import Settings
from .types import VisionCrop, VisionFallbackInput, VisionFallbackProvider, VisionFallbackResult


class VisionProviderFailure(RuntimeError):
    pass


CROP_SCHEMA: dict[str, Any] = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "crop": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "x": {"type": "number", "minimum": 0, "maximum": 1},
                "y": {"type": "number", "minimum": 0, "maximum": 1},
                "width": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
                "height": {"type": "number", "exclusiveMinimum": 0, "maximum": 1},
            },
            "required": ["x", "y", "width", "height"],
        },
        "rotation": {"type": "integer", "enum": [0, 90, 180, 270]},
        "model_confidence": {"type": "number", "minimum": 0, "maximum": 1},
        "evidence_codes": {
            "type": "array",
            "items": {"type": "string"},
            "maxItems": 12,
        },
    },
    "required": ["crop", "rotation", "model_confidence", "evidence_codes"],
}

VISION_INSTRUCTION = (
    "Find the single package shipping-label content region. Exclude seller-only invoices and blank "
    "outer whitespace. Preserve every barcode, QR code, address block, border, and package label "
    "field. Coordinates are normalized top-left x/y/width/height in 0..1. Return only the schema."
)


class LocalVisionProvider:
    id = "local-vision/opencv-content-bounds/v1"

    def analyze(self, input_data: VisionFallbackInput) -> VisionFallbackResult:
        import cv2
        import numpy as np

        image = cv2.imdecode(
            np.frombuffer(input_data.image_bytes, dtype=np.uint8), cv2.IMREAD_GRAYSCALE
        )
        if image is None:
            raise VisionProviderFailure("local_vision_decode_failed")
        height, width = image.shape
        mask = cv2.threshold(image, 245, 255, cv2.THRESH_BINARY_INV)[1]
        count, _, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)
        components = [
            stat
            for stat in stats[1:count]
            if int(stat[cv2.CC_STAT_AREA]) >= max(12, int(width * height * 0.000_02))
        ]
        if not components:
            raise VisionProviderFailure("local_vision_no_content")
        left = min(int(stat[cv2.CC_STAT_LEFT]) for stat in components)
        top = min(int(stat[cv2.CC_STAT_TOP]) for stat in components)
        right = max(int(stat[cv2.CC_STAT_LEFT] + stat[cv2.CC_STAT_WIDTH]) for stat in components)
        bottom = max(int(stat[cv2.CC_STAT_TOP] + stat[cv2.CC_STAT_HEIGHT]) for stat in components)
        padding = max(3, round(min(width, height) * 0.015))
        left = max(0, left - padding)
        top = max(0, top - padding)
        right = min(width, right + padding)
        bottom = min(height, bottom + padding)
        coverage = ((right - left) * (bottom - top)) / (width * height)
        if coverage < 0.08:
            raise VisionProviderFailure("local_vision_content_too_small")
        return VisionFallbackResult(
            provider_id=self.id,
            crop=VisionCrop(
                x=left / width,
                y=top / height,
                width=(right - left) / width,
                height=(bottom - top) / height,
            ),
            rotation=0,
            model_confidence=min(0.92, 0.62 + coverage * 0.3),
            evidence_codes=["meaningful_content_bounds", "noise_filtered", "safety_padding"],
        )


class OpenAIProvider:
    id = "openai/responses-vision/v1"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=30.0)

    def analyze(self, input_data: VisionFallbackInput) -> VisionFallbackResult:
        encoded = base64.b64encode(input_data.image_bytes).decode("ascii")
        try:
            response = self.client.post(
                "https://api.openai.com/v1/responses",
                headers={"Authorization": f"Bearer {self.api_key}"},
                json={
                    "model": self.model,
                    "store": False,
                    "max_output_tokens": 350,
                    "instructions": VISION_INSTRUCTION,
                    "input": [
                        {
                            "role": "user",
                            "content": [
                                {
                                    "type": "input_text",
                                    "text": f"Marketplace hint: {input_data.marketplace_hint}.",
                                },
                                {
                                    "type": "input_image",
                                    "detail": "high",
                                    "image_url": f"data:{input_data.mime_type};base64,{encoded}",
                                },
                            ],
                        }
                    ],
                    "text": {
                        "format": {
                            "type": "json_schema",
                            "name": "shipping_label_crop",
                            "strict": True,
                            "schema": CROP_SCHEMA,
                        }
                    },
                },
            )
            response.raise_for_status()
            text = _openai_output_text(response.json())
            return _parse_result(self.id, text)
        except Exception as error:
            raise VisionProviderFailure("openai_vision_request_failed") from error


class GeminiProvider:
    id = "gemini/interactions-vision/v1"

    def __init__(self, api_key: str, model: str, client: httpx.Client | None = None):
        self.api_key = api_key
        self.model = model
        self.client = client or httpx.Client(timeout=30.0)

    def analyze(self, input_data: VisionFallbackInput) -> VisionFallbackResult:
        encoded = base64.b64encode(input_data.image_bytes).decode("ascii")
        try:
            response = self.client.post(
                "https://generativelanguage.googleapis.com/v1beta/interactions",
                headers={"x-goog-api-key": self.api_key},
                json={
                    "model": self.model,
                    "input": [
                        {
                            "type": "text",
                            "text": (
                                f"{VISION_INSTRUCTION} Marketplace hint: "
                                f"{input_data.marketplace_hint}."
                            ),
                        },
                        {
                            "type": "image",
                            "data": encoded,
                            "mime_type": input_data.mime_type,
                        },
                    ],
                    "response_format": {
                        "type": "text",
                        "mime_type": "application/json",
                        "schema": CROP_SCHEMA,
                    },
                    "generation_config": {"thinking_level": "minimal"},
                },
            )
            response.raise_for_status()
            payload = response.json()
            text = payload.get("output_text")
            if not isinstance(text, str):
                raise ValueError("missing_output_text")
            return _parse_result(self.id, text)
        except Exception as error:
            raise VisionProviderFailure("gemini_vision_request_failed") from error


def build_vision_providers(settings: Settings) -> list[VisionFallbackProvider]:
    providers: list[VisionFallbackProvider] = []
    if settings.local_vision_enabled:
        providers.append(LocalVisionProvider())
    if settings.ai_enabled and settings.gemini_api_key:
        providers.append(GeminiProvider(settings.gemini_api_key, settings.gemini_model))
    if settings.ai_enabled and settings.openai_api_key:
        providers.append(OpenAIProvider(settings.openai_api_key, settings.openai_model))
    return providers


def _parse_result(provider_id: str, text: str) -> VisionFallbackResult:
    payload = json.loads(text)
    payload["provider_id"] = provider_id
    return VisionFallbackResult.model_validate(payload)


def _openai_output_text(payload: dict[str, Any]) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue
        for content in item.get("content", []):
            if content.get("type") == "output_text" and isinstance(content.get("text"), str):
                return content["text"]
    raise ValueError("missing_output_text")

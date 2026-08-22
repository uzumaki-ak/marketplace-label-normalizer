from collections.abc import Callable
from typing import Literal, Protocol

from pydantic import BaseModel, ConfigDict, Field, model_validator


class VisionCrop(BaseModel):
    """Top-left-origin normalized coordinates in the range 0..1."""

    model_config = ConfigDict(extra="forbid")

    x: float = Field(ge=0, le=1)
    y: float = Field(ge=0, le=1)
    width: float = Field(gt=0, le=1)
    height: float = Field(gt=0, le=1)

    @model_validator(mode="after")
    def inside_page(self):
        if self.x + self.width > 1.000_001 or self.y + self.height > 1.000_001:
            raise ValueError("crop_outside_page")
        return self


class VisionFallbackInput(BaseModel):
    model_config = ConfigDict(arbitrary_types_allowed=True, extra="forbid")

    image_bytes: bytes
    mime_type: Literal["image/png", "image/jpeg", "image/webp"]
    pixel_width: int = Field(gt=0, le=10_000)
    pixel_height: int = Field(gt=0, le=10_000)
    marketplace_hint: Literal["flipkart", "amazon", "meesho", "generic"] = "generic"


class VisionFallbackResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    provider_id: str
    crop: VisionCrop
    rotation: Literal[0, 90, 180, 270] = 0
    model_confidence: float = Field(ge=0, le=1)
    evidence_codes: list[str] = Field(default_factory=list, max_length=12)


class DeterministicValidationSnapshot(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confidence: float = Field(ge=0, le=1)
    output_dimensions_valid: bool
    machine_readable_decoded: bool
    clipping_risk: bool
    marketplace_anchors: bool
    layout_fingerprint_match: bool

    @property
    def mandatory_checks_pass(self) -> bool:
        return (
            self.output_dimensions_valid
            and self.machine_readable_decoded
            and not self.clipping_risk
        )


class FallbackAttempt(BaseModel):
    provider_id: str
    status: Literal["accepted", "rejected", "failed"]
    reason: str
    post_validation: DeterministicValidationSnapshot | None = None


class FallbackDecision(BaseModel):
    disposition: Literal["deterministic", "accepted", "review"]
    selected: VisionFallbackResult | None = None
    attempts: list[FallbackAttempt] = Field(default_factory=list)


class VisionFallbackProvider(Protocol):
    id: str

    def analyze(self, input_data: VisionFallbackInput) -> VisionFallbackResult: ...


PostVisionValidator = Callable[
    [VisionFallbackResult, VisionFallbackInput], DeterministicValidationSnapshot
]

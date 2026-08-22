from .providers import VisionProviderFailure
from .types import (
    DeterministicValidationSnapshot,
    FallbackAttempt,
    FallbackDecision,
    PostVisionValidator,
    VisionFallbackInput,
    VisionFallbackProvider,
)


class VisionFallbackCoordinator:
    def __init__(
        self,
        providers: list[VisionFallbackProvider],
        *,
        deterministic_confidence_threshold: float = 0.85,
        max_image_bytes: int = 5 * 1024 * 1024,
    ):
        self.providers = providers
        self.deterministic_confidence_threshold = deterministic_confidence_threshold
        self.max_image_bytes = max_image_bytes

    def run(
        self,
        input_data: VisionFallbackInput,
        initial_validation: DeterministicValidationSnapshot,
        post_vision_validator: PostVisionValidator,
    ) -> FallbackDecision:
        if self._approved(initial_validation):
            return FallbackDecision(disposition="deterministic")
        if len(input_data.image_bytes) > self.max_image_bytes:
            return FallbackDecision(
                disposition="review",
                attempts=[
                    FallbackAttempt(
                        provider_id="coordinator",
                        status="failed",
                        reason="minimal_image_exceeds_limit",
                    )
                ],
            )

        attempts: list[FallbackAttempt] = []
        for provider in self.providers:
            try:
                proposal = provider.analyze(input_data)
                validation = post_vision_validator(proposal, input_data)
            except VisionProviderFailure as error:
                attempts.append(
                    FallbackAttempt(
                        provider_id=provider.id,
                        status="failed",
                        reason=str(error),
                    )
                )
                continue
            except Exception:
                attempts.append(
                    FallbackAttempt(
                        provider_id=provider.id,
                        status="failed",
                        reason="deterministic_post_validation_failed",
                    )
                )
                continue

            if self._approved(validation):
                attempts.append(
                    FallbackAttempt(
                        provider_id=provider.id,
                        status="accepted",
                        reason="deterministic_post_validation_passed",
                        post_validation=validation,
                    )
                )
                return FallbackDecision(
                    disposition="accepted",
                    selected=proposal,
                    attempts=attempts,
                )
            attempts.append(
                FallbackAttempt(
                    provider_id=provider.id,
                    status="rejected",
                    reason="deterministic_post_validation_rejected",
                    post_validation=validation,
                )
            )
        return FallbackDecision(disposition="review", attempts=attempts)

    def _approved(self, validation: DeterministicValidationSnapshot) -> bool:
        return (
            validation.mandatory_checks_pass
            and validation.confidence >= self.deterministic_confidence_threshold
        )

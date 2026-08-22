import type {
  DetectionResult,
  PageClassification,
  PdfDocumentAnalysis,
  PdfPageAnalysis,
  RegionDetection,
} from "../../../types";
import type {
  MarketplaceAdapter,
  PageContext,
  ValidationContext,
} from "../../../adapter";
import type { NormalizationContext } from "../../../adapter";
import { normalizePdfRegionNative } from "../../../pdf-native";
import {
  MARKETPLACE_VALIDATION_POLICIES,
  validateWithEvidence,
} from "../../../confidence";

export class GenericAdapter implements MarketplaceAdapter<
  PdfDocumentAnalysis,
  PdfPageAnalysis
> {
  readonly id = "generic";
  readonly version = "1.0.0";

  async detectDocument(): Promise<DetectionResult> {
    return {
      marketplace: "unknown",
      confidence: 0,
      evidence: [],
      adapterId: this.id,
      adapterVersion: this.version,
    };
  }

  async classifyPage(): Promise<PageClassification> {
    return {
      marketplace: "unknown",
      pageKind: "unknown",
      confidence: 0,
      evidence: [],
    };
  }

  async findPrintableRegions(
    context: PageContext<PdfDocumentAnalysis, PdfPageAnalysis>,
  ): Promise<readonly RegionDetection[]> {
    return [
      {
        id: `${context.pageId}:region:0`,
        documentId: context.documentContext.documentId,
        pageId: context.pageId,
        regionIndex: 0,
        boundsPt: context.page.geometry.mediaBox,
        confidence: 0.2,
        evidence: [
          {
            code: "generic.full_page_review",
            message:
              "No marketplace rule matched; the full page is retained for manual review.",
            source: "geometry",
            weight: 0.2,
          },
        ],
        requiresReview: true,
      },
    ];
  }

  normalizeRegion(
    context: NormalizationContext<PdfDocumentAnalysis, PdfPageAnalysis>,
  ) {
    return normalizePdfRegionNative(context, {
      marketplace: "unknown",
      adapterId: this.id,
      adapterVersion: this.version,
    });
  }

  async validate(context: ValidationContext) {
    return validateWithEvidence(
      context,
      MARKETPLACE_VALIDATION_POLICIES.unknown,
    );
  }
}

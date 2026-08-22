import type {
  DetectionResult,
  Evidence,
  PageClassification,
  PdfDocumentAnalysis,
  PdfPageAnalysis,
  PdfTextItem,
  RegionDetection,
} from "../../../types";
import type {
  DocumentContext,
  MarketplaceAdapter,
  NormalizationContext,
  PageContext,
  ValidationContext,
} from "../../../adapter";
import { normalizePdfRegionNative } from "../../../pdf-native";
import {
  MARKETPLACE_VALIDATION_POLICIES,
  validateWithEvidence,
} from "../../../confidence";
import {
  clampConfidence,
  clampRect,
  findTextItem,
  pageContains,
} from "../../shared";

export const FLIPKART_LAYOUT_V1 = "flipkart/a4-ekart-tax-invoice/v1";

const DOCUMENT_SIGNALS = [
  ["e-kart", 0.35],
  ["ordered through", 0.1],
  ["awb no", 0.15],
  ["shipping/customer address", 0.15],
  ["sku id", 0.1],
  ["not for resale", 0.1],
  ["tax invoice", 0.05],
] as const;

export class FlipkartAdapter implements MarketplaceAdapter<
  PdfDocumentAnalysis,
  PdfPageAnalysis
> {
  readonly id = "flipkart";
  readonly version = "1.0.0";

  async detectDocument(
    context: DocumentContext<PdfDocumentAnalysis>,
  ): Promise<DetectionResult> {
    const matched = DOCUMENT_SIGNALS.filter(([anchor]) =>
      context.document.pages.some((page) => pageContains(page, anchor)),
    );
    const hasPrimaryAnchor = matched.some(([anchor]) => anchor === "e-kart");
    const confidence = hasPrimaryAnchor
      ? clampConfidence(
          matched.reduce((total, [, weight]) => total + weight, 0),
        )
      : 0;
    const representativePage = context.document.pages.find((page) =>
      pageContains(page, "e-kart"),
    );
    const layoutFingerprint = representativePage
      ? detectLayoutFingerprint(representativePage)
      : undefined;

    return {
      marketplace: confidence >= 0.6 ? "flipkart" : "unknown",
      confidence,
      evidence: matched.map(([anchor, weight]) =>
        anchorEvidence(anchor, weight),
      ),
      adapterId: this.id,
      adapterVersion: this.version,
      ...(layoutFingerprint ? { layoutFingerprint } : {}),
    };
  }

  async classifyPage(
    context: PageContext<PdfDocumentAnalysis, PdfPageAnalysis>,
  ): Promise<PageClassification> {
    const page = context.page;
    const hasEkart = pageContains(page, "e-kart");
    const hasAwb = pageContains(page, "awb no");
    const hasAddress = pageContains(page, "shipping/customer address");
    const hasInvoice = pageContains(page, "tax invoice");
    const hasNotForResale = pageContains(page, "not for resale");
    const evidence = [
      ...(hasEkart ? [anchorEvidence("e-kart", 0.3)] : []),
      ...(hasAwb ? [anchorEvidence("awb no", 0.2)] : []),
      ...(hasAddress ? [anchorEvidence("shipping/customer address", 0.2)] : []),
      ...(hasNotForResale ? [anchorEvidence("not for resale", 0.15)] : []),
      ...(hasInvoice ? [anchorEvidence("tax invoice", 0.15)] : []),
    ];
    const confidence = evidence.reduce(
      (total, item) => total + (item.weight ?? 0),
      0,
    );
    const layoutFingerprint = detectLayoutFingerprint(page);

    if (hasEkart && hasAwb && hasAddress) {
      return {
        marketplace: "flipkart",
        pageKind: hasInvoice ? "shipping_plus_invoice" : "shipping_label",
        confidence: clampConfidence(confidence),
        evidence,
        ...(layoutFingerprint ? { layoutFingerprint } : {}),
      };
    }

    return {
      marketplace: hasEkart ? "flipkart" : "unknown",
      pageKind: hasInvoice && hasEkart ? "shipping_plus_invoice" : "unknown",
      confidence: clampConfidence(confidence),
      evidence,
    };
  }

  async findPrintableRegions(
    context: PageContext<PdfDocumentAnalysis, PdfPageAnalysis>,
  ): Promise<readonly RegionDetection[]> {
    const page = context.page;
    const ekart = findTextItem(page, "e-kart");
    const invoice = findTextItem(page, "tax invoice");
    const notForResale = findTextItem(page, "not for resale");
    const orderedThrough = highestAnchor(page, "ordered through");
    const layoutFingerprint = detectLayoutFingerprint(page);
    if (
      !ekart?.boundsPt ||
      !invoice?.boundsPt ||
      !notForResale?.boundsPt ||
      !orderedThrough?.boundsPt
    ) {
      return [
        {
          id: `${context.pageId}:region:0`,
          documentId: context.documentContext.documentId,
          pageId: context.pageId,
          regionIndex: 0,
          boundsPt: page.geometry.mediaBox,
          confidence: 0.4,
          evidence: [
            {
              code: "flipkart.crop.required_anchor_missing",
              message:
                "A required shipping/invoice boundary anchor was unavailable.",
              source: "geometry",
              weight: 0.4,
            },
          ],
          requiresReview: true,
        },
      ];
    }

    const ekartBounds = ekart.boundsPt;
    const invoiceBounds = invoice.boundsPt;
    const notForResaleBounds = notForResale.boundsPt;
    const orderedBounds = orderedThrough.boundsPt;

    const invoiceTop = invoiceBounds.y + invoiceBounds.height;
    const dividerGapMidpoint = (invoiceTop + notForResaleBounds.y) / 2;
    const enclosureLeft = orderedBounds.x - 2.25;
    const enclosureTop = ekartBounds.y + ekartBounds.height + 3;
    const safetyMargin = 1.25;
    const crop = clampRect(
      {
        x: enclosureLeft - safetyMargin,
        y: dividerGapMidpoint - safetyMargin,
        width: 214.5 + safetyMargin * 2,
        height: enclosureTop - dividerGapMidpoint + safetyMargin * 2,
      },
      page.geometry.mediaBox,
    );
    const fingerprintMatched = layoutFingerprint === FLIPKART_LAYOUT_V1;
    const confidence = fingerprintMatched ? 0.99 : 0.84;
    const evidence: Evidence[] = [
      anchorEvidence("e-kart", 0.2),
      anchorEvidence("tax invoice", 0.2),
      anchorEvidence("not for resale", 0.2),
      {
        code: "flipkart.crop.invoice_gap",
        message:
          "The lower boundary was placed inside the measured gap between the shipping footer and Tax Invoice.",
        source: "geometry",
        weight: 0.2,
      },
      ...(fingerprintMatched
        ? [
            {
              code: "flipkart.layout.v1",
              message:
                "Anchor geometry matches the confirmed A4 E-Kart layout.",
              source: "layout_fingerprint" as const,
              weight: 0.19,
            },
          ]
        : []),
    ];

    return [
      {
        id: `${context.pageId}:region:0`,
        documentId: context.documentContext.documentId,
        pageId: context.pageId,
        regionIndex: 0,
        boundsPt: crop,
        confidence,
        evidence,
        ...(layoutFingerprint ? { layoutFingerprint } : {}),
        requiresReview: !fingerprintMatched,
      },
    ];
  }

  normalizeRegion(
    context: NormalizationContext<PdfDocumentAnalysis, PdfPageAnalysis>,
  ) {
    return normalizePdfRegionNative(context, {
      marketplace: "flipkart",
      adapterId: this.id,
      adapterVersion: this.version,
    });
  }

  async validate(context: ValidationContext) {
    return validateWithEvidence(
      context,
      MARKETPLACE_VALIDATION_POLICIES.flipkart,
    );
  }
}

function anchorEvidence(anchor: string, weight: number): Evidence {
  return {
    code: `flipkart.anchor.${anchor.replaceAll(/[^a-z0-9]+/g, "_")}`,
    message: `Found expected Flipkart anchor: ${anchor}.`,
    source: "text_anchor",
    weight,
  };
}

function highestAnchor(
  page: PdfPageAnalysis,
  anchor: string,
): PdfTextItem | undefined {
  return page.textItems
    .filter((item) =>
      item.text.toLowerCase().replaceAll(/\s+/g, " ").includes(anchor),
    )
    .sort(
      (left, right) =>
        (right.boundsPt?.y ?? Number.NEGATIVE_INFINITY) -
        (left.boundsPt?.y ?? Number.NEGATIVE_INFINITY),
    )[0];
}

function detectLayoutFingerprint(page: PdfPageAnalysis): string | undefined {
  const ekart = findTextItem(page, "e-kart")?.boundsPt;
  const invoice = findTextItem(page, "tax invoice")?.boundsPt;
  const notForResale = findTextItem(page, "not for resale")?.boundsPt;
  const address = findTextItem(page, "shipping/customer address")?.boundsPt;
  const matchesA4 =
    near(page.geometry.widthPt, 595, 2) && near(page.geometry.heightPt, 842, 2);
  const matchesAnchors =
    ekart &&
    invoice &&
    notForResale &&
    address &&
    near(ekart.x, 216, 4) &&
    near(ekart.y, 804.5, 4) &&
    near(invoice.x, 51.75, 4) &&
    near(invoice.y, 442.25, 4) &&
    near(notForResale.x, 192.75, 4) &&
    near(notForResale.y, 468.5, 4) &&
    near(address.x, 264, 5) &&
    near(address.y, 653.75, 5);
  return matchesA4 && matchesAnchors ? FLIPKART_LAYOUT_V1 : undefined;
}

function near(value: number, expected: number, tolerance: number): boolean {
  return Math.abs(value - expected) <= tolerance;
}

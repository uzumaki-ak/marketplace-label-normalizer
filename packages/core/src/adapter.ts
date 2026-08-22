import type {
  DetectionResult,
  ConfidenceSignals,
  MachineReadableCodeResult,
  NormalizedLabel,
  PageClassification,
  PageGeometry,
  PdfTextItem,
  ProcessingEventDraft,
  RegionDetection,
  SourceDocumentDescriptor,
  ValidationResult,
} from "./types";

export interface DocumentContext<TDocument = unknown> {
  readonly batchId: string;
  readonly documentId: string;
  readonly source: SourceDocumentDescriptor;
  readonly document: TDocument;
  readonly emit: (event: ProcessingEventDraft) => void;
  readonly signal?: AbortSignal;
}

export interface PageContext<TDocument = unknown, TPage = unknown> {
  readonly documentContext: DocumentContext<TDocument>;
  readonly pageId: string;
  readonly pageNumber: number;
  readonly page: TPage;
  readonly geometry: PageGeometry;
  readonly textItems: readonly PdfTextItem[];
}

export interface NormalizationContext<TDocument = unknown, TPage = unknown> {
  readonly pageContext: PageContext<TDocument, TPage>;
  readonly region: RegionDetection;
  readonly sourcePdfBytes: Uint8Array;
  readonly outputOrder: number;
}

export interface ValidationContext {
  readonly label: NormalizedLabel;
  readonly expectedMachineReadableCodes: readonly string[];
  readonly validationDpi: number;
  readonly machineReadableCodes: readonly MachineReadableCodeResult[];
  readonly outputDimensionsValid: boolean;
  readonly contentClippingRisk: number;
  readonly confidenceSignals: ConfidenceSignals;
}

export interface MarketplaceAdapter<TDocument = unknown, TPage = unknown> {
  readonly id: string;
  readonly version: string;

  detectDocument(context: DocumentContext<TDocument>): Promise<DetectionResult>;
  classifyPage(
    context: PageContext<TDocument, TPage>,
  ): Promise<PageClassification>;
  findPrintableRegions(
    context: PageContext<TDocument, TPage>,
  ): Promise<readonly RegionDetection[]>;
  normalizeRegion(
    context: NormalizationContext<TDocument, TPage>,
  ): Promise<NormalizedLabel>;
  validate(context: ValidationContext): Promise<ValidationResult>;
}

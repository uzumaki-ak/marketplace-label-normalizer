import type {
  Batch,
  BatchCounts,
  BatchDocument,
  BatchLabel,
  SourceDocumentDescriptor,
} from "./types";

export function createBatchId(): string {
  const randomPart =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `batch-${randomPart}`;
}

export function createSourceDescriptor(
  file: Pick<File, "name" | "size" | "type" | "lastModified">,
  batchId: string,
  uploadIndex: number,
): SourceDocumentDescriptor {
  return {
    id: `${batchId}:document:${uploadIndex}`,
    name: file.name,
    sizeBytes: file.size,
    mimeType: file.type || "application/octet-stream",
    uploadIndex,
    lastModified: file.lastModified,
  };
}

export function deriveBatchCounts(
  documents: readonly BatchDocument[],
  labels: readonly BatchLabel[] = [],
): BatchCounts {
  const discovered = documents.reduce(
    (total, document) =>
      total +
      document.pages.reduce(
        (pageTotal, page) => pageTotal + (page.regions?.length ?? 0),
        0,
      ),
    0,
  );
  return {
    documentsTotal: documents.length,
    documentsReady: documents.filter((document) =>
      ["success", "warning"].includes(document.status),
    ).length,
    documentsFailed: documents.filter(
      (document) => document.status === "failed",
    ).length,
    sourcePages: documents.reduce(
      (total, document) => total + document.pages.length,
      0,
    ),
    labelsDiscovered: discovered,
    labelsReady: labels.filter((label) => label.status === "success").length,
    reviewRequired:
      labels.length > 0
        ? labels.filter((label) => label.status === "review_required").length
        : documents.reduce(
            (total, document) =>
              total +
              document.pages.reduce(
                (pageTotal, page) =>
                  pageTotal +
                  (page.regions?.filter((region) => region.requiresReview)
                    .length ?? 0),
                0,
              ),
            0,
          ),
    labelsFailed: labels.filter((label) => label.status === "failed").length,
  };
}

export function createEmptyBatch(
  batchId: string,
  documents: readonly BatchDocument[],
  now = new Date(),
): Batch {
  const timestamp = now.toISOString();
  return {
    id: batchId,
    status: "idle",
    createdAt: timestamp,
    updatedAt: timestamp,
    documents,
    labels: [],
    combinedPdf: null,
    events: [],
    counts: deriveBatchCounts(documents),
  };
}

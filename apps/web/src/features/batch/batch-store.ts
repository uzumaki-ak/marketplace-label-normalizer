import {
  assertBatchTransition,
  createBatchId,
  createEmptyBatch,
  createProcessingEvent,
  createSourceDescriptor,
  deriveBatchCounts,
  type Batch,
  type BatchDocument,
  type BatchLabel,
  type BatchStatus,
  type CombinedPdfArtifact,
  type ProcessingEventDraft,
  type PdfPageAnalysis,
} from "@label-normalizer/core";
import { create } from "zustand";

interface BatchStoreState {
  readonly batch: Batch | null;
  readonly sourceFiles: ReadonlyMap<string, File>;
  readonly pageAnalyses: ReadonlyMap<string, PdfPageAnalysis>;
  readonly selectedDocumentId: string | null;
  readonly selectedPageId: string | null;
  readonly beginBatch: (files: readonly File[]) => string;
  readonly transitionBatch: (batchId: string, status: BatchStatus) => void;
  readonly updateDocument: (
    batchId: string,
    documentId: string,
    update: (document: BatchDocument) => BatchDocument,
  ) => void;
  readonly appendEvent: (batchId: string, event: ProcessingEventDraft) => void;
  readonly setPageAnalysis: (
    batchId: string,
    analysis: PdfPageAnalysis,
  ) => void;
  readonly setLabels: (batchId: string, labels: readonly BatchLabel[]) => void;
  readonly updateLabel: (
    batchId: string,
    labelId: string,
    update: (label: BatchLabel) => BatchLabel,
  ) => void;
  readonly setCombinedPdf: (
    batchId: string,
    combinedPdf: CombinedPdfArtifact | null,
  ) => void;
  readonly selectDocument: (documentId: string) => void;
  readonly selectPage: (documentId: string, pageId: string) => void;
  readonly reset: () => void;
}

function disposePreviews(batch: Batch | null): void {
  if (typeof URL === "undefined") return;
  for (const document of batch?.documents ?? []) {
    for (const page of document.pages) {
      if (page.preview) URL.revokeObjectURL(page.preview.objectUrl);
    }
  }
  if (batch?.combinedPdf?.objectUrl) {
    URL.revokeObjectURL(batch.combinedPdf.objectUrl);
  }
}

export const useBatchStore = create<BatchStoreState>((set, get) => ({
  batch: null,
  sourceFiles: new Map(),
  pageAnalyses: new Map(),
  selectedDocumentId: null,
  selectedPageId: null,

  beginBatch(files) {
    disposePreviews(get().batch);
    const batchId = createBatchId();
    const documents = files.map<BatchDocument>((file, uploadIndex) => {
      const source = createSourceDescriptor(file, batchId, uploadIndex);
      return {
        id: source.id,
        batchId,
        source,
        status: "queued",
        pageCount: 0,
        pages: [],
      };
    });
    const sourceFiles = new Map(
      documents.map((document, index) => [document.id, files[index] as File]),
    );

    set({
      batch: createEmptyBatch(batchId, documents),
      sourceFiles,
      pageAnalyses: new Map(),
      selectedDocumentId: documents[0]?.id ?? null,
      selectedPageId: null,
    });
    return batchId;
  },

  transitionBatch(batchId, status) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      assertBatchTransition(state.batch.status, status);
      return {
        batch: {
          ...state.batch,
          status,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  updateDocument(batchId, documentId, update) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      const documents = state.batch.documents.map((document) =>
        document.id === documentId ? update(document) : document,
      );
      return {
        batch: {
          ...state.batch,
          documents,
          counts: deriveBatchCounts(documents, state.batch.labels),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  appendEvent(batchId, event) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      const nextEvent = createProcessingEvent(event, state.batch.events.length);
      return {
        batch: {
          ...state.batch,
          events: [...state.batch.events, nextEvent],
          updatedAt: nextEvent.timestamp,
        },
      };
    });
  },

  setPageAnalysis(batchId, analysis) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      const pageAnalyses = new Map(state.pageAnalyses);
      pageAnalyses.set(analysis.pageId, analysis);
      return { pageAnalyses };
    });
  },

  setLabels(batchId, labels) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      return {
        batch: {
          ...state.batch,
          labels,
          counts: deriveBatchCounts(state.batch.documents, labels),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  updateLabel(batchId, labelId, update) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      const labels = state.batch.labels.map((label) =>
        label.id === labelId ? update(label) : label,
      );
      return {
        batch: {
          ...state.batch,
          labels,
          counts: deriveBatchCounts(state.batch.documents, labels),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  setCombinedPdf(batchId, combinedPdf) {
    set((state) => {
      if (!state.batch || state.batch.id !== batchId) return state;
      if (state.batch.combinedPdf?.objectUrl) {
        URL.revokeObjectURL(state.batch.combinedPdf.objectUrl);
      }
      const artifact = combinedPdf
        ? {
            ...combinedPdf,
            objectUrl: URL.createObjectURL(
              new Blob([combinedPdf.pdfBytes.slice().buffer as ArrayBuffer], {
                type: "application/pdf",
              }),
            ),
          }
        : null;
      return {
        batch: {
          ...state.batch,
          combinedPdf: artifact,
          updatedAt: new Date().toISOString(),
        },
      };
    });
  },

  selectDocument(documentId) {
    const document = get().batch?.documents.find(
      (item) => item.id === documentId,
    );
    set({
      selectedDocumentId: documentId,
      selectedPageId: document?.pages[0]?.id ?? null,
    });
  },

  selectPage(documentId, pageId) {
    set({ selectedDocumentId: documentId, selectedPageId: pageId });
  },

  reset() {
    disposePreviews(get().batch);
    set({
      batch: null,
      sourceFiles: new Map(),
      pageAnalyses: new Map(),
      selectedDocumentId: null,
      selectedPageId: null,
    });
  },
}));

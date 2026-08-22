import { INGEST_LIMITS } from "@label-normalizer/config";
import type { ProcessingError } from "@label-normalizer/core";

const PDF_MAGIC = "%PDF-";

export type FileValidationResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly error: ProcessingError };

export async function validatePdfFile(
  file: File,
  uploadIndex: number,
): Promise<FileValidationResult> {
  if (uploadIndex >= INGEST_LIMITS.maxDocumentsPerBatch) {
    return failure(
      "batch_document_limit",
      `This batch is limited to ${INGEST_LIMITS.maxDocumentsPerBatch} documents.`,
    );
  }

  if (file.size === 0) {
    return failure("empty_file", "The selected file is empty.");
  }

  if (file.size > INGEST_LIMITS.maxBytesPerDocument) {
    return failure(
      "file_too_large",
      `PDFs must be ${formatBytes(INGEST_LIMITS.maxBytesPerDocument)} or smaller.`,
    );
  }

  try {
    const header = new Uint8Array(
      await file.slice(0, PDF_MAGIC.length).arrayBuffer(),
    );
    const signature = String.fromCharCode(...header);

    if (signature !== PDF_MAGIC) {
      return failure(
        "invalid_pdf_signature",
        "The file does not have a valid PDF header.",
      );
    }
  } catch {
    return failure("file_read_failed", "The browser could not read this file.");
  }

  return { valid: true };
}

function failure(code: string, message: string): FileValidationResult {
  return {
    valid: false,
    error: { code, message, recoverable: true },
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

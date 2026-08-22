"use client";

import { INGEST_LIMITS } from "@label-normalizer/config";
import { useDropzone } from "react-dropzone";

interface FileDropzoneProps {
  readonly disabled?: boolean;
  readonly compact?: boolean;
  readonly onFiles: (files: readonly File[]) => void;
}

export function FileDropzone({
  disabled = false,
  compact = false,
  onFiles,
}: FileDropzoneProps) {
  const { getInputProps, getRootProps, isDragActive } = useDropzone({
    disabled,
    multiple: true,
    onDrop: (files) => {
      if (files.length > 0) onFiles(files);
    },
  });

  return (
    <div
      {...getRootProps({
        className: `dropzone${isDragActive ? " is-active" : ""}${compact ? " is-compact" : ""}`,
        "aria-label": "Select or drop marketplace PDF files",
      })}
    >
      <input {...getInputProps()} />
      <span className="eyebrow">LOCAL PDF INPUT</span>
      <strong>
        {isDragActive ? "RELEASE TO INSPECT" : "DROP MARKETPLACE PDFS HERE"}
      </strong>
      {!compact && (
        <>
          <p>Flipkart / Amazon / Meesho / mixed batches</p>
          <span className="button-like">SELECT PDFS</span>
          <small>
            Up to {INGEST_LIMITS.maxDocumentsPerBatch} files · files stay on
            this device
          </small>
        </>
      )}
    </div>
  );
}

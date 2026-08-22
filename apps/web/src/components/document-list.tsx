"use client";

import type { BatchDocument } from "@label-normalizer/core";
import { StatusBadge } from "@label-normalizer/ui";
import { formatBytes } from "@/features/batch/file-validation";

interface DocumentListProps {
  readonly documents: readonly BatchDocument[];
  readonly selectedDocumentId: string | null;
  readonly onSelect: (documentId: string) => void;
}

export function DocumentList({
  documents,
  selectedDocumentId,
  onSelect,
}: DocumentListProps) {
  return (
    <section
      className="panel documents-panel"
      aria-labelledby="documents-title"
    >
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SOURCE DOCUMENTS</span>
          <h2 id="documents-title">
            {documents.length.toString().padStart(2, "0")} FILES
          </h2>
        </div>
      </div>
      <div className="document-list">
        {documents.map((document, index) => (
          <button
            aria-pressed={selectedDocumentId === document.id}
            className="document-row"
            data-selected={selectedDocumentId === document.id}
            key={document.id}
            onClick={() => onSelect(document.id)}
            type="button"
          >
            <span className="document-index">
              {(index + 1).toString().padStart(2, "0")}
            </span>
            <span className="document-name-block">
              <strong title={document.source.name}>
                {document.source.name}
              </strong>
              <small>
                {formatBytes(document.source.sizeBytes)} ·{" "}
                {document.pages.length}/{document.pageCount || "?"} pages
              </small>
            </span>
            <StatusBadge status={document.status} />
          </button>
        ))}
      </div>
    </section>
  );
}

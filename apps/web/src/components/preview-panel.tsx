"use client";

import type { BatchDocument } from "@label-normalizer/core";
import { StatusBadge } from "@label-normalizer/ui";

interface PreviewPanelProps {
  readonly document: BatchDocument | null;
  readonly selectedPageId: string | null;
  readonly onSelectPage: (pageId: string) => void;
}

export function PreviewPanel({
  document,
  selectedPageId,
  onSelectPage,
}: PreviewPanelProps) {
  const selectedPage =
    document?.pages.find((page) => page.id === selectedPageId) ??
    document?.pages[0] ??
    null;

  return (
    <section className="panel preview-panel" aria-labelledby="preview-title">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">SELECTED SOURCE</span>
          <h2 id="preview-title">
            {selectedPage
              ? `PAGE ${selectedPage.pageNumber.toString().padStart(2, "0")}`
              : "NO PAGE YET"}
          </h2>
        </div>
        {selectedPage && <StatusBadge status={selectedPage.status} />}
      </div>

      {!document ? (
        <EmptyPreview message="Select a document to inspect its local preview." />
      ) : !selectedPage ? (
        <EmptyPreview
          message={
            document.error?.message ??
            (document.status === "processing"
              ? "PDF.js is enumerating source pages."
              : "No source page preview is available.")
          }
        />
      ) : (
        <>
          <div className="preview-frame">
            {selectedPage.preview ? (
              // Preview rasters are intentionally UI-only and never used for output.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                alt={`${document.source.name}, source page ${selectedPage.pageNumber}`}
                src={selectedPage.preview.objectUrl}
              />
            ) : (
              <EmptyPreview
                message={selectedPage.error?.message ?? "Preview unavailable."}
              />
            )}
          </div>

          <div className="page-tabs" aria-label="Source pages" role="tablist">
            {document.pages.map((page) => (
              <button
                aria-selected={page.id === selectedPage.id}
                className="page-tab"
                key={page.id}
                onClick={() => onSelectPage(page.id)}
                role="tab"
                type="button"
              >
                {page.pageNumber.toString().padStart(2, "0")}
              </button>
            ))}
          </div>

          <dl className="technical-grid">
            <TechnicalDatum label="SOURCE" value={document.source.name} />
            <TechnicalDatum
              label="PAGE BOX"
              value={
                selectedPage.geometry
                  ? `${selectedPage.geometry.widthPt.toFixed(2)} × ${selectedPage.geometry.heightPt.toFixed(2)} pt`
                  : "Unavailable"
              }
            />
            <TechnicalDatum
              label="ROTATION"
              value={
                selectedPage.geometry
                  ? `${selectedPage.geometry.rotation}°`
                  : "—"
              }
            />
            <TechnicalDatum
              label="TEXT OBJECTS"
              value={`${selectedPage.textItemCount} (${selectedPage.hasExtractableText ? "present" : "none"})`}
            />
            <TechnicalDatum
              label="PDF VERSION"
              value={document.metadata?.pdfVersion ?? "Not reported"}
            />
            <TechnicalDatum
              label="PARSE TIME"
              value={`${selectedPage.durationMs} ms`}
            />
          </dl>
        </>
      )}
    </section>
  );
}

function EmptyPreview({ message }: { readonly message: string }) {
  return (
    <div className="empty-preview">
      <span aria-hidden="true">[ ]</span>
      <p>{message}</p>
    </div>
  );
}

function TechnicalDatum({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd title={value}>{value}</dd>
    </div>
  );
}

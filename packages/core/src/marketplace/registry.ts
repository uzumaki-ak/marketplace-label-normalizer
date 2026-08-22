import type { DocumentContext, MarketplaceAdapter } from "../adapter";
import type { PdfDocumentAnalysis, PdfPageAnalysis } from "../types";
import { FlipkartAdapter } from "./adapters/flipkart";
import { AmazonAdapter } from "./adapters/amazon";
import { GenericAdapter } from "./adapters/generic";
import { MeeshoAdapter } from "./adapters/meesho";

export type PdfMarketplaceAdapter = MarketplaceAdapter<
  PdfDocumentAnalysis,
  PdfPageAnalysis
>;

export const MARKETPLACE_ADAPTERS: readonly PdfMarketplaceAdapter[] = [
  new FlipkartAdapter(),
  new AmazonAdapter(),
  new MeeshoAdapter(),
  new GenericAdapter(),
];

export function getMarketplaceAdapterById(id: string): PdfMarketplaceAdapter {
  return (
    MARKETPLACE_ADAPTERS.find((adapter) => adapter.id === id) ??
    MARKETPLACE_ADAPTERS.at(-1) ??
    new GenericAdapter()
  );
}

export async function selectMarketplaceAdapter(
  context: DocumentContext<PdfDocumentAnalysis>,
  adapters: readonly PdfMarketplaceAdapter[] = MARKETPLACE_ADAPTERS,
): Promise<{
  readonly adapter: PdfMarketplaceAdapter;
  readonly detection: Awaited<
    ReturnType<PdfMarketplaceAdapter["detectDocument"]>
  >;
}> {
  const results = await Promise.all(
    adapters.map(async (adapter) => ({
      adapter,
      detection: await adapter.detectDocument(context),
    })),
  );
  const selected = results.sort(
    (left, right) => right.detection.confidence - left.detection.confidence,
  )[0];
  if (!selected)
    throw new Error("At least one marketplace adapter is required.");
  return selected;
}

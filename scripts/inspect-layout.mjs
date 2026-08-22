import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const fixtureDirectory = path.resolve(
  process.argv[2] ?? "docs/fixtures/flipkart",
);
const SAFE_ANCHORS = [
  "e-kart",
  "ordered through",
  "awb no",
  "shipping/customer address",
  "sku id",
  "not for resale",
  "tax invoice",
  "triplicate for supplier",
  "amazon.in",
  "valmo",
  "delhivery",
  "product details",
  "customer address",
  "if undelivered, return to",
  "original for recipient",
  "purchase order no",
  "destination code",
  "return code",
  "tax is not payable on reverse charge basis",
  "computer generated invoice",
];

const names = (await readdir(fixtureDirectory))
  .filter((name) => name.toLowerCase().endsWith(".pdf"))
  .sort((left, right) => left.localeCompare(right));

for (const name of names) {
  const bytes = new Uint8Array(
    await readFile(path.join(fixtureDirectory, name)),
  );
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
  const document = await loadingTask.promise;

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const items = textContent.items.filter((item) => "str" in item);
    const anchors = items.flatMap((item) => {
      const normalized = item.str.toLowerCase().replaceAll(/\s+/g, " ").trim();
      const matched = SAFE_ANCHORS.filter((anchor) =>
        normalized.includes(anchor),
      );
      return matched.map((anchor) => ({
        anchor,
        x: Number(item.transform[4].toFixed(3)),
        y: Number(item.transform[5].toFixed(3)),
        width: Number(item.width.toFixed(3)),
        height: Number(item.height.toFixed(3)),
      }));
    });
    const invoiceY = anchors.find((item) => item.anchor === "tax invoice")?.y;
    const shippingItems =
      invoiceY === undefined
        ? items
        : items.filter((item) => item.transform[5] > invoiceY + 10);
    const textBounds = boundsOfTextItems(shippingItems);

    process.stdout.write(
      `${JSON.stringify({ name, pageNumber, anchors, shippingTextBounds: textBounds })}\n`,
    );
    page.cleanup();
  }
  await loadingTask.destroy();
}

function boundsOfTextItems(items) {
  if (items.length === 0) return null;
  const left = Math.min(...items.map((item) => item.transform[4]));
  const bottom = Math.min(...items.map((item) => item.transform[5]));
  const right = Math.max(
    ...items.map((item) => item.transform[4] + item.width),
  );
  const top = Math.max(...items.map((item) => item.transform[5] + item.height));
  return {
    x: Number(left.toFixed(3)),
    y: Number(bottom.toFixed(3)),
    width: Number((right - left).toFixed(3)),
    height: Number((top - bottom).toFixed(3)),
  };
}

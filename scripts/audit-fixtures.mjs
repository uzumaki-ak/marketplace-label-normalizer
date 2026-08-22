import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const fixtureDirectory = path.resolve(
  process.argv[2] ?? "docs/fixtures/_incoming",
);

const SIGNALS = {
  flipkart: [
    "e-kart",
    "flipkart",
    "ordered through",
    "awb no",
    "shipping/customer address",
    "sku id",
    "not for resale",
    "tax invoice",
  ],
  amazon: [
    "amazon.in",
    "amazon transportation",
    "cash memo",
    "triplicate for supplier",
    "shipping label",
  ],
  meesho: [
    "meesho",
    "supplier",
    "sub order",
    "reseller",
    "return address",
    "customer copy",
    "valmo",
  ],
  logistics: [
    "delhivery",
    "xpressbees",
    "shadowfax",
    "ecom express",
    "delivery address",
    "shipping address",
    "billing address",
    "sold by",
    "shipped by",
    "order no",
    "invoice no",
    "product details",
    "prepaid",
    "cod",
    "gstin",
  ],
};

const names = (await readdir(fixtureDirectory))
  .filter((name) => name.toLowerCase().endsWith(".pdf"))
  .sort((left, right) => left.localeCompare(right));

const audit = [];

for (const name of names) {
  const bytes = new Uint8Array(
    await readFile(path.join(fixtureDirectory, name)),
  );
  const fingerprint = createHash("sha256")
    .update(bytes)
    .digest("hex")
    .slice(0, 16);
  const loadingTask = getDocument({ data: bytes, useSystemFonts: true });
  const document = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const normalizedText = textContent.items
      .filter((item) => "str" in item)
      .map((item) => item.str)
      .join(" ")
      .toLowerCase()
      .replaceAll(/\s+/g, " ");
    const [x1 = 0, y1 = 0, x2 = 0, y2 = 0] = page.view;
    const matches = Object.fromEntries(
      Object.entries(SIGNALS).map(([marketplace, signals]) => [
        marketplace,
        signals.filter((signal) => normalizedText.includes(signal)),
      ]),
    );

    pages.push({
      pageNumber,
      widthPt: Number(Math.abs(x2 - x1).toFixed(3)),
      heightPt: Number(Math.abs(y2 - y1).toFixed(3)),
      rotation: page.rotate,
      textItemCount: textContent.items.length,
      matches,
    });
    page.cleanup();
  }

  audit.push({ name, fingerprint, pageCount: document.numPages, pages });
  await loadingTask.destroy();
}

process.stdout.write(`${JSON.stringify(audit, null, 2)}\n`);

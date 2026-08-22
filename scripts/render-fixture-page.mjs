import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createCanvas } from "@napi-rs/canvas";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const inputPath = path.resolve(process.argv[2]);
const outputPath = path.resolve(process.argv[3]);
const pageNumber = Number(process.argv[4] ?? 1);
const scale = Number(process.argv[5] ?? 1.5);

const bytes = new Uint8Array(await readFile(inputPath));
const wasmUrl = `${path.resolve("node_modules/pdfjs-dist/wasm").replaceAll("\\", "/")}/`;
const loadingTask = getDocument({ data: bytes, useSystemFonts: true, wasmUrl });
const document = await loadingTask.promise;
const page = await document.getPage(pageNumber);
const viewport = page.getViewport({ scale });
const canvas = createCanvas(
  Math.ceil(viewport.width),
  Math.ceil(viewport.height),
);
const context = canvas.getContext("2d");

await page.render({ canvas, canvasContext: context, viewport }).promise;
await writeFile(outputPath, canvas.toBuffer("image/png"));

page.cleanup();
await loadingTask.destroy();

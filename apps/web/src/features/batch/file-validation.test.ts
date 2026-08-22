import { validatePdfFile } from "./file-validation";

describe("PDF file validation", () => {
  it("accepts files based on PDF magic bytes rather than the filename alone", async () => {
    const file = new File(["%PDF-1.7\nbody"], "arbitrary.bin", {
      type: "application/octet-stream",
    });
    await expect(validatePdfFile(file, 0)).resolves.toEqual({ valid: true });
  });

  it("rejects a renamed non-PDF", async () => {
    const file = new File(["hello"], "shipment.pdf", {
      type: "application/pdf",
    });
    const result = await validatePdfFile(file, 0);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe("invalid_pdf_signature");
  });

  it("rejects empty files", async () => {
    const result = await validatePdfFile(
      new File([], "empty.pdf", { type: "application/pdf" }),
      0,
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe("empty_file");
  });
});

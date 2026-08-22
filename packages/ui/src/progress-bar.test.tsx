import { render, screen } from "@testing-library/react";
import { ProgressBar } from "./progress-bar";

describe("ProgressBar", () => {
  it("exposes bounded progress to assistive technology", () => {
    render(<ProgressBar label="Batch progress" value={140} />);
    expect(
      screen.getByRole("progressbar", { name: "Batch progress" }),
    ).toHaveAttribute("aria-valuenow", "100");
  });
});

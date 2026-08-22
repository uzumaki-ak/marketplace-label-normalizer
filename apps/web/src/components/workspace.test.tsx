import { render, screen } from "@testing-library/react";
import { Workspace } from "./workspace";
import { useBatchStore } from "@/features/batch/batch-store";

describe("Workspace", () => {
  beforeEach(() => useBatchStore.getState().reset());

  it("presents a keyboard-accessible local PDF entry point", () => {
    render(<Workspace />);
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Select or drop marketplace PDF files"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("NO SCREENSHOTS FOR PRINT", { exact: false }),
    ).toBeInTheDocument();
  });
});

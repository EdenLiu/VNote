import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QuickAddBar } from "../QuickAddBar";

describe("QuickAddBar", () => {
  it("renders input and add button", () => {
    render(<QuickAddBar listId="inbox" onCreate={vi.fn()} />);
    expect(screen.getByPlaceholderText("Add a task")).toBeInTheDocument();
    expect(screen.getByLabelText("Add task")).toBeInTheDocument();
  });

  it("calls onCreate with trimmed value when button is clicked", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddBar listId="inbox" onCreate={onCreate} />);

    const input = screen.getByPlaceholderText("Add a task");
    await userEvent.type(input, "  new task  ");

    fireEvent.click(screen.getByLabelText("Add task"));
    expect(onCreate).toHaveBeenCalledWith("new task");
  });

  it("calls onCreate when Enter is pressed", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddBar listId="inbox" onCreate={onCreate} />);

    const input = screen.getByPlaceholderText("Add a task");
    await userEvent.type(input, "enter task{Enter}");

    expect(onCreate).toHaveBeenCalledWith("enter task");
  });

  it("does not call onCreate for empty input", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddBar listId="inbox" onCreate={onCreate} />);

    fireEvent.click(screen.getByLabelText("Add task"));
    expect(onCreate).not.toHaveBeenCalled();

    const input = screen.getByPlaceholderText("Add a task");
    await userEvent.type(input, "   {Enter}");
    expect(onCreate).not.toHaveBeenCalled();
  });

  it("clears input after successful creation", async () => {
    const onCreate = vi.fn().mockResolvedValue(undefined);
    render(<QuickAddBar listId="inbox" onCreate={onCreate} />);

    const input = screen.getByPlaceholderText("Add a task") as HTMLInputElement;
    await userEvent.type(input, "clear me{Enter}");

    expect(input.value).toBe("");
  });
});

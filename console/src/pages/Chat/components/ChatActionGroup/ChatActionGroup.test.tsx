import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "@/test/common_setup";

vi.mock("../../ChatSearchPanel", () => ({ default: () => null }));
vi.mock("../../ChatSessionDrawer", () => ({ default: () => null }));

import ChatActionGroup from "./index";

describe("ChatActionGroup", () => {
  it("renders without crash", () => {
    expect(() => renderWithProviders(<ChatActionGroup />)).not.toThrow();
  });

  it("renders search icon button", () => {
    renderWithProviders(<ChatActionGroup />);
    expect(
      document.querySelector('[data-icon="SparkSearchLine"]'),
    ).toBeInTheDocument();
  });

  it("renders new chat icon button", () => {
    renderWithProviders(<ChatActionGroup />);
    expect(
      document.querySelector('[data-icon="SparkNewChatFill"]'),
    ).toBeInTheDocument();
  });
});

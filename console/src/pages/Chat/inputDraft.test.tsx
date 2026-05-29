import { useCallback } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearChatInputDraft, useChatInputDraft } from "./inputDraft";

const DRAFT_STORAGE_KEY = "qwenpaw_chat_input_draft";

function DraftHarness({
  sessionId = "session-a",
  active = true,
}: {
  sessionId?: string;
  active?: boolean;
}) {
  const isChatActive = useCallback(() => active, [active]);
  const getCurrentSessionId = useCallback(() => sessionId, [sessionId]);

  useChatInputDraft(isChatActive, getCurrentSessionId);

  return (
    <div className="sender">
      <textarea aria-label="chat-input" />
    </div>
  );
}

describe("useChatInputDraft", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it("cancels pending stale saves when the draft is cleared on submit", () => {
    const { unmount } = render(<DraftHarness />);

    const textarea = screen.getByLabelText("chat-input") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "hi" } });

    clearChatInputDraft();
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("clears the stored draft immediately when the input becomes empty", () => {
    render(<DraftHarness />);

    const textarea = screen.getByLabelText("chat-input") as HTMLTextAreaElement;
    fireEvent.input(textarea, { target: { value: "hi" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });

    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toContain("hi");

    fireEvent.input(textarea, { target: { value: "" } });

    expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
  });

  it("does not restore another session's draft into the current input", () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        sessionId: "other-session",
        value: "old text",
        selectionStart: 8,
        selectionEnd: 8,
      }),
    );

    render(<DraftHarness sessionId="session-a" />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const textarea = screen.getByLabelText("chat-input") as HTMLTextAreaElement;
    expect(textarea.value).toBe("");
  });

  it("restores the draft for the matching session", () => {
    localStorage.setItem(
      DRAFT_STORAGE_KEY,
      JSON.stringify({
        sessionId: "session-a",
        value: "unfinished draft",
        selectionStart: 16,
        selectionEnd: 16,
      }),
    );

    render(<DraftHarness sessionId="session-a" />);
    act(() => {
      vi.advanceTimersByTime(100);
    });

    const textarea = screen.getByLabelText("chat-input") as HTMLTextAreaElement;
    expect(textarea.value).toBe("unfinished draft");
  });
});

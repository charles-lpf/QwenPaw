import { useEffect } from "react";
import { setTextareaValue } from "./utils";

const DRAFT_STORAGE_KEY = "qwenpaw_chat_input_draft";
const DRAFT_FALLBACK_SESSION_ID = "__new_chat__";
const CHAT_INPUT_DRAFT_CLEAR_EVENT = "qwenpaw:chat-input-draft-clear";

interface DraftState {
  sessionId: string;
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function clearChatInputDraft() {
  localStorage.removeItem(DRAFT_STORAGE_KEY);
  window.dispatchEvent(new CustomEvent(CHAT_INPUT_DRAFT_CLEAR_EVENT));
}

export function useChatInputDraft(
  isChatActive: () => boolean,
  getCurrentSessionId: () => string | undefined,
) {
  useEffect(() => {
    if (!isChatActive()) return;

    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let isRestoringDraft = false;
    let skipNextFinalSave = false;

    const getTextarea = (): HTMLTextAreaElement | null => {
      const sender = document.querySelector('[class*="sender"]');
      return sender?.querySelector("textarea") as HTMLTextAreaElement | null;
    };

    const getDraftSessionId = () =>
      getCurrentSessionId() || DRAFT_FALLBACK_SESSION_ID;

    const clearDraft = (skipFinalSave = false) => {
      if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
      }
      skipNextFinalSave = skipFinalSave;
      localStorage.removeItem(DRAFT_STORAGE_KEY);
    };

    const saveDraft = (textarea: HTMLTextAreaElement) => {
      if (isRestoringDraft) return;
      const draft: DraftState = {
        sessionId: getDraftSessionId(),
        value: textarea.value,
        selectionStart: textarea.selectionStart,
        selectionEnd: textarea.selectionEnd,
      };
      if (draft.value) {
        localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
      } else {
        localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
    };

    const handleInput = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target?.tagName !== "TEXTAREA") return;
      if (!target?.closest('[class*="sender"]')) return;

      if (saveTimer) clearTimeout(saveTimer);
      if (!(target as HTMLTextAreaElement).value) {
        clearDraft();
        return;
      }
      skipNextFinalSave = false;
      saveTimer = setTimeout(() => {
        saveDraft(target as HTMLTextAreaElement);
      }, 300);
    };

    const handleDraftClear = () => clearDraft(true);

    // Restore draft on mount with polling for textarea readiness
    let restoreAttempts = 0;
    const maxRestoreAttempts = 20;
    const restoreInterval = setInterval(() => {
      restoreAttempts++;
      const textarea = getTextarea();
      if (textarea) {
        clearInterval(restoreInterval);
        const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
        if (raw) {
          try {
            const draft: DraftState = JSON.parse(raw);
            if (!draft.sessionId) {
              clearDraft();
              return;
            }
            if (
              draft.value &&
              draft.sessionId === getDraftSessionId() &&
              !textarea.value
            ) {
              isRestoringDraft = true;
              setTextareaValue(textarea, draft.value);
              requestAnimationFrame(() => {
                textarea.selectionStart = draft.selectionStart;
                textarea.selectionEnd = draft.selectionEnd;
                isRestoringDraft = false;
              });
            }
          } catch {
            clearDraft();
          }
        }
      } else if (restoreAttempts >= maxRestoreAttempts) {
        clearInterval(restoreInterval);
      }
    }, 100);

    document.addEventListener("input", handleInput, true);
    window.addEventListener(CHAT_INPUT_DRAFT_CLEAR_EVENT, handleDraftClear);

    return () => {
      clearInterval(restoreInterval);
      if (saveTimer) clearTimeout(saveTimer);
      document.removeEventListener("input", handleInput, true);
      window.removeEventListener(CHAT_INPUT_DRAFT_CLEAR_EVENT, handleDraftClear);

      // Final save on unmount
      if (skipNextFinalSave) return;
      const textarea = getTextarea();
      if (textarea) {
        saveDraft(textarea);
      }
    };
  }, [isChatActive, getCurrentSessionId]);
}

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useChatSessionListController } from "./useChatSessionListController";
import * as sessionApiModule from "../../sessionApi";
import * as chatApiModule from "../../../../api/modules/chat";
import type { ExtendedChatSession } from "./useChatSessionListController";

// ── Mocks ────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
const mockPreloadSession = vi.fn();
const mockFinishSessionSwitch = vi.fn();
const mockGetSessionList = vi.fn();
const mockDeleteChat = vi.fn().mockResolvedValue(undefined);

vi.mock("react-router-dom", () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock("../../sessionApi", () => ({
  default: {
    getSessionList: () => mockGetSessionList(),
    isSessionSwitching: false,
    preloadSession: (...args: any[]) => mockPreloadSession(...args),
    finishSessionSwitch: () => mockFinishSessionSwitch(),
    lastNavigatedChatId: null,
  },
}));

vi.mock("../../../../api/modules/chat", () => ({
  chatApi: {
    deleteChat: (...args: any[]) => mockDeleteChat(...args),
    updateChat: vi.fn().mockResolvedValue(undefined),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const makeSession = (overrides: Partial<ExtendedChatSession> = {}): ExtendedChatSession => ({
  id: "session-id-" + Math.random(),
  name: "Test Session",
  realId: undefined,
  ...overrides,
} as ExtendedChatSession);

const sessionsFixture: ExtendedChatSession[] = [
  makeSession({ id: "s1", name: "Session One", realId: "uuid-1" }),
  makeSession({ id: "s2", name: "Session Two", realId: "uuid-2" }),
  makeSession({ id: "s3", name: "Session Three" }), // no realId, numeric id
];

// ── Tests ────────────────────────────────────────────────────────────────────

describe("useChatSessionListController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSessionList.mockResolvedValue(sessionsFixture);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("handleSessionClick — drawer mode (with setCurrentSessionId)", () => {
    it("calls preloadSession, navigates, and sets currentSessionId", async () => {
      const mockSetCurrentSessionId = vi.fn();
      mockPreloadSession.mockResolvedValue({
        session: sessionsFixture[0],
        realId: "uuid-1",
      });

      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: undefined,
          setCurrentSessionId: mockSetCurrentSessionId,
          active: false,
          poll: false,
        }),
      );

      // Trigger click - handleSessionClick starts async operations
      await act(async () => {
        result.current.handleSessionClick("s1");
        // Wait for all microtasks to complete (includes Promise chain)
        await new Promise((resolve) => setTimeout(resolve, 10));
      });

      expect(mockPreloadSession).toHaveBeenCalledWith("s1");
      expect(mockNavigate).toHaveBeenCalledWith("/chat/uuid-1", {
        replace: true,
      });
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("s1");
    });

    it("skips if sessionApi.isSessionSwitching is true", async () => {
      vi.mocked(sessionApiModule.default).isSessionSwitching = true;

      const mockSetCurrentSessionId = vi.fn();
      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: undefined,
          setCurrentSessionId: mockSetCurrentSessionId,
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        result.current.handleSessionClick("s1");
      });

      expect(mockPreloadSession).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(mockSetCurrentSessionId).not.toHaveBeenCalled();

      vi.mocked(sessionApiModule.default).isSessionSwitching = false;
    });

    it("does not navigate if clicking the current session", async () => {
      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: "s1",
          setCurrentSessionId: vi.fn(),
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        result.current.handleSessionClick("s1");
      });

      expect(mockPreloadSession).not.toHaveBeenCalled();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("handleSessionClick — sidebar mode (without setCurrentSessionId)", () => {
    it("navigates to session realId without setting isSessionSwitching", async () => {
      // Sidebar mode: NO setCurrentSessionId passed
      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: undefined,
          setCurrentSessionId: undefined, // sidebar mode
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        result.current.handleSessionClick("s1");
      });

      // Should NOT call preloadSession (which sets isSessionSwitching)
      expect(mockPreloadSession).not.toHaveBeenCalled();

      // Should navigate directly
      expect(mockNavigate).toHaveBeenCalledWith("/chat/uuid-1", { replace: true });

      // Should NOT set isSessionSwitching lock
      expect(mockFinishSessionSwitch).not.toHaveBeenCalled();
    });

    it("navigates to session id when no realId exists", async () => {
      // Session s3 has no realId
      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: undefined,
          setCurrentSessionId: undefined,
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        result.current.handleSessionClick("s3");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/chat/s3", { replace: true });
      expect(mockPreloadSession).not.toHaveBeenCalled();
    });

    it("does not check isSessionSwitching lock in sidebar mode", async () => {
      vi.mocked(sessionApiModule.default).isSessionSwitching = true;

      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: undefined,
          setCurrentSessionId: undefined, // sidebar mode
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        result.current.handleSessionClick("s2");
      });

      // Sidebar mode ignores isSessionSwitching and navigates directly
      expect(mockNavigate).toHaveBeenCalledWith("/chat/uuid-2", { replace: true });
      expect(mockPreloadSession).not.toHaveBeenCalled();

      vi.mocked(sessionApiModule.default).isSessionSwitching = false;
    });
  });

  describe("sortedSessions", () => {
    it("sorts pinned sessions first", async () => {
      const unsorted: ExtendedChatSession[] = [
        makeSession({ id: "u1", name: "Unpinned", pinned: false }),
        makeSession({ id: "p1", name: "Pinned", pinned: true }),
      ];

      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: unsorted,
          setSessions: vi.fn(),
          currentSessionId: undefined,
          active: false,
          poll: false,
        }),
      );

      expect(result.current.sortedSessions[0].pinned).toBe(true);
      expect(result.current.sortedSessions[1].pinned).toBe(false);
    });
  });

  describe("handleDelete", () => {
    it("deletes via backend id and refreshes list", async () => {
      const mockRefresh = vi.fn();
      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: mockRefresh,
          currentSessionId: "s1",
          setCurrentSessionId: vi.fn(),
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        await result.current.handleDelete("s1");
      });

      expect(mockDeleteChat).toHaveBeenCalledWith("uuid-1");
      expect(mockRefresh).toHaveBeenCalled();
    });

    it("navigates to next session when deleting current", async () => {
      const remainingSessions = sessionsFixture.filter((s) => s.id !== "s1");
      const mockSetCurrentSessionId = vi.fn();

      const { result } = renderHook(() =>
        useChatSessionListController({
          sessions: sessionsFixture,
          setSessions: vi.fn(),
          currentSessionId: "s1",
          setCurrentSessionId: mockSetCurrentSessionId,
          active: false,
          poll: false,
        }),
      );

      await act(async () => {
        await result.current.handleDelete("s1");
      });

      expect(mockNavigate).toHaveBeenCalledWith("/chat/uuid-2", {
        replace: true,
      });
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("s2");
    });
  });
});

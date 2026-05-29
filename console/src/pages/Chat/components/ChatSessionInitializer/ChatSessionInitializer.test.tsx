import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, useLocation, Routes, Route } from "react-router-dom";
import { render, waitFor } from "@testing-library/react";
import ChatSessionInitializer from "./index";
import type { ExtendedChatSession } from "../ChatSessionList/useChatSessionListController";

// ── Types ────────────────────────────────────────────────────────────────────

interface MockSession extends ExtendedChatSession {
  id: string;
}

// ── Test fixtures ─────────────────────────────────────────────────────────────

const makeSession = (id: string, name = "Test", realId?: string): MockSession => ({
  id,
  name,
  realId,
} as MockSession);

const sessions: MockSession[] = [
  makeSession("s1", "Session One"),
  makeSession("uuid-2", "Session Two", "uuid-2"),
  makeSession("s3", "Session Three"),
];

// ── Global mock state ─────────────────────────────────────────────────────────

const mockState = {
  sessions,
  currentSessionId: null as string | null,
  isSessionSwitching: false,
  lastNavigatedChatId: null as string | null,
  pendingNewSessionId: null as string | null,
};

const {
  mockSetCurrentSessionId,
  mockSetSessions,
  mockGetSessionList,
  mockCreateSession,
} = vi.hoisted(() => ({
  mockSetCurrentSessionId: vi.fn(),
  mockSetSessions: vi.fn(),
  mockGetSessionList: vi.fn(),
  mockCreateSession: vi.fn(),
}));

vi.mock("@agentscope-ai/chat", () => ({
  useChatAnywhereSessionsState: vi.fn(() => ({
    sessions: mockState.sessions,
    currentSessionId: mockState.currentSessionId,
    setCurrentSessionId: mockSetCurrentSessionId,
    setSessions: mockSetSessions,
  })),
}));

vi.mock("../../sessionApi", () => ({
  default: {
    getSessionList: mockGetSessionList,
    createSession: mockCreateSession,
    get isSessionSwitching() {
      return mockState.isSessionSwitching;
    },
    set isSessionSwitching(val) {
      mockState.isSessionSwitching = val;
    },
    get lastNavigatedChatId() {
      return mockState.lastNavigatedChatId;
    },
    set lastNavigatedChatId(val) {
      mockState.lastNavigatedChatId = val;
    },
    get pendingNewSessionId() {
      return mockState.pendingNewSessionId;
    },
    set pendingNewSessionId(val) {
      mockState.pendingNewSessionId = val;
    },
  },
}));

// ── Test Component ──────────────────────────────────────────────────────────

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

function TestRouter({
  initialPath = "/chat",
  children,
}: {
  initialPath?: string;
  children: React.ReactNode;
}) {
  return (
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/chat/*" element={<>{children}<LocationDisplay /></>} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe("ChatSessionInitializer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessions.length = 0;
    sessions.push(
      makeSession("s1", "Session One"),
      makeSession("uuid-2", "Session Two", "uuid-2"),
      makeSession("s3", "Session Three"),
    );
    mockState.sessions = sessions;
    mockState.currentSessionId = null;
    mockState.isSessionSwitching = false;
    mockState.lastNavigatedChatId = null;
    mockState.pendingNewSessionId = null;
    mockGetSessionList.mockResolvedValue(sessions);
    mockCreateSession.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("URL-driven session matching", () => {
    it("matches session by id and sets currentSessionId", () => {
      const { getByTestId } = render(
        <TestRouter initialPath="/chat/s1">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      // Verify the location is correct
      expect(getByTestId("location")).toHaveTextContent("/chat/s1");
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("s1");
    });

    it("matches session by realId (uuid) and sets currentSessionId to frontend id", () => {
      const { getByTestId } = render(
        <TestRouter initialPath="/chat/uuid-2">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      // Verify the location is correct
      expect(getByTestId("location")).toHaveTextContent("/chat/uuid-2");
      // Should set currentSessionId to session.id (which equals realId in this case)
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("uuid-2");
    });

    it("matches a restored backend session by local timestamp sessionId", () => {
      const restoredSession = {
        ...makeSession("backend-chat-id", "My Skills"),
        sessionId: "1234567890",
      } as MockSession;
      mockState.sessions = [restoredSession];

      const { getByTestId } = render(
        <TestRouter initialPath="/chat/1234567890">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      expect(getByTestId("location")).toHaveTextContent("/chat/1234567890");
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("backend-chat-id");
    });

    it("does not trigger when isSessionSwitching is true", () => {
      mockState.isSessionSwitching = true;

      render(
        <TestRouter initialPath="/chat/s1">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      expect(mockSetCurrentSessionId).not.toHaveBeenCalled();
    });

    it("does not trigger when lastNavigatedChatId matches (avoid double handling)", () => {
      // Simulate onSessionSelected already handled this navigation
      mockState.lastNavigatedChatId = "s1";

      render(
        <TestRouter initialPath="/chat/s1">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      // Should be skipped because onSessionSelected already handled this
      expect(mockSetCurrentSessionId).not.toHaveBeenCalled();
    });
  });

  describe("realId mismatch scenario", () => {
    it("handles session where id differs from realId", () => {
      // Create a session where frontend id is different from backend realId
      const sessionWithRealId: MockSession[] = [
        { id: "frontend-temp-123", name: "Test", realId: "backend-real-id-456" } as MockSession,
      ];

      // Update the global sessions array directly
      sessions.length = 0;
      sessions.push(...sessionWithRealId);

      const { getByTestId } = render(
        <TestRouter initialPath="/chat/backend-real-id-456">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      // Verify the location is correct
      expect(getByTestId("location")).toHaveTextContent("/chat/backend-real-id-456");
      // Should match by realId and set currentSessionId to frontend id
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("frontend-temp-123");
    });
  });

  describe("/chat (no id)", () => {
    it("creates the first session when entering with no sessions", async () => {
      const newSession = makeSession("new-local-session", "New Chat");
      mockState.sessions = [];
      mockGetSessionList.mockResolvedValue([]);
      mockCreateSession.mockResolvedValue([newSession]);

      render(
        <TestRouter initialPath="/chat">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      await waitFor(() => expect(mockCreateSession).toHaveBeenCalledOnce());
      expect(mockSetSessions).toHaveBeenCalledWith([newSession]);
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("new-local-session");
    });

    it("selects an existing session when the backend list is not empty", async () => {
      mockState.sessions = [];
      mockGetSessionList.mockResolvedValue(sessions);

      render(
        <TestRouter initialPath="/chat">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      await waitFor(() => expect(mockGetSessionList).toHaveBeenCalledOnce());
      expect(mockCreateSession).not.toHaveBeenCalled();
      expect(mockSetSessions).toHaveBeenCalledWith(sessions);
      expect(mockSetCurrentSessionId).toHaveBeenCalledWith("s1");
    });

    it("does not create a session when one is already selected", () => {
      mockState.sessions = [];
      mockState.currentSessionId = "s1";

      render(
        <TestRouter initialPath="/chat">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      expect(mockGetSessionList).not.toHaveBeenCalled();
      expect(mockCreateSession).not.toHaveBeenCalled();
    });
  });
});

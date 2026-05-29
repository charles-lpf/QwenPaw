import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MemoryRouter, useLocation, Routes, Route } from "react-router-dom";
import { render } from "@testing-library/react";
import ChatSessionInitializer from "./index";
import * as chatModule from "../../sessionApi";
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

const mockSetCurrentSessionId = vi.fn();

vi.mock("@agentscope-ai/chat", () => ({
  useChatAnywhereSessionsState: vi.fn(() => ({
    sessions: mockState.sessions,
    currentSessionId: mockState.currentSessionId,
    setCurrentSessionId: mockSetCurrentSessionId,
  })),
}));

vi.mock("../../sessionApi", () => ({
  default: {
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
    mockState.currentSessionId = null;
    mockState.isSessionSwitching = false;
    mockState.lastNavigatedChatId = null;
    mockState.pendingNewSessionId = null;
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
    it("clears currentSessionId when navigating to /chat", () => {
      // Set a current session
      mockState.currentSessionId = "s1";
      // Not a fresh new session
      mockState.pendingNewSessionId = null;

      render(
        <TestRouter initialPath="/chat">
          <ChatSessionInitializer />
        </TestRouter>,
      );

      expect(mockSetCurrentSessionId).toHaveBeenCalledWith(undefined);
    });
  });
});

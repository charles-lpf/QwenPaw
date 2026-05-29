import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { IAgentScopeRuntimeWebUISession } from "@agentscope-ai/chat";
import type { ChatStatus } from "../../../../api/types/chat";
import { chatApi } from "../../../../api/modules/chat";
import sessionApi from "../../sessionApi";

export interface ExtendedChatSession extends IAgentScopeRuntimeWebUISession {
  realId?: string;
  sessionId?: string;
  userId?: string;
  channel?: string;
  createdAt?: string | null;
  meta?: Record<string, unknown>;
  status?: ChatStatus;
  generating?: boolean;
  pinned?: boolean;
}

interface UseChatSessionListControllerParams {
  sessions: IAgentScopeRuntimeWebUISession[];
  setSessions: (sessions: IAgentScopeRuntimeWebUISession[]) => void;
  currentSessionId?: string;
  setCurrentSessionId?: (sessionId: string | undefined) => void;
  active?: boolean;
  poll?: boolean;
}

const CHAT_SESSION_LIST_CHANGED_EVENT = "qwenpaw:chat-session-list-changed";

export const formatCreatedAt = (raw: string | null | undefined): string => {
  if (!raw) return "";
  const date = new Date(raw);
  if (isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate(),
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
    date.getSeconds(),
  )}`;
};

const getBackendId = (session: ExtendedChatSession): string | null => {
  if (session.realId) return session.realId;
  const id = session.id;
  if (!/^\d+$/.test(id)) return id;
  return null;
};

export function useChatSessionListController({
  sessions,
  setSessions,
  currentSessionId,
  setCurrentSessionId,
  active = true,
  poll = true,
}: UseChatSessionListControllerParams) {
  const navigate = useNavigate();
  const controllerIdRef = useRef(
    `chat-session-list-${Math.random().toString(36).slice(2)}`,
  );
  const [loading, setLoading] = useState(true);
  const [switchingSessionId, setSwitchingSessionId] = useState<string | null>(
    null,
  );
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const sortedSessions = useMemo(() => {
    return [...sessions].sort((a, b) => {
      const extA = a as ExtendedChatSession;
      const extB = b as ExtendedChatSession;

      if (extA.pinned && !extB.pinned) return -1;
      if (!extA.pinned && extB.pinned) return 1;

      const aTime = extA.createdAt;
      const bTime = extB.createdAt;
      if (!aTime && !bTime) return 0;
      if (!aTime) return 1;
      if (!bTime) return -1;
      return new Date(bTime).getTime() - new Date(aTime).getTime();
    }) as ExtendedChatSession[];
  }, [sessions]);

  const refreshSessions = useCallback(async () => {
    const list = await sessionApi.getSessionList();
    setSessions(list);
    return list;
  }, [setSessions]);

  const notifySessionListChanged = useCallback(() => {
    window.dispatchEvent(
      new CustomEvent(CHAT_SESSION_LIST_CHANGED_EVENT, {
        detail: { source: controllerIdRef.current },
      }),
    );
  }, []);

  useEffect(() => {
    if (!active) return;

    let isCancelled = false;

    const loadSessions = async () => {
      setLoading(true);
      try {
        const list = await sessionApi.getSessionList();
        if (!isCancelled) {
          setSessions(list);
        }
      } catch (error) {
        console.error("Failed to refresh session list:", error);
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };

    void loadSessions();

    const handleSessionListChanged = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source;
      if (source === controllerIdRef.current) return;
      void refreshSessions();
    };

    window.addEventListener(
      CHAT_SESSION_LIST_CHANGED_EVENT,
      handleSessionListChanged,
    );

    if (!poll) {
      return () => {
        isCancelled = true;
        window.removeEventListener(
          CHAT_SESSION_LIST_CHANGED_EVENT,
          handleSessionListChanged,
        );
      };
    }

    const timer = window.setInterval(async () => {
      try {
        const list = await sessionApi.getSessionList();
        if (!isCancelled) {
          setSessions(list);
        }
      } catch {
        // Ignore polling errors; the next successful refresh will resync.
      }
    }, 3000);

    return () => {
      isCancelled = true;
      window.removeEventListener(
        CHAT_SESSION_LIST_CHANGED_EVENT,
        handleSessionListChanged,
      );
      window.clearInterval(timer);
    };
  }, [active, poll, refreshSessions, setSessions]);

  const handleSessionClick = useCallback(
    (sessionId: string) => {
      // Drawer mode: has setCurrentSessionId, use full preload + switching lock
      if (setCurrentSessionId) {
        if (sessionApi.isSessionSwitching) return;
        if (sessionId === currentSessionId) return;

        sessionApi.isSessionSwitching = true;
        setSwitchingSessionId(sessionId);

        sessionApi
          .preloadSession(sessionId)
          .then(({ realId }) => {
            const targetId = realId || sessionId;
            navigate(`/chat/${targetId}`, { replace: true });
            sessionApi.lastNavigatedChatId = targetId;
            setCurrentSessionId(sessionId);
          })
          .catch(() => {
            setCurrentSessionId(sessionId);
          })
          .then(() => {
            return new Promise<void>((resolve) => {
              requestAnimationFrame(() => {
                requestAnimationFrame(() => resolve());
              });
            });
          })
          .finally(() => {
            sessionApi.finishSessionSwitch();
            setSwitchingSessionId(null);
          });
        return;
      }

      // Sidebar mode: no setCurrentSessionId, URL-driven only, no isSessionSwitching lock
      // This avoids blocking ChatSessionInitializer which reads isSessionSwitching
      const session = sessions.find((s) => s.id === sessionId) as
        | ExtendedChatSession
        | undefined;
      const targetId = session?.realId || sessionId;
      navigate(`/chat/${targetId}`, { replace: true });
    },
    [currentSessionId, navigate, setCurrentSessionId, sessions],
  );

  const handleDelete = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId) as
        | ExtendedChatSession
        | undefined;
      const backendId = session ? getBackendId(session) : null;

      if (backendId) {
        await chatApi.deleteChat(backendId);
      }

      const nextSessions = sessions.filter((s) => s.id !== sessionId);
      const deletingCurrent = currentSessionId === sessionId;

      if (deletingCurrent) {
        const nextSession = nextSessions[0] as ExtendedChatSession | undefined;
        if (nextSession) {
          const targetId = nextSession.realId || nextSession.id;
          navigate(`/chat/${targetId}`, { replace: true });
          setCurrentSessionId?.(nextSession.id);
        } else {
          // No more sessions: navigate to /chat. The library's useMount
          // will auto-create a session when session list is empty.
          navigate("/chat", { replace: true });
        }
      }

      await refreshSessions();
      notifySessionListChanged();
    },
    [
      sessions,
      currentSessionId,
      navigate,
      setCurrentSessionId,
      refreshSessions,
      notifySessionListChanged,
    ],
  );

  const handleEditStart = useCallback(
    (sessionId: string, currentName: string) => {
      setEditingSessionId(sessionId);
      setEditValue(currentName);
    },
    [],
  );

  const handleEditChange = useCallback((value: string) => {
    setEditValue(value);
  }, []);

  const handleEditSubmit = useCallback(async () => {
    if (!editingSessionId) return;

    const session = sessions.find((s) => s.id === editingSessionId) as
      | ExtendedChatSession
      | undefined;
    const backendId = session ? getBackendId(session) : null;
    const newName = editValue.trim();

    if (backendId && newName && session) {
      await chatApi.updateChat(backendId, { name: newName });
    }

    setEditingSessionId(null);
    setEditValue("");
    await refreshSessions();
    notifySessionListChanged();
  }, [
    editingSessionId,
    editValue,
    sessions,
    refreshSessions,
    notifySessionListChanged,
  ]);

  const handleEditCancel = useCallback(() => {
    setEditingSessionId(null);
    setEditValue("");
  }, []);

  const handlePinToggle = useCallback(
    async (sessionId: string) => {
      const session = sessions.find((s) => s.id === sessionId) as
        | ExtendedChatSession
        | undefined;
      const backendId = session ? getBackendId(session) : null;

      if (!backendId || !session) return;

      try {
        await chatApi.updateChat(backendId, { pinned: !session.pinned });
        await refreshSessions();
        notifySessionListChanged();
      } catch (error) {
        console.error("Failed to toggle pin status:", error);
      }
    },
    [sessions, refreshSessions, notifySessionListChanged],
  );

  return {
    sortedSessions,
    currentSessionId,
    loading,
    switchingSessionId,
    editingSessionId,
    editValue,
    refreshSessions,
    handleSessionClick,
    handleDelete,
    handleEditStart,
    handleEditChange,
    handleEditSubmit,
    handleEditCancel,
    handlePinToggle,
  };
}

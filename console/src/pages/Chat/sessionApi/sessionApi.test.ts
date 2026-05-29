import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApi = vi.hoisted(() => ({
  listChats: vi.fn(),
  deleteChat: vi.fn(),
  getChat: vi.fn(),
}));

vi.mock("../../../api", () => ({
  default: mockApi,
}));

describe("sessionApi", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(1234567890);
    mockApi.listChats.mockResolvedValue([]);
    mockApi.deleteChat.mockResolvedValue({});
    mockApi.getChat.mockResolvedValue({
      id: "backend-1",
      name: "My Skills",
      session_id: "1234567890",
      user_id: "default",
      channel: "console",
      status: "idle",
      messages: [{ role: "assistant", content: [{ type: "text", text: "ok" }] }],
    });
  });

  it("preserves a pending New Chat when backend polling returns no chats", async () => {
    const sessionApi = (await import("./index")).default;

    await sessionApi.createSession({ name: "", messages: [] });
    const sessions = await sessionApi.getSessionList();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      id: "1234567890",
      messages: [],
    });
  });

  it("removes a pending New Chat without resurrecting it on the next poll", async () => {
    const sessionApi = (await import("./index")).default as any;

    await sessionApi.createSession({ name: "", messages: [] });
    const afterRemove = await sessionApi.removeSession({ id: "1234567890" });
    const afterPoll = await sessionApi.getSessionList();

    expect(mockApi.deleteChat).not.toHaveBeenCalled();
    expect(afterRemove).toEqual([]);
    expect(afterPoll).toEqual([]);
    expect(sessionApi.pendingNewSessionId).toBeNull();
  });

  it("uses a provided realId when removing a locally identified backend chat", async () => {
    const sessionApi = (await import("./index")).default;

    await sessionApi.createSession({ name: "", messages: [] });
    await sessionApi.removeSession({
      id: "1234567890",
      realId: "backend-1",
    } as any);

    expect(mockApi.deleteChat).toHaveBeenCalledWith("backend-1");
  });

  it("keeps local messages until a pending session is resolved to a backend chat", async () => {
    const sessionApi = (await import("./index")).default;
    const messages = [{ id: "m1", role: "user", cards: [] }];

    await sessionApi.createSession({ name: "", messages: [] });
    await sessionApi.updateSession({
      id: "1234567890",
      messages: messages as any,
    });
    const session = await sessionApi.getSession("1234567890");

    expect(session.messages).toBe(messages);
  });

  it("recovers a numeric URL session from backend session_id after navigation", async () => {
    mockApi.listChats.mockResolvedValue([
      {
        id: "backend-1",
        name: "My Skills",
        session_id: "1234567890",
        user_id: "default",
        channel: "console",
        meta: {},
        status: "idle",
      },
    ]);
    const sessionApi = (await import("./index")).default;

    const sessions = await sessionApi.getSessionList();
    const session = await sessionApi.getSession("1234567890");

    expect(sessions[0]).toMatchObject({
      id: "1234567890",
      realId: "backend-1",
      sessionId: "1234567890",
    });
    expect(mockApi.getChat).toHaveBeenCalledWith("backend-1");
    expect(session).toMatchObject({
      id: "1234567890",
      realId: "backend-1",
      name: "My Skills",
    });
  });

  it("recovers a pending numeric session once the backend chat appears", async () => {
    const sessionApi = (await import("./index")).default as any;

    await sessionApi.createSession({ name: "", messages: [] });
    mockApi.listChats.mockResolvedValue([
      {
        id: "backend-1",
        name: "My Skills",
        session_id: "1234567890",
        user_id: "default",
        channel: "console",
        meta: {},
        status: "idle",
      },
    ]);

    const session = await sessionApi.getSession("1234567890");

    expect(sessionApi.pendingNewSessionId).toBeNull();
    expect(mockApi.getChat).toHaveBeenCalledWith("backend-1");
    expect(session).toMatchObject({
      id: "1234567890",
      realId: "backend-1",
      name: "My Skills",
    });
  });

  it("deletes a backend chat when removing by its local timestamp session_id", async () => {
    mockApi.listChats.mockResolvedValue([
      {
        id: "backend-1",
        name: "My Skills",
        session_id: "1234567890",
        user_id: "default",
        channel: "console",
        meta: {},
        status: "idle",
      },
    ]);
    const sessionApi = (await import("./index")).default;

    await sessionApi.getSessionList();
    await sessionApi.removeSession({ id: "1234567890" });

    expect(mockApi.deleteChat).toHaveBeenCalledWith("backend-1");
  });
});

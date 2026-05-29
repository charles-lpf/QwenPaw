# Left Sidebar New Chat Handoff

## Current User-Visible Problem

The right-side chat header "new task/new chat" button works: after clicking it, sending a message receives an assistant response.

The left sidebar "我的任务" row has a `+` icon. Clicking this icon opens a New Chat view, and the user can send a message, but the assistant response never appears. The UI enters a sending/loading state and can appear stuck.

The latest user statement was:

> 目前还没有解决，你生成一份交接的md文档，由其他大模型接手开发

So this document is a handoff for another model/developer to continue.

## Environment

- Repo: `/Users/charles/Desktop/project/qwenpaw`
- Frontend dev URL used by user: `http://localhost:5173`
- Backend API observed on: `http://localhost:8088`
- Frontend package directory: `/Users/charles/Desktop/project/qwenpaw/console`
- TypeScript check command:

```bash
cd /Users/charles/Desktop/project/qwenpaw/console
npx tsc -b --noEmit
```

At the time of this handoff, `npx tsc -b --noEmit` passed after the recent edits.

## Verified Facts

1. Backend streaming is healthy.

I manually tested the backend SSE endpoint and it returned a normal assistant response:

```bash
curl -sS -N -m 20 http://localhost:8088/api/console/chat \
  -H 'Content-Type: application/json' \
  -d '{"input":[{"role":"user","type":"message","content":[{"type":"text","text":"hi"}]}],"session_id":"codex_debug_1","user_id":"default","channel":"console","stream":true}'
```

This returned `response.created`, `response.in_progress`, assistant message chunks, and `response.completed`.

2. The right-side header button works because it is inside the `@agentscope-ai/chat` context and calls:

```tsx
const { createSession } = useChatAnywhereSessions();
```

See:

- `console/src/pages/Chat/components/ChatActionGroup/index.tsx`

3. The left sidebar is outside the chat context. Directly calling `useChatAnywhereSessions()` in `Sidebar` would use the default/no-op context or be invalid by design.

4. The original left `+` only did:

```tsx
navigate("/chat");
```

This opens the New Chat route visually but does not necessarily create the internal chat session state expected by the library.

5. The current attempted fix dispatches a browser event from Sidebar and listens for it in `ChatActionGroup`, which is inside the chat context. The user reports this still does not solve the issue.

## Related Files

### User-facing current work

- `console/src/layouts/Sidebar.tsx`
  - Renders left sidebar.
  - Contains the "我的任务" row and left `+` button.
  - Now imports `requestCreateChatSession` from `../pages/Chat/events`.
  - Current left `+` logic roughly:

```tsx
navigate("/chat");
window.setTimeout(() => {
  requestCreateChatSession();
}, 0);
```

- `console/src/pages/Chat/events.ts`
  - Added event bridge:

```ts
export const CREATE_CHAT_SESSION_EVENT = "qwenpaw:create-chat-session";
export function requestCreateChatSession(): void {
  window.dispatchEvent(new CustomEvent(CREATE_CHAT_SESSION_EVENT));
}
```

- `console/src/pages/Chat/components/ChatActionGroup/index.tsx`
  - Right header actions.
  - Now listens to `CREATE_CHAT_SESSION_EVENT` and calls `createSession()`.
  - The right-side button itself still calls `createSession()` directly.

### Session lifecycle files

- `console/src/pages/Chat/components/ChatSessionInitializer/index.tsx`
  - Syncs `/chat/:id` URL to chat context current session id.
  - Was changed to allow `/chat` to show empty New Chat by clearing the current session unless the current session is the freshly-created pending session.

- `console/src/pages/Chat/sessionApi/index.ts`
  - Implements `IAgentScopeRuntimeWebUISessionAPI`.
  - Added `pendingNewSessionId`.
  - `createSession()` sets `pendingNewSessionId = session.id`.
  - `_doGetSession()` now returns a local empty session immediately when `sessionId === pendingNewSessionId`, instead of waiting for a real backend id.
  - `resolveAndNotify()` clears `pendingNewSessionId` after resolving the real backend id.

### Shared session history list work

- `console/src/pages/Chat/components/ChatSessionList/index.tsx`
- `console/src/pages/Chat/components/ChatSessionList/index.module.less`
- `console/src/pages/Chat/components/ChatSessionList/useChatSessionListController.ts`
- `console/src/pages/Chat/components/ChatSessionDrawer/index.tsx`

This was the implementation for showing the chat history under "我的任务" in the left sidebar and reusing the list in the right drawer.

## Important Existing Context

The app uses `@agentscope-ai/chat`.

Important library behavior found in `console/node_modules/@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Chat/hooks/useChatSessionHandler.js`:

- On submit, `ensureSession(query)` calls `createSession({ name: query })` only if `getCurrentSessionId()` is empty.
- Then `updateSessionName(query, messages)` and `syncSessionMessages(...)` run.
- If current session id is wrong, undefined at the wrong time, or points to a session that `sessionApi.getSession()` blocks on, the UI can enter loading without processing the SSE result.

Important library behavior found in `console/node_modules/@agentscope-ai/chat/lib/AgentScopeRuntimeWebUI/core/Context/ChatAnywhereSessionsContext.js`:

- `createSession()` calls `options.api.createSession(...)`, then `setCurrentSessionId(session.id)`, then `setMessages(session.messages)`.
- This is why the right-side button is the most reliable known path.

## Current Hypotheses

### Hypothesis 1: Event fires before ChatActionGroup listener is mounted

The left `+` does `navigate("/chat")` and then `setTimeout(..., 0)` to dispatch the event. If the current page is not already the Chat page, the event may fire before `ChatActionGroup` mounts and registers the listener. The user is likely already on `/chat`, but this should still be verified.

Possible fix:

- Move the event listener higher, into a component that is always mounted inside the chat context, or
- Use navigation state/query param and consume it inside `Chat` after mount, e.g. `navigate("/chat?new=1")`, then in `Chat`/`ChatActionGroup` effect call `createSession()` once.

### Hypothesis 2: Sidebar list polling overwrites the pending local session

The left sidebar session list polls `sessionApi.getSessionList()` every 3 seconds through `useChatSessionListController`.

`sessionApi.getSessionList()` updates the internal `sessionList` from backend chats. If a pending local session was just created but not yet persisted, polling may overwrite the internal list before the first request completes. This could disrupt pending session resolution or current session sync.

Possible fix:

- Preserve the pending local session inside `applyChatsToSessionList()` while `pendingNewSessionId` is set.
- Or pause sidebar history polling while `pendingNewSessionId` exists.
- Or make `sessionApi.createSession()` insert the local session into `this.sessionList` immediately, so it is not only in React context.

Suggested code direction:

```ts
async createSession(session: Partial<IAgentScopeRuntimeWebUISession>) {
  session.id = Date.now().toString();
  const extended = { ... } as ExtendedSession;
  this.updateWindowVariables(extended);
  this.pendingNewSessionId = session.id;
  this.sessionList = [extended, ...this.sessionList.filter((s) => s.id !== extended.id)];
  this.onSessionCreated?.(session.id);
  return [...this.sessionList];
}
```

Then audit `applyChatsToSessionList()` so it does not drop `pendingNewSessionId` before it resolves.

### Hypothesis 3: `/chat` route clear logic still races with `createSession()`

`ChatSessionInitializer` clears the current session when there is no `chatId`, unless it is the pending session. If `pendingNewSessionId` has not been set yet, or is cleared too early, the initializer can still clear the newly-created session.

Possible fix:

- Move the "create new session from left +" handling fully inside Chat after URL reaches `/chat`, and only clear current session after deciding no create request is pending.
- Add a route state flag such as:

```tsx
navigate("/chat", { state: { createNewSession: true } });
```

Then inside `Chat` or `ChatActionGroup`, use `useLocation()` and `createSession()` after mount. This avoids global event ordering issues.

### Hypothesis 4: The left `+` should not depend on `/chat` empty-state auto-create

The right button path is known good. The left button should probably trigger exactly that path after the Chat context exists. The cleanest architecture may be:

1. Sidebar dispatches an intent, not a session operation.
2. MainLayout or Chat route stores `pendingCreateChat` in a small global store.
3. ChatActionGroup/Chat page consumes the intent after mount and calls `createSession()`.
4. The intent is cleared after the returned session id is created.

## Recommended Next Debug Steps

1. Add temporary logs around the left `+` flow:

```ts
console.log("[left plus] navigate /chat");
console.log("[event] requestCreateChatSession dispatch");
console.log("[ChatActionGroup] received create event");
console.log("[ChatActionGroup] createSession result", id);
console.log("[sessionApi] createSession", session.id);
console.log("[initializer] no chatId", currentSessionId, sessionApi.pendingNewSessionId);
console.log("[customFetch] requestBody", requestBody);
```

2. In Chrome DevTools Network, compare a successful right-button request and failing left-button request:

- `POST /api/console/chat`
- request body `session_id`
- HTTP status
- response body/stream chunks
- whether `response.completed` arrives

3. Check whether failing left flow sends `POST /api/console/chat` at all.

- If no request: issue is before `customFetch`, likely session creation/currentSessionId.
- If request returns SSE but UI ignores it: issue is likely `currentQARef.activeSessionId` mismatch or session changed mid-stream.
- If request hangs: compare session_id and backend logs.

4. Temporarily disable sidebar session polling (`poll: false` in Sidebar controller) and retest left `+`.

If disabling polling makes the left `+` work, preserve pending local sessions in `sessionApi.getSessionList()` / `applyChatsToSessionList()`.

5. Try replacing the event bridge with route-state consumption:

Sidebar:

```tsx
navigate("/chat", { state: { createNewSession: Date.now() } });
```

Chat page or ChatActionGroup:

```tsx
const location = useLocation();
useEffect(() => {
  if (!location.state?.createNewSession) return;
  void createSession();
  navigate("/chat", { replace: true, state: null });
}, [location.state, createSession, navigate]);
```

This is likely more reliable than `window.setTimeout(...dispatchEvent...)`.

## Existing Verification

Already run successfully:

```bash
cd /Users/charles/Desktop/project/qwenpaw/console
npx tsc -b --noEmit
```

Backend SSE direct curl returned a normal assistant response.

## Caution

The working tree contains many user-requested changes unrelated to this specific bug:

- Menu hiding/toggle work in `Sidebar` and `Header`.
- Branding/welcome changes.
- Vite proxy work.
- Desktop icon changes.
- Default agent changes.
- Shared chat history list implementation.

Do not reset or revert unrelated files. Work with the current dirty tree.

## Current Desired Acceptance Criteria

- Clicking right-side new task still works.
- Clicking left "我的任务" `+` creates a New Chat that can send and receive the first assistant response.
- New chat should not be persisted until the first message is sent, preserving the intended current behavior if possible.
- Left history list and right drawer remain in sync after the new chat is persisted.
- `npx tsc -b --noEmit` passes.

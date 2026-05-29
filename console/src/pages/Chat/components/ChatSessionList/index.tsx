import React, {
  useCallback,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { Input, Spin } from "antd";
import { FixedSizeList, type ListChildComponentProps } from "react-window";
import {
  SparkDeleteLine,
  SparkEditLine,
  SparkMarkFill,
  SparkMarkLine,
} from "@agentscope-ai/icons";
import { useTranslation } from "react-i18next";
import ChatSessionItem from "../ChatSessionItem";
import { getChannelLabel } from "../../../Control/Channels/components";
import type { ContextMenuItem } from "../../../../components/ContextMenu";
import {
  formatCreatedAt,
  useChatSessionListController,
  type ExtendedChatSession,
} from "./useChatSessionListController";
import styles from "./index.module.less";

const DRAWER_ITEM_HEIGHT = 77;

type Controller = ReturnType<typeof useChatSessionListController>;

interface ChatSessionListProps {
  controller: Controller;
  variant: "drawer" | "sidebar";
  onContextMenu?: (sessionId: string, event: React.MouseEvent) => void;
  maxSidebarItems?: number;
}

interface DrawerRowData {
  sessions: ExtendedChatSession[];
  controller: Controller;
  t: ReturnType<typeof useTranslation>["t"];
  onContextMenu?: (sessionId: string, event: React.MouseEvent) => void;
}

const DrawerSessionRow = React.memo(function DrawerSessionRow({
  index,
  style,
  data,
}: ListChildComponentProps<DrawerRowData>) {
  const session = data.sessions[index];
  const channelKey = session.channel?.trim() || "";
  const channelLabel = channelKey
    ? getChannelLabel(channelKey, data.t)
    : undefined;
  const isEditing = data.controller.editingSessionId === session.id;
  const isDisabled =
    !!data.controller.switchingSessionId &&
    session.id !== data.controller.switchingSessionId;

  return (
    <div style={style}>
      <ChatSessionItem
        sessionId={session.id}
        name={session.name || "New Chat"}
        time={formatCreatedAt(session.createdAt ?? null)}
        channelKey={channelKey || undefined}
        channelLabel={channelLabel}
        chatStatus={session.status}
        generating={session.generating}
        pinned={session.pinned}
        active={session.id === data.controller.currentSessionId}
        disabled={isDisabled}
        editing={isEditing}
        editValue={isEditing ? data.controller.editValue : undefined}
        onClick={data.controller.handleSessionClick}
        onEdit={data.controller.handleEditStart}
        onDelete={data.controller.handleDelete}
        onPin={data.controller.handlePinToggle}
        onEditChange={data.controller.handleEditChange}
        onEditSubmit={data.controller.handleEditSubmit}
        onEditCancel={data.controller.handleEditCancel}
        onContextMenu={data.onContextMenu}
      />
    </div>
  );
});

function SidebarSessionItem({
  session,
  controller,
}: {
  session: ExtendedChatSession;
  controller: Controller;
}) {
  const isComposingRef = useRef(false);
  const isEditing = controller.editingSessionId === session.id;
  const isDisabled =
    !!controller.switchingSessionId &&
    session.id !== controller.switchingSessionId;

  const className = [
    styles.sidebarItem,
    session.id === controller.currentSessionId ? styles.sidebarItemActive : "",
    isDisabled ? styles.sidebarItemDisabled : "",
  ]
    .filter(Boolean)
    .join(" ");

  const stopAction = (
    event: React.MouseEvent,
    action: () => void | Promise<void>,
  ) => {
    event.stopPropagation();
    void action();
  };

  return (
    <div
      className={className}
      onClick={
        isEditing ? undefined : () => controller.handleSessionClick(session.id)
      }
      title={session.name || "New Chat"}
    >
      {isEditing ? (
        <Input
          autoFocus
          size="small"
          className={styles.sidebarEditInput}
          value={controller.editValue}
          onChange={(event) => controller.handleEditChange(event.target.value)}
          onCompositionStart={() => {
            isComposingRef.current = true;
          }}
          onCompositionEnd={() => {
            isComposingRef.current = false;
          }}
          onKeyDown={(event) => {
            if (
              event.key === "Enter" &&
              !event.nativeEvent.isComposing &&
              !isComposingRef.current
            ) {
              event.preventDefault();
              void controller.handleEditSubmit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              controller.handleEditCancel();
            }
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!isComposingRef.current) {
                void controller.handleEditSubmit();
              }
            }, 100);
          }}
          onClick={(event) => event.stopPropagation()}
        />
      ) : (
        <>
          <span className={styles.sidebarName}>
            {session.name || "New Chat"}
          </span>
          {session.pinned && (
            <span className={styles.sidebarPinnedMark}>
              <SparkMarkFill />
            </span>
          )}
          <span className={styles.sidebarActions}>
            <button
              type="button"
              className={styles.sidebarActionButton}
              onClick={(event) =>
                stopAction(event, () =>
                  controller.handleEditStart(
                    session.id,
                    session.name || "New Chat",
                  ),
                )
              }
              aria-label="Rename"
            >
              <SparkEditLine />
            </button>
            <button
              type="button"
              className={styles.sidebarActionButton}
              onClick={(event) =>
                stopAction(event, () => controller.handleDelete(session.id))
              }
              aria-label="Delete"
            >
              <SparkDeleteLine />
            </button>
            <button
              type="button"
              className={styles.sidebarActionButton}
              onClick={(event) =>
                stopAction(event, () => controller.handlePinToggle(session.id))
              }
              aria-label={session.pinned ? "Unpin" : "Pin"}
            >
              {session.pinned ? <SparkMarkFill /> : <SparkMarkLine />}
            </button>
          </span>
        </>
      )}
    </div>
  );
}

export function buildChatSessionContextMenuItems({
  controller,
  sessionId,
  sessions,
  t,
}: {
  controller: Controller;
  sessionId: string | null;
  sessions: ExtendedChatSession[];
  t: ReturnType<typeof useTranslation>["t"];
}): ContextMenuItem[] {
  if (!sessionId) return [];
  const session = sessions.find((item) => item.id === sessionId);
  return [
    {
      key: "open",
      label: t("chat.contextMenu.open", "Open"),
      onClick: () => controller.handleSessionClick(sessionId),
    },
    {
      key: "rename",
      label: t("chat.contextMenu.rename", "Rename"),
      onClick: () =>
        controller.handleEditStart(sessionId, session?.name || "New Chat"),
    },
    {
      key: "pin",
      label: session?.pinned
        ? t("chat.contextMenu.unpin", "Unpin")
        : t("chat.contextMenu.pin", "Pin"),
      onClick: () => controller.handlePinToggle(sessionId),
    },
    { key: "divider-1", label: "", divider: true },
    {
      key: "delete",
      label: t("chat.contextMenu.delete", "Delete"),
      danger: true,
      onClick: () => controller.handleDelete(sessionId),
    },
  ];
}

export default function ChatSessionList({
  controller,
  variant,
  onContextMenu,
  maxSidebarItems,
}: ChatSessionListProps) {
  const { t } = useTranslation();
  const [listHeight, setListHeight] = useState(0);
  const observerRef = useRef<ResizeObserver | null>(null);

  const listWrapperRef = useCallback((node: HTMLDivElement | null) => {
    if (observerRef.current) {
      observerRef.current.disconnect();
      observerRef.current = null;
    }

    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        if (height > 0) {
          setListHeight(height);
        }
      }
    });

    observer.observe(node);
    observerRef.current = observer;

    const initialHeight = node.clientHeight;
    if (initialHeight > 0) {
      setListHeight(initialHeight);
    }
  }, []);

  const sidebarSessions = maxSidebarItems
    ? controller.sortedSessions.slice(0, maxSidebarItems)
    : controller.sortedSessions;

  const drawerData = useMemo<DrawerRowData>(
    () => ({
      sessions: controller.sortedSessions,
      controller,
      t,
      onContextMenu,
    }),
    [controller, onContextMenu, t],
  );

  if (variant === "sidebar") {
    if (controller.loading) {
      return (
        <div className={styles.sidebarLoading}>
          <Spin size="small" />
        </div>
      );
    }

    if (!sidebarSessions.length) {
      return <div className={styles.sidebarEmpty}>{t("chat.noChats")}</div>;
    }

    return (
      <div className={styles.sidebarList}>
        {sidebarSessions.map((session) => (
          <SidebarSessionItem
            key={session.id}
            session={session}
            controller={controller}
          />
        ))}
      </div>
    );
  }

  const wrapperStyle: CSSProperties | undefined = controller.switchingSessionId
    ? { pointerEvents: "none" }
    : undefined;

  return (
    <div
      className={styles.drawerListWrapper}
      ref={listWrapperRef}
      style={wrapperStyle}
    >
      <div className={styles.topGradient} />
      {controller.loading ? (
        <div className={styles.drawerLoading}>
          <Spin />
        </div>
      ) : (
        <>
          {controller.sortedSessions.length * DRAWER_ITEM_HEIGHT >
            listHeight && (
            <div className={styles.virtualListBackground}>
              <Spin size="small" />
            </div>
          )}
          <FixedSizeList
            height={listHeight}
            width="100%"
            itemCount={controller.sortedSessions.length}
            itemSize={DRAWER_ITEM_HEIGHT}
            overscanCount={20}
            itemData={drawerData}
            className={styles.drawerList}
          >
            {DrawerSessionRow}
          </FixedSizeList>
        </>
      )}
      <div className={styles.bottomGradient} />
    </div>
  );
}

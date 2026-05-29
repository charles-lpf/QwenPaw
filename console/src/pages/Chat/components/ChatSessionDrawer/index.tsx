import React, { useCallback, useMemo, useState } from "react";
import { Drawer, Tooltip } from "antd";
import { IconButton } from "@agentscope-ai/design";
import {
  SparkLockFill,
  SparkLockLine,
  SparkOperateRightLine,
} from "@agentscope-ai/icons";
import {
  useChatAnywhereSessions,
  useChatAnywhereSessionsState,
} from "@agentscope-ai/chat";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  useContextMenu,
} from "../../../../components/ContextMenu";
import ChatSessionList, {
  buildChatSessionContextMenuItems,
} from "../ChatSessionList";
import { useChatSessionListController } from "../ChatSessionList/useChatSessionListController";
import styles from "./index.module.less";

interface ChatSessionDrawerProps {
  /** Whether the drawer is visible */
  open: boolean;
  /** Callback to close the drawer */
  onClose: () => void;
  /** Whether the drawer is pinned (stays open) */
  pinned?: boolean;
  /** Callback to toggle the pinned state */
  onPinChange?: (pinned: boolean) => void;
}

const ChatSessionDrawer: React.FC<ChatSessionDrawerProps> = (props) => {
  const { t } = useTranslation();
  const { sessions, currentSessionId, setCurrentSessionId, setSessions } =
    useChatAnywhereSessionsState();
  const { createSession } = useChatAnywhereSessions();
  const sharedContextMenu = useContextMenu();
  const [contextMenuSessionId, setContextMenuSessionId] = useState<
    string | null
  >(null);

  const controller = useChatSessionListController({
    sessions,
    setSessions,
    currentSessionId,
    setCurrentSessionId,
    active: props.open,
    poll: true,
  });

  /** Create a new session; close the drawer only when not pinned */
  const handleCreateSession = useCallback(async () => {
    await createSession();
    if (!props.pinned) {
      props.onClose();
    }
  }, [createSession, props.onClose, props.pinned]);

  /** Show shared context menu for a specific session */
  const handleItemContextMenu = useCallback(
    (sessionId: string, event: React.MouseEvent) => {
      setContextMenuSessionId(sessionId);
      sharedContextMenu.show(event);
    },
    [sharedContextMenu],
  );

  /** Build context menu items for the currently right-clicked session */
  const contextMenuItems = useMemo(
    () =>
      buildChatSessionContextMenuItems({
        controller,
        sessionId: contextMenuSessionId,
        sessions: controller.sortedSessions,
        t,
      }),
    [contextMenuSessionId, controller, t],
  );

  return (
    <Drawer
      open={props.open}
      onClose={props.pinned ? undefined : props.onClose}
      destroyOnClose={!props.pinned}
      placement="right"
      width={360}
      closable={false}
      title={null}
      mask={!props.pinned}
      styles={{
        header: { display: "none" },
        body: {
          padding: 0,
          display: "flex",
          flexDirection: "column",
          height: "100%",
          overflow: "hidden",
        },
        mask: { background: "transparent" },
      }}
      className={styles.drawer}
    >
      {/* Header bar */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerTitle}>{t("chat.allChats")}</span>
        </div>
        <div className={styles.headerRight}>
          <Tooltip
            title={
              props.pinned
                ? t("chat.unpinDrawer", "Unpin")
                : t("chat.pinDrawer", "Pin")
            }
            mouseEnterDelay={0.5}
          >
            <IconButton
              bordered={false}
              icon={props.pinned ? <SparkLockFill /> : <SparkLockLine />}
              className={props.pinned ? styles.pinActive : undefined}
              onClick={() => props.onPinChange?.(!props.pinned)}
            />
          </Tooltip>
          {!props.pinned && (
            <IconButton
              bordered={false}
              icon={<SparkOperateRightLine />}
              onClick={props.onClose}
            />
          )}
        </div>
      </div>

      {/* Create new chat button */}
      <div className={styles.createSection}>
        <div className={styles.createButton} onClick={handleCreateSession}>
          {t("chat.createNewChat")}
        </div>
      </div>

      <ChatSessionList
        controller={controller}
        variant="drawer"
        onContextMenu={handleItemContextMenu}
      />

      {/* Shared context menu — single instance for all session items */}
      <ContextMenu
        visible={sharedContextMenu.visible}
        x={sharedContextMenu.x}
        y={sharedContextMenu.y}
        items={contextMenuItems}
        onClose={sharedContextMenu.hide}
      />
    </Drawer>
  );
};

export default ChatSessionDrawer;

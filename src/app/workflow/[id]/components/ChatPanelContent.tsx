"use client";

import React from "react";
import ChatPanelHeader from "./ChatPanelHeader";
import ChatInterface, { ChatMessage } from "../../../components/ChatInterface";
import ChangesPanel from "../../../components/ChangesPanel";

type ChatPanelContentProps = {
  activeTab: "chat" | "history";
  messages: ChatMessage[];
  onSendMessage: (message: string) => Promise<void> | void;
  onAbort: () => void;
  isProcessing: boolean;
  caseId: number;
  onQuickAction: () => void;
  onClearChat: () => void;
};

export default function ChatPanelContent({
  activeTab,
  messages,
  onSendMessage,
  onAbort,
  isProcessing,
  caseId,
  onQuickAction,
  onClearChat,
}: ChatPanelContentProps) {
  return (
    <div className="flex-1 overflow-hidden flex flex-col">
      {activeTab === "chat" ? (
        <>
          <ChatPanelHeader
            onQuickAction={onQuickAction}
            onClearChat={onClearChat}
          />
          <div className="flex-1 overflow-hidden">
            <ChatInterface
              messages={messages}
              onSendMessage={onSendMessage}
              onAbort={onAbort}
              isProcessing={isProcessing}
              isLoading={false}
              caseid={caseId}
            />
          </div>
        </>
      ) : (
        <ChangesPanel caseid={caseId} />
      )}
    </div>
  );
}

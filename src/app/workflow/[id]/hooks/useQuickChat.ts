"use client";

import { useCallback, useRef, useState } from "react";
import { Field, Stage } from "../../../types";
import { composeQuickChatMessage } from "../utils/composeQuickChatMessage";
import useQuickSelectionSummary from "./useQuickSelectionSummary";
import useChatMessaging from "./useChatMessaging";

type UseQuickChatArgs = {
  stages: Stage[];
  fields: Field[];
  views: { id: number; name: string }[];
  selectedFieldIds: number[];
  selectedViewIds: number[];
  selectedStageIds: number[];
  selectedProcessIds: number[];
  selectedStepIds: number[];
  messages: any[];
  setMessagesAction: (updater: (prev: any[]) => any[]) => void;
  setIsProcessingAction: (next: boolean) => void;
  selectedCase: { id: number; name: string } | null;
  refreshWorkflowDataAction: () => Promise<void>;
  setSelectedViewAction: (next: string | null) => void;
  setActiveStageAction: (next: string | undefined) => void;
  setActiveProcessAction: (next: string | undefined) => void;
  setActiveStepAction: (next: string | undefined) => void;
};

export function useQuickChat({
  stages,
  fields,
  views,
  selectedFieldIds,
  selectedViewIds,
  selectedStageIds,
  selectedProcessIds,
  selectedStepIds,
  messages,
  setMessagesAction,
  setIsProcessingAction,
  selectedCase,
  refreshWorkflowDataAction,
  setSelectedViewAction,
  setActiveStageAction,
  setActiveProcessAction,
  setActiveStepAction,
}: UseQuickChatArgs) {
  const [isQuickChatOpen, setIsQuickChatOpen] = useState(false);
  const [quickChatText, setQuickChatText] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);

  const quickSelectionSummary = useQuickSelectionSummary({
    stages,
    selectedStageIds,
    selectedProcessIds,
    selectedStepIds,
    selectedFieldIds,
    selectedViewIds,
  });

  const { handleSendMessage } = useChatMessaging({
    messages,
    setMessagesAction,
    setIsProcessingAction,
    selectedCase,
    stages,
    refreshWorkflowDataAction,
    setSelectedViewAction,
    setActiveStageAction,
    setActiveProcessAction,
    setActiveStepAction,
  });

  const sendQuickChat = useCallback(
    async (textArg?: string) => {
      const text = (textArg ?? quickChatText).trim();
      if (!text) return;
      const composedMessage = composeQuickChatMessage({
        quickChatText: text,
        selectedFieldIds,
        selectedViewIds,
        selectedStageIds,
        selectedProcessIds,
        selectedStepIds,
        fields: fields.map((f) => ({ id: f.id as number, name: f.name })),
        views: views.map((v) => ({ id: v.id as number, name: v.name })),
        stages: stages as any,
      });
      // Leave closing/clearing to caller (so UI can control timing)
      void handleSendMessage(composedMessage);
    },
    [
      quickChatText,
      selectedFieldIds,
      selectedViewIds,
      selectedStageIds,
      selectedProcessIds,
      selectedStepIds,
      fields,
      views,
      stages,
      handleSendMessage,
    ],
  );

  return {
    isQuickChatOpen,
    setIsQuickChatOpen,
    quickChatText,
    setQuickChatText,
    quickInputRef,
    quickSelectionSummary,
    sendQuickChat,
  } as const;
}

"use client";

import { useCallback, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import { Service } from "../../../services/service";
import processToolResponse from "../utils/processToolResponse";
import { Stage } from "../../../types";
import { ChatMessage } from "../../../components/ChatInterface";

type MinimalCase = {
  id: number;
  name: string;
  model?: any;
};

type UseChatMessagingArgs = {
  messages: ChatMessage[];
  setMessagesAction: (updater: (prev: ChatMessage[]) => ChatMessage[]) => void;
  setIsProcessingAction: (next: boolean) => void;
  selectedCase: MinimalCase | null;
  stages: Stage[];
  refreshWorkflowDataAction: () => Promise<void>;
  setSelectedViewAction: (next: string | null) => void;
  setActiveStageAction: (next: string | undefined) => void;
  setActiveProcessAction: (next: string | undefined) => void;
  setActiveStepAction: (next: string | undefined) => void;
};

export default function useChatMessaging({
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
}: UseChatMessagingArgs) {
  const abortRef = useRef<AbortController | null>(null);
  const handleSendMessage = useCallback(
    async (message: string) => {
      let aiMessageId: string;

      try {
        setIsProcessingAction(true);

        // Add user message immediately
        setMessagesAction((prev) => [
          ...prev,
          {
            id: uuidv4(),
            content: message,
            sender: "user",
            timestamp: new Date(),
          },
        ]);

        // Add a placeholder AI message that will be updated with the response
        aiMessageId = uuidv4();
        setMessagesAction((prev) => [
          ...prev,
          {
            id: aiMessageId,
            content: "",
            sender: "assistant",
            timestamp: new Date(),
            isThinking: true,
          },
        ]);

        // Build conversation history (excluding the just-typed message which we add separately)
        const history = messages
          .filter((m) => typeof m.content === "string" && m.content.trim())
          .map((m) => ({
            role:
              m.sender === "user" ? ("user" as const) : ("assistant" as const),
            content: m.content,
          }));

        abortRef.current = new AbortController();

        const response = await Service.generateResponse(
          message,
          selectedCase
            ? JSON.stringify({
                currentCaseId: selectedCase.id,
                name: selectedCase.name,
                stages,
                instructions:
                  "You are working with an EXISTING workflow. Use saveCase with isNew=false for any modifications. The current case ID is: " +
                  selectedCase.id,
              })
            : "",
          history,
          abortRef.current.signal,
        );

        if (!response.ok) {
          throw new Error(
            `Failed to generate response: ${response.statusText}`,
          );
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body available");
        }

        const decoder = new TextDecoder();
        let shouldReloadWorkflow = false;
        let currentThinkingContent = "";
        // Keep a ref to reader for cancellation on abort
        const readerRef = { current: reader };

        try {
          while (true) {
            const { done, value } = await readerRef.current.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split("\n");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6));

                  // Capture usage for this response (prefer total tokens when available)
                  if (data.usage) {
                    const usage = data.usage as {
                      prompt_tokens?: number;
                      completion_tokens?: number;
                      total_tokens?: number;
                      prompt_tokens_approx?: number;
                    };
                    let tokenCount: number | undefined = undefined;
                    let tokenExact = false;
                    // 1) Exact total from API if present
                    if (typeof usage.total_tokens === "number") {
                      tokenCount = usage.total_tokens;
                      tokenExact = true;
                    } else if (
                      typeof usage.prompt_tokens === "number" &&
                      typeof usage.completion_tokens === "number"
                    ) {
                      // 2) Derive total from exact prompt + completion
                      tokenCount =
                        usage.prompt_tokens + usage.completion_tokens;
                      tokenExact = true;
                    } else if (typeof usage.prompt_tokens_approx === "number") {
                      // 3) Fallback to approximate (prompt only)
                      tokenCount = usage.prompt_tokens_approx;
                      tokenExact = false;
                    }
                    if (typeof tokenCount === "number") {
                      setMessagesAction((prev) =>
                        prev.map((msg) =>
                          msg.id === aiMessageId
                            ? { ...msg, tokenCount, tokenExact }
                            : msg,
                        ),
                      );
                    }
                  }

                  if (data.text) {
                    // Filter noisy tool outputs
                    const lowerText = String(data.text).toLowerCase();
                    const isListTool =
                      lowerText.includes("listviews") ||
                      lowerText.includes("listfields");

                    const shouldFilter =
                      isListTool &&
                      (lowerText.includes('"id":') ||
                        lowerText.includes('"name":') ||
                        lowerText.includes('"type":') ||
                        lowerText.includes('"caseid":') ||
                        lowerText.includes('"model":') ||
                        lowerText.includes('"primary":') ||
                        lowerText.includes('"required":') ||
                        lowerText.includes('"label":') ||
                        lowerText.includes('"description":') ||
                        lowerText.includes('"order":') ||
                        lowerText.includes('"options":') ||
                        lowerText.includes('"defaultvalue":')) &&
                      !lowerText.includes("workflow") &&
                      !lowerText.includes("fields created") &&
                      !lowerText.includes("views created") &&
                      !lowerText.includes("stages") &&
                      !lowerText.includes("processes") &&
                      !lowerText.includes("steps") &&
                      !lowerText.includes("breakdown") &&
                      !lowerText.includes("summary");

                    const isRawJsonToolResult =
                      String(data.text).trim().startsWith("{") &&
                      String(data.text).trim().endsWith("}") &&
                      (lowerText.includes('"id":') ||
                        lowerText.includes('"name":') ||
                        lowerText.includes('"type":') ||
                        lowerText.includes('"caseid":') ||
                        lowerText.includes('"model":') ||
                        lowerText.includes('"primary":') ||
                        lowerText.includes('"required":') ||
                        lowerText.includes('"label":') ||
                        lowerText.includes('"description":') ||
                        lowerText.includes('"order":') ||
                        lowerText.includes('"options":') ||
                        lowerText.includes('"defaultvalue":')) &&
                      !(
                        lowerText.includes('"ids":') &&
                        lowerText.includes('"fields":')
                      );

                    if (!shouldFilter && !isRawJsonToolResult) {
                      let processedText = processToolResponse(
                        String(data.text),
                      );
                      currentThinkingContent += processedText;
                      setMessagesAction((prev) =>
                        prev.map((msg) =>
                          msg.id === aiMessageId
                            ? {
                                ...msg,
                                content: currentThinkingContent,
                                isThinking: true,
                              }
                            : msg,
                        ),
                      );
                    }

                    // Track if a reload is needed
                    if (data.text) {
                      const lt = lowerText;
                      if (
                        lt.includes("created") ||
                        lt.includes("saved") ||
                        lt.includes("deleted") ||
                        lt.includes("removed") ||
                        lt.includes("operation completed successfully") ||
                        lt.includes("updated") ||
                        lt.includes("all constraints satisfied") ||
                        lt.includes("task completed successfully") ||
                        lt.includes("[[completed]]") ||
                        (lt.includes("workflow") &&
                          lt.includes("saved successfully"))
                      ) {
                        shouldReloadWorkflow = true;
                      }
                    }
                  }

                  if (data.error) {
                    setMessagesAction((prev) => [
                      ...prev,
                      {
                        id: uuidv4(),
                        content: `Error: ${data.error}`,
                        sender: "assistant",
                        timestamp: new Date(),
                      },
                    ]);
                  }

                  if (data.done) {
                    // Clear thinking indicator and set total duration
                    const completedAt = Date.now();
                    setMessagesAction((prev) =>
                      prev.map((msg) =>
                        msg.id === aiMessageId
                          ? {
                              ...msg,
                              isThinking: false,
                              durationMs:
                                completedAt - new Date(msg.timestamp).getTime(),
                            }
                          : msg,
                      ),
                    );

                    if (shouldReloadWorkflow) {
                      console.debug(
                        "[chat] done=true; refreshing workflow data before preview update",
                      );
                      await refreshWorkflowDataAction();
                      setSelectedViewAction(null);
                      setActiveStageAction(undefined);
                      setActiveProcessAction(undefined);
                      setActiveStepAction(undefined);
                    }
                    break;
                  }
                } catch {
                  // ignore parse errors of non-JSON SSE lines
                }
              }
            }
          }
        } finally {
          try {
            // Cancel the stream before releasing to avoid BodyStreamBuffer errors
            try {
              await readerRef.current.cancel();
            } catch {}
            readerRef.current.releaseLock();
          } catch {}
        }
      } catch (error) {
        if ((error as any)?.name === "AbortError") {
          // Mark thinking false for the placeholder AI message and inform the user quietly
          setMessagesAction((prev) =>
            prev.map((msg) =>
              msg.isThinking ? { ...msg, isThinking: false } : msg,
            ),
          );
          setMessagesAction((prev) => [
            ...prev,
            {
              id: uuidv4(),
              content: "Stopped by user.",
              sender: "assistant",
              timestamp: new Date(),
            },
          ]);
          // Suppress logging for intentional aborts
          return;
        }
        // Non-abort errors: clear thinking and show a generic message
        setMessagesAction((prev) =>
          prev.map((msg) =>
            msg.isThinking ? { ...msg, isThinking: false } : msg,
          ),
        );
        setMessagesAction((prev) => [
          ...prev,
          {
            id: uuidv4(),
            content: "Sorry, there was an error processing your request.",
            sender: "assistant",
            timestamp: new Date(),
          },
        ]);
        console.error("Error sending message:", error);
      } finally {
        setIsProcessingAction(false);
        abortRef.current = null;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      messages,
      setMessagesAction,
      setIsProcessingAction,
      selectedCase?.id,
      selectedCase?.name,
      stages,
      refreshWorkflowDataAction,
      setSelectedViewAction,
      setActiveStageAction,
      setActiveProcessAction,
      setActiveStepAction,
    ],
  );

  const handleAbort = useCallback(() => {
    if (abortRef.current) {
      try {
        abortRef.current.abort();
      } catch {
        // ignore abort errors
      }
    }
  }, []);

  return { handleSendMessage, handleAbort } as const;
}

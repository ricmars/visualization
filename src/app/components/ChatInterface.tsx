import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-json';

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
}

export function ChatInterface({ messages, onSendMessage }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    // Highlight code blocks after messages update
    Prism.highlightAll();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim()) {
      onSendMessage(input.trim());
      setInput('');
    }
  };

  const formatDelta = (delta: any) => {
    switch (delta.type) {
      case 'add':
        return `Added ${delta.target.type} "${delta.target.name}"`;
      case 'delete':
        return `Deleted ${delta.target.type} "${delta.target.name}"`;
      case 'move':
        if (delta.target.type === 'step') {
          return `Moved step "${delta.target.name}" from stage ${delta.target.sourceStageId} to stage ${delta.target.targetStageId}`;
        }
        return `Moved ${delta.target.type} "${delta.target.name}"`;
      case 'update':
        return `Updated ${delta.target.type} "${delta.target.name}"`;
      default:
        return 'Unknown change';
    }
  };

  const renderMessage = (message: Message) => {
    if (message.type === 'json') {
      const content = typeof message.content === 'string' 
        ? JSON.parse(message.content) 
        : message.content;

      return (
        <div className="space-y-4">
          {content.message && (
            <p className="text-gray-700 dark:text-gray-300">{content.message}</p>
          )}
          
          {content.action?.changes && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Changes:</h4>
              <ul className="list-disc list-inside space-y-1 text-gray-700 dark:text-gray-300">
                {content.action.changes.map((delta: any, index: number) => (
                  <li key={index} className="ml-4">
                    {formatDelta(delta)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {content.visualization && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Workflow Summary:</h4>
              <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
                <p className="text-gray-700 dark:text-gray-300">
                  Total Stages: {content.visualization.totalStages}
                </p>
                <div className="mt-2 space-y-2">
                  {content.visualization.stageBreakdown.map((stage: any, index: number) => (
                    <div key={index} className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {stage.name} ({stage.status})
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {stage.stepCount} steps
                      </p>
                      {stage.steps && (
                        <ul className="mt-1 pl-4 text-sm text-gray-600 dark:text-gray-400">
                          {stage.steps.map((step: any, stepIndex: number) => (
                            <li key={stepIndex}>
                              • {step.name} ({step.status})
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {content.model && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-900 dark:text-gray-100">Technical Details:</h4>
              <pre className="text-sm bg-gray-800 rounded-lg p-4 overflow-x-auto">
                <code className="language-json">
                  {JSON.stringify(content.model, null, 2)}
                </code>
              </pre>
            </div>
          )}
        </div>
      );
    }

    return <p className={`${message.sender === 'ai' ? 'text-gray-700 dark:text-gray-300' : 'text-blue-600 dark:text-blue-400'}`}>{message.content}</p>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={chatContainerRef}>
        {messages.map((message, index) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-lg p-4 ${
                message.sender === 'user'
                  ? 'bg-blue-50 dark:bg-blue-900/20'
                  : 'bg-gray-50 dark:bg-gray-800/50'
              }`}
            >
              {renderMessage(message)}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <form onSubmit={handleSubmit} className="p-4 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex space-x-4">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command or ask a question..."
            className="flex-1 p-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 
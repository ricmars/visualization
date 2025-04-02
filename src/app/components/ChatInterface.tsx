import React, { useState, useRef, useEffect } from 'react';
import { Message } from '../types';
import dynamic from 'next/dynamic';
import Prism from 'prismjs';
import 'prismjs/themes/prism-tomorrow.css';
import 'prismjs/components/prism-json';
import { Service, LLMProvider } from '../services/service';

// Client-side only component for code highlighting
const CodeBlock = ({ code }: { code: string }) => {
  const codeRef = useRef<HTMLPreElement>(null);

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current);
    }
  }, [code]);

  return (
    <pre ref={codeRef} className="text-sm bg-gray-800 rounded-lg p-4 overflow-x-auto">
      <code className="language-json">
        {code}
      </code>
    </pre>
  );
};

// Dynamic import with SSR disabled
const DynamicCodeBlock = dynamic(() => Promise.resolve(CodeBlock), {
  ssr: false
});

interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  onClear: () => void;
}

export function ChatInterface({ messages, onSendMessage, onClear }: ChatInterfaceProps) {
  const [input, setInput] = useState('');
  const [provider, setProvider] = useState<LLMProvider>('gemini');
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

  const handleProviderChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newProvider = event.target.value as LLMProvider;
    setProvider(newProvider);
    Service.setProvider(newProvider);
  };

  interface Delta {
    type: 'add' | 'delete' | 'move' | 'update';
    target: {
      type: string;
      name: string;
      sourceStageId?: number;
      targetStageId?: number;
    };
  }

  const formatDelta = (delta: Delta) => {
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
                {content.action.changes.map((delta: Delta, index: number) => (
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
                <div 
                  className="mt-2 space-y-2 resize-y overflow-auto min-h-[200px] max-h-[600px] border border-gray-200 dark:border-gray-700 p-4 rounded-lg"
                  style={{ resize: 'vertical' }}
                >
                  {content.visualization.stageBreakdown.map((stage: { name: string; status: string; stepCount: number; steps?: { name: string; status: string }[] }, index: number) => (
                    <div key={index} className="pl-4 border-l-2 border-gray-200 dark:border-gray-700">
                      <p className="font-medium text-gray-800 dark:text-gray-200">
                        {stage.name} ({stage.status})
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {stage.stepCount} steps
                      </p>
                      {stage.steps && (
                        <ul className="mt-1 pl-4 text-sm text-gray-600 dark:text-gray-400">
                          {stage.steps.map((step: { name: string; status: string }, stepIndex: number) => (
                            <li key={stepIndex} className="py-1">
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
              <DynamicCodeBlock code={JSON.stringify(content.model, null, 2)} />
            </div>
          )}
        </div>
      );
    }

    return (
      <p className={`${message.sender === 'ai' ? 'text-gray-700 dark:text-gray-300' : 'text-blue-600 dark:text-blue-400'}`}>
        {typeof message.content === 'string' ? message.content : '[Invalid content]'}
      </p>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="flex justify-between items-center p-4 pr-[50px] border-b dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex items-center space-x-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">AI Assistant</h2>
          <select
            value={provider}
            onChange={handleProviderChange}
            className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-800 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-500"
          >
            <option value="ollama">Ollama</option>
            <option value="gemini">Gemini</option>
          </select>
        </div>
        <button
          onClick={onClear}
          className="px-3 py-1 text-sm text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 rounded-lg ring-1 ring-gray-200 dark:ring-gray-700 hover:ring-red-200 dark:hover:ring-red-800 focus:outline-none focus:ring-2 focus:ring-red-500 dark:focus:ring-red-500 active:bg-red-50 dark:active:bg-red-900/20 transition-colors"
        >
          Clear Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto" ref={chatContainerRef}>
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`rounded-lg p-2 ${
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
      <form onSubmit={handleSubmit} className="p-2 border-t dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex space-x-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a command or ask a question..."
            className="flex-1 p-2 rounded-lg border dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            type="submit"
            className="px-3 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
} 
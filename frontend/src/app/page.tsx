'use client';
import { useState, useRef, useEffect } from 'react';
import { ChatMessage, KnowledgeBase } from '@/types';
import { sendMessage, getKnowledgeBases } from '@/lib/api';
import References from '@/components/References';

export default function ChatPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);

  useEffect(() => {
    getKnowledgeBases().then(setKnowledgeBases);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: input,
      references: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: '',
        references: null,
        createdAt: new Date().toISOString(),
      },
    ]);

    try {
      const reader = await sendMessage(
        input,
        knowledgeBaseId || undefined,
        sessionId || undefined,
      );
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // 按 \n\n 切分完整的 SSE 事件
        const parts = buffer.split('\n\n');
        // 最后一段可能不完整，留到下次
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6); // 精确去掉 "data: " 前缀
          try {
            const data = JSON.parse(jsonStr);

            if (data.type === 'chunk') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.content += data.data;
                return [...updated];
              });
            } else if (data.type === 'done') {
              setSessionId(data.sessionId);
              if (data.references?.length) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  last.references = data.references;
                  return [...updated];
                });
              }
            } else if (data.type === 'error') {
              console.error('AI 错误:', data.data);
            }
          } catch {
            // 忽略解析失败的片段
          }
        }
      }
    } catch (error) {
      console.error('请求失败:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 顶部标题栏 */}
      <div className="h-12 border-b border-gray-200 bg-white flex items-center justify-between px-5">
        <span className="text-sm text-gray-700 font-medium">
          {sessionId ? '对话中' : '新对话'}
        </span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">知识库:</span>
          <select
            value={knowledgeBaseId}
            onChange={(e) => setKnowledgeBaseId(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:border-blue-400 bg-white text-gray-700"
          >
            <option value="">不选择（自由对话）</option>
            {knowledgeBases.map((kb) => (
              <option key={kb.id} value={kb.id}>{kb.name}</option>
            ))}
          </select>
        </div>
      </div>

      {/* 消息列表 */}
      <div className="flex-1 overflow-y-auto">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
              <span className="text-3xl">🧠</span>
            </div>
            <p className="text-base mb-1">你好，我是 AI 知识库助手</p>
            <p className="text-sm">右上角选择知识库，然后开始提问吧</p>
          </div>
        )}

        {messages.length > 0 && (
          <div className="max-w-3xl mx-auto px-5 py-6 space-y-6">
            {messages.map((msg, i) => (
              <div key={i}>
                {msg.role === 'user' ? (
                  <div className="flex justify-end">
                    <div className="bg-blue-500 text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[80%]">
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 bg-blue-500 rounded-lg flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-white text-xs font-bold">AI</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="prose prose-sm max-w-none text-gray-800 leading-relaxed">
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      </div>
                      {msg.references && <References references={msg.references} />}
                    </div>
                  </div>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* 输入区 */}
      <div className="p-4 pb-6">
        <div className="max-w-3xl mx-auto relative">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="给 AI 知识库助手 发送消息"
              rows={1}
              className="w-full px-4 pt-3.5 pb-2 text-sm resize-none focus:outline-none placeholder-gray-400 bg-transparent"
              disabled={loading}
            />
            <div className="flex items-center justify-between px-3 pb-2.5">
              <div className="flex items-center gap-1">
                {/* 功能按钮预留 */}
              </div>
              <button
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center hover:bg-blue-600 disabled:bg-gray-200 disabled:cursor-not-allowed transition-colors"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M8 12V4M4 7l4-4 4 4" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

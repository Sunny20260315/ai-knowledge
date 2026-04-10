'use client';
import { useState, useRef, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { ChatMessage, KnowledgeBase } from '@/types';
import { sendMessage, getChatMessages, getKnowledgeBases } from '@/lib/api';
import References from '@/components/References';

export default function ChatSessionPage() {
  const params = useParams();
  const sessionId = params.sessionId as string;

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [knowledgeBaseId, setKnowledgeBaseId] = useState<string>('');
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [sessionTitle, setSessionTitle] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getKnowledgeBases().then(setKnowledgeBases);
  }, []);

  useEffect(() => {
    getChatMessages(sessionId).then((data) => {
      setMessages(data.messages || []);
      if (data.session) {
        setSessionTitle(data.session.title || '');
        if (data.session.knowledgeBaseId) {
          setKnowledgeBaseId(data.session.knowledgeBaseId);
        }
      }
    });
  }, [sessionId]);

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
        sessionId,
      );
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split('\n\n');
        buffer = parts.pop() || '';

        for (const part of parts) {
          const line = part.trim();
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const data = JSON.parse(jsonStr);
            if (data.type === 'chunk') {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.content += data.data;
                return [...updated];
              });
            } else if (data.type === 'done' && data.references?.length) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                last.references = data.references;
                return [...updated];
              });
            }
          } catch {
            // ignore
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
        <span className="text-sm text-gray-700 font-medium truncate">
          {sessionTitle || '对话'}
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
              placeholder="继续提问..."
              rows={1}
              className="w-full px-4 pt-3.5 pb-2 text-sm resize-none focus:outline-none placeholder-gray-400 bg-transparent"
              disabled={loading}
            />
            <div className="flex items-center justify-end px-3 pb-2.5">
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
          <p className="text-center text-xs text-gray-400 mt-2">内容由 AI 生成，仅供参考，请仔细甄别</p>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { getChatSessions, getKnowledgeBases } from '@/lib/api';
import { KnowledgeBase, ChatSession } from '@/types';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const pathname = usePathname();

  useEffect(() => {
    getKnowledgeBases().then(setKnowledgeBases);
    getChatSessions().then(setSessions);
  }, []);

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 新对话按钮 */}
      <div className="px-3 mb-2">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-gray-200 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M8 3v10M3 8h10" />
          </svg>
          开启新对话
        </Link>
      </div>

      {/* 滚动区域 */}
      <div className="flex-1 overflow-y-auto px-2">
        {/* 知识库 */}
        <div className="mt-3">
          <p className="px-2 mb-1 text-xs text-gray-400 font-medium">知识库</p>
          {knowledgeBases.map((kb: KnowledgeBase) => (
            <Link
              key={kb.id}
              href={`/knowledge/${kb.id}`}
              className={`group flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                pathname === `/knowledge/${kb.id}`
                  ? 'bg-blue-50 text-blue-600'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0 opacity-60">
                <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1 1.5h5.5c.83 0 1.5.67 1.5 1.5v6c0 .83-.67 1.5-1.5 1.5h-9A1.5 1.5 0 012 12V4.5z" />
              </svg>
              <span className="truncate">{kb.name}</span>
            </Link>
          ))}
          <Link
            href="/knowledge"
            className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
              pathname === '/knowledge'
                ? 'bg-blue-50 text-blue-600'
                : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" className="shrink-0 opacity-60">
              <path d="M8 4v8M4 8h8" />
            </svg>
            管理知识库
          </Link>
        </div>

        {/* 对话历史 */}
        {sessions.length > 0 && (
          <div className="mt-4">
            <p className="px-2 mb-1 text-xs text-gray-400 font-medium">历史对话</p>
            {sessions.map((s: ChatSession) => (
              <Link
                key={s.id}
                href={`/chat/${s.id}`}
                className={`flex items-center gap-2 px-2 py-2 rounded-lg text-sm transition-colors ${
                  pathname === `/chat/${s.id}`
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" className="shrink-0 opacity-60">
                  <path d="M2 3h12v8.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 11.5V3z" />
                  <path d="M2 3l6 5 6-5" />
                </svg>
                <span className="truncate">{s.title}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

import { useEffect, useState, useRef } from 'react';
import { getChatSessions, getKnowledgeBases, deleteChatSession, updateChatSession } from '@/lib/api';
import { KnowledgeBase, ChatSession } from '@/types';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

function groupSessionsByTime(sessions: ChatSession[]) {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const sevenDaysAgo = new Date(today.getTime() - 7 * 86400000);
  const thirtyDaysAgo = new Date(today.getTime() - 30 * 86400000);

  const groups: { label: string; items: ChatSession[] }[] = [
    { label: '今天', items: [] },
    { label: '昨天', items: [] },
    { label: '7 天内', items: [] },
    { label: '30 天内', items: [] },
    { label: '更早', items: [] },
  ];

  for (const s of sessions) {
    const d = new Date(s.updatedAt || s.createdAt);
    if (d >= today) groups[0].items.push(s);
    else if (d >= yesterday) groups[1].items.push(s);
    else if (d >= sevenDaysAgo) groups[2].items.push(s);
    else if (d >= thirtyDaysAgo) groups[3].items.push(s);
    else groups[4].items.push(s);
  }

  return groups.filter((g) => g.items.length > 0);
}

export default function Sidebar() {
  const [knowledgeBases, setKnowledgeBases] = useState<KnowledgeBase[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [menuId, setMenuId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const pathname = usePathname();
  const router = useRouter();
  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getKnowledgeBases().then(setKnowledgeBases);
    getChatSessions().then(setSessions);
  }, []);

  // 点击外部关闭菜单
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 重命名输入框自动聚焦
  useEffect(() => {
    if (renamingId) renameInputRef.current?.focus();
  }, [renamingId]);

  const loadSessions = () => getChatSessions().then(setSessions);

  const handleDelete = async (id: string) => {
    setMenuId(null);
    if (!confirm('确定删除该对话？')) return;
    await deleteChatSession(id);
    loadSessions();
    if (pathname === `/chat/${id}`) router.push('/');
  };

  const handleRenameStart = (s: ChatSession) => {
    setMenuId(null);
    setRenamingId(s.id);
    setRenameValue(s.title);
  };

  const handleRenameSubmit = async (id: string) => {
    if (renameValue.trim()) {
      await updateChatSession(id, { title: renameValue.trim() });
      loadSessions();
    }
    setRenamingId(null);
  };

  const handlePin = async (s: ChatSession) => {
    setMenuId(null);
    await updateChatSession(s.id, { isPinned: !s.isPinned });
    loadSessions();
  };

  const handleShare = (s: ChatSession) => {
    setMenuId(null);
    const url = `${window.location.origin}/chat/${s.id}`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(() => alert('对话链接已复制到剪贴板'));
    } else {
      // 非 HTTPS 环境的兼容方案
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      alert('对话链接已复制到剪贴板');
    }
  };

  // 分离置顶和普通会话
  const pinned = sessions.filter((s) => s.isPinned);
  const unpinned = sessions.filter((s) => !s.isPinned);
  const groupedSessions = groupSessionsByTime(unpinned);

  const renderSessionItem = (s: ChatSession) => {
    const isActive = pathname === `/chat/${s.id}`;

    if (renamingId === s.id) {
      return (
        <div key={s.id} className="px-2 py-1.5">
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleRenameSubmit(s.id);
              if (e.key === 'Escape') setRenamingId(null);
            }}
            onBlur={() => handleRenameSubmit(s.id)}
            className="w-full border border-blue-400 rounded px-2 py-1 text-sm focus:outline-none"
          />
        </div>
      );
    }

    return (
      <div key={s.id} className="relative group">
        <Link
          href={`/chat/${s.id}`}
          className={`flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-colors ${
            isActive
              ? 'bg-blue-50 text-blue-600'
              : 'text-gray-600 hover:bg-gray-100'
          }`}
        >
          <span className="truncate">{s.title}</span>
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setMenuId(menuId === s.id ? null : s.id);
            }}
            className={`shrink-0 w-6 h-6 rounded flex items-center justify-center transition-opacity ${
              menuId === s.id
                ? 'opacity-100'
                : 'opacity-0 group-hover:opacity-100'
            } hover:bg-gray-200`}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <circle cx="3" cy="8" r="1.5" />
              <circle cx="8" cy="8" r="1.5" />
              <circle cx="13" cy="8" r="1.5" />
            </svg>
          </button>
        </Link>

        {/* 下拉菜单 */}
        {menuId === s.id && (
          <div
            ref={menuRef}
            className="absolute right-0 top-9 z-50 w-32 bg-white rounded-lg shadow-lg border border-gray-200 py-1"
          >
            <button
              onClick={() => handleRenameStart(s)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 2.5L13.5 4.5L5 13H3V11L11.5 2.5Z" />
              </svg>
              重命名
            </button>
            <button
              onClick={() => handlePin(s)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 2l6 0 0 4-2 2 0 4-1 2-1-2 0-4-2-2z" />
              </svg>
              {s.isPinned ? '取消置顶' : '置顶'}
            </button>
            <button
              onClick={() => handleShare(s)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="4" cy="8" r="2" />
                <circle cx="12" cy="4" r="2" />
                <circle cx="12" cy="12" r="2" />
                <path d="M6 7l4-2M6 9l4 2" />
              </svg>
              分享
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button
              onClick={() => handleDelete(s.id)}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <path d="M3 4h10M6 4V3h4v1M5 4v8.5a.5.5 0 00.5.5h5a.5.5 0 00.5-.5V4" />
              </svg>
              删除
            </button>
          </div>
        )}
      </div>
    );
  };

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

        {/* 置顶对话 */}
        {pinned.length > 0 && (
          <div className="mt-4">
            <p className="px-2 mb-1 text-xs text-gray-400 font-medium">置顶</p>
            {pinned.map(renderSessionItem)}
          </div>
        )}

        {/* 对话历史（按时间分组） */}
        {groupedSessions.map((group) => (
          <div key={group.label} className="mt-4">
            <p className="px-2 mb-1 text-xs text-gray-400 font-medium">{group.label}</p>
            {group.items.map(renderSessionItem)}
          </div>
        ))}
      </div>
    </div>
  );
}

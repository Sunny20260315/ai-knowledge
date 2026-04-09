'use client';
import { useState } from 'react';
import { Reference } from '@/types';

export default function References({ references }: { references: Reference[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!references || references.length === 0) return null;

  return (
    <div className="mt-2">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0">
          <path d="M4 2h5l4 4v8a1 1 0 01-1 1H4a1 1 0 01-1-1V3a1 1 0 011-1z" />
          <path d="M9 2v4h4" />
        </svg>
        {references.length} 个参考来源
        <svg
          width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"
          className={`transition-transform ${expanded ? 'rotate-180' : ''}`}
        >
          <path d="M4 6l4 4 4-4" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2 space-y-2">
          {references.map((ref, i) => (
            <div
              key={i}
              className="bg-gray-50 border border-gray-100 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-500">
                  [{i + 1}] {ref.metadata?.fileName || '未知文件'}
                </span>
                <span className="text-xs text-gray-400">
                  相关度 {Math.round(ref.score * 100)}%
                </span>
              </div>
              <p className="text-xs text-gray-600 leading-relaxed">{ref.content}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

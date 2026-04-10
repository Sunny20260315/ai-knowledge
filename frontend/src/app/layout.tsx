import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import Sidebar from '@/components/Sidebar';
import Image from 'next/image';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'LocalBase - AI 知识库助手',
  description: 'LocalBase AI 知识库问答系统',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex h-screen bg-[#f5f5f5]">
        {/* 左侧栏 */}
        <aside className="w-60 bg-white flex flex-col border-r border-gray-200">
          {/* Logo */}
          <div className="px-4 py-4 flex items-center gap-2">
            <Image
              src="/logo.png"
              alt="LocalBase"
              width={28}
              height={28}
              style={{ width: 28, height: 'auto' }}
            />
            <span className="font-semibold text-base text-gray-800">
              LocalBase
            </span>
          </div>
          <Sidebar />
        </aside>

        {/* 右侧内容区 */}
        <main className="flex-1 flex flex-col min-w-0">{children}</main>
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from 'next';
import { TopBar } from './_components/ui';
import './gr.css';


export const metadata: Metadata = {
  title: 'Scholar Research',
};

export const viewport: Viewport = {
  themeColor: '#EEE7D8',
};

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gr min-h-screen w-full bg-paper font-body text-ink">
      <div className="gr-grain" aria-hidden="true" />
      <TopBar />
      {children}
    </div>
  );
}

import Link from 'next/link';
import PaperSeekSettings from '../_components/PaperSeekSettings';
import { ResearcherSettings } from '../_components/Settings';
import type { SettingsTab } from '../_components/preferences';

export default function SettingsPage({ searchParams }: { searchParams: { tab?: string; section?: string } }) {
  const tab = searchParams.tab === 'gpt-researcher' ? 'gpt-researcher' : 'paperseek';
  const section = (['research', 'mcp', 'documents', 'backend'].includes(searchParams.section || '') ? searchParams.section : 'research') as SettingsTab;
  return <main className="mx-auto max-w-5xl px-5 py-10">
    <h1 className="font-display text-3xl font-semibold">设置</h1>
    <nav aria-label="设置系统" className="mt-6 flex gap-6 border-b border-rule-soft">
      <Link href="/settings?tab=paperseek" aria-current={tab === 'paperseek' ? 'page' : undefined} className="border-b-2 border-transparent py-3 font-medium aria-[current=page]:border-rubric">PaperSeek</Link>
      <Link href="/settings?tab=gpt-researcher" aria-current={tab === 'gpt-researcher' ? 'page' : undefined} className="border-b-2 border-transparent py-3 font-medium aria-[current=page]:border-rubric">GPT Researcher</Link>
    </nav>
    <div className="mt-6 bg-paper-hi">{tab === 'paperseek' ? <PaperSeekSettings /> : <ResearcherSettings tab={section} />}</div>
  </main>;
}

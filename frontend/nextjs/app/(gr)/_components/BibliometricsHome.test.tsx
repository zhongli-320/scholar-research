// @vitest-environment jsdom
import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import BibliometricsHome from './BibliometricsHome';
import { deleteAnalysis, listAnalyses, listHistory } from '@/lib/paperseek/client';
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.stubGlobal('React', React); vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
vi.mock('@/lib/paperseek/client', () => ({ listHistory: vi.fn(), listAnalyses: vi.fn(), createAnalysis: vi.fn(), renameAnalysis: vi.fn(), deleteAnalysis: vi.fn() }));
it('offers only completed searches and confirms deletion before sending', async () => {
  vi.mocked(listHistory).mockResolvedValue({ items: [ { id: 'done', status: 'completed', display_title: 'Done', question: '', source: '', result_count: 1, created_at: '' }, { id: 'running', status: 'running', display_title: 'Running', question: '', source: '', result_count: 0, created_at: '' } ], next_cursor: null, matched_count: 2 });
  vi.mocked(listAnalyses).mockResolvedValue({ items: [{ id: 'a', source_run_id: 'done', title: 'Analysis', paper_count: 1, scope: 'retrieved_candidates', created_at: '' }], next_offset: null, total_count: 1 }); vi.mocked(deleteAnalysis).mockResolvedValue();
  const element = document.createElement('div'); const root = createRoot(element);
  await act(async () => root.render(<BibliometricsHome />));
  expect(element.textContent).toContain('Done'); expect(element.textContent).not.toContain('Running');
  const button = (label: string) => [...element.querySelectorAll('button')].find((b) => b.textContent === label)!;
  await act(async () => button('删除').click()); expect(deleteAnalysis).not.toHaveBeenCalled();
  await act(async () => button('确认删除').click()); expect(deleteAnalysis).toHaveBeenCalledWith('a');
  await act(async () => root.unmount());
});

import type { PaperSeekRun, PaperSeekSource } from '@/lib/paperseek/types';

export const sources: PaperSeekSource[] = [{ id: 'openalex', label: 'OpenAlex', default: true, capabilities: { citation_expansion: true, filter: { mode: 'native', label: '学科', options: [{ id: 'computer-science', label: '计算机科学' }] } } }];
export const recent: PaperSeekRun = { id: 'example-run', question: '人工智能如何影响科学研究？', display_title: '人工智能与科学研究', source: 'openalex', status: 'completed', result_count: 256 };

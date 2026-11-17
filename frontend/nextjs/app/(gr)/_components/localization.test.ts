import { expect, it } from 'vitest';
import { reportLabel } from '@/lib/research/brief';
import { REPORT_TYPES, SOURCES, TONES } from './Brief';
import { sourcesSummary } from './Sources';
import { statusWord } from './Stages';
import { runEventCountLabel, runEventLabel, runStageLabel, runStatusLabel } from '@/lib/paperseek/status';

it('presents the review workflow in Chinese while preserving protocol values', () => {
  expect(statusWord).toMatchObject({ idle: '准备就绪', researching: '检索中', done: '已完成', failed: '失败' });
  expect(reportLabel('detailed_report')).toBe('详细综述');
  expect(REPORT_TYPES.find(({ value }) => value === 'multi_agents')?.label).toBe('多智能体综述');
  expect(SOURCES.find(({ value }) => value === 'hybrid')?.label).toBe('网络和我的文档');
  expect(TONES.find(({ value }) => value === 'Objective')?.label).toBe('客观');
  expect(sourcesSummary({ sources: [{ domain: 'a.example' }, { domain: 'a.example' }] } as never)).toBe('2 个来源 · 1 个网站');
  expect(runStatusLabel('completed_with_warnings')).toBe('已完成');
  expect(runStageLabel('retrieval')).toBe('文献获取');
  expect(runStageLabel('completed_with_warnings')).toBe('已完成');
  expect(runStageLabel('failed')).toBe('失败');
  expect(runEventLabel('retrieval.degraded')).toBe('文献获取：部分降级');
  expect(runEventCountLabel('candidate_count')).toBe('候选数');
});

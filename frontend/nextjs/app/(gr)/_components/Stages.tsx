import type { Question, RunState, Stage } from '@/lib/research/run';
import { FaviconStack } from './Favicon';
import { clock } from './ui';

export const statusWord: Record<RunState['status'], string> = {
  idle: '准备就绪',
  researching: '检索中',
  review: '等待你的确认',
  drafting: '起草中',
  writing: '写作中',
  done: '已完成',
  stopped: '已停止',
  failed: '失败',
};

export const stageTime = (stage: Stage, now: number) => {
  if (stage.startedAt === undefined) return '';
  return clock((stage.endedAt ?? now) - stage.startedAt);
};

export const questionMark: Record<Question['status'], string> = {
  queued: 'bg-rule-soft',
  searching: 'bg-rubric animate-[gr-blink_1.2s_steps(2,jump-none)_infinite]',
  reading: 'bg-rubric',
  done: 'bg-ink',
  empty: 'shadow-[inset_0_0_0_1px_#5F574B]',
  stopped: 'shadow-[inset_0_0_0_1px_#B8381C]',
};

/** One mark per research question, so the search reads at a glance. */
export function QuestionMarks({ questions }: { questions: Question[] }) {
  return (
    <span className="flex gap-[3px]" aria-hidden="true">
      {questions.map((q) => (
        <i key={q.text} className={`h-[6px] w-4 ${questionMark[q.status]}`} />
      ))}
    </span>
  );
}

function Signal({ stage, run }: { stage: Stage; run: RunState }) {
  if (stage.status === 'waiting') return null;
  if (stage.id === 'search' && run.questions.length) return <QuestionMarks questions={run.questions} />;
  if (stage.id === 'read' && run.sources.length) {
    const latest = [...run.sources].reverse().map((s) => s.domain);
    return <FaviconStack domains={latest} max={5} />;
  }
  return null;
}

export function StageList({ run }: { run: RunState }) {
  const descriptions: Record<Stage['id'], string> = {
    plan: '理解研究主题，拆分需要回答的问题并规划综述结构。',
    search: '围绕各研究问题检索资料，汇总可供后续阅读的来源。',
    read: '打开并阅读候选页面，提取与研究主题直接相关的信息。',
    filter: '比较资料质量与相关性，保留可用于论证和引用的证据。',
    write: '综合已筛选证据，按学术综述结构生成中文正文。',
  };
  const metrics = (stage: Stage): [string, number][] => {
    if (stage.id === 'plan') return [['研究问题', run.subqueries.length]];
    if (stage.id === 'search') return [['检索问题', run.questions.filter((q) => q.status !== 'queued').length], ['候选来源', run.sources.length]];
    if (stage.id === 'read') return [['已读页面', run.pagesScraped], ['资料来源', run.sources.length]];
    if (stage.id === 'filter') return [['引用来源', run.sources.filter((source) => source.cited).length], ['候选来源', run.sources.length]];
    return [['正文篇幅', run.words], ['已成章节', run.sections]];
  };
  const details = [...run.activity].reverse().slice(0, 30).reverse();
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <p className="gr-meta">{statusWord[run.status]}</p>
        <p className="font-code text-[30px] font-medium tabular-nums tracking-[-0.02em]">{clock(run.elapsed)}</p>
      </div>
      <ol className="mt-5 space-y-3">
        {run.stages.map((stage) => (
          <li key={stage.id} className="rounded-sm border border-rule bg-paper px-4 py-4" data-status={stage.status}>
            <div className="flex items-center gap-3 border-b border-rule-soft pb-3">
              <i className="gr-dot" data-status={stage.status} aria-hidden="true" />
              <span className={`flex-1 font-code text-[11.5px] font-medium uppercase tracking-[0.14em] ${stage.status === 'waiting' ? 'text-ink-3' : 'text-ink'}`}>
                {stage.label}
              </span>
              <span className="font-code text-[11px] tabular-nums text-ink-3">{stageTime(stage, run.elapsed)}</span>
            </div>
            <p className="mt-3 text-[13.5px] leading-relaxed text-ink-2">{descriptions[stage.id]}</p>
            <div className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-sm bg-rule-soft sm:grid-cols-4">
              {metrics(stage).map(([label, value]) => (
                <p key={label} className="bg-paper-deep/70 px-3 py-2.5">
                  <span className="block font-code text-[20px] font-medium tabular-nums text-ink">{value.toLocaleString('zh-CN')}</span>
                  <span className="mt-1 block text-[11.5px] text-ink-3">{label}</span>
                </p>
              ))}
            </div>
            {stage.detail && stage.status !== 'waiting' && (
              <p className="mt-3 text-[13.5px] leading-snug text-ink"><span className="text-ink-3">阶段结果：</span>{stage.detail}</p>
            )}
            <div className="empty:hidden [&>*]:mt-3"><Signal stage={stage} run={run} /></div>
          </li>
        ))}
      </ol>
      {(details.length > 0 || run.log.length > 0) && (
        <details className="mt-4 border-t border-rule pt-3">
          <summary className="cursor-pointer select-none font-code text-[11px] uppercase tracking-[0.1em] text-ink-2">
            查看详细记录（{details.length + run.log.length}）
          </summary>
          <ol className="mt-3 max-h-64 space-y-2 overflow-auto pr-2 text-[12.5px] leading-relaxed text-ink-2">
            {details.map((item, index) => (
              <li key={`${item.t}-${index}`} className="grid grid-cols-[42px_minmax(0,1fr)] gap-3">
                <span className="font-code tabular-nums text-ink-3">{clock(item.t)}</span>
                <span>{item.text}{item.quote ? `：${item.quote}` : ''}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

/** One line for narrow screens: the five stages as segments of a bar. */
export function StageStrip({ run }: { run: RunState }) {
  const failed = run.stages.find((s) => s.status === 'failed');
  const active = run.stages.filter((s) => s.status === 'active');
  const detail = [...active].reverse().find((s) => s.detail && s.detail !== statusWord[run.status])?.detail;
  const line = failed
    ? `${statusWord[run.status]}：${failed.label}`
    : [statusWord[run.status], detail ?? active.at(-1)?.label].filter(Boolean).join(' · ');
  return (
    <span className="flex items-center gap-4">
      <span className="min-w-0 flex-1">
        <span className="flex gap-[3px]" aria-hidden="true">
          {run.stages.map((stage) => (
            <i
              key={stage.id}
              className={`h-[5px] flex-1 ${
                stage.status === 'done'
                  ? 'bg-ink'
                  : stage.status === 'active'
                    ? 'animate-[gr-blink_1.2s_steps(2,jump-none)_infinite] bg-rubric'
                    : stage.status === 'failed'
                      ? 'bg-rubric'
                      : 'bg-rule-soft'
              }`}
            />
          ))}
        </span>
        <span className="mt-2 block truncate font-code text-[10.5px] uppercase tracking-[0.12em] text-ink-2">{line}</span>
      </span>
      <span className="font-code text-[20px] font-medium tabular-nums">{clock(run.elapsed)}</span>
    </span>
  );
}

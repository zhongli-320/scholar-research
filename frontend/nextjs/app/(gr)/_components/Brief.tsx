'use client';

import Link from 'next/link';
import { useMock } from './mode';
import { useEffect, useId, useState } from 'react';
import { DEFAULT_BRIEF, type BriefValue } from '@/lib/research/brief';
import { MCP_PRESETS, checkMcp } from '@/lib/research/mcp';
import { popoverPanel, usePopover } from './popover';

export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export const REPORT_TYPES: Option[] = [
  { value: 'research_report', label: '简要综述', hint: '约 2 分钟，约 1,500 字' },
  { value: 'detailed_report', label: '详细综述', hint: '约 5 分钟，按章节展开' },
  { value: 'deep', label: '深度研究综述', hint: '继续追踪两层新问题' },
  { value: 'multi_agents', label: '多智能体综述', hint: '约 7 分钟，由编辑、审阅和写作智能体协作' },
];

export const SOURCES: Option[] = [
  { value: 'web', label: '网络' },
  { value: 'local', label: '我的文档', hint: '仅使用后端中的文件' },
  { value: 'hybrid', label: '网络和我的文档' },
];

export const TONES: Option[] = (
  [
    ['Objective', '客观', '中立陈述，以事实为依据'],
    ['Formal', '正式', '使用学术语言与结构'],
    ['Analytical', '分析', '深入分析数据与理论'],
    ['Persuasive', '论证', '围绕一种观点展开论证'],
    ['Informative', '信息型', '清晰、完整地覆盖主题'],
    ['Explanatory', '解释型', '让复杂概念易于理解'],
    ['Descriptive', '描述型', '详细描述案例与实例'],
    ['Critical', '批判', '评估证据的可靠程度'],
    ['Comparative', '比较', '并列比较不同方案'],
    ['Speculative', '推测', '探讨未来可能的发展'],
    ['Reflective', '反思', '审视过程及其局限'],
    ['Narrative', '叙事', '以故事方式呈现发现'],
    ['Humorous', '幽默', '轻松而有吸引力'],
    ['Optimistic', '乐观', '突出收益与积极面'],
    ['Pessimistic', '谨慎', '突出限制与风险'],
    ['Simple', '简明', '使用简单直白的语言'],
    ['Casual', '日常', '使用轻松的日常语言'],
  ] as const
).map(([value, label, hint]) => ({ value, label, hint }));

export const MCP_STRATEGIES: Option[] = [
  { value: 'fast', label: '每次研究调用一次', hint: '速度最快，仅用研究问题调用一次' },
  { value: 'deep', label: '每个问题都调用', hint: '速度较慢，但更全面' },
];

export { DEFAULT_BRIEF, type BriefValue };

export type BriefField = 'report_type' | 'report_source' | 'tone' | 'domains';

function Choice({
  label,
  options,
  value,
  onChange,
  defaultOpen = false,
}: {
  label: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  defaultOpen?: boolean;
}) {
  const { open, setOpen, root } = usePopover<HTMLSpanElement>(defaultOpen);
  const id = useId();
  const current = options.find((o) => o.value === value) ?? options[0];

  useEffect(() => {
    if (open) root.current?.querySelector<HTMLElement>('[aria-selected="true"] button')?.focus({ preventScroll: true });
  }, [open, root]);

  return (
    <span ref={root} className="relative inline-block">
      <button
        type="button"
        className="gr-select"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`${label}: ${current.label}`}
        onClick={() => setOpen((o) => !o)}
      >
        {current.label}
      </button>
      {open && (
        <ul
          id={id}
          role="listbox"
          aria-label={label}
          data-popover
          className={`${popoverPanel} gr-scroll left-[-14px] max-h-[min(360px,60vh)] w-[min(300px,calc(100vw-24px))] overflow-auto py-2`}
        >
          {options.map((o) => (
            <li key={o.value} role="option" aria-selected={o.value === value}>
              <button
                type="button"
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
                className="flex w-full items-start gap-3 px-4 py-2.5 text-left outline-none transition-colors hover:bg-paper focus-visible:bg-paper"
              >
                <i
                  className={`mt-[7px] h-[7px] w-[7px] flex-none ${o.value === value ? 'bg-rubric' : 'shadow-[inset_0_0_0_1px_#5F574B]'}`}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-[15px] font-medium leading-snug text-ink">{o.label}</span>
                  {o.hint && <span className="mt-0.5 block text-[13px] leading-snug text-ink-3">{o.hint}</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}

const toSite = (raw: string) =>
  raw
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .split(/[/?#\s]/)[0];

const isSite = (site: string) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(site);

/** The site list with a field to add more, used by the sentence popover and by Settings. */
export function SitesEditor({ value, onChange, autoFocus = false }: { value: string[]; onChange: (sites: string[]) => void; autoFocus?: boolean }) {
  const [draft, setDraft] = useState('');
  const [invalid, setInvalid] = useState(false);

  const add = () => {
    const site = toSite(draft);
    if (!site) return;
    if (!isSite(site)) {
      setInvalid(true);
      return;
    }
    if (!value.includes(site)) onChange([...value, site]);
    setDraft('');
    setInvalid(false);
  };

  return (
    <>
      {value.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-1.5">
          {value.map((site) => (
            <li key={site}>
              <button
                type="button"
                onClick={() => onChange(value.filter((s) => s !== site))}
                aria-label={`移除 ${site}`}
                className="inline-flex h-7 items-center gap-2 bg-paper px-2.5 font-code text-[11.5px] shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] transition-colors hover:text-rubric"
              >
                {site}
                <span aria-hidden="true">×</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">添加网站</span>
          <input
            autoFocus={autoFocus}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setInvalid(false);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
            placeholder="添加网站，例如 reuters.com"
            aria-invalid={invalid}
            className="gr-input h-9 w-full bg-paper px-3 text-[14px] outline-none shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] focus:shadow-[inset_0_0_0_1px_#1A1612] aria-[invalid=true]:shadow-[inset_0_0_0_1px_#B8381C]"
          />
        </label>
        <button type="button" onClick={add} className="gr-btn-line h-9">
          添加
        </button>
      </div>
      {invalid && <p className="mt-2 text-[12.5px] text-rubric">网站地址格式不正确，请参考 reuters.com。</p>}
    </>
  );
}

const sitesLabel = (sites: string[]) =>
  sites.length === 0
    ? '任意网站'
    : sites.length === 1
      ? `仅 ${sites[0]}`
      : sites.length === 2
        ? `仅 ${sites[0]}、${sites[1]}`
        : `仅 ${sites[0]} 等 ${sites.length} 个网站`;

function Sites({ value, onChange, defaultOpen = false }: { value: string[]; onChange: (sites: string[]) => void; defaultOpen?: boolean }) {
  const { open, setOpen, root } = usePopover<HTMLSpanElement>(defaultOpen);
  const id = useId();

  return (
    <span ref={root} className="relative inline-block">
      <button
        type="button"
        className="gr-select"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={id}
        aria-label={`检索网站：${sitesLabel(value)}`}
        onClick={() => setOpen((o) => !o)}
      >
        {sitesLabel(value)}
      </button>
      {open && (
        <div
          id={id}
          role="dialog"
          aria-label="检索网站"
          data-popover
          className={`${popoverPanel} left-[-14px] w-[min(330px,calc(100vw-24px))] p-4 sm:left-auto sm:right-[-14px]`}
        >
          <p className="gr-meta">仅检索这些网站</p>
          <SitesEditor value={value} onChange={onChange} autoFocus />
          <div className="mt-4 flex items-center justify-between border-t border-rule-soft pt-3 text-[13.5px]">
            <button type="button" onClick={() => onChange([])} disabled={!value.length} className="text-ink-2 hover:text-ink disabled:opacity-40">
              检索任意网站
            </button>
            <button type="button" onClick={() => setOpen(false)} className="font-medium hover:text-rubric">
              完成
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

export default function Brief({
  value,
  onChange,
  openField,
  documents,
}: {
  value: BriefValue;
  onChange: (value: BriefValue) => void;
  openField?: BriefField;
  documents?: number;
}) {
  const set = (key: 'report_type' | 'report_source' | 'tone') => (v: string) => onChange({ ...value, [key]: v });
  const readsWeb = value.report_source !== 'local';
  const readsDocs = value.report_source !== 'web';

  return (
    <div>
      <div className="text-[16px] leading-[1.9] text-ink-2">
        生成{' '}
        <Choice label="综述类型" options={REPORT_TYPES} value={value.report_type} onChange={set('report_type')} defaultOpen={openField === 'report_type'} />，资料来源为{' '}
        <Choice label="资料来源" options={SOURCES} value={value.report_source} onChange={set('report_source')} defaultOpen={openField === 'report_source'} />，采用{' '}
        <Choice label="语气" options={TONES} value={value.tone} onChange={set('tone')} defaultOpen={openField === 'tone'} />语气
        {readsWeb ? (
          <>
            ，检索 <Sites value={value.domains} onChange={(domains) => onChange({ ...value, domains })} defaultOpen={openField === 'domains'} />。
          </>
        ) : (
          '.'
        )}
        <McpClause value={value} />
      </div>
      {readsDocs && documents !== undefined && (
        <p className="mt-1 text-[13.5px] text-ink-3">
          {documents
            ? `读取后端已有的 ${documents} 份文档，以及你新添加的文档。`
            : '后端尚无文档，请在上方添加文件。'}
        </p>
      )}
    </div>
  );
}

const names = (list: string[]) => (list.length <= 2 ? list.join('、') : `${list[0]} 等 ${list.length} 个服务`);

/** MCP is set up in Settings; the sentence says it is on, and opens it. */
function McpClause({ value }: { value: BriefValue }) {
  const mock = useMock();
  if (!value.mcp_enabled) return null;
  const check = checkMcp(value.mcp_configs);
  if (check.state === 'invalid') {
    return (
      <>
        {' '}
        <Link href={mock ? '/mocks/settings?tab=gpt-researcher&section=mcp' : '/settings?tab=gpt-researcher&section=mcp'} className="gr-select !text-rubric">
          MCP 配置需要修正
        </Link>
        .
      </>
    );
  }
  return (
    <>
      {' '}
      {check.state === 'empty' ? 'MCP 已启用，' : '并通过 MCP 调用 '}
      <Link href={mock ? '/mocks/settings?tab=gpt-researcher&section=mcp' : '/settings?tab=gpt-researcher&section=mcp'} className="gr-select">
        {check.state === 'empty'
          ? '但尚未配置服务'
          : names(check.servers.map((s) => MCP_PRESETS.find((p) => p.server.name === s.name)?.label ?? s.name))}
      </Link>
      .
    </>
  );
}

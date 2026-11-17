'use client';

import Link from 'next/link';
import { useId, useRef, useState } from 'react';
import { reportLabel, type BriefValue } from '@/lib/research/brief';
import { MCP_PRESETS, checkMcp, formatMcp, mcpPlaceholders, togglePreset } from '@/lib/research/mcp';
import { MCP_STRATEGIES, REPORT_TYPES, SOURCES, SitesEditor, TONES, type Option } from './Brief';
import { useBackend, type BackendStatus } from './backend';
import { useBrief, type SettingsTab } from './preferences';

const MCP_DOCS = 'https://docs.gptr.dev/docs/gpt-researcher/retrievers/mcp-configs';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'research', label: '综述' },
  { id: 'mcp', label: 'MCP 服务' },
  { id: 'documents', label: '文档' },
  { id: 'backend', label: '后端' },
];

const STATUS_WORD: Record<BackendStatus, string> = { online: '在线', offline: '离线', checking: '检查中' };

const plain = (label: string) => label.replace(/^(a|an|the) /, '').replace(/^./, (c) => c.toUpperCase());

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (checked: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-none transition-colors ${checked ? 'bg-ink' : 'shadow-[inset_0_0_0_1px_rgba(29,25,21,0.4)]'}`}
    >
      <i className={`absolute top-[5px] h-[14px] w-[14px] transition-all ${checked ? 'left-[25px] bg-rubric' : 'left-[5px] bg-ink-3'}`} aria-hidden="true" />
    </button>
  );
}

function Section({ title, hint, aside, children }: { title: string; hint?: React.ReactNode; aside?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <section className="border-b border-rule-soft py-6 first:pt-0 last:border-0 last:pb-0">
      <div className="flex items-start justify-between gap-6">
        <div>
          <h3 className="text-[15px] font-semibold">{title}</h3>
          {hint && <p className="mt-1 max-w-[40em] text-[13.5px] leading-snug text-ink-3">{hint}</p>}
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

const card =
  'flex cursor-pointer items-start gap-3 bg-paper px-4 py-3 shadow-[inset_0_0_0_1px_rgba(29,25,21,0.14)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(29,25,21,0.4)] has-[:checked]:shadow-[inset_0_0_0_1px_#1A1612] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink';

function Radios({ name, label, options, value, onChange, columns = 2 }: { name: string; label: string; options: Option[]; value: string; onChange: (value: string) => void; columns?: 1 | 2 | 3 }) {
  const cols = { 1: '', 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3' }[columns];
  return (
    <div role="radiogroup" aria-label={label} className={`mt-4 grid gap-2 ${cols}`}>
      {options.map((o) => (
        <label key={o.value} className={card}>
          <input type="radio" name={name} value={o.value} checked={o.value === value} onChange={() => onChange(o.value)} className="sr-only" />
          <i className={`mt-[7px] h-[7px] w-[7px] flex-none ${o.value === value ? 'bg-rubric' : 'shadow-[inset_0_0_0_1px_#5F574B]'}`} aria-hidden="true" />
          <span>
            <span className="block text-[14.5px] font-medium leading-snug">{plain(o.label)}</span>
            {o.hint && <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{o.hint}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}

function ResearchPanel({ brief, onChange }: { brief: BriefValue; onChange: (brief: BriefValue) => void }) {
  const tone = TONES.find((t) => t.value === brief.tone);
  return (
    <>
      <p className="mb-6 text-[14px] leading-snug text-ink-2">
        新综述的默认选项。首页中的设置句也会同步修改这些选项。
      </p>
      <Section title="综述类型">
        <Radios name="report_type" label="综述类型" options={REPORT_TYPES} value={brief.report_type} onChange={(report_type) => onChange({ ...brief, report_type })} />
      </Section>
      <Section title="资料来源">
        <Radios name="report_source" label="资料来源" options={SOURCES} value={brief.report_source} onChange={(report_source) => onChange({ ...brief, report_source })} columns={3} />
      </Section>
      <Section title="语气" hint={tone?.hint}>
        <div role="radiogroup" aria-label="语气" className="mt-4 flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <label
              key={t.value}
              title={t.hint}
              className="inline-flex h-8 cursor-pointer items-center bg-paper px-3 text-[13px] shadow-[inset_0_0_0_1px_rgba(29,25,21,0.2)] transition-colors hover:shadow-[inset_0_0_0_1px_rgba(29,25,21,0.5)] has-[:checked]:bg-ink has-[:checked]:text-paper-hi has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
            >
              <input type="radio" name="tone" value={t.value} checked={t.value === brief.tone} onChange={() => onChange({ ...brief, tone: t.value })} className="sr-only" />
              {t.label}
            </label>
          ))}
        </div>
      </Section>
      <Section title="网站" hint={brief.report_source === 'local' ? '仅在使用网络资料时生效。' : '仅检索这些网站；留空则检索任意网站。'}>
        <SitesEditor value={brief.domains} onChange={(domains) => onChange({ ...brief, domains })} />
      </Section>
    </>
  );
}

function McpPanel({ brief, onChange }: { brief: BriefValue; onChange: (brief: BriefValue) => void }) {
  const id = useId();
  const check = checkMcp(brief.mcp_configs);
  const placeholders = mcpPlaceholders(check.servers);
  const setConfigs = (mcp_configs: string) => onChange({ ...brief, mcp_configs });

  return (
    <>
      <Section
        title="使用 MCP 服务"
        hint="除网络外，也允许研究智能体通过 MCP 查询你的工具和数据。"
        aside={<Toggle checked={brief.mcp_enabled} onChange={(mcp_enabled) => onChange({ ...brief, mcp_enabled })} label="使用 MCP 服务" />}
      >
        {!brief.mcp_enabled && <p className="mt-4 text-[13.5px] text-ink-3">已关闭。研究仅使用网络和你的文档。</p>}
      </Section>
      {brief.mcp_enabled && (
        <>
          <Section title="调用时机">
            <Radios name="mcp_strategy" label="何时调用 MCP 服务" options={MCP_STRATEGIES} value={brief.mcp_strategy} onChange={(mcp_strategy) => onChange({ ...brief, mcp_strategy })} />
          </Section>
          <Section title="服务" hint="添加预设并填写密钥，或粘贴自定义列表。">
            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="预设">
              {MCP_PRESETS.map((p) => {
                const added = check.servers.some((s) => s.name === p.server.name);
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={added}
                    disabled={check.state === 'invalid'}
                    onClick={() => {
                      const next = togglePreset(brief.mcp_configs, p);
                      if (next !== null) setConfigs(next);
                    }}
                    className="flex items-start gap-3 bg-paper px-4 py-3 text-left shadow-[inset_0_0_0_1px_rgba(29,25,21,0.14)] transition-shadow hover:shadow-[inset_0_0_0_1px_rgba(29,25,21,0.4)] disabled:cursor-not-allowed disabled:opacity-50 aria-pressed:shadow-[inset_0_0_0_1px_#1A1612]"
                  >
                    <span className={`mt-px grid h-4 w-4 flex-none place-items-center font-code text-[11px] leading-none ${added ? 'bg-ink text-paper-hi' : 'shadow-[inset_0_0_0_1px_#5F574B]'}`} aria-hidden="true">
                      {added ? '✓' : '+'}
                    </span>
                    <span>
                      <span className="block text-[14px] font-medium leading-snug">{p.label}</span>
                      <span className="mt-0.5 block text-[12.5px] leading-snug text-ink-3">{p.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex items-end justify-between gap-3">
              <label htmlFor={`${id}-json`} className="gr-meta">
                JSON 配置
              </label>
              <div className="flex gap-4 text-[13px] font-medium">
                <button type="button" onClick={() => setConfigs(formatMcp(brief.mcp_configs))} disabled={check.state !== 'ready'} className="text-ink-2 hover:text-ink disabled:opacity-40">
                  格式化
                </button>
                <button type="button" onClick={() => setConfigs('')} disabled={!brief.mcp_configs.trim()} className="text-ink-2 hover:text-ink disabled:opacity-40">
                  清空
                </button>
              </div>
            </div>
            <textarea
              id={`${id}-json`}
              rows={11}
              spellCheck={false}
              value={brief.mcp_configs}
              onChange={(e) => setConfigs(e.target.value)}
              placeholder={'[\n  { "name": "my-server", "command": "npx", "args": ["-y", "my-mcp-server"], "env": {} }\n]'}
              aria-invalid={check.state === 'invalid'}
              aria-describedby={`${id}-check`}
              className="gr-input gr-scroll mt-2 w-full resize-y bg-paper px-4 py-3 font-code text-[12px] leading-relaxed outline-none shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] focus:shadow-[inset_0_0_0_1px_#1A1612] aria-[invalid=true]:shadow-[inset_0_0_0_1px_#B8381C]"
            />
            <div id={`${id}-check`} role="status" className="mt-2 space-y-1 font-code text-[11.5px] leading-relaxed">
              <p className={check.state === 'invalid' ? 'text-rubric' : 'text-ink-3'}>{check.message}</p>
              {placeholders.length > 0 && <p className="text-rubric">运行前请替换占位值：{placeholders.join('、')}。</p>}
            </div>
            <p className="mt-4 text-[13px] leading-snug text-ink-3">
              每个服务都需要 <code className="font-code text-[12px] text-ink-2">name</code>，并提供带{' '}
              <code className="font-code text-[12px] text-ink-2">args</code>、<code className="font-code text-[12px] text-ink-2">env</code> 的 <code className="font-code text-[12px] text-ink-2">command</code>，或提供{' '}
              <code className="font-code text-[12px] text-ink-2">connection_url</code>。{' '}
              <a href={MCP_DOCS} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-rule underline-offset-4 hover:text-rubric">
                MCP 配置说明
              </a>
            </p>
          </Section>
        </>
      )}
    </>
  );
}

function DocumentsPanel({ brief, onChange }: { brief: BriefValue; onChange: (brief: BriefValue) => void }) {
  const backend = useBackend();
  const picker = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(0);
  const [problem, setProblem] = useState('');
  const [confirming, setConfirming] = useState<string | null>(null);

  if (backend.status !== 'online') {
    return (
      <Section title="后端文档" hint={backend.status === 'checking' ? '正在检查连接。' : '后端不可用，无法列出文档。'}>
        {backend.status === 'offline' && (
          <Link href="/settings?tab=gpt-researcher&section=backend" className="gr-btn-line mt-4">
            后端设置
          </Link>
        )}
      </Section>
    );
  }

  const add = async (list: FileList | null) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    setProblem('');
    setUploading(files.length);
    try {
      await Promise.all(files.map(backend.upload));
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
    setUploading(0);
    await backend.check();
  };

  const remove = async (name: string) => {
    setConfirming(null);
    setProblem('');
    try {
      await backend.remove(name);
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    }
  };

  const docs = backend.documents;
  return (
    <Section
      title="后端文档"
      hint="资料来源包含你的文档时，研究会读取这些文件。"
      aside={
        <>
          <button type="button" className="gr-btn-line flex-none" onClick={() => picker.current?.click()} disabled={uploading > 0}>
            {uploading ? '正在上传' : '+ 添加文件'}
          </button>
          <input
            ref={picker}
            type="file"
            multiple
            accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.pptx,.html"
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(e) => {
              void add(e.target.files);
              e.target.value = '';
            }}
          />
        </>
      }
    >
      <p className="sr-only" role="status">
        {uploading ? `正在上传 ${uploading} 个文件` : ''}
      </p>
      {problem && (
        <p role="alert" className="mt-4 text-[13.5px] leading-snug text-rubric">
          {problem}
        </p>
      )}
      {docs.length > 0 && brief.report_source === 'web' && (
        <p className="mt-4 text-[13.5px] leading-snug text-ink-2">
          当前研究仅使用网络。{' '}
          <button type="button" className="font-medium underline decoration-rule underline-offset-4 hover:text-rubric" onClick={() => onChange({ ...brief, report_source: 'hybrid' })}>
            同时读取这些文档
          </button>
        </p>
      )}
      {docs.length ? (
        <ul className="mt-4 border-t border-rule-soft" aria-label="文档">
          {docs.map((name) => (
            <li key={name} className="flex min-h-[48px] items-center justify-between gap-4 border-b border-rule-soft py-2">
              <span className="min-w-0 truncate text-[14px] font-medium">{name}</span>
              {confirming === name ? (
                <span className="flex flex-none items-center gap-3 text-[13px]">
                  <span className="text-ink-3">从后端移除？</span>
                  <button type="button" className="font-medium text-rubric hover:underline" onClick={() => void remove(name)}>
                    移除
                  </button>
                  <button type="button" className="font-medium text-ink-2 hover:text-ink" onClick={() => setConfirming(null)}>
                    保留
                  </button>
                </span>
              ) : (
                <button type="button" aria-label={`移除 ${name}`} className="flex-none text-[13px] font-medium text-ink-3 hover:text-rubric" onClick={() => setConfirming(name)}>
                  移除
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13.5px] leading-snug text-ink-3">尚无文档。添加 PDF、Word、表格或文本文件后，研究即可读取。</p>
      )}
    </Section>
  );
}

function BackendPanel() {
  const backend = useBackend();
  const [draft, setDraft] = useState(backend.host);
  return (
    <Section title="Python 后端" hint="浏览器会将研究请求发送到这里，地址保存在本浏览器中。">
      <p className="mt-4 flex items-center gap-2.5 text-[14px] leading-snug text-ink-2" role="status">
        <i
          className={`h-2 w-2 flex-none ${backend.status === 'online' ? 'bg-ink' : backend.status === 'offline' ? 'bg-rubric' : 'animate-[gr-blink_1s_steps(2,jump-none)_infinite] bg-ink-3'}`}
          aria-hidden="true"
        />
        {backend.status === 'online'
          ? `已连接，后端有 ${backend.documents.length} 个文档。`
          : backend.status === 'offline'
            ? '无法连接。请在项目目录运行 python main.py，或填写其他地址。'
            : '正在检查连接。'}
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          backend.setHost(draft);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">后端地址</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://localhost:8000"
            className="gr-input h-10 w-full bg-paper px-3 font-code text-[12.5px] outline-none shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] focus:shadow-[inset_0_0_0_1px_#1A1612]"
          />
        </label>
        <button type="submit" className="gr-btn-line h-10">
          连接
        </button>
      </form>
      <div className="mt-3 flex items-center justify-between gap-4 text-[12.5px] text-ink-3">
        <span>留空以使用默认地址。</span>
        <button type="button" onClick={() => void backend.check()} className="font-medium text-ink-2 hover:text-ink">
          重新检查
        </button>
      </div>
    </Section>
  );
}

export function ResearcherSettings({ tab }: { tab: SettingsTab }) {
  const [brief, setBrief] = useBrief();
  const backend = useBackend();
  const mcp = checkMcp(brief.mcp_configs);
  const hints: Record<SettingsTab, string> = {
    research: reportLabel(brief.report_type),
    mcp: !brief.mcp_enabled ? '关闭' : mcp.state === 'invalid' ? '需修正' : String(mcp.servers.length),
    documents: backend.status === 'online' ? String(backend.documents.length) : '–',
    backend: STATUS_WORD[backend.status],
  };
  return <div className="sm:grid sm:grid-cols-[200px_minmax(0,1fr)]">
    <nav aria-label="设置栏目" className="flex overflow-x-auto border-b border-rule-soft sm:flex-col sm:border-b-0 sm:border-r">
      {TABS.map((t) => <Link key={t.id} href={`/settings?tab=gpt-researcher&section=${t.id}`} aria-current={t.id === tab ? 'page' : undefined} className="flex justify-between gap-3 whitespace-nowrap px-4 py-3 text-sm font-medium aria-[current=page]:text-rubric">{t.label}<span className="font-code text-ink-3">{hints[t.id]}</span></Link>)}
    </nav>
    <div className="px-5 py-6 sm:px-8">
      {tab === 'research' && <ResearchPanel brief={brief} onChange={setBrief} />}
      {tab === 'mcp' && <McpPanel brief={brief} onChange={setBrief} />}
      {tab === 'documents' && <DocumentsPanel brief={brief} onChange={setBrief} />}
      {tab === 'backend' && <BackendPanel />}
      <p className="mt-8 text-[12.5px] text-ink-3">修改会自动保存在本浏览器中，新研究将使用这些设置。</p>
    </div>
  </div>;
}

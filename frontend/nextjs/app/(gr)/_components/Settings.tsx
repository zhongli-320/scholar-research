'use client';

import { useId, useRef, useState } from 'react';
import { reportLabel, type BriefValue } from '@/lib/research/brief';
import { MCP_PRESETS, checkMcp, formatMcp, mcpPlaceholders, togglePreset } from '@/lib/research/mcp';
import { MCP_STRATEGIES, REPORT_TYPES, SOURCES, SitesEditor, TONES, type Option } from './Brief';
import { useBackend, type BackendStatus } from './backend';
import { openSettings, useBrief, type SettingsTab } from './preferences';

const MCP_DOCS = 'https://docs.gptr.dev/docs/gpt-researcher/retrievers/mcp-configs';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'research', label: 'Research' },
  { id: 'mcp', label: 'MCP servers' },
  { id: 'documents', label: 'Documents' },
  { id: 'backend', label: 'Backend' },
];

const STATUS_WORD: Record<BackendStatus, string> = { online: 'Online', offline: 'Offline', checking: 'Checking' };

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
        Defaults for new research. The sentence on the home page changes the same settings, for a quick change before you start.
      </p>
      <Section title="Report">
        <Radios name="report_type" label="Report" options={REPORT_TYPES} value={brief.report_type} onChange={(report_type) => onChange({ ...brief, report_type })} />
      </Section>
      <Section title="Sources">
        <Radios name="report_source" label="Sources" options={SOURCES} value={brief.report_source} onChange={(report_source) => onChange({ ...brief, report_source })} columns={3} />
      </Section>
      <Section title="Tone" hint={tone?.hint}>
        <div role="radiogroup" aria-label="Tone" className="mt-4 flex flex-wrap gap-1.5">
          {TONES.map((t) => (
            <label
              key={t.value}
              title={t.hint}
              className="inline-flex h-8 cursor-pointer items-center bg-paper px-3 text-[13px] shadow-[inset_0_0_0_1px_rgba(29,25,21,0.2)] transition-colors hover:shadow-[inset_0_0_0_1px_rgba(29,25,21,0.5)] has-[:checked]:bg-ink has-[:checked]:text-paper-hi has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ink"
            >
              <input type="radio" name="tone" value={t.value} checked={t.value === brief.tone} onChange={() => onChange({ ...brief, tone: t.value })} className="sr-only" />
              {t.value}
            </label>
          ))}
        </div>
      </Section>
      <Section title="Sites" hint={brief.report_source === 'local' ? 'Only applies when research reads the web.' : 'Only read these sites. Leave it empty to read any site.'}>
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
        title="Use MCP servers"
        hint="Let the researchers query your own tools and data through the Model Context Protocol, next to the web."
        aside={<Toggle checked={brief.mcp_enabled} onChange={(mcp_enabled) => onChange({ ...brief, mcp_enabled })} label="Use MCP servers" />}
      >
        {!brief.mcp_enabled && <p className="mt-4 text-[13.5px] text-ink-3">Off. Research reads only the web and your documents.</p>}
      </Section>
      {brief.mcp_enabled && (
        <>
          <Section title="When to ask them">
            <Radios name="mcp_strategy" label="When to ask the MCP servers" options={MCP_STRATEGIES} value={brief.mcp_strategy} onChange={(mcp_strategy) => onChange({ ...brief, mcp_strategy })} />
          </Section>
          <Section title="Servers" hint="Add a preset and fill in its keys, or paste your own list.">
            <div className="mt-4 grid gap-2 sm:grid-cols-3" role="group" aria-label="Presets">
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
                Config, as JSON
              </label>
              <div className="flex gap-4 text-[13px] font-medium">
                <button type="button" onClick={() => setConfigs(formatMcp(brief.mcp_configs))} disabled={check.state !== 'ready'} className="text-ink-2 hover:text-ink disabled:opacity-40">
                  Format
                </button>
                <button type="button" onClick={() => setConfigs('')} disabled={!brief.mcp_configs.trim()} className="text-ink-2 hover:text-ink disabled:opacity-40">
                  Clear
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
              {placeholders.length > 0 && <p className="text-rubric">Replace the placeholder values before you run: {placeholders.join(', ')}.</p>}
            </div>
            <p className="mt-4 text-[13px] leading-snug text-ink-3">
              Each server needs a <code className="font-code text-[12px] text-ink-2">name</code>, and either a <code className="font-code text-[12px] text-ink-2">command</code> with{' '}
              <code className="font-code text-[12px] text-ink-2">args</code> and <code className="font-code text-[12px] text-ink-2">env</code>, or a{' '}
              <code className="font-code text-[12px] text-ink-2">connection_url</code>.{' '}
              <a href={MCP_DOCS} target="_blank" rel="noopener noreferrer" className="font-medium text-ink underline decoration-rule underline-offset-4 hover:text-rubric">
                How MCP configs work
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
      <Section title="Documents on the backend" hint={backend.status === 'checking' ? 'Checking the connection.' : 'The backend is not reachable, so its documents cannot be listed.'}>
        {backend.status === 'offline' && (
          <button type="button" className="gr-btn-line mt-4" onClick={() => openSettings('backend')}>
            Backend settings
          </button>
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
      title="Documents on the backend"
      hint="Research reads these when its sources include your documents."
      aside={
        <>
          <button type="button" className="gr-btn-line flex-none" onClick={() => picker.current?.click()} disabled={uploading > 0}>
            {uploading ? 'Uploading' : '+ Add files'}
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
        {uploading ? `Uploading ${uploading} file${uploading === 1 ? '' : 's'}` : ''}
      </p>
      {problem && (
        <p role="alert" className="mt-4 text-[13.5px] leading-snug text-rubric">
          {problem}
        </p>
      )}
      {docs.length > 0 && brief.report_source === 'web' && (
        <p className="mt-4 text-[13.5px] leading-snug text-ink-2">
          Research reads only the web right now.{' '}
          <button type="button" className="font-medium underline decoration-rule underline-offset-4 hover:text-rubric" onClick={() => onChange({ ...brief, report_source: 'hybrid' })}>
            Read these documents too
          </button>
        </p>
      )}
      {docs.length ? (
        <ul className="mt-4 border-t border-rule-soft" aria-label="Documents">
          {docs.map((name) => (
            <li key={name} className="flex min-h-[48px] items-center justify-between gap-4 border-b border-rule-soft py-2">
              <span className="min-w-0 truncate text-[14px] font-medium">{name}</span>
              {confirming === name ? (
                <span className="flex flex-none items-center gap-3 text-[13px]">
                  <span className="text-ink-3">Remove from the backend?</span>
                  <button type="button" className="font-medium text-rubric hover:underline" onClick={() => void remove(name)}>
                    Remove
                  </button>
                  <button type="button" className="font-medium text-ink-2 hover:text-ink" onClick={() => setConfirming(null)}>
                    Keep
                  </button>
                </span>
              ) : (
                <button type="button" aria-label={`Remove ${name}`} className="flex-none text-[13px] font-medium text-ink-3 hover:text-rubric" onClick={() => setConfirming(name)}>
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-[13.5px] leading-snug text-ink-3">No documents yet. Add PDFs, Word files, spreadsheets or text, and research can read them.</p>
      )}
    </Section>
  );
}

function BackendPanel() {
  const backend = useBackend();
  const [draft, setDraft] = useState(backend.host);
  return (
    <Section title="Python backend" hint="Where this browser sends research. Saved in this browser.">
      <p className="mt-4 flex items-center gap-2.5 text-[14px] leading-snug text-ink-2" role="status">
        <i
          className={`h-2 w-2 flex-none ${backend.status === 'online' ? 'bg-ink' : backend.status === 'offline' ? 'bg-rubric' : 'animate-[gr-blink_1s_steps(2,jump-none)_infinite] bg-ink-3'}`}
          aria-hidden="true"
        />
        {backend.status === 'online'
          ? `Connected. ${backend.documents.length} document${backend.documents.length === 1 ? '' : 's'} on the backend.`
          : backend.status === 'offline'
            ? 'Not reachable. Start it from the repo with python main.py, or point to another address.'
            : 'Checking the connection.'}
      </p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          backend.setHost(draft);
        }}
      >
        <label className="min-w-0 flex-1">
          <span className="sr-only">Backend address</span>
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="http://localhost:8000"
            className="gr-input h-10 w-full bg-paper px-3 font-code text-[12.5px] outline-none shadow-[inset_0_0_0_1px_rgba(29,25,21,0.26)] focus:shadow-[inset_0_0_0_1px_#1A1612]"
          />
        </label>
        <button type="submit" className="gr-btn-line h-10">
          Connect
        </button>
      </form>
      <div className="mt-3 flex items-center justify-between gap-4 text-[12.5px] text-ink-3">
        <span>Leave it empty to use the default.</span>
        <button type="button" onClick={() => void backend.check()} className="font-medium text-ink-2 hover:text-ink">
          Check again
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
    mcp: !brief.mcp_enabled ? 'Off' : mcp.state === 'invalid' ? 'Fix' : String(mcp.servers.length),
    documents: backend.status === 'online' ? String(backend.documents.length) : '–',
    backend: STATUS_WORD[backend.status],
  };
  return <div className="sm:grid sm:grid-cols-[200px_minmax(0,1fr)]">
    <nav aria-label="Settings sections" className="flex overflow-x-auto border-b border-rule-soft sm:flex-col sm:border-b-0 sm:border-r">
      {TABS.map((t) => <a key={t.id} href={`/settings?tab=gpt-researcher&section=${t.id}`} aria-current={t.id === tab ? 'page' : undefined} className="flex justify-between gap-3 whitespace-nowrap px-4 py-3 text-sm font-medium aria-[current=page]:text-rubric">{t.label}<span className="font-code text-ink-3">{hints[t.id]}</span></a>)}
    </nav>
    <div className="px-5 py-6 sm:px-8">
      {tab === 'research' && <ResearchPanel brief={brief} onChange={setBrief} />}
      {tab === 'mcp' && <McpPanel brief={brief} onChange={setBrief} />}
      {tab === 'documents' && <DocumentsPanel brief={brief} onChange={setBrief} />}
      {tab === 'backend' && <BackendPanel />}
      <p className="mt-8 text-[12.5px] text-ink-3">Saved in this browser as you go. New research uses these settings.</p>
    </div>
  </div>;
}

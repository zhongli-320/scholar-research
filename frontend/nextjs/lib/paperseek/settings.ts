import { z } from 'zod';

export type ConnectionKind = 'llm' | 'embedding' | 'reranker' | 'decision';
export type ConnectionInput = { kind: ConnectionKind; provider: string; api_type: string; base_url: string; model: string; api_key?: string };
export type TestStatus = { status: string; latency_ms: number | null; code: string; tested_at: string | null };
export type Connection = Omit<ConnectionInput, 'api_key'> & { id: string; has_key: boolean; key_hint: string; requires_key: boolean; test: TestStatus; created_at: string; updated_at: string };
export type SourceSetting = { id: string; has_key: boolean; key_origin: string; key_hint: string; usable: boolean; options: Record<string, string>; test: TestStatus };
export type Defaults = { search_llm: string; review_llm: string; pre_ranking: string; embedding: string; reranker: string; decision: string; source: string };
export type Proxy = { origin: string; hosts: string[]; scope: string[] };
export type PaperSeekWorkspaceSettings = { connections: Connection[]; sources: SourceSetting[]; defaults: Defaults; proxy: Proxy | null };
export type Probe = { ok: boolean; latency_ms: number | null; code: string };

// Schemas strip unknown fields and reject nested values before they reach the browser.
const text = z.string();
const safeCode = z.string().transform(code => /^(?:|timeout|connection_failed|request_failed|connect_timeout|send_timeout|first_byte_timeout|read_idle_timeout|step_deadline|connect_error|transport_error|source_unavailable|http_[1-5][0-9]{2})$/.test(code) ? code : 'request_failed');
const testSchema = z.object({ status: z.enum(['untested', 'ok', 'failed']), latency_ms: z.number().nullable(), code: safeCode, tested_at: text.nullable() });
const connectionSchema = z.object({ id: text, kind: z.enum(['llm', 'embedding', 'reranker', 'decision']), provider: text, api_type: text, base_url: text, model: text, has_key: z.boolean(), key_hint: text.max(4), requires_key: z.boolean(), test: testSchema, created_at: text, updated_at: text });
const sourceSchema = z.object({ id: text, has_key: z.boolean(), key_origin: z.enum(['', 'settings', 'environment']), key_hint: text.max(4), usable: z.boolean(), options: z.object({ openalex_email: text.optional(), crossref_email: text.optional(), pubmed_tool: text.optional(), pubmed_email: text.optional(), wos_db: text.optional() }), test: testSchema });
export const defaultsSchema = z.object({ search_llm: text, review_llm: text, pre_ranking: z.enum(['local_fusion', 'embedding_rerank', 'decision']), embedding: text, reranker: text, decision: text, source: text });
export const proxySchema = z.object({ origin: z.enum(['', 'settings', 'environment']), hosts: z.array(text), scope: z.array(z.enum(['models', 'ip_limited_sources', 'other_sources'])) });
export const probeSchema = z.object({ ok: z.boolean(), latency_ms: z.number().nullable(), code: safeCode });
const workspaceSchema = z.object({ connections: z.array(connectionSchema), sources: z.array(sourceSchema), defaults: defaultsSchema, proxy: proxySchema.nullable() });
export const safeConnection = (value: unknown): Connection => connectionSchema.parse(value);
export const safeWorkspace = (value: unknown): PaperSeekWorkspaceSettings => workspaceSchema.parse(value);
export const withoutEmptyKey = <T extends { api_key?: string | null }>(input: T): T => {
  const copy = { ...input };
  if (!copy.api_key?.trim()) delete copy.api_key;
  return copy;
};
async function request<T>(path: string, method = 'GET', body?: object): Promise<T> {
  const response = await fetch(`/api/paperseek/settings${path}`, { method, cache: 'no-store', ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
  if (!response.ok) throw new Error('PaperSeek 设置请求失败');
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}
export async function loadPaperSeekSettings() { return safeWorkspace(await request('')); }
export async function saveDefaults(input: Partial<Defaults>) { return defaultsSchema.parse(await request('/defaults', 'PUT', input)); }
export async function createConnection(input: ConnectionInput) { return safeConnection(await request('/connections', 'POST', withoutEmptyKey(input))); }
export async function updateConnection(id: string, input: ConnectionInput) { return safeConnection(await request(`/connections/${encodeURIComponent(id)}`, 'PUT', withoutEmptyKey(input))); }
export function deleteConnection(id: string, replacement = '') { return request<void>(`/connections/${encodeURIComponent(id)}${replacement ? `?${new URLSearchParams({ replacement })}` : ''}`, 'DELETE'); }
export async function testConnection(id: string) { return probeSchema.parse(await request(`/connections/${encodeURIComponent(id)}/test`, 'POST')); }
export async function testDraftConnection(input: ConnectionInput & { id?: string }) { return probeSchema.parse(await request('/connections/test', 'POST', withoutEmptyKey(input))); }
export async function saveProxy(input: { urls?: string; scope: string[] }) { return proxySchema.parse(await request('/proxy', 'PUT', input)); }
export function saveSource(id: string, input: { api_key?: string; options?: Record<string, string> }) { return request<void>(`/sources/${encodeURIComponent(id)}`, 'PUT', withoutEmptyKey(input)); }
export async function testSource(id: string) { return probeSchema.parse(await request(`/sources/${encodeURIComponent(id)}/test`, 'POST')); }

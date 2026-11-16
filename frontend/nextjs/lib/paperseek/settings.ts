export type ConnectionKind = 'llm' | 'embedding' | 'reranker' | 'decision';
export type ConnectionInput = { kind: ConnectionKind; provider: string; api_type: string; base_url: string; model: string; api_key?: string };
export type TestStatus = { status: string; latency_ms: number | null; code: string; tested_at: string | null };
export type Connection = Omit<ConnectionInput, 'api_key'> & { id: string; has_key: boolean; key_hint: string; requires_key: boolean; test: TestStatus; created_at: string; updated_at: string };
export type SourceSetting = { id: string; has_key: boolean; key_origin: string; key_hint: string; usable: boolean; options: Record<string, string>; test: TestStatus };
export type Defaults = { search_llm: string; review_llm: string; pre_ranking: string; embedding: string; reranker: string; decision: string; source: string };
export type Proxy = { origin: string; hosts: string[]; scope: string[] };
export type PaperSeekWorkspaceSettings = { connections: Connection[]; sources: SourceSetting[]; defaults: Defaults; proxy: Proxy | null };
export type Probe = { ok: boolean; latency_ms: number | null; code: string };

// Only the documented public fields may cross the settings gateway.
const pick = (value: any, fields: string[]) => Object.fromEntries(fields.filter(k => value && k in value).map(k => [k, value[k]]));
const testFields = ['status', 'latency_ms', 'code', 'tested_at'];
export function safeConnection(value: any): Connection {
  return { ...pick(value, ['id', 'kind', 'provider', 'api_type', 'base_url', 'model', 'has_key', 'key_hint', 'requires_key', 'created_at', 'updated_at']), test: pick(value?.test, testFields) } as Connection;
}
export function safeWorkspace(value: any): PaperSeekWorkspaceSettings {
  return {
    connections: (value.connections || []).map(safeConnection),
    sources: (value.sources || []).map((s: any) => ({ ...pick(s, ['id', 'has_key', 'key_origin', 'key_hint', 'usable']), options: pick(s.options, ['openalex_email', 'crossref_email', 'pubmed_tool', 'pubmed_email', 'wos_db']), test: pick(s.test, testFields) })),
    defaults: pick(value.defaults, ['search_llm', 'review_llm', 'pre_ranking', 'embedding', 'reranker', 'decision', 'source']),
    proxy: value.proxy ? pick(value.proxy, ['origin', 'hosts', 'scope']) : null,
  } as PaperSeekWorkspaceSettings;
}
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
export function saveDefaults(input: Partial<Defaults>) { return request<Defaults>('/defaults', 'PUT', input); }
export async function createConnection(input: ConnectionInput) { return safeConnection(await request('/connections', 'POST', withoutEmptyKey(input))); }
export async function updateConnection(id: string, input: ConnectionInput) { return safeConnection(await request(`/connections/${encodeURIComponent(id)}`, 'PUT', withoutEmptyKey(input))); }
export function deleteConnection(id: string, replacement = '') { return request<void>(`/connections/${encodeURIComponent(id)}${replacement ? `?${new URLSearchParams({ replacement })}` : ''}`, 'DELETE'); }
export function testConnection(id: string) { return request<Probe>(`/connections/${encodeURIComponent(id)}/test`, 'POST'); }
export function testDraftConnection(input: ConnectionInput & { id?: string }) { return request<Probe>('/connections/test', 'POST', withoutEmptyKey(input)); }
export function saveProxy(input: { urls?: string; scope: string[] }) { return request<Proxy>('/proxy', 'PUT', input); }
export function saveSource(id: string, input: { api_key?: string; options?: Record<string, string> }) { return request<void>(`/sources/${encodeURIComponent(id)}`, 'PUT', withoutEmptyKey(input)); }
export function testSource(id: string) { return request<Probe>(`/sources/${encodeURIComponent(id)}/test`, 'POST'); }

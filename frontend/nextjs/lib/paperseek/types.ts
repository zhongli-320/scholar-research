export interface PaperSeekSource {
  id: string;
  label: string;
  default: boolean;
  capabilities: { citation_expansion: boolean; filter: { mode: string; label: string; options: { id: string; label: string }[] } };
}
export interface PaperSeekRun {
  id: string;
  question: string;
  display_title: string;
  source: string;
  status: string;
  result_count: number;
  current_step?: string; warnings?: string[]; error_code?: string;
}
export interface PaperSeekHistoryPage { items: PaperSeekRun[]; next_cursor: string | null; matched_count: number }
export interface PaperSeekResultPage { results: PaperSeekResult[]; next_cursor: string | null; total_count: number; matched_count: number; scored_count: number; high_score_count: number; max_score: number | null }
export interface PaperSeekRunInput {
  question: string;
  source: string;
  search_budget: string;
  field_ids?: string[];
  field_hint?: string;
  citation_enabled?: boolean;
  wos_db?: string;
}

export interface PaperSeekEvent {
  run_id: string; sequence: number; event_type: string; stage: string;
  occurred_at: string; schema_version: number; payload: Record<string, unknown>;
}
export interface PaperSeekResult {
  uid: string; rank: number; title: string; authors: string[]; year: number | null; venue: string;
  doi: string; url: string; abstract: string; relevance_score: number | null; relevance_reason: string;
  citation_count: number;
}
export interface PaperSeekFilters {
  cursor?: string; page_size?: number; query?: string; min_score?: number; metadata?: string;
  sort?: string; journal?: string; acceptance?: string;
}
export interface PaperSeekCitationMap { nodes: unknown[]; edges: unknown[]; enabled?: boolean }
export interface PaperSeekArtifact { id: string; filename: string; kind: string }

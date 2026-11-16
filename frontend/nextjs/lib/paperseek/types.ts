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
}
export interface PaperSeekHistoryPage { items: PaperSeekRun[]; next_cursor: string | null; matched_count: number }
export interface PaperSeekResultPage { results: unknown[]; next_cursor: string | null; total_count: number }
export interface PaperSeekRunInput {
  question: string;
  source: string;
  search_budget: string;
  field_ids?: string[];
  field_hint?: string;
  citation_enabled?: boolean;
  wos_db?: string;
}

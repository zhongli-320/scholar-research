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
export interface PaperSeekHistoryItem extends PaperSeekRun { created_at: string; kind?: string }
export interface PaperSeekHistoryPage { items: PaperSeekHistoryItem[]; next_cursor: string | null; matched_count: number }
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

export interface PaperSeekAnalysisSummary {
  id: string; source_run_id: string; title: string; paper_count: number; scope: string; created_at: string;
}
export interface PaperSeekAnalysis extends PaperSeekAnalysisSummary {
  source_reported_total: number | null; retrieval_pool_limit: number | null; scoring_limit: number | null; warnings: string[];
  statistics: {
    paper_count: number; scored_count: number; cited_paper_count: number; citation_sum: number;
    years: MetricBucket[]; venues: MetricBucket[]; providers: MetricBucket[]; document_types: MetricBucket[];
    authors: MetricBucket[]; institutions: MetricBucket[]; countries: MetricBucket[]; keywords: MetricBucket[];
    keyword_sources: MetricBucket[]; citation_sources: MetricBucket[]; coverage: { field: string; available: number; total: number }[];
    category_totals: Record<string, number>; category_limit: number; ranked_paper_count: number; cas_top_count: number;
    cas_tiers: MetricBucket[]; jcr_quartiles: MetricBucket[]; ccf_ranks: MetricBucket[];
    ranked_venues: (MetricBucket & { cas_tier: number | null; cas_top: boolean; jcr_quartile: string; impact_factor: number | null; ccf_rank: string })[];
  };
}
export interface MetricBucket { label: string; count: number }
export interface PaperSeekAnalysisPage { items: PaperSeekAnalysisSummary[]; total_count: number; next_offset: number | null }
export interface PaperSeekNetworkParameters {
  kind: 'keywords' | 'coupling'; min_occurrences: number; max_nodes: number; max_edges: number; min_weight?: number; max_reference_frequency?: number | null;
}
export interface PaperSeekMetricNetwork {
  parameters: PaperSeekNetworkParameters; corpus_count: number; eligible_paper_count: number; eligible_node_count: number; total_edge_count: number; excluded_reference_count: number;
  nodes: { id: string; label: string; count: number; group?: number; year?: number | null }[];
  edges: { source: string; target: string; weight: number; similarity: number }[]; warnings: string[];
}

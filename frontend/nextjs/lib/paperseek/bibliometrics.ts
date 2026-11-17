const ANALYSIS_SCOPE: Record<string, string> = {
  retrieved_candidates: '检索候选文献',
  legacy_ranked_only: '历史排序结果',
};

export const analysisScopeLabel = (scope: string) => ANALYSIS_SCOPE[scope] ?? '其他分析范围';

const RUN_STATUS: Record<string, string> = {
  queued: '排队中',
  running: '运行中',
  cancelling: '正在取消',
  completed: '已完成',
  completed_with_warnings: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const runStatusLabel = (status: string) => RUN_STATUS[status] ?? '未知状态';

const STAGE: Record<string, string> = {
  lifecycle: '任务',
  workflow: '流程',
  query: '检索规划',
  retrieval: '文献获取',
  citation: '引用扩展',
  selection: '候选筛选',
  ranking: '相关性排序',
  cancelling: '正在取消',
  completed: '已完成',
  completed_with_warnings: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

export const runStageLabel = (stage: string) => STAGE[stage] ?? stage;

const EVENT_ACTION: Record<string, string> = {
  created: '已创建', claimed: '已接收', cancelling: '正在取消', completed: '已完成', completed_with_warnings: '已完成', failed: '失败', cancelled: '已取消',
  started: '已开始', request_failed: '请求失败', recovery: '正在恢复', degraded: '部分降级', planned: '已规划', request_started: '请求已开始', progress: '处理中',
  portfolio_request_started: '组合请求已开始', portfolio_recorded: '组合方案已记录', portfolio_degraded: '组合方案已降级', refinement_stopped: '优化已停止', resumed: '已恢复', selected: '已选定',
  embedding_completed: '向量化已完成', lane_completed: '检索通道已完成', rerank_completed: '重排序已完成', decision_started: '筛选决策已开始', decision_progress: '筛选决策进行中', decision_degraded: '筛选决策已降级', decision_completed: '筛选决策已完成', decision_failed: '筛选决策失败', retrying: '正在重试', skipped: '已跳过',
  batch_completed: '批次已完成', batch_failed: '批次失败', reasons_progress: '排序理由生成中',
};

export function runEventLabel(eventType: string) {
  const [stage, action = ''] = eventType.split('.', 2);
  const stageLabel = stage === 'enrichment' ? '元数据补充' : runStageLabel(stage);
  return `${stageLabel}：${EVENT_ACTION[action] ?? action}`;
}

const EVENT_COUNT: Record<string, string> = {
  count: '数量', warning_count: '警告数', candidate_count: '候选数', result_count: '结果数', hit_count: '命中数',
  query_view_count: '检索视角数', portfolio_count: '组合方案数', primary_count: '主检索数', raw_count: '原始结果数',
  scored_count: '已评分数', seed_count: '种子数', paper_count: '文献数', group_count: '组数', artifact_count: '产物数',
  completed_batches: '已完成批次', batch_count: '批次数',
};
export const runEventCountLabel = (key: string) => EVENT_COUNT[key] ?? '数量';

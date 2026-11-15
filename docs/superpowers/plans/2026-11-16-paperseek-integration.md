# PaperSeek 文献工作台接入 GPT Researcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 GPT Researcher 的现有视觉体系中接入 PaperSeek 文献检索与文献计量，同时原样保留 GPT Researcher 一键写综述流程和两套独立配置。

**Architecture:** Next.js 负责统一界面，并通过服务端 Route Handlers 直接代理明确允许的 PaperSeek API；GPT Researcher FastAPI 继续只负责原报告流程。PaperSeek、GPT Researcher FastAPI 和 Next.js 保持三个独立进程，由一个 Windows 启动脚本检查并启动缺失服务。

**Tech Stack:** Next.js 14、React 18、TypeScript、原生 `fetch`/SSE、Zod 3、Vitest、PowerShell、PaperSeek Community HTTP API。

**Spec:** `docs/superpowers/specs/2026-11-16-paperseek-integration-design.md`

## Global Constraints

- PaperSeek 固定使用当前 `1.0.0b6` 独立 Python 3.12 环境；不升级、不重建 `.venv`。
- PaperSeek 默认地址为 `http://127.0.0.1:8767`，只从 Next.js 服务端环境变量 `PAPERSEEK_API_URL` 覆盖。
- 不合并数据库、历史、密钥、Python 虚拟环境或后台进程。
- GPT Researcher 报告不得读取 PaperSeek 检索结果；PaperSeek 检索不得依赖 GPT Researcher FastAPI 存活。
- 不提供任意路径代理；每个公开 Route Handler 必须对应计划中列出的 PaperSeek 接口。
- 浏览器、日志和错误响应不得包含 PaperSeek 明文 API key。
- 首期是本机单用户应用，不增加登录、多用户隔离或公网发布。
- 不修改 `findpapers`，不删除 `data/`、`outputs/` 或 `C:\Users\zhonglee\.paperseek`。
- 所有页面沿用 `frontend/nextjs/app/(gr)/gr.css` 和现有 Tailwind token，不复制 PaperSeek Vue 静态资源。

## Review Focus

- PaperSeek 离线或超时：检索页面显示可恢复的 503，`/reviews/new` 仍能使用 GPT Researcher FastAPI；Task 1 覆盖。
- 路径注入或任意 URL：动态 ID 必须 `encodeURIComponent`，服务端 helper 拒绝完整 URL、`..` 和非 `/ready`、`/api/v1/` 路径；Task 1 覆盖。
- SSE 断线重连：使用持久事件 sequence 去重，并允许浏览器携带 `Last-Event-ID`；Task 4 覆盖。
- 设置中的密钥：响应只使用 `has_key`、`key_hint`，保存请求不写日志；Task 7 覆盖。
- 刷新已有检索详情：只查询原 run ID，不创建重复任务；Task 4 覆盖。

---

### Task 1: PaperSeek 网关基础与前端测试基线

**Files:**
- Modify: `frontend/nextjs/package.json`
- Create: `frontend/nextjs/vitest.config.ts`
- Create: `frontend/nextjs/lib/paperseek/server.ts`
- Create: `frontend/nextjs/lib/paperseek/server.test.ts`
- Create: `frontend/nextjs/app/api/paperseek/ready/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/sources/route.ts`
- Modify: `frontend/nextjs/.example.env`

**Interfaces:**
- Produces: `paperseekRequest(request: Request, path: string, init?: RequestInit): Promise<Response>`，负责固定服务端地址、允许路径校验、有限头转发、状态码和流式响应保真。
- Produces: `paperseekPath(...segments: string[]): string`，逐段编码动态 ID，不接受完整 URL。
- Produces: `GET /api/paperseek/ready` 与 `GET /api/paperseek/sources`。

- [ ] **Step 1: 添加 Vitest 配置和脚本**

在 `package.json` 增加 `test:unit: vitest run`，开发依赖只增加 `vitest`；`vitest.config.ts` 使用 Node 环境并解析 `@` 到 `frontend/nextjs`。

- [ ] **Step 2: 写网关失败测试**

在 `server.test.ts` 覆盖：默认地址、末尾斜杠清理、拒绝 `https://evil.example`、拒绝 `../settings`、PaperSeek 连接失败返回稳定 503、保留上游 `404`/`content-type`/`content-disposition`、只转发 `Idempotency-Key` 和 `Last-Event-ID`。

- [ ] **Step 3: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/server.test.ts`

Expected: FAIL，原因是 `server.ts` 或导出函数不存在。

- [ ] **Step 4: 实现最小服务端 helper 和两个显式路由**

`paperseekRequest` 使用 `process.env.PAPERSEEK_API_URL || 'http://127.0.0.1:8767'` 与原生 `fetch`；响应 body 直接流转，不读取完整 SSE 或下载文件。两个 Route Handler 只传入固定 `/ready`、`/api/v1/sources`。

- [ ] **Step 5: 运行任务测试与类型检查**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/server.test.ts; npx tsc --noEmit`

Expected: 网关测试全部 PASS，TypeScript 退出码 0。

- [ ] **Step 6: 提交**

```powershell
git add frontend/nextjs/package.json frontend/nextjs/vitest.config.ts frontend/nextjs/lib/paperseek frontend/nextjs/app/api/paperseek/ready frontend/nextjs/app/api/paperseek/sources frontend/nextjs/.example.env
git commit -m "feat: add PaperSeek gateway foundation"
```

### Task 2: 顶部导航与 GPT Researcher 综述入口迁移

**Files:**
- Create: `frontend/nextjs/app/(gr)/_components/navigation.ts`
- Test: `frontend/nextjs/app/(gr)/_components/navigation.test.ts`
- Modify: `frontend/nextjs/app/(gr)/_components/ui.tsx:107-151`
- Modify: `frontend/nextjs/app/(gr)/_components/mode.tsx:18-27`
- Create: `frontend/nextjs/app/(gr)/reviews/new/page.tsx`
- Create: `frontend/nextjs/app/(gr)/history/reviews/page.tsx`
- Modify: `frontend/nextjs/app/(gr)/archive/page.tsx`
- Modify: `frontend/nextjs/app/(gr)/research/[id]/ResearchScreen.tsx:100-180`

**Interfaces:**
- Produces: `MAIN_NAV_ITEMS`，包含 `/`、`/bibliometrics`、`/reviews/new`。
- Produces: `HISTORY_NAV_ITEMS`，包含 `/history/searches`、`/history/reviews`。
- Produces: `useLinks().reviewHome`、`searchHistory`、`reviewHistory`，mock 模式仍映射现有 mock 页面。

- [ ] **Step 1: 写导航契约测试**

断言主菜单顺序为“文献检索、文献计量、一键写综述”，历史下拉只含“检索历史、综述历史”，设置链接为 `/settings`，不再显示外部 Docs 作为主任务。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- 'app/(gr)/_components/navigation.test.ts'`

Expected: FAIL，原因是导航常量不存在。

- [ ] **Step 3: 提取导航常量并改造 TopBar**

保持现有品牌、颜色和响应式结构；桌面端历史使用可键盘操作的下拉，移动端使用同一项目列表的折叠菜单。设置按钮改为链接 `/settings`。

- [ ] **Step 4: 迁移一键写综述入口而不复制逻辑**

`/reviews/new/page.tsx` 直接渲染现有 `HomeScreen`；`/history/reviews` 渲染现有 `ArchiveScreen`。旧 `/archive` 保留为兼容重定向，`/research/[id]` 的“New research/Archive”链接改到新路由。

- [ ] **Step 5: 运行测试、lint 和构建**

Run: `cd frontend/nextjs; npm run test:unit -- 'app/(gr)/_components/navigation.test.ts'; npm run lint; npm run build`

Expected: 测试 PASS，lint 无 error，Next.js build 成功；已有 `/research/[id]` 路由仍生成。

- [ ] **Step 6: 提交**

```powershell
git add frontend/nextjs/app/'(gr)'
git commit -m "feat: add workbench navigation"
```

### Task 3: 文献检索首页、客户端类型与创建任务

**Files:**
- Create: `frontend/nextjs/lib/paperseek/types.ts`
- Create: `frontend/nextjs/lib/paperseek/client.ts`
- Test: `frontend/nextjs/lib/paperseek/client.test.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/history/route.ts`
- Create: `frontend/nextjs/app/(gr)/_components/LiteratureHome.tsx`
- Modify: `frontend/nextjs/app/(gr)/page.tsx`
- Create: `frontend/nextjs/app/(gr)/mocks/literature/page.tsx`
- Create: `frontend/nextjs/app/(gr)/mocks/_data/paperseek.ts`

**Interfaces:**
- Produces: `PaperSeekRun`, `PaperSeekSource`, `PaperSeekHistoryPage`, `PaperSeekResultPage`, `PaperSeekRunInput` 最小类型，仅覆盖页面实际使用字段；`PaperSeekRunInput` 包含 `question/source/search_budget/field_ids/field_hint/citation_enabled/wos_db`。
- Produces: `listSources()`, `listHistory(params)`, `createRun(input)`；`createRun` 使用 `crypto.randomUUID()` 生成 `Idempotency-Key`。
- Consumes: Task 1 的 `paperseekRequest`。

- [ ] **Step 1: 写客户端契约失败测试**

覆盖 `createRun({question, source:'openalex', search_budget:'fast'})` 的 URL、body、幂等头；高级字段 `field_ids/field_hint/citation_enabled/wos_db` 原样传递；`listHistory({limit:1})` 只请求最近一条；非 JSON 错误解析为包含 PaperSeek `error.code` 的 `PaperSeekApiError`。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/client.test.ts`

Expected: FAIL，原因是 client/types 不存在。

- [ ] **Step 3: 实现最小类型、客户端和两个显式 Route Handler**

`POST /api/paperseek/runs` 对应 `/api/v1/runs`；`GET /api/paperseek/history` 对应 `/api/v1/history` 并转发允许的分页/查询参数。客户端不包含 PaperSeek 设置或综述类型。

- [ ] **Step 4: 实现首页**

首页按已确认 B-v2：问题输入、数据源、预算、高级条件、默认数据源摘要、最近一条检索；删除“下一步”。成功创建后跳转 `/literature/{run.id}`；PaperSeek 离线时保留输入并链接 `/settings?tab=paperseek`。

- [ ] **Step 5: 添加 mock 页面并做构建检查**

`/mocks/literature` 使用固定数据渲染同一 `LiteratureHome`，禁止真实提交，供桌面和移动端人工检查。

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/client.test.ts; npx tsc --noEmit; npm run build`

Expected: 测试 PASS、类型检查和 build 成功，根路由 `/` 生成文献检索首页。

- [ ] **Step 6: 提交**

```powershell
git add frontend/nextjs/lib/paperseek frontend/nextjs/app/api/paperseek/runs frontend/nextjs/app/api/paperseek/history frontend/nextjs/app/'(gr)'
git commit -m "feat: add literature search home"
```

### Task 4: 检索进度、结果、引用与导出闭环

**Files:**
- Create: `frontend/nextjs/lib/paperseek/events.ts`
- Test: `frontend/nextjs/lib/paperseek/events.test.ts`
- Modify: `frontend/nextjs/lib/paperseek/client.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/events/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/results/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/citation-map/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/artifacts/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/artifacts/[artifactId]/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/export/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/export-selected/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/runs/[id]/cancel/route.ts`
- Create: `frontend/nextjs/app/(gr)/literature/[id]/page.tsx`
- Create: `frontend/nextjs/app/(gr)/literature/[id]/LiteratureRunScreen.tsx`
- Create: `frontend/nextjs/app/(gr)/_components/LiteratureResults.tsx`

**Interfaces:**
- Produces: `reducePaperSeekEvents(events: PaperSeekEvent[]): PaperSeekProgress`，按 sequence 去重并保留最后 stage、warning 和 error code。
- Produces: `openRunEvents(id, handlers): () => void`，使用 `EventSource` 连接同源网关。
- Produces: `getRun`, `cancelRun`, `getResults(filters)`, `getCitationMap`, `listArtifacts`, `exportRun(format)`, `exportSelected(format,uids)`；结果 filters 覆盖 `cursor/page_size/query/min_score/metadata/sort/journal/acceptance`。
- Consumes: Task 3 的 `PaperSeekRun` 和 `PaperSeekApiError`。

- [ ] **Step 1: 写事件归并失败测试**

覆盖乱序/重复 sequence、terminal event 后状态、warning 保留、错误 code 保留；同一事件重放不得重复增加进度记录。

- [ ] **Step 2: 写路径与 SSE 网关失败测试**

扩展 `server.test.ts`：动态 run/artifact ID 被逐段编码，`Last-Event-ID` 被转发，SSE `content-type` 和 body stream 原样返回，刷新 GET 不触发 POST。

- [ ] **Step 3: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/events.test.ts lib/paperseek/server.test.ts`

Expected: FAIL，原因是事件 reducer 和动态路由能力不存在。

- [ ] **Step 4: 实现显式网关、客户端和运行页**

运行页先 GET 状态，再订阅事件；完成后加载分页结果。显示 PaperSeek 原始阶段、结果统计、论文题录/摘要/相关性理由、warning、错误 code、引用图入口、筛选排序、全量导出和选中导出；取消按钮只 POST 当前 run 的 `/cancel`。

- [ ] **Step 5: 验证刷新和历史任务**

Run: `Invoke-RestMethod 'http://127.0.0.1:8767/api/v1/runs/1833c3a4-9929-4464-b272-721878417c7d' | Select-Object id,status,result_count`

Expected: `status=completed`、`result_count=256`。随后通过开发服务器同源 `/api/paperseek/runs/...` 查询同样结果；不创建新任务。

- [ ] **Step 6: 运行测试和构建**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek; npm run lint; npm run build`

Expected: 全部 PASS，构建成功。

- [ ] **Step 7: 提交**

```powershell
git add frontend/nextjs/lib/paperseek frontend/nextjs/app/api/paperseek/runs frontend/nextjs/app/'(gr)'/literature
git commit -m "feat: add PaperSeek run results"
```

### Task 5: 检索历史与最近检索一致性

**Files:**
- Create: `frontend/nextjs/lib/paperseek/history.ts`
- Test: `frontend/nextjs/lib/paperseek/history.test.ts`
- Create: `frontend/nextjs/app/api/paperseek/history/[id]/route.ts`
- Create: `frontend/nextjs/app/(gr)/history/searches/page.tsx`
- Create: `frontend/nextjs/app/(gr)/_components/SearchHistoryScreen.tsx`
- Modify: `frontend/nextjs/app/(gr)/_components/LiteratureHome.tsx`

**Interfaces:**
- Produces: `latestSearch(items): PaperSeekHistoryItem | null`，只选择最新 `research` 记录。
- Produces: `renameSearch(id, title)` 和 `deleteSearch(id)`；真实删除仅由明确点击和二次确认触发。

- [ ] **Step 1: 写历史选择和修改失败测试**

覆盖空历史、混入 review kind、日期相同的稳定顺序、重命名空标题不发送、动态 ID 编码、删除响应 202。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/history.test.ts`

Expected: FAIL，原因是 history helper 不存在。

- [ ] **Step 3: 实现历史页面和首页复用**

历史页支持查询、分页、打开、重命名和单条删除确认；首页调用同一 `latestSearch` 且只渲染一条，不复制排序逻辑。测试和开发不得调用真实 DELETE。

- [ ] **Step 4: 运行测试、类型检查和构建**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/history.test.ts; npx tsc --noEmit; npm run build`

Expected: PASS；`/history/searches` 与首页均构建成功。

- [ ] **Step 5: 提交**

```powershell
git add frontend/nextjs/lib/paperseek/history* frontend/nextjs/app/api/paperseek/history frontend/nextjs/app/'(gr)'/history/searches frontend/nextjs/app/'(gr)'/_components/LiteratureHome.tsx frontend/nextjs/app/'(gr)'/_components/SearchHistoryScreen.tsx
git commit -m "feat: add literature search history"
```

### Task 6: PaperSeek 文献计量与网络查看

**Files:**
- Modify: `frontend/nextjs/lib/paperseek/types.ts`
- Modify: `frontend/nextjs/lib/paperseek/client.ts`
- Create: `frontend/nextjs/lib/paperseek/network.ts`
- Test: `frontend/nextjs/lib/paperseek/network.test.ts`
- Create: `frontend/nextjs/app/api/paperseek/bibliometrics/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/bibliometrics/[id]/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/bibliometrics/[id]/network/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/bibliometrics/[id]/export/route.ts`
- Create: `frontend/nextjs/app/(gr)/bibliometrics/page.tsx`
- Create: `frontend/nextjs/app/(gr)/bibliometrics/[id]/page.tsx`
- Create: `frontend/nextjs/app/(gr)/_components/BibliometricsHome.tsx`
- Create: `frontend/nextjs/app/(gr)/_components/BibliometricsDetail.tsx`
- Create: `frontend/nextjs/app/(gr)/_components/NetworkView.tsx`

**Interfaces:**
- Produces: `PaperSeekAnalysis`, `PaperSeekAnalysisPage`, `PaperSeekMetricNetwork`。
- Produces: `createAnalysis({source_run_id,title})`, `listAnalyses`, `getAnalysis`, `renameAnalysis`, `deleteAnalysis`, `buildNetwork`, `exportAnalysis`。
- Produces: `layoutNetwork(network, width, height): PositionedNetwork`，保持 node/edge ID，输出有限坐标并提供可访问列表。

- [ ] **Step 1: 写计量与网络失败测试**

覆盖：创建 body 必须只有 `source_run_id/title`；重命名空标题不发送；删除只接受 204；默认网络参数 `kind='keywords'`, `min_occurrences=2`, `max_nodes=100`, `max_edges=500`；空网络、孤立节点、未知 edge endpoint 不崩溃；所有坐标为有限数。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/network.test.ts`

Expected: FAIL，原因是计量类型和布局函数不存在。

- [ ] **Step 3: 实现显式计量网关与客户端**

保留 PaperSeek 201/204、`Idempotency-Key`、CSV/JSON 下载头和结构化 warning。页面只允许选择 `completed` 的检索，不提供上传。

- [ ] **Step 4: 实现计量页面**

入口页同时显示可选检索和已有分析；详情页展示论文数、引用数、年份、来源、作者、机构、国家、关键词、期刊分区覆盖和 warning。网络支持 `keywords`、`coupling` 参数、SVG 查看和按权重排序的可访问节点列表；首期不新增图形依赖。

- [ ] **Step 5: 运行测试和构建**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/network.test.ts lib/paperseek/client.test.ts; npm run lint; npm run build`

Expected: PASS；`/bibliometrics` 与 `/bibliometrics/[id]` 构建成功。

- [ ] **Step 6: 提交**

```powershell
git add frontend/nextjs/lib/paperseek frontend/nextjs/app/api/paperseek/bibliometrics frontend/nextjs/app/'(gr)'/bibliometrics frontend/nextjs/app/'(gr)'/_components/Bibliometrics*
git add frontend/nextjs/app/'(gr)'/_components/NetworkView.tsx
git commit -m "feat: add PaperSeek bibliometrics"
```

### Task 7: PaperSeek / GPT Researcher 双标签设置页

**Files:**
- Create: `frontend/nextjs/lib/paperseek/settings.ts`
- Test: `frontend/nextjs/lib/paperseek/settings.test.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/defaults/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/connections/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/connections/test/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/connections/[id]/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/connections/[id]/test/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/proxy/route.ts`
- Create: `frontend/nextjs/app/api/paperseek/settings/sources/[id]/test/route.ts`
- Create: `frontend/nextjs/app/(gr)/settings/page.tsx`
- Create: `frontend/nextjs/app/(gr)/_components/PaperSeekSettings.tsx`
- Modify: `frontend/nextjs/app/(gr)/_components/Settings.tsx`
- Modify: `frontend/nextjs/app/(gr)/_components/preferences.ts`
- Modify: `frontend/nextjs/app/(gr)/_components/HomeScreen.tsx`
- Modify: `frontend/nextjs/app/(gr)/layout.tsx`

**Interfaces:**
- Produces: `PaperSeekWorkspaceSettings`，connection 只含 `has_key/key_hint/requires_key`，不含可读取的 `api_key`。
- Produces: `loadPaperSeekSettings`, `saveDefaults`, `createConnection`, `updateConnection`, `deleteConnection`, `testConnection`, `saveProxy`, `testSource`。
- Produces: `/settings?tab=paperseek|gpt-researcher&section=...` 页面状态。

- [ ] **Step 1: 写设置安全失败测试**

覆盖：API 返回模型不包含明文 `api_key`；空 key 更新不会覆盖已保存 key；保存 PaperSeek 设置不调用 GPT Researcher 接口；连接测试 body 不出现在 console mock；路径 ID 编码。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/settings.test.ts`

Expected: FAIL，原因是 settings client 不存在。

- [ ] **Step 3: 实现显式设置网关和 PaperSeek 设置面板**

设置页顶层只有 PaperSeek / GPT Researcher 两个标签。PaperSeek 标签复用其 workspace settings 语义，展示连接、默认模型/源、代理、测试状态；不接入 `DELETE /settings/secrets`，避免新增全局清密钥入口。

- [ ] **Step 4: 把现有 GPT Researcher 设置嵌入第二个标签**

从当前 `SettingsDialog` 提取可复用内容，不复制 Research/MCP/Documents/Backend 面板；顶部齿轮和 HomeScreen 中的设置链接改为 `/settings` 查询参数。完成后移除不再使用的 modal 状态和导入。

- [ ] **Step 5: 运行测试、lint 和构建**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/settings.test.ts; npm run lint; npm run build`

Expected: PASS；设置页构建成功，未出现未使用的 dialog/preferences 导出。

- [ ] **Step 6: 提交**

```powershell
git add frontend/nextjs/lib/paperseek/settings* frontend/nextjs/app/api/paperseek/settings frontend/nextjs/app/'(gr)'/settings frontend/nextjs/app/'(gr)'/_components frontend/nextjs/app/'(gr)'/layout.tsx
git commit -m "feat: add split workbench settings"
```

### Task 8: 本机统一启动入口

**Files:**
- Create: `scripts/start-research-workbench.ps1`
- Create: `scripts/test-start-research-workbench.ps1`
- Modify: `README-zh_CN.md`
- Modify: `PROJECT_STATE.md`

**Interfaces:**
- Produces: `Resolve-ServiceAction([bool]$Ready, [bool]$PortOpen) -> 'reuse'|'start'|'blocked'`。
- Produces: `start-research-workbench.ps1 [-CheckOnly] [-PaperSeekPort 8767] [-BackendPort 8000] [-FrontendPort 3000]`。

- [ ] **Step 1: 写纯 PowerShell 决策测试**

测试三个状态：健康即 `reuse`；端口空闲即 `start`；端口占用但健康失败即 `blocked`。断言 blocked 路径不调用 `Stop-Process`、不选随机端口。

- [ ] **Step 2: 运行测试确认失败**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-start-research-workbench.ps1`

Expected: FAIL，原因是启动脚本或函数不存在。

- [ ] **Step 3: 实现统一启动脚本**

按顺序检查 PaperSeek `/ready`、GPT Researcher `/files/`、Next.js 首页。健康服务直接复用；缺失服务分别使用 `paperseek\.venv\Scripts\paperseek.exe serve --port 8767`、`gpt-researcher\.venv\Scripts\python.exe main.py`、在 `frontend\nextjs` 执行 `npm run dev`。`Start-Process` 必须 `-WindowStyle Hidden` 并把 stdout/stderr 写入 `logs/workbench/`。任何 blocked 状态终止启动并报告端口，不停止进程。

- [ ] **Step 4: 实现 CheckOnly 和文档**

`-CheckOnly` 只报告三项状态、不启动进程。README 记录启动命令、默认端口、日志和独立数据目录；PROJECT_STATE 只增量记录新入口，不改旧交接事实。

- [ ] **Step 5: 运行测试和安全检查**

Run: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-start-research-workbench.ps1; powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-research-workbench.ps1 -CheckOnly`

Expected: 决策测试 PASS；当前健康的 PaperSeek 显示 `reuse`；脚本中不存在 `Stop-Process`。

- [ ] **Step 6: 提交**

```powershell
git add scripts/start-research-workbench.ps1 scripts/test-start-research-workbench.ps1 README-zh_CN.md PROJECT_STATE.md
git commit -m "feat: add local workbench launcher"
```

### Task 9: 故障隔离、回归与验收

**Files:**
- Modify: `frontend/nextjs/app/(gr)/mocks/layout.tsx`
- Create: `frontend/nextjs/app/(gr)/mocks/search-history/page.tsx`
- Create: `frontend/nextjs/app/(gr)/mocks/bibliometrics/page.tsx`
- Create: `frontend/nextjs/app/(gr)/mocks/settings/page.tsx`
- Create: `frontend/nextjs/lib/paperseek/integration.test.ts`
- Modify: `docs/superpowers/specs/2026-11-16-paperseek-integration-design.md` only if implementation reveals a verified factual correction

**Interfaces:**
- Consumes: Tasks 1–8 的公共接口；不新增产品接口。
- Produces: 一组离线 fixture 驱动的 mock 页面和跨模块故障隔离测试。

- [ ] **Step 1: 写跨模块失败测试**

模拟 GPT Researcher FastAPI 连接失败、PaperSeek 正常：PaperSeek client 仍能查询；模拟 PaperSeek 503、GPT Researcher 报告 API 正常：报告路由不调用 PaperSeek；设置保存分别只触达自己的接口。

- [ ] **Step 2: 运行测试确认失败**

Run: `cd frontend/nextjs; npm run test:unit -- lib/paperseek/integration.test.ts`

Expected: 若任何模块仍共享错误状态或地址，测试 FAIL。

- [ ] **Step 3: 完成最小故障隔离修正和 mock 页面**

只修复测试揭示的共享状态；mock 页面覆盖首页、运行结果、检索历史、计量和双标签设置，使用同一产品组件，不维护第二套页面。

- [ ] **Step 4: 运行前端全量验证**

Run: `cd frontend/nextjs; npm run test:unit; npx tsc --noEmit; npm run lint; npm run build`

Expected: unit tests 全部 PASS；类型、lint、build 退出码均为 0。

- [ ] **Step 5: 运行 GPT Researcher 后端回归**

Run: `python -m pytest tests/backend tests/test_report_generator_live_websocket.py -q`

Expected: 全部 PASS；没有 PaperSeek 依赖导入到 Python 后端。

- [ ] **Step 6: 运行 PaperSeek 回归与历史核对**

Run: `E:\中大研究生涯\信息组织\research agent\paperseek\.venv\Scripts\python.exe -m unittest -v E:\中大研究生涯\信息组织\research agent\paperseek\test_query_budget.py`

Expected: 1/1 PASS。

Run: `Invoke-RestMethod 'http://127.0.0.1:8767/api/v1/runs/1833c3a4-9929-4464-b272-721878417c7d' | Select-Object id,status,result_count,warnings,error_code`

Expected: `completed`、256、0 warning、无 error；不创建或删除任务。

- [ ] **Step 7: 人工验收关键界面**

用 mock 路由检查桌面与移动端：顶部 B 导航、首页仅一条最近检索且无“下一步”、文献结果分页、计量网络可缩放/列表可读、设置双标签键盘可用。再用本机服务验证 PaperSeek 离线时 `/reviews/new` 可用，以及 GPT Researcher FastAPI 离线时 PaperSeek 历史可查。

- [ ] **Step 8: 提交**

```powershell
git add frontend/nextjs/app/'(gr)'/mocks frontend/nextjs/lib/paperseek/integration.test.ts
git commit -m "test: verify research workbench integration"
```

- [ ] **Step 9: 整体提交审查**

Run: `git status --short; git log --oneline --max-count=10; git diff --check HEAD~9..HEAD`

Expected: 只有用户原有的未跟踪 `data/` 保持未提交；本计划每个任务一个聚焦提交；diff check 无错误。

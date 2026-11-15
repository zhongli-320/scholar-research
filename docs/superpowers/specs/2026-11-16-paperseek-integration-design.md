# PaperSeek 文献工作台接入 GPT Researcher 设计

日期：2026-11-16
状态：用户已确认设计，待实施计划
目标项目：`E:\中大研究生涯\信息组织\research agent\gpt-researcher`

## 1. 意图

把 PaperSeek 的文献检索和文献计量能力接入 GPT Researcher，形成一个统一入口的研究工作台。用户只面对 GPT Researcher 风格的前端，但不同能力继续由各自擅长的后台负责：PaperSeek 负责结构化文献检索和计量，GPT Researcher 负责自然语言一键研究与综述写作。

选择这一方向，是因为 GPT Researcher 有完整、可编辑的 Next.js 前端，而本机安装的 PaperSeek Community 只带预编译网页资源；PaperSeek 同时已经提供覆盖检索、进度、结果、历史、计量和导出的 HTTP API。首期通过 API 组合两个系统，比复制算法、前端产物或数据库更小、更可维护。

## 2. 产品目标

- GPT Researcher 首页改为 PaperSeek 驱动的“新建文献检索”。
- 顶部菜单提供文献检索、文献计量、一键写综述、历史记录和设置。
- 文献检索与文献计量保持 PaperSeek 原功能和数据语义。
- 一键写综述复用 GPT Researcher 当前首页的完整自然语言研究与报告流程。
- 两套历史、配置、密钥和数据存储各自独立，但通过同一前端访问。
- PaperSeek 不可用时，一键写综述仍可使用；GPT Researcher Python 后台停止时，PaperSeek 检索与计量仍应可用。
- 首期按本机单用户使用设计，并提供统一启动入口。

## 3. 非目标与反目标

首期不做：

- 不合并 PaperSeek SQLite 与 GPT Researcher 报告存储。
- 不让 GPT Researcher 综述读取或复用 PaperSeek 检索结果。
- 不增加文献计量文件上传或外部数据导入。
- 不重写 PaperSeek 检索、评分、计量或导出算法。
- 不修改 PaperSeek 预编译前端资源。
- 不把两个 Python 后台强行合并为一个进程或一个虚拟环境。
- 不共享、复制或自动同步两套密钥和模型配置。
- 不自动升级 PaperSeek，不删除现有历史，不停止占用其他端口的服务。
- 不在首期增加登录、多用户数据隔离或公网部署能力。

即使技术上能运行，下列结果也视为失败：

- 为了统一界面而破坏 PaperSeek 现有数据库、历史或产物兼容性。
- 通过通配代理暴露 PaperSeek 删除、密钥或其他未使用接口。
- 页面把摘要级证据描述成全文级证据。
- 一个后台离线导致整个工作台首页不可用。

## 4. 已确认的信息架构

### 4.1 顶部菜单

采用已确认的 B 方案：

1. **文献检索**：返回首页并新建 PaperSeek 检索。
2. **文献计量**：进入 PaperSeek 计量功能。
3. **一键写综述**：进入 GPT Researcher 原首页研究与报告流程。
4. **历史记录**：下拉包含“检索历史”和“综述历史”。
5. **设置**：进入同一设置页，页内包含“PaperSeek”和“GPT Researcher”两个标签。

桌面端显示以上菜单；移动端可以折叠导航，但菜单层级和名称不变。

### 4.2 首页

首页固定为“新建文献检索”，保持 GPT Researcher 当前米色纸张、深色墨水、红色强调色及字体层级。首页包括：

- 研究问题输入框。
- PaperSeek 数据源、检索预算和高级条件入口。
- “开始检索”主按钮。
- 最近一次检索摘要，仅显示一条，包括标题、状态、结果数、数据源和查看入口。
- 默认数据源摘要，并提示可在设置中修改。

首页不显示“下一步”栏目，也不展示多条历史；完整历史由顶部“历史记录 → 检索历史”承担。

已确认草图位于本机会话的可视化目录：`home-menu-b-v2.html`。草图仅表达信息层级，不作为逐像素实现规范。

## 5. 三条独立业务流程

### 5.1 文献检索

1. 用户在首页输入问题，必要时调整数据源、预算和高级条件。
2. Next.js 的 PaperSeek 网关校验并转发请求到 PaperSeek `POST /api/v1/runs`，保留 `Idempotency-Key`。
3. 前端进入检索详情页，通过网关转发的 PaperSeek SSE 事件流显示查询规划、检索、融合、评分和保存进度。
4. 完成后读取 PaperSeek 结果、统计、引用图和产物接口。
5. 用户可以筛选、查看论文信息并使用 PaperSeek 原有导出能力。
6. 取消操作只取消指定 PaperSeek 任务，不影响 GPT Researcher 报告任务。

页面与接口应保留 PaperSeek 的状态、warning 和 error code，不把失败统一压缩成模糊的“发生错误”。面向用户的提示采用 GPT Researcher 文案风格。

### 5.2 文献计量

功能边界完全参考 PaperSeek 原功能：

1. 文献计量页列出可以用于分析的已完成 PaperSeek 检索及已有计量记录。
2. 用户从已完成检索中创建计量分析；不提供文件上传。
3. 分析详情展示 PaperSeek 返回的计量概览、范围说明、警告及统计结果。
4. 用户可按 PaperSeek 原能力生成和查看网络分析。
5. 保留计量历史、重命名和 CSV/JSON 导出。

计量分析必须继续引用 PaperSeek `source_run_id`，不在 GPT Researcher 中复制文献语料。网络可视化需要一个前端图形实现；实施计划先检查项目现有能力和 PaperSeek 上游源码，再决定是否只引入一个必要依赖。

### 5.3 一键写综述

一键写综述是 GPT Researcher 当前首页入口和现有报告流程的复用，不是 PaperSeek 综述功能：

1. 将当前 GPT Researcher 首页组件迁移到“一键写综述”路由，避免复制一套逻辑。
2. 保留自然语言问题输入、报告类型、检索来源、语气、域名、文档和 MCP 等当前能力。
3. 保留现有 WebSocket 运行进度、人类反馈、报告展示、聊天、导出和错误处理。
4. 保留现有报告详情深链接，已有报告不因首页改版失效。
5. 不读取 PaperSeek 的结果、数据库、产物或检索历史。

## 6. 历史与数据所有权

### 6.1 检索历史

- 数据源：PaperSeek `/api/v1/history`、`/api/v1/runs/{run_id}` 及关联结果和产物接口。
- 所有重命名、取消或删除行为仍由 PaperSeek 执行。
- 首期默认不提供批量删除，也不改变 PaperSeek 的保留规则。

### 6.2 综述历史

- 数据源：GPT Researcher 现有报告接口和 `ReportStore`。
- 现有报告 ID、详情路由、聊天记录和输出文件保持兼容。
- 只改变历史入口位置和页面风格，不迁移报告到 PaperSeek。

### 6.3 标识与关联

PaperSeek run ID、bibliometrics ID 与 GPT Researcher research ID 分属不同命名空间。前端路由和类型必须明确区分，不创建跨库外键或隐含关联。

## 7. 设置

设置采用一个页面、两个标签。

### 7.1 PaperSeek 标签

复用 PaperSeek 设置 API 和已有保存语义，覆盖实际文献检索与计量所需配置，包括数据源、模型连接、API、代理及默认参数。页面不读取或显示明文密钥；只显示是否已配置，写入时直接交给 PaperSeek。

### 7.2 GPT Researcher 标签

复用当前 GPT Researcher 设置能力，包括研究参数、MCP、文档和后台连接等。现有依赖环境变量的密钥继续使用原有方式，不复制到 PaperSeek。

### 7.3 隔离规则

- 两个标签分别调用各自后台。
- 保存一个标签不提交另一个标签的内容。
- 同名模型或提供商也不自动同步。
- 日志、前端状态和错误消息不得包含密钥值。

## 8. 后台架构

### 8.1 运行边界

首期保持三个运行单元，并让 Next.js 分别连接两个互不依赖的后台：

```text
GPT Researcher Next.js 前端与 Route Handlers
  ├─ 报告请求与 WebSocket ──► GPT Researcher FastAPI 后台
  └─ 明确许可的 PaperSeek API ──► PaperSeek Community 服务
                                      ├─ ~/.paperseek/paperseek.db
                                      ├─ ~/.paperseek/artifacts
                                      └─ PaperSeek 自有凭据存储
```

PaperSeek 服务地址通过一个仅供 Next.js 服务端读取的环境变量配置，默认本机 `http://127.0.0.1:8767`。浏览器不保存第二个后台地址，也不直接连接 PaperSeek，从而避免双 CORS、地址泄漏和浏览器到任意地址的代理风险。PaperSeek 请求不经过 GPT Researcher FastAPI，因此该 Python 进程停止时，文献检索和计量仍可工作。

### 8.2 网关原则

- 使用 Next.js Route Handlers 和平台自带 `fetch`，首期不增加 Python 依赖。
- 只实现产品实际使用的明确路由，不提供通配反向代理。
- 转发 PaperSeek HTTP 状态、结构化错误、幂等键、SSE 游标、内容类型和下载文件名。
- 对 SSE 和大文件使用流式转发，不把完整响应读入内存。
- 设置与密钥写入接口不得记录请求体。
- PaperSeek 超时、离线和返回异常格式需要转换为稳定的网关错误，但保留原始错误 code（若存在）。

### 8.3 统一启动

提供一个本机统一启动入口，负责检查并启动 Next.js、GPT Researcher FastAPI 和 PaperSeek：

- 启动前分别检查目标端口和健康接口。
- `8767` 上已有健康的 PaperSeek 时直接复用，不停止、不重启、不替换。
- 端口被非 PaperSeek 服务占用时明确报错，不结束占用进程，也不静默改端口。
- 只启动缺失的服务；任一子服务启动失败时报告具体服务和日志位置。
- 统一启动不等于统一进程，各服务仍保留独立生命周期和数据目录。

### 8.4 首期需要覆盖的 PaperSeek 能力

- `/ready`、`/api/v1/sources`。
- 检索创建、状态、取消、事件、结果、引用图、产物和导出。
- 检索历史及重命名；删除只在现有 UI 明确要求时接入。
- 文献计量创建、列表、详情、网络、导出和重命名。
- PaperSeek 设置页实际使用的设置、连接测试和数据源测试接口。

具体网关路径和请求/响应类型在实施计划中从 PaperSeek 当前 `/openapi.json` 生成核对清单，避免凭记忆复制字段。

## 9. 前端路由与组件归属

建议路由：

- `/`：新建文献检索。
- `/literature/[id]`：PaperSeek 检索运行和结果。
- `/bibliometrics`：文献计量入口与历史。
- `/bibliometrics/[id]`：计量详情和网络。
- `/reviews/new`：GPT Researcher 一键写综述入口。
- `/research/[id]`：保留现有 GPT Researcher 报告详情。
- `/history/searches`：PaperSeek 检索历史。
- `/history/reviews`：GPT Researcher 综述历史。
- `/settings?tab=paperseek|gpt-researcher`：双标签设置页。

实现应复用现有 GPT Researcher 的布局、按钮、表单、状态提示、报告组件和响应式规则。PaperSeek 页面作为新的功能页面实现，不复制或嵌入 PaperSeek 编译后的 Vue 页面。

## 10. 可用性与故障隔离

- 顶部或设置页显示两个后台各自的连接状态，不用一个总状态掩盖故障来源。
- PaperSeek 离线：首页仍可打开并保留输入；提交按钮禁用或提交后给出可恢复提示，并提供 PaperSeek 设置入口。一键写综述保持可用。
- GPT Researcher FastAPI 离线：Next.js 仍通过独立 PaperSeek 网关提供文献检索和计量；一键写综述显示原有后台错误。
- PaperSeek 任务运行中断：详情页可使用任务 ID 重新查询和续读持久事件，不自动创建重复任务。
- 页面刷新后：检索详情从 PaperSeek 恢复，综述详情从 GPT Researcher 报告存储恢复。
- 移动端保持菜单和主要流程可访问，不要求网络图在窄屏显示全部节点；可以提供列表或缩放查看。

## 11. 依赖、许可与升级

- PaperSeek `1.0.0b6` 继续运行在独立 Python 3.12 虚拟环境。
- GPT Researcher 不直接声明或导入 PaperSeek Python 包，只依赖其 HTTP API。
- 产品首期限定本机单用户，不把 PaperSeek 全局历史和凭据暴露到局域网或公网。
- PaperSeek 为 Apache-2.0，GPT Researcher 为 MIT；分发时保留 PaperSeek 许可证和第三方声明。
- 当前 GLM-5.3 低思考补丁位于 PaperSeek 已安装包，升级或重建环境会覆盖。集成不把该补丁复制进 GPT Researcher；任何升级必须先单独验证补丁和回归测试。
- 首期除网络图确实需要外，不增加前端依赖。若需要，只选择一个覆盖布局、缩放和基本交互的依赖，并记录许可证。

## 12. 验收标准

### 文献检索

- 首页能用默认 PaperSeek 配置创建检索，并正确显示持久进度。
- 已完成检索能显示结果、统计、warning、引用数据和导出。
- 刷新或重新打开页面后，可通过 run ID 查询同一任务，不重复提交。
- 现有任务 `1833c3a4-9929-4464-b272-721878417c7d` 仍可查询，结果数保持 256，历史未被迁移或删除。

### 文献计量

- 能从已完成检索创建计量分析。
- 能显示 PaperSeek 返回的概览、警告和至少一种网络。
- CSV/JSON 导出可用，计量历史可查询。

### 一键写综述

- 现有 GPT Researcher 首页研究流程在新入口功能等价。
- WebSocket 进度、报告详情、聊天、导出和综述历史均通过现有回归测试。
- 运行一键写综述时不读取 PaperSeek API。

### 设置与隔离

- 一个设置页显示两个标签，保存彼此独立。
- 前端和日志不返回明文密钥。
- 任意一个后台离线时，另一个业务模块仍可使用。
- GPT Researcher FastAPI 停止时，PaperSeek 检索历史和现有任务仍可通过统一前端查询。

### 工程验证

- GPT Researcher 后端单元/集成测试通过。
- Next.js 类型检查、lint、生产构建及相关界面测试通过。
- PaperSeek GLM-5.3 回归测试继续通过。
- 不修改 `findpapers`，不删除现有 `data/`、`outputs/` 或 PaperSeek 历史目录。

## 13. 实施顺序约束

实施计划应按最小可验证纵向切片展开：

1. PaperSeek 健康检查与只读任务查询通过 Next.js 网关可用，并验证 GPT Researcher FastAPI 离线时仍可查询。
2. 首页创建检索、SSE 进度和结果页形成闭环。
3. 检索历史和最近一次检索接入。
4. 文献计量页面和网络接入。
5. 迁移现有 GPT Researcher 首页到一键写综述入口，并调整综述历史入口。
6. 合并设置外壳但保持两套保存逻辑独立。
7. 完成故障隔离、移动端和全量回归。
8. 增加统一启动入口，验证健康服务复用和端口冲突时不停止其他进程。

每个阶段先以测试或可重复检查定义成功，再修改最少代码使其通过。与当前阶段无关的重构、依赖升级和样式清理不进入本项目。

## 14. 留给实施者的局部决定

下列选择不改变已确认产品范围，可由实施者在计划中依据现有代码作最小决定：

- 网关内部模块和类型文件的具体命名。
- PaperSeek API 类型是手写最小接口还是由 OpenAPI 辅助生成；不能为未使用端点生成整套客户端。
- 文献网络采用现有能力或一个新增依赖的具体选择。
- 移动端顶部菜单的折叠控件形式。
- 测试夹具的组织位置和 mock 库使用方式。

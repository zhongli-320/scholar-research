<!-- GPTR-LOCAL-HANDOFF-BEGIN PH-20261112-gptr-local-01 -->
## GPT Researcher 本地部署与 GLM 适配（2026-11-12）

### 交接区

- 交接编号：PH-20261112-gptr-local-01
- 源任务编号：
- 用户确认范围：用户要求“做一下收尾和交接，我将在新的会话继续任务”；本次仅保存当前状态、停止服务和提供接续入口，不再修改功能。
- 项目目录：`E:\中大研究生涯\信息组织\research agent\gpt-researcher`
- 接手任务编号：
- 交接状态：材料已核对
- 更新时间：2026-11-12 17:25 Asia/Shanghai

### 任务与版本

- 目标：在本机运行 GPT Researcher 新版 Next.js 界面，以智谱官方 OpenAI 兼容接口调用 `glm-5.3-flash`，使用 Tavily 检索并生成研究报告。
- 范围与完成标准：新版前端可连接后端；GLM 文本生成和 embedding 可调用；研究任务能抓取来源并生成非空报告。尚不把 OpenAlex、PDF 导出和代理兼容性视为已完成。
- 版本位置：仓库提交 `ddd4db36208d9c8e49f3b2436efda97baecb5433`。没有修改项目源代码；本地忽略文件 `.env`、`frontend/nextjs/.env.local`、虚拟环境和 `node_modules` 已配置/安装。当前 Git 仅显示未跟踪的运行数据目录 `data/`，其中 `data/reports.json` 保存两次本地报告记录，不要误删。

### 权威资料

- `E:\中大研究生涯\信息组织\research agent\gpt-researcher\.env`：后端本地配置和密钥；已写入智谱、Tavily、OpenAlex 凭据。不得把内容提交到 Git 或复制到聊天。
- `E:\中大研究生涯\信息组织\research agent\gpt-researcher\frontend\nextjs\.env.local`：新版前端后端地址，当前为 `NEXT_PUBLIC_GPTR_API_URL=http://127.0.0.1:8000`。
- `E:\中大研究生涯\信息组织\research agent\gpt-researcher\data\reports.json`：新版前端的本地报告记录，当前约 85 KB。
- `E:\中大研究生涯\信息组织\research agent\gpt-researcher\outputs\task_1794474505_3bb63dfbb6.md`：第二次测试成功生成的完整 Markdown 报告。
- `E:\中大研究生涯\信息组织\research agent\gpt-researcher\outputs\task_1794474505_3bb63dfbb6.docx`：第二次测试成功生成的 Word 报告。
- `E:\中大研究生涯\信息组织\research agent\gpt-researcher\outputs\task_1794474006_3bb63dfbb6.md`：第一次测试的空报告样本，用于继续排查。
- 冲突：第一次测试的所有来源被地址安全检查拦截，第二次在没有持久设置 `ALLOW_PRIVATE_URLS=true` 的情况下又成功抓取；行为变化的原因尚未确认。

### 决定与限制

- 用户已确认：使用智谱官方 API，模型选择 `glm-5.3-flash`；使用新版前端；密钥由用户写入本地 `.env`。
- Agent 建议或自行选择：通过项目已有的 OpenAI 兼容层接入智谱，不改源代码；显式使用 `CONTEXT_FILTER=keyword`，避免依赖未配置的 TypeSafe/Jev 服务。
- 未决：是否把 `RETRIEVER` 设置为 `tavily,openalex`；是否保留显式 `CONTEXT_FILTER=keyword`；是否修复本机 WeasyPrint/GTK DLL 以恢复 PDF 导出；是否需要针对本机代理做持久兼容处理。
- 已否决路线：暂不永久设置 `ALLOW_PRIVATE_URLS=true`。它会放宽 SSRF 防护，而且第二次测试已在未设置时成功，需先复现并查明原因。
- 授权边界：可以继续做本地诊断和最小修改；新增依赖、改安全策略、删除 `data/` 或报告、提交/推送代码前需再次确认。

### 进展与运行状态

- 已完成：Python 3.12.11 虚拟环境与约 190 个 Python 包安装完成，依赖检查通过；新版前端约 985 个 npm 包安装完成，未生成新的 lockfile。
- 已完成：智谱 `glm-5.3-flash` 实际请求成功；智谱 `embedding-3` 返回 2048 维向量。
- 已完成：前端 `http://127.0.0.1:3000`、后端 `http://127.0.0.1:8000`、报告 API 与跨域访问在服务运行时均返回成功。新版界面应访问 3000 端口；8000 端口是后端/旧界面。
- 已完成：查询“社交机器人在社交媒体的研究进展”的第二次任务抓取了多批网页，合并上下文约 103,709 字符，生成 27,208 字节 Markdown、47,813 字节 DOCX 和 23,600 字节 JSON。新版前端报告记录 ID 为 `c541962d-6156-40a9-9d2d-29db301ac55f`。
- 已完成：本次交接前已停止 3000 和 8000 端口服务，当前无监听进程。
- 未做：没有启用 OpenAlex 检索；当前后端日志只显示 `TavilySearch`。
- 未验证：首次空报告的根因是否会再次出现。首次运行时 14 个来源域名被本机代理/DNS 映射到 `198.18.0.x`，被 URL 安全检查判为非公网地址，最终抓取 0 页；第二次没有复现。
- 未验证：PDF 导出。当前 WeasyPrint 无法加载 `C:\Users\zhonglee\AppData\Local\Programs\Tesseract-OCR\libgobject-2.0-0.dll`（错误 0x7e）；Markdown 和 DOCX 不受影响。
- 未验证：受限网络下 Google Fonts 下载失败，前端回退到本机字体，功能正常但外观可能与官网 Demo 略有差异。

### 运行方法

后端（PowerShell 窗口 1）：

```powershell
cd "E:\中大研究生涯\信息组织\research agent\gpt-researcher"
.\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload
```

新版前端（PowerShell 窗口 2）：

```powershell
cd "E:\中大研究生涯\信息组织\research agent\gpt-researcher\frontend\nextjs"
npm run dev
```

浏览器访问：`http://127.0.0.1:3000`

### 接续动作

1. 第一步：先只读检查本交接文件和最新成功报告，然后启动前后端，用同一查询再跑一次；记录抓取成功页数、是否出现 `Skipping unsafe URL`、报告正文长度和来源数量。
2. 验收：连续一次完整运行得到非空报告、正文引用来源且至少成功抓取一个网页；若再次为空，再对照首次失败日志定位代理/DNS 与 URL 安全检查，不要直接关闭安全保护。
3. 前置条件与阻塞：本机网络代理需能访问 Tavily、智谱和来源网页；`.env` 中现有密钥必须保持有效。PDF 导出问题不阻塞 Markdown/DOCX 研究流程。

开场白：

```text
$project-handoff 恢复。项目 E:\中大研究生涯\信息组织\research agent\gpt-researcher；来源 E:\中大研究生涯\信息组织\research agent\gpt-researcher\PROJECT_STATE.md 交接区 PH-20261112-gptr-local-01；目标是继续验证新版前端 + 智谱 glm-5.3-flash 的完整研究流程；限制是不要泄露或提交 .env 密钥，不要直接设置 ALLOW_PRIVATE_URLS=true，不要删除 data/ 和 outputs/；第一步先只读核对最新成功报告并启动前后端复跑同一查询；验收为至少抓取一个网页并生成有正文和来源的非空报告。先只读核对再继续。
```
<!-- GPTR-LOCAL-HANDOFF-END PH-20261112-gptr-local-01 -->

## PaperSeek 统一工作台启动入口（2026-11-16）

- 本工作树提供 `scripts/start-research-workbench.ps1`；使用 `-CheckOnly` 可只检查三个服务的健康与端口状态。
- 默认端口为 PaperSeek 8767、GPT Researcher 8000、Next.js 3000；日志位于本工作树 `logs/workbench/`。详细说明见 `README-zh_CN.md`。

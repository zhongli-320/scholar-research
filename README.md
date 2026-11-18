# Scholar Research

Scholar Research 是一个面向学术研究场景的开源 Web 应用，将 PaperSeek 文献检索、文献计量分析与 GPT Researcher 综述生成整合在同一套界面中。

线上地址：<https://scholar-research-production.up.railway.app>

> 当前为公开体验版本，暂未接入注册与登录。请勿在公开实例中提交敏感或未公开研究资料。

## 主要功能

### 文献检索

- 基于 PaperSeek 的多数据源学术检索
- 支持 OpenAlex、arXiv、Crossref、Semantic Scholar、PubMed 等数据源
- 将运行过程整理为“检索意图与检索式、检索迭代、候选召回与排序、文献结果”四个板块
- 展示检索轮次、数据源总命中、本轮取回、候选文献、进入排序和最终结果等关键数字
- 原始事件记录默认折叠，已完成任务重新打开后仍可回放过程
- 检索结果可继续用于文献计量分析

### 文献计量

- 年份、作者、机构、国家或地区、期刊、主题与关键词分布
- 年份默认按降序展示
- 字段覆盖名称中文化
- 期刊评价中支持匹配期刊分区与影响因子
- 从最近检索记录直接选择数据集进行分析

### 一键写综述

- 支持简要综述、详细综述、深度研究和多智能体综述
- 默认生成中文内容
- 展示来源、研究问题、页面阅读、写作阶段和引用
- 完成正文后立即保存到综述历史，不依赖 PDF、Word 或 Markdown 文件是否已经生成
- 历史记录保存在 Railway 持久化卷中，重新部署不会清空

### 设置与公开访问

- PaperSeek 与 Scholar Research 后端状态检查
- 生产环境由 Railway 环境变量统一配置
- 未启用账号系统，公开地址可直接访问

## 技术架构

- 前端：Next.js、React、TypeScript、Tailwind CSS
- 综述后端：FastAPI、GPT Researcher
- 文献检索与计量：PaperSeek Community
- 入口代理：Nginx
- 进程管理：Supervisord
- 持久化：PaperSeek 元数据 SQLite、工件 SQLite、JSON 综述历史、Railway Volume
- 部署：单容器全栈部署到 Railway

服务结构：

```text
Browser
  └─ Nginx :3000
      ├─ Next.js :3001
      ├─ GPT Researcher API :8000
      └─ PaperSeek API :8767
```

## 本地运行

### Docker

```bash
docker build -f Dockerfile.fullstack -t scholar-research .
docker run --rm -p 3000:3000 --env-file .env -v scholar-data:/data scholar-research
```

打开 <http://localhost:3000>。

### 开发模式

后端：

```bash
python main.py
```

前端：

```bash
cd frontend/nextjs
npm install
npm run dev
```

## 关键环境变量

### GPT Researcher

| 变量 | 说明 |
| --- | --- |
| `OPENAI_API_KEY` | 兼容 OpenAI 协议的模型密钥 |
| `OPENAI_BASE_URL` | 模型服务地址 |
| `FAST_LLM` | 快速模型 |
| `SMART_LLM` | 综述写作模型 |
| `STRATEGIC_LLM` | 规划模型 |
| `RETRIEVER` | 网络检索器 |
| `LANGUAGE` | 综述输出语言，生产镜像默认 `chinese` |

### PaperSeek

| 变量 | 说明 |
| --- | --- |
| `PAPERSEEK_LLM_API_KEY` | PaperSeek 模型密钥 |
| `PAPERSEEK_LLM_BASE_URL` | PaperSeek 模型地址 |
| `PAPERSEEK_LLM_MODEL` | PaperSeek 模型名称 |
| `PAPERSEEK_OPENALEX_API_KEY` | OpenAlex 密钥或联系邮箱配置 |
| `PAPERSEEK_MAX_CONCURRENT_RUNS` | PaperSeek 最大并发任务数 |
| `PAPERSEEK_PUBLIC_MODE` | 公开访问模式 |
| `PAPERSEEK_DEVICE_ISOLATION` | 是否按设备隔离检索历史 |

### 持久化与资源控制

| 变量 | 说明 |
| --- | --- |
| `PAPERSEEK_DATABASE` | PaperSeek SQLite 路径，生产默认 `/data/paperseek.db` |
| `REPORT_STORE_PATH` | 综述历史路径，生产默认 `/data/reports.json` |
| `MAX_CONCURRENT_RESEARCH` | 同时生成综述的数量，生产默认 2 |
| `MAX_SCRAPER_WORKERS` | 单次综述抓取并发，生产默认 2 |

部署时必须将持久化卷挂载到 `/data`。

## Railway 部署

1. 在 Railway 新建项目并连接本仓库。
2. 服务使用 `Dockerfile.fullstack` 构建。
3. 将 Volume 挂载到 `/data`。
4. 配置模型和检索所需环境变量。
5. 生成公开域名并检查 `/settings` 中两个后端的连接状态。

生产部署跟随 `main` 分支。推送到 `main` 后 Railway 会自动构建并发布。

## 稳定性说明

- Railway 低内存实例下，过高的抓取并发可能导致综述后端被系统终止。生产镜像允许同时运行 2 个综述任务，并将每个任务的抓取线程限制为 2；WebSocket 断开时会等待研究任务和发送任务完成取消清理，任务结束后还会回收循环引用并归还可释放的 Linux 内存页。
- PaperSeek 1.0.0b6 默认工件提交依赖临时文件与硬链接。生产镜像将检索检查点和结果工件持久化到独立 SQLite，并在服务启动前对实际 `/data` 卷执行写入、读取、删除自检。旧文件工件仍可兼容读取。
- PaperSeek 的 GLM-5.3 JSON 规划请求扩大了输出预算，并降低推理强度，避免结构化结果被截断。
- PDF 中文显示依赖容器字体；若需要正式发布 PDF，建议在镜像中加入完整的 CJK 字体。

## PaperSeek 存储故障处理

出现 `artifact_persistence_failed` 时，不要只看启动自检。真实检索检查点可能达到数 MiB，必须结合 Railway 运行日志和磁盘指标判断。

1. 在 Railway Metrics 查看 `DISK_USAGE_GB`。本项目的卷容量为 0.5 GB，接近上限时 SQLite 通常会报 `database or disk is full`。
2. 检查运行日志中是否出现 `PaperSeek artifact put failed`、`RunPersistenceError` 或 `database or disk is full`。
3. 核对 `/data` 中的大文件。可以清理的范围仅限：
   - `/data/artifacts/runs/<run-id>/checkpoint/` 下的旧恢复检查点；
   - `paperseek-artifacts.db` 中已经失效的 checkpoint 记录。
4. 不要删除 `paperseek.db`、`reports.json`、`final_result`、`bibliometric_corpus`、`export_json` 或期刊指标文件。
5. 清理后必须验证：
   - 启动日志出现 `PaperSeek artifact storage and checkpoint retention checks passed`；
   - 用真实宽泛主题完成一次检索，而不只是运行 16 字节的小型自检；
   - 最终结果能在文献计量页被选择；
   - 日志中不再出现工件保存或磁盘满错误。

当前防复发措施：

- 检查点使用 zlib 压缩后写入独立 SQLite；
- SQLite 使用 WAL、busy timeout 和自动提交；
- 每个任务只保留最近 3 份恢复检查点，失败任务不会无限堆积；
- 部署迁移会清除旧版文件存储遗留的 checkpoint，但保留最终结果；
- 服务启动时验证写入、读取、删除和检查点保留上限。

容量边界：0.5 GB 是有限空间。检查点增长已经受控，但长期积累大量正常检索结果后仍可能耗尽容量。此时应优先扩容 Railway Volume，或另行制定检索历史保留策略；不要直接删除成功结果。

## 仓库与分支

- 仓库：<https://github.com/zhongli-320/scholar-research>
- 生产基准分支：`main`
- 部署平台：Railway

## 许可证

本项目基于 GPT Researcher 与 PaperSeek 的开源代码继续开发。上游组件的版权与许可证归各自项目所有。

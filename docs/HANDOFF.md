# Scholar Research 交接说明

更新时间：2026-11-18（Asia/Shanghai）

## 先读

新会话开始后先阅读：

1. 本文件
2. 根目录 `README.md`
3. 涉及 PaperSeek 存储时阅读 `deploy/patch_paperseek_railway.py` 与 `deploy/verify_paperseek_storage.py`

## 仓库与生产环境

- GitHub 私有仓库：https://github.com/zhongli-320/scholar-research
- 生产基准分支：`main`
- `paperseek-integration` 已是 `main` 的祖先，生产部署不使用该分支
- 线上地址：https://scholar-research-production.up.railway.app
- Railway 项目 ID：`a99cfdc9-f06b-4422-a9ee-371d5052c13a`
- Railway 服务 ID：`07724d0d-58ff-4a00-8dca-4f968a6a39fb`
- Railway 生产环境 ID：`5b2536cd-812c-4d5d-ac22-c75b1775d359`
- Volume ID：`08951bdc-e1c3-40ef-ba3d-47a1717fee94`
- Volume 挂载路径：`/data`
- 当前卷容量：0.5 GB
- 最新确认成功的生产部署：`936f6000-8050-4677-8233-2921c65c2bf2`
- 交接前生产提交：`7f42f449706857e59bbee5fa69baf9d9b7a1b206`

## 当前已完成的主要改动

- 文献检索过程按“检索意图与检索式、检索迭代、候选召回与排序、文献结果”归纳展示。
- 一键写综述过程展示保持原样。
- 综述默认生成中文，并在完成正文后保存到综述历史。
- 文献检索成功记录可在文献计量页选择。
- 文献计量页面已按用户要求调整栏目、中文字段、年份降序和期刊评价位置。
- 综述最大并发数为 2；任务结束后清理循环引用并归还可释放内存页。
- Railway 公开部署暂不启用注册登录。

## 最近故障：artifact_persistence_failed

### 根因

Railway 0.5 GB 持久化卷被 PaperSeek 旧版文件工件的恢复检查点占满。共发现并清理：

- 65 个旧 checkpoint 文件
- 合计 396.0 MiB
- 单个检查点约 12–16 MiB

最终结果、文献计量语料、导出文件、`paperseek.db` 和综述历史均保留。

### 已实施的长期修复

- PaperSeek 工件改存独立 SQLite 侧车 `/data/paperseek-artifacts.db`。
- 工件内容使用 zlib 压缩，带 `PSZ1` 标记，读取兼容旧的未压缩内容。
- SQLite 使用 WAL、30 秒 busy timeout、自动提交。
- 每个 run 只保留最近 3 份 checkpoint，失败任务不会无限积累。
- 启动前执行真实写入、读取、删除和 checkpoint 保留数量自检。
- 旧文件存储中的 `/data/artifacts/runs/<run-id>/checkpoint/` 通过一次性迁移清理。
- README 已记录完整故障处理流程和禁止删除的文件范围。

关键提交：

- `7bffd96c66bb888f0e344d1f5c35d04afbcab4f5`：限制每个任务最多 3 份检查点
- `0e1199b63b3d0eff960366d71d6482fe29243469`：生产启动自检检查保留上限
- `7f42f449706857e59bbee5fa69baf9d9b7a1b206`：README 运维手册

### 生产验证

真实检索“社交机器人”已完整成功：

- Run ID：`e82e5582-d77c-4c02-8627-ff8ed78bb6ff`
- 最终结果：256 篇
- 候选召回：795 条
- 完成相关性排序和最终工件保存
- 文献计量页可选择“社交机器人 · 256 条文献”
- 日志中未再出现 `artifact_persistence_failed` 或 `database or disk is full`

最新启动日志应包含：

`PaperSeek artifact storage and checkpoint retention checks passed`

## 下次同类故障的处理顺序

1. Railway Metrics 检查 `DISK_USAGE_GB`。
2. 日志搜索：
   - `PaperSeek artifact put failed`
   - `database or disk is full`
   - `RunPersistenceError`
   - `artifact_persistence_failed`
3. 只读确认 `/data` 最大文件。
4. 可清理范围仅限旧恢复检查点：
   - `/data/artifacts/runs/<run-id>/checkpoint/`
   - 侧车数据库中失效的 checkpoint
5. 禁止直接删除：
   - `paperseek.db`
   - `reports.json`
   - `final_result`
   - `bibliometric_corpus`
   - `export_json`
   - 期刊指标数据
6. 清理后必须用真实宽泛主题完整检索，并确认文献计量页能读取结果。

任何生产删除操作都要先确认绝对路径、数据类型和用户授权。

## 尚存边界与后续决策

检查点无限增长已经解决，但 0.5 GB 是有限容量。大量正常成功检索结果长期积累后仍可能占满磁盘。当前没有自动删除成功历史，因为这会造成用户数据丢失。

达到容量预警时优先选择：

1. 扩容 Railway Volume；
2. 或由用户明确确定成功检索历史的保留期限/条数，再实现清理策略。

不要未经确认自动删除成功检索结果。

## 工作习惯

- 修改后提交到 `main`，Railway 会自动部署。
- 必须等待部署状态为 `SUCCESS` 并检查运行日志。
- 修复存储问题不能只依赖小型启动自检，必须跑一次真实检索。
- 保留用户已有改动，避免覆盖无关文件。

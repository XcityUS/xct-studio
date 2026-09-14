# 短剧云端业务持久化与执行边界

更新日期：2026-09-14。本文取代 2026-09-10 的“XCT Studio 不接数据库”判断；2026-09-13 提交 `4505c6b` 已在 XCT Studio 交付云端业务持久化实现。

## 当前已交付

- PostgreSQL 是已登录用户 Studio 业务记录的权威数据源；服务端通过 `DATABASE_URL` 访问数据库。
- 浏览器通过同源 `GET/POST /api/business` 读写，不直连数据库；服务端以 TokenHub 用户 ID 隔离 owner。
- Project、Episode、ScriptVersion、Character、Scene、Shot、Asset/Binding、Generation Batch/Job/Result、EpisodeVersion、Export 等记录已进入云端业务合同。
- 现有同步编辑器通过 compatibility codec 拆分为独立业务记录；revision、软删除和事务冲突检查已经落地。
- localStorage 只承担 outbox、故障恢复和旧数据迁移，不再是已登录用户业务数据的权威来源。
- 生成队列记录、事务化 claim/release 与 attempt 标识已经持久化，刷新后可从服务端记录恢复。

实现与数据口径以 [Business Persistence Specification](../requirements/business-persistence-spec.md) 和仓库代码为准。

## 当前责任分工

| 位置 | 当前职责 | 尚未承担 |
| --- | --- | --- |
| XCT Studio 浏览器 | 工作区、编辑交互、同源业务 API 调用、本地 outbox/恢复 | 数据库凭据、直接 SQL、长期后台执行 |
| XCT Studio 服务端 | `/api/business`、用户隔离、PostgreSQL 持久化、revision/事务、队列 claim | AI provider 凭据与网关治理 |
| xcity-litellm | 模型网关、鉴权/路由/计费、`/v1/drama/script/breakdown` 与 provider 能力 | Studio 业务数据库的权威来源 |
| 现有媒体 Worker/R2 | 媒体字节、归档、分享、社区与兼容云状态 | 关系业务记录的权威来源 |

## 已交付不等于完整 P0

9 月 13 日交付的是可工作的云端持久化底座，但以下仍属于后续增强：

- 当前 compatibility schema 以公共元数据列加 JSONB payload 承载不同领域记录；尚未完成全部强类型列、外键和不可变版本语义。
- 队列状态和 claim 已在服务端持久化，但 provider 提交仍由前端工作区触发；尚未形成可脱离浏览器持续运行的服务端后台执行器。
- AnalysisRun/Chunk/Attempt、正式计划接受事务、完整 Batch 控制和多设备冲突体验仍需按 P0 合同补齐。
- 云端业务持久化已经交付，不能再把“没有数据库/只有 localStorage”作为当前架构事实；同时也不能据此勾选全部短剧 P0 验收项。

## 部署边界

XCT Studio 服务端需要 `DATABASE_URL` 并运行仓库内业务迁移。浏览器不得获得数据库或 provider 密钥。xcity-litellm 继续独立管理模型路由、provider 凭据和计费；媒体文件继续由 Worker/R2 管理。

后续实施顺序：先在现有云端持久化合同上补强领域语义与迁移，再把 provider 提交/轮询迁入可恢复的服务端执行器，最后接入编剧分析、正式计划确认和批量生产能力。

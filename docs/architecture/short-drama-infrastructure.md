# 短剧后端边界：XCT Studio 不接数据库

日期：2026-09-10。用户决定：XCT Studio 不接数据库，短剧业务 API 统一由 xcity-litellm 后端承载。

## 当前状态

此前在 Studio 实验新增的 PostgreSQL、迁移器、快照/队列执行器及专用测试已撤回。对应 pg/PGlite/tsx/zod 直接依赖、脚本和 DRAMA 数据库配置一并移除。当前只在 xcity-litellm 新增无持久化的 `POST /v1/drama/script/breakdown`，复用现有鉴权、模型路由与计费；未部署，也没有短剧数据迁移或 worker。

原来的 336 项常规测试与 3 项 PostgreSQL 测试属于已撤回实现的历史记录，不代表当前 P0 交付。当前完整 P0 验收仍未完成。

## 责任分工

| 位置 | 职责 | 不负责 |
| --- | --- | --- |
| XCT Studio | 工作区、剧本导入、角色/场景/分镜编辑、Review、状态展示，必要的薄 API 代理 | 数据库连接、SQL 迁移、业务事务、后台队列、持久化执行凭据 |
| xcity-litellm 后端 | Project/Script/Scene/Shot/Binding/Snapshot/Batch/Preflight API、鉴权、持久化、异步执行、幂等与恢复 | Studio 交互状态和组件 |
| 现有媒体 Worker/R2 | 素材和视频归档，现有云端兼容状态 | 短剧关系模型的唯一数据源 |

Studio 的普通浏览器缓存和原有 API 代理保持不变。新的短剧生产数据只能经后端 API 保存；不能改成 localStorage 独自承担后台执行。

## 数据库与 Railway

本地 xcity-litellm 的 schema.prisma 已声明 PostgreSQL/DATABASE_URL，并有用户、Key、预算和消费等表。LiteLLM_ProjectTable 是模型预算/权限项目，不是短剧 Project/Scene/Shot。

是否复用现有数据库实例、使用独立 database/schema，以及迁移方式，应在 LiteLLM 仓库核实后确定；不能直接复用业务含义不同的表。尚未核验 Railway 线上数据库配置。

XCT Studio 不添加数据库环境变量、迁移命令或 Drama Worker 服务。需要的后端运行/队列部署在 LiteLLM 侧规划，不能把旧版 Studio worker 部署说明继续执行。

## 后续实施顺序

1. 在 xcity-litellm 核实数据库、鉴权、视频任务、模型调用和归档合同。
2. 在后端设计并实现版本化短剧业务合同、持久化与恢复机制。
3. Studio 接后端合同，先打通人工单镜头生成与刷新恢复。
4. 接入 AI 解析草稿确认，再扩为批量执行。
5. 按 [P0 任务清单](../requirements/short-drama-p0-task-breakdown.md) 完成验收。

当前解析接口不等于已完成后端迁移；Project/Script/Scene/Shot/Binding/Snapshot/Batch 的持久化接口和 worker 仍是后续工作。

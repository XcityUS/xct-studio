# Short Drama P0 任务拆解与推荐实现路径

更新日期：2026-09-14。依据：[P0 requirements](short-drama-p0-requirements.md)、当前工作树、[架构计划](../architecture/short-drama-p0-implementation-plan.md) 与 [Business Persistence Specification](business-persistence-spec.md)。本文区分 2026-09-13 已落地的云端业务持久化底座和后续 P0 任务；任务编号为 SD 系列，避免混淆原架构计划的 P0-01 等阶段编号。

## 1. 当前到底做了什么

2026-09-10 的“XCT Studio 不接数据库”结论已过期。2026-09-13 提交 `4505c6b` 已在 Studio 服务端交付 PostgreSQL 业务持久化、同源 `/api/business`、owner 隔离、revision/事务、软删除、outbox 恢复和队列 claim。

当前状态：Studio 原有 Normal、脚本提取、素材页与媒体归档保持不变。已新增项目独立配置、结构化角色/场景/Shot Review、资产选择和 Preflight，业务编辑数据会拆分为云端记录并可刷新恢复。`/api/script/breakdown` 继续通过 xcity-litellm 使用 AI 能力。完整 P0 仍未交付：现有 schema 仍偏 compatibility/JSONB，provider 提交仍由浏览器触发，尚无独立服务端后台执行器，也未完成 AnalysisRun/Chunk/Attempt 和完整批量控制。

## 2. 可复用能力与责任分界

- Studio 复用 StudioWorkspace 的页面组合、项目 UI、ScriptImportField、文件提取器、素材选择和播放器。
- 原有浏览器 storage 只承担旧数据导入、outbox 和故障恢复；已登录用户的新业务记录以 PostgreSQL 为准。
- Studio 的 script/breakdown.ts 只做输入、错误映射和响应归一化；Characters/Scenes/Shots 解析提示与严格响应合同由 xcity-litellm 实现。
- Studio 服务端已经拥有 PostgreSQL 业务记录合同；后续需在此基础上冻结 Project/Script/Binding/Generation 的强类型语义与迁移路径。
- xcity-litellm 继续负责模型调用、provider 凭据、路由和计费，不是 Studio 业务记录的数据源。
- 浏览器只调用 Studio 同源 API，不能直连 Studio 或 LiteLLM 数据库。
- 参考 [持久化与执行边界](../architecture/short-drama-infrastructure.md)，不要再按 9 月 10 日旧文档撤回现有 Studio 数据库实现。

## 3. 完整任务包

### 图片复核后的执行补充

- SD-01/02 先核查 Studio 已有 persistence contract/schema，再显式补强 Project、ScriptVersion、Character、Scene、Shot、BindingVersion、Generation、Snapshot、Attempt、Batch；不得重复建设或破坏现有兼容记录。
- 每项按 Studio 服务端合同/实现、Studio UI、跨端测试拆分；provider 网关部分再按 xcity-litellm 工程工具验证。
- SD-05/06 增加单一下拉、新建/编辑 Modal、重名不切项目、独立配置和语言确认。
- SD-10～15 拆为身份提取（别名/证据/出镜类型）、人工确认、项目资产绑定、分镜 ID 引用、生成快照锁定。人工重复角色映射属于基础确认，不扩展为 AI Smart Merge。
- SD-17 增加自动拆分默认关闭、覆盖确认、关闭保留草稿、保存不套用普通 Prompt、付费生成二次确认。
- SD-21/25 增加项目视频与 Normal 历史分区、复用单镜头分享。
- 状态、冻结时点、防重、依赖失败、字幕交付边界按需求文件顶部复核裁定执行。

2026-09-13 接线进度：改现有 ProjectHeader、CreationForm、ShotBuilderDialog，未另建独立页面；模式切换不卸载现有生成表单。项目配置按项目保存，AI Review 可编辑角色/场景/镜头并绑定当前项目素材，主要角色未绑定会阻塞生成。Studio 已新增业务数据库、云端记录和持久化队列 claim；但 provider 执行仍依赖浏览器工作区，不等于后台 worker 已交付。

状态定义：以下是基于已交付持久化底座的剩余/增强任务，并非都从零开始。Studio 负责业务记录、事务、队列状态、UI 和交互；xcity-litellm 负责 AI/provider 网关；跨端验收共同完成。每项交付包含接口合同、实现、自动化测试和必要文档，不允许只交 UI 或只交表。

### M0：冻结合同与运行基座（依赖：无）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-01 | 对照 P0 冻结领域字段、状态与错误码；修正架构计划和代码差异 | Scene/语言/对白/覆盖确认/连续依赖口径明确；Shot 编辑状态与 Generation 执行状态分离 |
| SD-02 | 在 Studio 现有 PostgreSQL compatibility schema 上补强 Scene、计划版本、解析 run/draft、项目素材/绑定版本及必要强类型约束 | 新业务空库和 Studio 存量数据库均可安全升级；重复迁移幂等；现有兼容记录可读；跨项目引用失败 |
| SD-03 | 收紧网关合同与恢复协议；鉴权失败停止模型轮换，明确可重试分类 | 稳定用户身份、审核资产、模型、预算、提交/查询/归档有 fixture；未知提交不会被自动重新计费；查不到任务时有人工对账入口 |
| SD-04 | 在 Studio 持久化/队列底座上实现独立服务端执行器；provider 密钥与模型路由仍留在 LiteLLM | worker 使用独立运行检查；迁移失败阻断新版本；重启保留任务；不依赖浏览器持钥运行 |

### M1：项目与剧本入口（依赖：SD-01、02；正式联调依赖 SD-03）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-05 | `/video` Normal / Short Drama 模式、项目工作区壳、模式与最近项目偏好 | 首次默认 Normal；返回恢复选择；项目删除后回退有效项目/空态；切模式不停止后台任务 |
| SD-06 | 新项目 CRUD 与配置 Modal，接现有 `/api/business` 持久化并补题材/基础 Prompt/明确模型版本等强类型字段 | 重名明确报错；配置不从 Normal 表单继承；编辑冲突可恢复；删除有二次确认且不影响其他项目 |
| SD-07 | TXT/MD/Word/PDF 导入、粘贴；原文件元数据/来源与文本版本持久化 | 统一大小/字符数上限；空文件/坏文件/扫描或加密 PDF 有说明；上传失败不生成假版本 |
| SD-08 | replace/append 影响预览，关联当前计划版本 | 显示受影响角色/场景/镜头/绑定/任务数量；确认令牌与 revision 防过期；取消不丢当前计划，append 不覆盖人工修改 |

### M2：AI 解析与正式计划确认（依赖：M1、SD-03）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-09 | 持久化 AnalysisRun/Chunk/Attempt；调用仍经 LiteLLM，复用 server adapter | 请求先落库再返回；关闭页面仍执行；DRAFT/PARSING/PARSED/FAILED 可恢复；重试有限且记录来源/model |
| SD-10 | 全局角色/场景索引 → 分段 Shots → 结构/语义校验；记录原文范围 | 长剧本无静默截断；角色 ID/说话人有效；每镜头有独立时长；章节覆盖有测试，失败不伪装成功 |
| SD-11 | Characters/Scenes/Shots 草稿 Review/Edit/Accept | AI 不直接覆盖正式数据；accept 事务校验 base revision；确认后创建正式计划与稳定 ID；重复接受幂等 |
| SD-12 | 重新解析和失败恢复 UI | 旧计划在新计划确认前保持可用；显示影响、保留旧结果来源；过期确认返回冲突；鉴权/额度/格式错误有不同出口 |

### M3：角色、场景、素材（依赖：M1；AI 填充依赖 M2）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-13 | Character/Scene 库 CRUD，主要角色标记；名称与 ID 分离 | 同名有提示/人工映射；改名称不破坏引用；删除前展示使用镜头，不隐式删除镜头 |
| SD-14 | 项目素材目录、从现有素材选择/上传/输入合规 Asset ID；角色/场景可复用绑定 | 不复制媒体库；审核未完成不可生成；Seedream 豁免仅可信来源；Shot 可覆盖继承并显示实际参考顺序 |
| SD-15 | BindingVersion、使用范围和变更影响确认 | 换角色/场景素材显示影响镜头数；新任务用新绑定，已入队任务仍用旧快照；撤销素材阻止新提交，不改历史 |

### M4：分镜编辑（依赖：M3；手动路径不依赖 AI 已完成）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-16 | 补齐 Shot camera、sceneId、多段对白 id/speaker/text/emotion/order、独立字幕内容/语言、audioPrompt、sourceRange | 对白不再挤在一段 audio；简中/繁中/英语明确；毫秒存储、模型边界转秒；历史 v1 快照仍可读 |
| SD-17 | Shot 列表/编辑面板、新增/复制/保存/取消/直接生成 | 复制新 ID，不复制任务；取消恢复；直接生成先保存再 Preflight；生成中编辑不改变任务输入 |
| SD-18 | 删除/拖拽/连续组及解除依赖确认 | 稳定 ID 不随排序改变；无环/跨项目引用；整组移动或显式断开；在途任务与共享媒体受保护 |

### M5：统一校验与单镜头闭环（依赖：M4、SD-03、04）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-19 | 共用规则服务：Preflight + Project Progress + Action Items | 同一缺失在三处口径一致；主要角色无素材阻塞、场景缺参考警告；含模型/余额/时长/语言/审核/连续校验 |
| SD-20 | 扩展 Snapshot 合同与 Prompt 编译，锁素材版本和生产语言 | 确认时看到实际参数/引用；创建后不可变；不自动截断参考；不支持的音频/字幕策略明确阻塞或提示 |
| SD-21 | 单 Shot 提交 → 队列 → LiteLLM → 归档 → Candidate 展示与历史快照 | 一次确认一条任务；刷新可恢复；归档失败只重试保存；已有视频可播放/下载；旧版本结果标识明确 |

P0 连续性默认是角色/场景引用、叙事上下文与依赖顺序，不承诺自动首尾帧延长或绝对人物一致。模型字幕指令也不等于确定性烧录字幕；基础字段/开关/语言须完成，完整字幕编辑器不加入本阶段。

### M6：批量、暂停与异常闭环（依赖：M5）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-22 | Generate All 范围解析与 Review：未完成/指定镜头、警告确认、防重复按钮 | 展示确切 shotIds，不夹带成功镜头；前后端均防重；入队范围与 Preflight 一致；不显示预计 Token |
| SD-23 | 批次面板：总数/排队/处理中/成功/失败/取消/依赖阻塞；Pause/Resume/Cancel | 默认并发 3 可配置；暂停仅停新提交；余额不足续原 Batch；已提交远端任务不冒充已取消或退款 |
| SD-24 | 错误分类与恢复：模型/参数/素材/安全/网络/额度/凭据/未知提交 | 可重试有按钮、不可重试可定位修复；独立镜头继续、依赖失败后继等待；未知提交走对账，不盲重试 |
| SD-25 | 跨刷新/页面/项目/模式/重新登录恢复；轮询退避与回前台同步 | 状态以服务端为准；多标签操作冲突明确；worker 重启不重复提交；凭据失效可重新授权续原批次 |
| SD-26 | 项目进度与待办导航 | 依据需求权重 15/15/15/25/30，空项目不除零；修改导致进度失效有规则；待办能定位角色/场景/镜头 |

### M7：迁移、测试与交付（依赖：M1–M6）

| ID | 任务 / 范围 | 验收条件 |
| --- | --- | --- |
| SD-27 | 旧本地项目显式导入服务端，sourceId/hash 映射；历史任务对账 | 预览并确认；重复导入不重复建项目；不搬运为新付费任务；默认测试项目不误认账号身份；旧数据先保留 |
| SD-28 | 中英文 UI、深浅主题、移动端、空态/加载/冲突/无权限/失败态 | 新组件 SCSS/主题变量；平铺翻译键；切 UI locale 不改变生成语言；不增长 legacy budgets |
| SD-29 | 完整回归与故障注入，需求 §44 逐项收证 | 单测、真实 PostgreSQL 并发、API、浏览器闭环；提交前后崩溃/归档失败/过期素材/余额耗尽/长剧本均有测试 |
| SD-30 | staging 发布演练、备份恢复、密钥保管/轮换方案、日志和告警、回退清单 | 新任务可关闭而旧任务仍可对账归档；队列卡住可告警；恢复数据库后先核对远端任务；生产发布与付费验收另获授权 |

## 4. 推荐实施与 PR 顺序

1. **合同补齐与增量迁移**：SD-01～04 基于 Studio 已有 PostgreSQL 持久化落地，AI/provider 合同与 LiteLLM 联调；不要立即接大 UI，不改写已有迁移。
2. **项目、文件和基础编辑数据**：SD-05～08、13～18；先用人工小样本验证项目归属与资产继承。
3. **单镜头最小端到端**：SD-19～21；本地用模拟 provider，验证入队、归档、刷新恢复，不用真实付费请求充当测试。
4. **AI 解析接入该主链路**：SD-09～12；解析产出已验证的同一份 Scene/Shot 合同，不另建 AI 专属数据模型。
5. **批量与恢复**：SD-22～26；只把单镜头闭环扩为多条持久化任务，验证连续依赖和局部失败。
6. **旧数据、体验、发布验收**：SD-27～30；不得因后端测试通过就勾选完整 P0。

任务包顺序表达业务依赖；上述 PR 顺序优先暴露生成/归档的集成风险，因此先用手工 Shot 打通单镜头，再接 AI。手动和自动流程共用正式数据、Preflight、Snapshot、Batch，不建两套 Pipeline。

每个 PR 控制在一个可验收能力，SD-02 可进一步按迁移器、计划数据、资产数据拆分。暂不提供未经联调的“几天必定完成”或总体完成百分比；上线关键风险是 gateway 合同与后台授权，不是 UI 页数。

## 5. API 与模块落点

以下是需要从现有 `/api/business` compatibility contract 继续类型化或新增的业务合同，不表示当前完全没有云端接口：

- Project/Script CRUD、文件提取结果保存与版本。
- AnalysisRun、BreakdownDraft Review/Accept。
- Character/Scene/ProjectAsset 与有序 BindingVersion。
- Shot CRUD/复制/排序、影响预览、连续关系。
- Preflight、Batch 创建/暂停/继续/取消、Generation 重试/对账。
- Candidate、Snapshot 查询、Project Progress/Action Items、偏好恢复。

Studio 服务端负责业务资源鉴权、revision、幂等键、稳定错误码及数据库事务；xcity-litellm 负责 AI/provider 鉴权、路由和计费。具体 typed URL、方法、模型字段和语言合同在 SD-01 冻结，并兼容现有 `/api/business` 数据。素材二进制继续由媒体 Worker/R2 保存。

## 6. 部署：沿用 Studio 云端数据库，补独立执行器

XCT Studio Web 服务已通过 `DATABASE_URL` 使用 PostgreSQL，并运行仓库内业务迁移。发布门禁必须保留迁移、备份恢复和 owner 隔离检查；不得把数据库连接或 provider 密钥暴露给浏览器。

下一步不是迁走业务数据库，而是在现有持久化和 queue claim 上补独立服务端执行器。执行器如何部署、扩缩容、续租、告警及回退属于 SD-04/30；AI/provider 请求继续经 xcity-litellm。

## 7. P0 §44 验收追踪

| 原清单顺序 | 验收主题 | 任务 |
| --- | --- | --- |
| 1 | 模式切换/恢复 | SD-05、25 |
| 2 | 项目 CRUD/隔离 | SD-06、25 |
| 3 | 文件导入/错误 | SD-07 |
| 4 | AI Parsing/重试 | SD-09、10、11 |
| 5 | 重解析影响确认 | SD-08、12 |
| 6 | Character/Scene Reference | SD-13～15、19 |
| 7 | Shot CRUD/复制/拖动 | SD-16～18 |
| 8 | 连续关系落库/保护 | SD-18、20 |
| 9 | Preflight/Action Items | SD-19、22、26 |
| 10 | 服务端批次/并发/防重 | SD-21～23、29 |
| 11 | 余额不足续原批次 | SD-23～25 |
| 12 | Snapshot 隔离 | SD-15、20、21 |
| 13 | 刷新/切换恢复 | SD-25、29、30 |
| 14 | 进度/待办 | SD-19、26 |
| 15 | 局部失败/Retry | SD-24、29 |
| 16 | 安全可读错误 | SD-03、24、28 |
| 17 | 生产语言不污染 | SD-06、16、20、28 |
| 18 | 不纳入延期能力 | SD-01、29，按 §42 审查 |

完整 Episode UI、Timeline、BGM、完整字幕编辑器、TTS/Voice Clone 体系、复杂造型、Prompt 版本管理 UI、AI Diff/Smart Merge、自动 Best Take、高级历史对比/优先级、完整 Undo/Redo 均不做。数据库留关联与版本不等于开发这些高级界面。

## 8. 交付验证与下一步

每个代码 PR 跑 `pnpm check:harness`、`pnpm lint`、`pnpm typecheck`、`pnpm test`；路由/UI 变化补 build 和浏览器验证。数据库队列必须补真实 PostgreSQL 并发测试，不只依靠内存引擎。常规测试禁止付费调用、发布和部署。

现有 PostgreSQL repository、migration、revision 冲突和 queue claim 测试属于当前交付基线。后续 Studio 数据库与队列改动在本仓库补真实 PostgreSQL 并发测试；LiteLLM 侧只验证 provider 网关合同。Studio 同时验证应用接口与交互行为。

**现在只做一个主链路：项目 → 剧本 → 已确认角色/场景/Shot → 素材绑定 → Preflight → 单镜头持久化生成 → 归档并刷新恢复。** 先基于现有云端记录补强类型与服务端执行，再把 AI 解析草稿接到同一个入口，最后扩展 Generate All。立即下一项是在 Studio 执行 SD-01/02：冻结现有合同的演进方式并补可升级模型，避免重复建设。

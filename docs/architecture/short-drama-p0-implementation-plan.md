# 短剧 P0 Implementation Plan

日期：2026-09-10。状态：历史架构提案，部署落点已被用户最新决定取代。XCT Studio 不接数据库；此前实验性的 Studio 数据库/API/worker 已撤回，未迁移到 LiteLLM。当前执行依据是 [后端边界说明](short-drama-infrastructure.md) 与 [P0 任务拆解](../requirements/short-drama-p0-task-breakdown.md)。

下文保留历史推导供参考，不作为 Studio 的开发指令：所有数据库、事务、解析任务、业务 API 和后台执行器均应落在 xcity-litellm 后端，不能按下文旧的 `src/server` 持久化目录方案重新接入 Studio。目标模型可以参考，但需结合 LiteLLM 实际实现重新确认；这里的测试和阶段计划不表示当前能力已交付。

依据：当前工作树 `e7b9f88`，以及尚未跟踪的 [P0 需求](../requirements/short-drama-p0-requirements.md)。本文不代表数据库、后台队列或 LiteLLM 扩展已经上线。

## 1. 交付目标与优先级

第一条主链路：**创建项目 → 导入剧本 → AI 解析草稿 → 确认角色/场景/分镜 → 绑定素材 → 编辑分镜 → Preflight → 单镜头/批量生成 → 服务端归档 → 暂停、重试、继续。**

以 P0 需求为范围依据；[Episode 架构提案](episode-production-pipeline-proposal.md)、[综合 Spec](../requirements/integrated-short-drama-studio-spec.md)、[Episode Spec](../requirements/episode-pipeline-spec.md)、[项目资产 Spec](../requirements/project-asset-workspace-spec.md) 和 [一致性 Spec](../requirements/ip-continuity-spec.md) 提供长期结构，不扩大本阶段范围。工程基线继续遵循 `docs/rules`。

| 旧设计或需求歧义 | 本计划的实施裁定 |
| --- | --- |
| 旧 Implementation Plan Stage 7 才引入数据库 | 数据库、持久化任务和后台授权先做；否则不能满足关闭浏览器后继续执行 |
| 旧提案第一阶段含选片、EpisodeVersion、组装 | P0 只保存 Candidate 与生成历史；完整选片/锁片、Timeline、成片版本延期 |
| 旧提案将 Word/PDF、批量队列延至 Phase 2 | 均进入 P0；文件提取已有实现可复用 |
| Episode 完整管理延期，但不能锁死唯一剧本 | 每个项目创建一个默认 Episode；P0 不显示多集管理 UI，Script/Shot/Batch 已有 episodeId |
| 旧 Shot 状态混合编辑、生成、选片 | Shot 只保留 DRAFT/READY；任务状态、结果过期和依赖阻塞分开表达 |
| P0 §33.3 图示看似必须 FAILED 后才 SUCCEEDED | 正常为 PROCESSING → SUCCEEDED 或 FAILED；失败不是成功的前置步骤 |
| 修改资产使用最新资产，同时任务必须锁快照 | 未创建任务使用当前绑定；已创建但尚未提交的任务也保留创建时快照 |
| 单 Shot 失败不能阻塞其他 Shot，但有连续依赖 | 无依赖镜头继续；依赖失败镜头的后继等待处理，不能用无效引用强行提交 |
| P0 不展示预计 Token | 显示镜头数、模型、重试范围与计费操作确认，不展示预计 Token；余额检查不冒充精确报价 |
| 删除不可恢复与数据库软删除规则 | UI 删除不可恢复；后台保留最小 tombstone/执行审计以对账，媒体按引用清理，不能级联删除共享素材 |

以上是针对歧义的推荐裁定，评审通过后再同步调整需求正文；本次保留原需求内容。

## 2. 现有 /video 实现核查

以下为本地静态代码证据；未执行付费请求，也未验证线上 LiteLLM 服务或远端仓库。

| 链路 | 当前证据 | 可复用与缺口 |
| --- | --- | --- |
| 路由 | `src/app/[locale]/(studio)/[surface]/page.tsx` 校验 surface 后返回 null；同组 layout 渲染 StudioWorkspace；`features/studio/routing.ts` | 实际视频页为 `/zh/video`、`/en/video`；不是独立的视频工作区实现，不能只改 page.tsx |
| 项目 | `features/projects/storage.ts`、`hooks/use-short-drama-project.ts` | 有创建/切换/重命名/删除、项目素材和引用包，但仅 localStorage，无服务端 owner/revision/config 事务 |
| 数据合同 | `shared/contracts/production.ts` | 有 ProjectAsset、CharacterVersion、ProductionSnapshot；CharacterVersion 无独立 Character 身份且可修改，不能直接视作不可变版本 |
| 文件导入 | `/api/script/extract`、`server/script/extract.ts`、`features/script/schema.ts` | 已支持 txt/md/doc/docx/pdf、20 MiB、空文本/提取失败；缺原文件持久化、ScriptVersion、导入与解析任务 |
| AI 拆分 | `src/lib/script-breakdown.ts` → TokenHub `/v1/chat/completions` | 当前 UI 与普通视频 Prompt 优化保持一致：浏览器使用用户 SSO/manual key 直连 TokenHub；`/api/script/breakdown` 仅为保留兼容入口 |
| 拆分合同 | `features/script/types.ts`、`schema.ts` | 仅 description/camera/audio/durationSeconds；提示词要求 2–12 镜头，校验静默截取前 20 条，缺角色/场景 ID、对白、完整覆盖检查 |
| 模型策略 | `server/script/breakdown.ts`、provider adapter | 环境变量优先，fallback 首项 deepseek-v4-pro-260425；temperature 0.3/max_tokens 4000。旧架构的默认 gpt-5-mini 描述已过时；不据此判断线上模型可用 |
| 分镜队列 | `CreationForm/shot-queue.ts`、`CreationForm/index.tsx` 的 processShotQueue | 全局 localStorage key；顺序 await 提交后出队，不等待视频完成，无服务端并发上限/依赖/租约/幂等保障 |
| 视频生成 | `StudioWorkspace/index.tsx` → `lib/video-service.ts` → `lib/openai-client.ts` | 旧浏览器 SDK 使用 dangerouslyAllowBrowser；参数映射可提取，浏览器传输不能成为新短剧链路 |
| 轮询/归档 | `use-video-jobs.ts`、StudioWorkspace 完成回调、`use-media-archive.ts` | 浏览器 setInterval，卸载停止；已提交 provider job 可能继续，但后续派发、归档不能保证离线执行 |
| 素材绑定 | useShortDramaProject.buildProductionSnapshot、appendProjectReferenceUrls | 当前把项目 active/uploaded 素材统一快照并追加至引用上限；不等于按镜头角色绑定，且会截断引用 |
| 历史与存储 | `use-video-history.ts`、Dexie、`lib/media-archive.ts`、`media-worker/index.js` | localStorage/IndexedDB + R2/cloud JSON；没有关系数据库与生产队列 |
| 身份 | Worker resolveOwner 调 `/key/info`，优先 user_id，否则 key hash | 能借鉴 owner 校验，但稳定用户身份、密钥轮换与后台调用授权必须另行接通 |
| 部署 | package.json、railway.json、nixpacks.toml | 当前部署只有 Next 启动命令；未见独立生产执行器与数据库迁移命令 |

结论：已有生成器、素材与拆分入口可以复用，缺的是服务端生产关系与执行闭环。已有 local-draft 快照不能充当正式 Snapshot，现有页面内队列也不能升级名义后当作后台队列。

## 3. 推荐基座与调用边界

推荐 P0 采用 **PostgreSQL + 独立 TypeScript 执行进程 + 数据库任务队列/outbox**。API 与执行器共享领域服务；Railway Web 与执行器分别部署，媒体继续走现有 Worker/R2。数据库访问优先采用薄 repository + 显式 SQL migrations，不为 P0 引入通用工作流引擎或额外 Redis 队列。

这是新增基础设施建议，并非现有能力。开始实现前在第一个任务中固定数据库驱动、迁移执行方式、连接池、执行器打包和运维负责人；不在本轮新增依赖。

```text
浏览器 ShortDramaWorkspace
  → Next /api/v1/drama（鉴权、合同校验、命令）
  → server/{projects,script,episode,generation}（事务与业务）
  → PostgreSQL（生产事实、快照、队列、事件）

独立执行器 → 原子领取任务/租约 → server provider adapters
  → xcity-litellm /v1/chat/completions、已验证的视频协议
  → media-worker → R2（原文件、引用媒体、生成结果）
  → PostgreSQL 回写结果/事件 → 浏览器查询状态
```

LiteLLM 负责模型路由、用户额度/计费、供应商协议及已有素材审核接口。Studio 负责 Project/Episode/Shot、解析草稿、确认、快照、批次和连续依赖。默认不把 Studio 的关系模型搬进 LiteLLM。新 provider 协议是否需要 LiteLLM 补充，由跨仓库合同核查确定，不虚构已有 `/drama` 接口。

后台授权是硬前置：将稳定 Xcity userId 映射为生产 owner，不能用客户端 projectId 或未验证 userId 授权。推荐后台保存加密的用户级 gateway 凭据/可撤销授权引用，密文仅执行器可解密，密钥不进入 Snapshot/日志/事件。若平台有委托 token，优先采用；无此能力时需确认凭据托管约定。登录会话过期不等于取消已授权批次；凭据撤销/失效停止新提交并等待重新连接。不能靠浏览器刷新 token 来满足离线运行。

## 4. 数据模型与数据库关系

所有可编辑实体带 `id`、`ownerId`、`revision`、UTC 时间；不可变记录保留创建时间与来源。时长内部统一 `durationMs`。状态/API 枚举由新合同定义，旧序列化字段通过 adapter 转换，不原地改名。

| 表/实体 | 核心字段与关系 | P0 责任 |
| --- | --- | --- |
| production_owner | id、xcityUserId unique | 与现有登录身份映射，不建立第二套用户登录 |
| drama_project | ownerId、title、normalizedTitle、revision、deletedAt | 每用户多个项目；新建/改名统一同名冲突校验 |
| project_config | projectId unique、genre/style、model/modelVersion、params、contentLanguage、audioLanguage、subtitleLanguage、subtitleMode、basePrompt、revision | 项目独立配置，语言枚举 zh-Hans/zh-Hant/en；不继承 UI locale |
| episode | projectId、number、title、activeScriptVersionId、activePlanRevisionId | 默认一集，为多集预留真实外键，不实现多集 UI |
| script_version | episodeId、parentId、importMode、originalAssetId、rawText、normalizedText、contentHash、sourceLanguage | 不可变源版本；追加保留原文与追加范围 |
| analysis_run | scriptVersionId、status、modelPolicy、prompt/schemaVersion、errorCode、attemptCount | DRAFT/PARSING/PARSED/FAILED 与 reviewState 分离 |
| analysis_chunk / analysis_attempt | runId、sourceRange、ordinal、inputHash、status、output、model、usage | 长剧本分段、恢复与质量追踪；不截断尾部 |
| breakdown_draft | runId、basePlanRevision、revision、validatedPayload、reviewState | JSON 草稿经 schema 与语义校验；不可直接生成 |
| plan_revision | episodeId、scriptVersionId、draftId、revisionNo、createdBy | 确认草稿后的计划版本；重解析切换计划不抹旧任务 |
| character | projectId、name、aliases、importance、currentReferenceVersionId | 角色先有身份再绑定资产；名称不是主键 |
| character_reference_version | characterId、versionNo、appearanceNotes | 最小不可变引用包，不实现复杂多造型 UI |
| character_reference | referenceVersionId、projectAssetId、assetRevisionId、order | 显式、可排序参考素材，禁止按整个项目自动灌入 |
| scene | planRevisionId、episodeId、order、name、locationLabel、timeOfDay、summary、revision | 叙事场次；复用背景由 ProjectAsset(kind=location) 表示 |
| shot | planRevisionId、sceneId、episodeId、order、revision、description、camera、durationMs、prompt、audioPrompt、continuitySourceShotId | 一个独立生成单元；DRAFT/READY 为规则计算结果 |
| shot_character | shotId、characterId、order | 同项目角色外键，不通过角色名字符串联结 |
| dialogue / subtitle | shotId、speakerCharacterId、order、text、emotion；subtitle.dialogueId?、language、text、timing? | 分离对白和字幕编辑；无时间信息时不伪造精确字幕轴 |
| media_asset | ownerId、workerObjectKey、kind、checksum、byteSize、availability | 复用 Worker 媒体，不复制 R2 存储职责 |
| project_asset / asset_revision | projectId、mediaAssetId?、kind、provider/account/assetId、sourceClass、reviewState、revision | 项目挂载关系与素材版本，provider ID 不等于内部 ID |
| scene_asset_binding / shot_asset_binding | scopeId、projectAssetId、assetRevisionId、role、order | 使用实体外键；明确镜头覆盖，禁止裸 scopeId 多态关联逃避引用约束 |
| generation_batch | projectId、episodeId、status、pauseReason、approvedScopeHash、policy、createdBy | 单 Shot 也走一个 item 的 batch，统一暂停/恢复逻辑 |
| generation / generation_attempt | batchId、shotId、snapshotId、status、waitReason；attemptNo、providerTaskId、submissionKey、phase、leaseUntil、error、nextRunAt | Generation 是逻辑工作项；每次执行保留 Attempt，重试不覆盖历史 |
| generation_snapshot | schemaVersion、shotRevision、configRevision、assetVersionIds、resolvedPrompt、orderedReferences、modelParams、languagePolicy、continuitySpec、hash | 创建后不可变；保存实际决策而不只存当前指针 |
| candidate | generationId、attemptId、shotId、mediaAssetId、availability、durationMs | 一个镜头多个结果可追踪；完整 SelectedTake 后续添加 |
| outbox / task_event | taskId、eventId、eventType、payloadVersion、createdAt、deliveredAt | 事务派发、状态审计、幂等完成处理；事件不存秘密或完整用户文本 |
| user_preference / legacy_import_map | ownerId、lastVideoMode/currentProjectId；sourceStore/sourceId/hash → targetId | 偏好恢复与可重复迁移，不使用本地测试默认项目作为真实身份 |

数据库约束：

- 所有跨表引用校验同 owner/project/episode；用复合外键或事务约束封住跨项目引用，不能只依靠 UI 过滤。
- 活跃项目 `(ownerId, normalizedTitle)` 唯一；同名返回 409，不按名称删除已有记录。角色别名可能歧义，要求人工映射。
- Scene 顺序在计划内唯一，Shot 顺序在 Episode 当前计划内唯一；拖动在事务中更新，ID 永不随排序变化。
- `(batchId, shotId)` 唯一，`(generationId, attemptNo)` 唯一；providerTaskId 按 provider/account 唯一，Candidate 按 attempt/outputOrdinal 去重。
- 每个 Shot 同时最多一个非终态 Generation；跨标签页不同幂等键也不能重复生成同一活动镜头。完成后显式重新生成允许新任务。
- `Idempotency-Key` 按 owner/command 保存 requestHash 与结果；相同 key 不同请求返回 409。创建 Batch、Generations、Snapshots、outbox 在同一事务提交。
- P0 连续关系只允许同计划前一个 Shot，最多一个直接后继，禁止自指/环；Group 从边计算，无需冗余 groupId。
- 删除 Shot/替换计划先查活动任务；已确认取消/结束后才允许移除活动计划关系。旧任务和结果保留来源，不能外键级联丢失。

## 5. 解析、绑定与快照流程

1. 导入：先确定 replace/append，展示影响；通过现有提取器读取，保存原文件、原文和标准文本，创建 ScriptVersion。沿用 20 MiB 与 120,000 字符上限建议，并在上传、提取结果、保存边界统一校验。扫描 PDF/OCR、加密或损坏文件返回明确错误；不默默当作解析成功。
2. 分析：创建持久化 run。确定性切分章节/场次边界，再按模型上下文分块；先提取全局角色/别名与场景索引，再生成每段 Shots。记录 sourceRange，检查全文覆盖、对白说话人、时长范围、引用有效性。缺段/截断不能成为成功结果。
3. 模型错误：结构化 JSON 只是第一层；有限次修复/重试记录在 Attempt，超限返回可编辑失败草稿。鉴权失败不轮换模型重试；额度不足不当作模型质量差。模型策略、超时、输出上限和回退由服务端配置。
4. 人工确认：PARSED 表示解析成功，不表示已接受；reviewState=PENDING/ACCEPTED/REJECTED。第一次与重新解析均可看角色/场景/分镜草稿；accept 事务校验 basePlanRevision，冲突 409，确认后建立正式记录。
5. 重新解析：旧计划持续可用直到接受新计划；replace 新建计划，旧人工编辑/绑定/结果不删除。append 只追加明确来源范围，复用角色需要确认 ID 映射；P0 不做智能合并。正在执行的旧计划任务仍按原快照完成并标记“旧版本结果”。
6. 绑定：在项目内把 Character、Scene、Shot 的引用关联现有素材。选择逻辑按项目配置 → 角色包/场景绑定 → Shot 显式覆盖解析，显示实际入参次序；超过模型上限为 BLOCKING，不能截断关键角色图片。
7. 快照：批次确认时锁定配置、语言、分镜内容、资产版本、引用顺序与编译后的基础 Prompt。仅保存本镜头需要的资产。提交前重新检查审核/撤销/可访问性；旧版本被撤销可阻止新提交，但不改写历史快照。
8. 连续引用：创建任务时，上一个镜头可能尚无输出。Snapshot 固定 sourceShotId、sourceGenerationId 或已确认 candidateId 和策略；待依赖完成，追加不可变 AttemptInput（candidateId、帧/media ID、实际 reference 顺序、最终 Prompt/参数 hash），不回写 Snapshot。这样同时满足冻结任务与等待前镜头。

P0 默认 context 连续：锁相同角色包/场景与上下镜头叙事上下文，不宣称等同视频首尾帧延长。若选择 frame/video 连续，必须有能力声明及服务器可执行的帧/视频引用适配，依赖归档成功后才能发起；不支持则提示改为 context 或更换模型，不静默退化。

字幕/配音语言在项目配置显式确认，字幕可选 none；普通生成表单、UI `/en`/`/zh`、silent 默认值均不能污染短剧配置。P0 只约束内容与生成提示，不承诺生成模型画面中文字绝对正确，不实现完整字幕渲染器。

## 6. 状态机与恢复规则

| 对象 | 持久化状态/动作 | 关键行为 |
| --- | --- | --- |
| AnalysisRun | DRAFT → PARSING → PARSED 或 FAILED；retry → PARSING | Attempt 留痕，解析与草稿接受状态分离 |
| Shot | DRAFT / READY | 从编辑完整性规则生成投影；生成失败不会把内容清空 |
| Generation | QUEUED → PROCESSING → SUCCEEDED / FAILED；QUEUED/PROCESSING → CANCELLED | FAILED 经显式 retry 创建新 Attempt 后回 QUEUED；不是 FAILED 直接变 SUCCEEDED |
| Generation waitReason | DEPENDENCY / CREDENTIAL / BALANCE / REVALIDATION / null | 解释 QUEUED 为什么不派发；不可占用 provider 并发槽 |
| Attempt phase | CLAIMED / SUBMITTING / SUBMISSION_UNKNOWN / POLLING / ARCHIVING / TERMINAL | 内部执行阶段与 Generation 产品状态分离 |
| Batch | CREATED → RUNNING → PAUSED → RUNNING；→ COMPLETED / CANCELLED | pauseReason 为 TOKEN_INSUFFICIENT/USER/CREDENTIAL_REQUIRED/REVIEW_REQUIRED 等；RESUME 是命令 |
| Candidate availability | ARCHIVING / AVAILABLE / ARCHIVE_FAILED / UNAVAILABLE | Provider 成功不等于已持久保存；归档重试不调用模型 |

派发与恢复规则：

- 默认最大并发为 3，由服务端策略配置。按 owner 设总上限，叠加 provider/model 限额，不能每个项目各自绕过总上限。跨执行器原子领取并分配槽位，依赖链串行、无依赖镜头按顺序领取并行执行。
- PostgreSQL 队列行保存 nextRunAt、leaseUntil、leaseToken；短事务领取后释放锁再调用网络。回写必须验证 leaseToken，租约过期被新执行器接管时拒绝旧执行器回写。
- 创建 outbox 与业务行同事务；通知丢失可扫表恢复，通知重复不会重复创建任务。独立定时 reconciliation 检查过期租约、provider job 和待归档结果。
- 已有 providerTaskId 仅查询原任务。提交超时且未拿到 ID 时记 SUBMISSION_UNKNOWN，先按上游幂等键/查询能力核对，无法核对则停新提交并提示人工处理；不能自动重发付费请求。
- 应用层幂等不等于 provider exactly-once。LiteLLM 视频提交是否接受幂等键、能否按键找回任务是上线合同门槛；没有此能力只能以安全暂停处理不确定结果。
- Token/Credit 不足：原 Batch → PAUSED，停止新领取；已有 provider 任务继续轮询。明确未接收的额度拒绝将工作项退回 QUEUED/BALANCE；重充后 resume 重查余额与授权，沿用 Batch/Snapshot，不重新创建已成功任务。
- 401/403、429 与余额不足按结构化上游码区分；普通限流退避，不推断成缺钱；审核拒绝/非法参数需要用户修复。HTTP 500 或 timeout 若发生在 submit 阶段，先处理不确定提交。
- 无依赖镜头失败不停止 Batch。后继等待依赖；用户可重试前驱或修改/解除依赖后创建新快照任务。不能无限等待且不展示原因。
- pause 停止新提交但不假取消已运行任务；cancelRequestedAt 记录取消请求，provider 支持时调用取消，不支持时等待现有任务终结。未提交项可立即 CANCELLED。用户不需浏览器在线才能完成取消与对账。
- COMPLETED 表示无剩余可执行/等待/运行项，允许含 FAILED，另返回 succeeded/failed/cancelled 统计。仍有依赖等待项不能 COMPLETED；其余工作终结后转 PAUSED/REVIEW_REQUIRED，提供修复入口。
- 归档使用确定性 attempt/output 标识，通过 Worker 幂等写入；SUCCEEDED 要有 AVAILABLE Candidate。归档失败保留 provider 结果与阶段，允许“重试保存”，不能重新生成付费视频。
- 用户关闭浏览器不暂停队列；重新打开查询服务端当前状态。已人工/额度暂停的任务仅在“继续”确认并校验后恢复。

## 7. 统一校验、进度与直接生成

`validateProduction(context, scope)` 返回稳定 issue code、severity、targetType/id、field 和 action。Action Items 与 Preflight 共用规则；Progress 消费相同完整性事实，但不把余额不足算成创作进度归零。

- BLOCKING：本次目标 Shot 的主要角色缺引用、实际引用未审核/撤销、必填 Prompt/配置缺失、模型不可用、时长/引用数量不支持、连续依赖非法、余额不足。
- WARNING：次要角色缺引用、场景无参考、可选音频缺失。未参与本次生成的其他角色不阻塞单 Shot，但项目待办保留提示。
- 外部余额/模型检查保留 checkedAt 与有效期。余额未知须返回验证不可用，不伪造 PASS；恢复检查可重试，实际扣费仍以 gateway 为准。
- Preflight 保存 scopeHash（Shot/config/asset revisions、任务范围、策略）和有效期；确认携带 preflightId 与已接受 warning codes，服务端在创建事务校验版本。任一内容改变返回 PREFLIGHT_STALE，要求刷新检查。
- “直接生成”先保存 Shot 得到 revision，然后执行同一 Preflight/创建流程。保存成功而任务创建失败时保留已保存内容，显示原因；不提交用户编辑之前的版本。
- Progress：script 15%、character 15%、scene 15%、shot 25%、generation 30%。空项目为 0；解析确认后确实无需角色的分项视为完成，缺数据不按 100% 处理。generation 按当前计划有可用结果的 Shot 数去重，多次重试不增加总镜头数；旧快照结果另报 staleCount，不冒充当前版本完成。
- 展示五个分项的 numerator/denominator、总分和 Action Items，不只返回一个百分比。Batch 进度分母固定为原 scope，不因编辑/删除 Shot 漂移。

## 8. API 合同

新持久化业务使用 `/api/v1/drama`；保留原 `/api/script/extract` 与 `/api/script/breakdown` 为兼容入口。当前短剧 UI 拆分主链路直连 TokenHub `/v1/chat/completions`，以下均为拟新增合同，不是现存服务声明。

| 方法与路径（相对 /api/v1/drama） | 行为 |
| --- | --- |
| GET/POST /projects | 分页列表、创建项目+默认 Episode+配置，POST 支持幂等键 |
| GET/PATCH/DELETE /projects/{id} | 读/改名/配置/确认删除，写入检查 revision 与 owner |
| GET/PATCH /preferences | 恢复模式、最近项目；已删除项目安全回退或空状态 |
| GET /projects/{id}/workspace | 当前 Episode/计划概要、计数、版本；大列表单独分页 |
| POST /projects/{id}/impact | 替换/删除/绑定/排序影响预览，返回 impactHash 与版本 |
| POST /episodes/{id}/script-imports | 文件或文本、replace/append、baseVersionId；202 返回导入任务 ID |
| GET /script-imports/{id} | 导入状态、错误、scriptVersionId |
| GET /episodes/{id}/script-versions | 导入/追加历史与当前来源 |
| POST /script-versions/{id}/analysis-runs | 创建/重试分析，202，带范围、配置版本与确认影响 |
| GET /analysis-runs/{id} | 解析进度、错误与 draftId |
| GET/PATCH /breakdown-drafts/{id} | 草稿读取/编辑，If-Match |
| POST /breakdown-drafts/{id}/accept | 校验映射/来源/影响确认，事务建立活动计划 |
| GET/POST /projects/{id}/characters | 角色列表/人工添加，角色资产版本由绑定命令创建 |
| PATCH /characters/{id} | 名称/别名/主次角色，If-Match |
| GET/POST /episodes/{id}/scenes | 当前计划场次列表/新增 |
| PATCH/DELETE /scenes/{id} | 修改/带影响确认删除，不无提示删除含 Shot 的场次 |
| GET/POST /projects/{id}/assets | 项目素材列表/挂载现有媒体或已核验 Asset ID，非复制上传 |
| POST /characters/{id}/bindings | 有序引用包版本，带影响确认 |
| POST /scenes/{id}/bindings | 场景引用版本，带影响确认 |
| POST /shots/{id}/bindings | 显式覆盖，保留来源与顺序 |
| GET/POST /episodes/{id}/shots | 分镜分页列表/新增 |
| PATCH/DELETE /shots/{id} | 版本检查；删除带 impactHash/确认，不破坏活动任务 |
| POST /shots/{id}/duplicate | 新 ID、复制编辑内容；不复制 Generation/Candidate 或隐含连续边 |
| POST /episodes/{id}/shot-order | 传稳定 ID 顺序和 group/detach 决策，整组移动事务 |
| GET /projects/{id}/progress | 分项计数、总分、待办、staleCount |
| POST /episodes/{id}/preflights | 单个/指定列表/未完成范围，返回 PASS/WARNING/BLOCKING 与 scopeHash |
| POST /episodes/{id}/batches | preflightId、scopeHash、warningsAccepted、Idempotency-Key；202 |
| GET /projects/{id}/batches | 跨页面恢复，服务端过滤 project |
| GET /batches/{id} | Batch 及分页 Generation 状态、revision、计数、pauseReason |
| POST /batches/{id}/pause、/resume、/cancel | 幂等命令；resume 不创建新 Batch |
| POST /generations/{id}/retry | 仅重试目标项，原快照；改配置重新生成需新 Preflight/Generation |
| POST /generations/{id}/retry-archive | 只保存已有输出，不创建 provider 视频 |
| GET /shots/{id}/candidates | 同 Shot 历史，带 snapshot/availability 与旧版本提示 |

读响应为 `{data, meta:{requestId, revision?}}`，错误为 `{error:{code, retryable, fieldErrors?, target?}, meta:{requestId}}`；安全用户说明通过明确码翻译，不回传 provider stack。401 未登录、403 无权限、404 不存在或不暴露的资源、409 冲突/过期 Preflight、413 超限、422 无效业务参数、429 请求限流。额度阻塞返回稳定 TOKEN_INSUFFICIENT 码，UI 不按 HTTP 状态或英文文案猜业务。

前端初期轮询应用 API（后台标签页退避、返回页面立即刷新）；SSE 可后续增强，不是执行可靠性的依赖。所有异步命令先持久化成功才返回 202，不能用 route 内未 await 的 Promise 冒充后台工作。

## 9. 模块边界与 /video 工作区

| 模块 | 负责 | 不负责 |
| --- | --- | --- |
| features/studio | 模式入口、路由和组合 | 新队列/分镜领域状态 |
| features/projects | 项目选择、配置 Modal、项目资产挂载 UI | 全局媒体二进制存储 |
| features/script | 导入、分析草稿、确认映射 | provider 传输和付费生成 |
| features/ip | Character 与最小引用包 UI/合同 | 供应商审核裁定 |
| features/episode | Scene/Shot 编辑、连续关系、完整性展示 | provider 任务轮询 |
| features/generation | Preflight、Batch、任务中心、Candidate 展示 | 浏览器调模型/消费队列 |
| features/assets | 上传、素材选择、审核状态及播放缓存 | 替代角色/Shot 数据模型 |
| server/{projects,script,episode,generation,assets} | 应用服务、事务、校验与查询 | React/IndexedDB/浏览器 File API |
| server/providers/xcity | LiteLLM 合同、错误与能力适配 | 短剧 UI 和生产关系 |
| server/persistence、server/tasks | repository/migrations、outbox、lease、reconciliation | 通用 Agent 图编排平台 |
| post-production/localization | 保留现有 Normal 功能；后续消费 Candidate | 本次新建 Timeline、TTS、多语言发布链 |

新增 `features/episode/components/ShortDramaWorkspace/index.tsx` 及 SCSS；`features/studio` 用小型模式容器组合它与现有 Normal。接入 `(studio)/layout` 的共享挂载结构前做路由回归，不再堆入超大 StudioWorkspace。首个接线 PR 允许仅移动必要展示边界，不连带重写图片/社区/剪辑。

工作区：顶部单一项目名/选择器+配置入口；主体为「剧本、角色/场景、分镜、生成」四步；右侧所选 Shot 编辑，底部/侧边为项目进度与下一步。项目素材从绑定选择器上传或选择已有资产，避免多个位置重复显示相同项目名。

Normal/Short Drama 是产品模式，不是 Agent/Manual；P0 不新增 Agent 开关。未来 Agent 只自动调用同一批命令与确认节点，不新建第二套 pipeline。项目切换只切查询 scope，旧异步响应按 projectId/revision 防串写；任务不随 UI 卸载结束。

新代码 TypeScript、SCSS Modules、主题 token、flat English-copy i18n keys；不扩大 legacy 文件预算，不引入 Tailwind；新 server 模块带 server-only。新 Node 执行器构建须排除 React client 依赖，并验证 server-only 导入在独立运行时可正确打包。

## 10. 迁移与回退

1. Expand：新增数据库/执行器与 API；默认关闭短剧新入口。先用模拟 adapter 跑通单镜头持久化、任务恢复、归档与幂等，Normal 保持旧路径。
2. 新数据只写新库：新短剧不双写 Worker history JSON 或 localStorage 作为主数据。媒体仍由 Worker 管理；旧历史可作为只读兼容投影进入新 UI。
3. 用户确认迁入：读取原始 `xctStudioShortDramaProjects`、`xctStudioShotGenerationQueue` 和 history，不先调用会按名称去重的 normalizeState；按原 ID/来源 hash 建立迁移映射。相同名称不同项目保留并提示改名，不能丢关联素材。
4. 验证 owner：本地记录视为不可信输入；校验其 Worker 对象和 provider Asset ID 权限。旧 `local_project_default` 只有确认为空占位时才跳过；不得按名字删除用户作品。
5. 转换：旧秒数转 durationMs、毫秒时间戳转 UTC；旧语言 zh-CN 映射为 zh-Hans 并显示确认，缺失配置进入待完善。旧 CharacterVersion 迁成 Character+引用版本，旧镜头随机队列 ID 保留 legacySourceId，不冒充已审分镜。
6. 历史：有 productionSnapshot 的结果按明确映射挂载；无 Shot 来源的历史作为未分配素材，让用户选择项目，不推断强绑。已存在 providerTaskId 只 reconcile，不重新提交；未知提交结果列为需核对。
7. 旧待提交项：只导入草稿，展示模型/语言/引用并重新 Preflight；用户确认后才创建付费 Batch。禁止恢复页面时把旧队列自动重放。
8. 验证迁移：记录 counts/checksum/失败项，重复导入返回同一映射；部分同步失败可重试。原 localStorage/IndexedDB 保留，不通过清缓存处理冲突。
9. 回退：关闭新建 Batch/短剧入口但保留执行器 reconciliation/归档直到活动任务结束；UI 回退 Normal 不重放短剧任务。数据库以向前修复为主，不能回滚表删除已付费任务；恢复备份后先对账 provider，再开放派发。

删除事务先锁项目并检查 QUEUED、PROCESSING、SUBMISSION_UNKNOWN、取消待确认项；与创建任务互斥。用户明确取消未提交项且所有在途项可对账后，才标记删除。只移除项目挂载与生产数据访问，共享原始资产和其他项目内容不删除。

## 11. 可执行任务拆分

每项对应可单独 review 的变更；前置未满足不得把后面的 UI 当作完成 P0。

| ID | 交付项 | 前置 | 验收证据 |
| --- | --- | --- | --- |
| P0-01 | 固定身份/DB/执行器 ADR；核查 LiteLLM 凭据、余额、视频幂等/查询/取消能力与 Worker 归档合同 | 本计划 | 已知能力和缺失项有 fixture/合同；明确跨仓库负责人及禁止自动重提边界 |
| P0-02 | 新合同、数据库 migrations、owner 授权、revision/幂等 repositories | 01 | 新库/升级/恢复演练；跨用户/项目读写被拒绝；冲突不覆盖 |
| P0-03 | 加密后台授权、任务/outbox/lease 执行器和 reconciliation | 02 | 两个执行器竞争只领一次；崩溃恢复、密钥失效和不确定提交可恢复 |
| P0-04 | 服务端视频 adapter + 单 Shot Snapshot → Candidate → Worker 归档闭环 | 03 | 模拟任务关浏览器/重启进程完成归档；归档失败重试不发起生成 |
| P0-05 | 项目 CRUD/独立配置/默认 Episode/偏好与同名校验 | 02 | 用户隔离、空项目、删除活动任务保护、语言不随 UI 切换 |
| P0-06 | 原文件持久化、ScriptVersion、replace/append、持久化解析 run/chunks/draft | 03、05 | txt/md/doc/docx/pdf；空/大/损坏/扫描文件；长剧本不截断、解析失败可重试 |
| P0-07 | 角色/场景/Shot 结构化合同、草稿确认事务、引用包与素材挂载 | 06 | 重解析不覆盖人工内容；跨项目引用拒绝；提交只含镜头需要的已准入素材 |
| P0-08 | Shot 增删复制编辑排序、连续组、对白/字幕、影响检查 | 07 | ID 稳定；整组移动；删除提示；Save+Generate 不用旧版本 |
| P0-09 | 统一验证、Progress/Action Items、Preflight 过期检查 | 08、04 | 主要角色阻塞/场景缺图警告；版本变更后旧 Preflight 无法提交 |
| P0-10 | Batch 并发、依赖、Pause/Resume/Cancel、失败重试与提交幂等 | 09 | 配置并发3；双击/多标签防重；余额暂停沿用原批次；独立 Shot 继续 |
| P0-11 | /video 模式容器与四步工作区接线、任务中心、项目查询隔离 | 05–10 | 刷新/切项目/切模式/关页后恢复；浅色/深色与中英文 UI 验证 |
| P0-12 | 显式 legacy 导入、开关/回退、运维与全链路验收 | 11 | 新用户、老浏览器、重复迁移、部分同步失败、服务重启、恢复后对账均覆盖 |

建议先完成 01–04 的**一镜头后台闭环**作为基座验收，再接 05–11 的可见主链路。阶段间用假 provider fixture，不以真实付费生成作为本地测试。

后续 P1：完整 Episode 管理、SelectedTake/锁片、EpisodeVersion 与现有组装适配、源字幕时间轴。P2：多语言发布/TTS/配音、复杂造型/道具、Agent 自动化与质量评分。P0 不实现这些表对应的完整产品，不把框架升级、全站 Tailwind 清理或其他旧功能迁移合并进本批。

## 12. 验证、发布门槛与本轮产出

开发验证：`pnpm check:harness`、`pnpm lint`、`pnpm typecheck`、`pnpm test`；新增路由和执行运行时另跑 `pnpm build`。数据库并发/事务必须用实际测试 PostgreSQL 验证，不能仅 mock repository。浏览器测 `/zh/video`、`/en/video`、项目/模式切换、浅深主题与移动宽度，并回归 Normal 视频、图片、素材、社区入口。

故障矩阵必须包含：提交前崩溃、provider 接收后响应丢失、重复通知、旧租约回写、429、余额不足、授权撤销、provider 成功但归档失败、连续前驱失败、Preflight 后编辑、多标签重复提交、取消不受支持、删除与回调竞争。

发布门槛：数据库备份/迁移恢复、执行器健康检查/优雅退出、凭据加密、队列积压和 lease 超时监控已接通；LiteLLM/Worker 合同缺口已有实现或明确阻断策略。当前 railway.json 仅启动 Web，届时需为执行器配置独立服务与健康检查；迁移只运行一次，不让每个 Web 实例各自争抢执行。现阶段不修改部署配置。

本轮仅输出方案与文档索引，静态核查代码。没有新增数据库、修改业务代码、运行真实 AI 或部署。跨仓库 LiteLLM 能力与线上运行情况属于 P0-01 的待验证事项，不以历史对话或本地 endpoint 名称代替证据。

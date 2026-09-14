# AI 短剧模式 P0 需求清单

> 这是 XCT Studio「AI 短剧模式」P0 的 **Source of Truth**，与其冲突的短剧相关 PRD / Spec 一律以此文件为准。

## 2026-09-10 图片需求复核与裁定

以下补充优先于下文旧示意图和含糊描述，不表示全部实现：

- 2026-09-13 起，Studio 服务端通过 `/api/business` 和 PostgreSQL 承担已登录用户的云端业务持久化、revision/事务及队列 claim；xcity-litellm 继续承担 AI/provider 网关、鉴权路由与计费。浏览器不直连数据库。
- 项目入口只展示一个项目下拉；新建/编辑通过 Modal，不再重复显示项目名和常驻文本框。重名报错，不自动切到另一个项目。项目配置须补画幅、分辨率、水印、明确声音语言与字幕模式；模型、画幅、分辨率和语言复用 Normal 的参数源，但短剧排除 Seedance 1.5。短剧模式隐藏 Normal 创作表单，只保留项目化分镜入口；首次明确确认语言，不继承 Normal 默认值。
- 自动拆分默认不选，选中时隐藏手工“添加分镜”入口；解析结果仍可编辑。第一次解析可预生成角色/场景/分镜草稿，人工确认后才成为正式计划。
- 人物草稿需有名称、别名、原文证据和明确外观描述；区分出镜、画外音、旁白、仅被提及人物。身份歧义人工确认，不按名字强行合并；重新解析保留人工确认的角色 ID/绑定。主要角色由 AI 建议、用户可修改，单镜头检查只针对该镜头实际使用的角色。
- 关闭/取消编辑器不提交生成，保留编辑草稿供再次打开。正式 P0 保存经 LiteLLM 云端落库；本轮临时 UI 的标签页草稿明确标为未上云，刷新恢复仍待后端实现。
- 编辑器主操作为关闭、保存、直接生成；不增加语义不明的“清屏”。保存不把所有镜头拼成普通 Prompt，也不触发付费生成。直接生成先保存、Preflight，再确认镜头数、模型、语言和引用后提交。
- Generation 正常流转为 QUEUED → PROCESSING → SUCCEEDED 或 FAILED；重试是独立 Attempt。Batch 可从 RUNNING 直接 COMPLETED，不必先 PAUSED；COMPLETED 表示全部处理结束，不等于全部成功。
- 素材更新仅影响尚未创建的任务。已经入队的任务也冻结快照；独立镜头失败不阻塞其他独立任务，但依赖它的后继需等待处理。
- 前端点击保护与后端幂等都必需；提交结果不确定时先对账，不自动重发付费请求。
- 短剧视频按项目展示，与 Normal 历史隔离；复用已有单视频分享能力。删除项目为逻辑删除，保留对账和快照，不物理删除共享素材；在途任务须先安全结束。
- 基础字幕支持独立文本/语言字段及开关；模型内字幕指令不等于确定性烧录。字幕文件/烧录的最终 P0 交付方式需单独确定，不能仅凭 Prompt 语言验收字幕正确。

本轮 UI 已实现：模式入口及刷新恢复、精简项目选择、项目独立配置、新建/编辑/删除、前端与数据层重名拒绝、自动拆分选择、重新拆分覆盖确认、标签页草稿保留、角色/场景/分镜结构化 Review、项目素材绑定、主要角色 Preflight、独立分镜编辑/复制、逐镜头时长/对白/字幕/连续来源、生成确认和浅色主题。AI 拆解走 xcity-litellm 专用接口，Studio 保留同源薄代理。2026-09-13 已交付云端业务记录、revision/事务、持久化队列 claim 和刷新恢复底座；完整强类型短剧模型、服务端后台执行、AnalysisRun/Chunk/Attempt 和完整 Batch 控制仍未交付，因此不勾选 §44 完整验收项。

## 1. 目标

在现有 `/video` 视频生成能力基础上增加「短剧模式」，完成以下核心链路：

~~~text
创建短剧项目
    ↓
项目独立配置
    ↓
导入剧本
    ↓
AI 解析 / 自动拆分
    ↓
角色 + 场景 + 分镜
    ↓
角色 / 场景资产绑定
    ↓
分镜编辑
    ↓
项目完整度检查
    ↓
Preflight Check
    ↓
单个 / 批量生成
    ↓
Generation Queue
    ↓
成功 / 失败 / Token不足
    ↓
恢复 / 重试 / 继续生成
~~~

P0 核心目标：

> 保证「Project → Script → AI Parsing → Assets → Storyboard → Generation」主链路完整、可靠、不丢数据，并正确处理重新解析、素材变更、任务失败、项目切换等异常情况。

---

# 2. Video 模式

## 2.1 模式切换

`/video` 增加两种模式：

~~~text
Normal
Short Drama
~~~

要求：

- 默认 Normal
- 记住用户最后一次选择
- 用户上次使用 Short Drama，下次进入 `/video` 自动恢复 Short Drama
- 模式切换不能终止正在执行的 Generation Task
- 切换回来后恢复任务最新状态

---

# 3. Short Drama Project

## 3.1 Project 数据关系

一个用户可以创建多个短剧项目。

~~~text
User
  ├── Project A
  ├── Project B
  └── Project C
~~~

每个 Project 拥有独立：

- Project Config
- Script
- Characters
- Scenes
- Storyboards / Shots
- Asset Binding
- Generation Tasks
- Generation History

即：

~~~text
User 1 : N ShortDramaProject
~~~

项目之间数据必须完全隔离。

---

## 3.2 当前项目

记录：

~~~text
currentDramaProjectId
~~~

用户再次进入 Short Drama 时：

- 自动恢复最后使用的 Project
- 如果 Project 已删除，则进入其他有效 Project 或空状态

切换 Project 时：

- 整个工作区同步切换
- 不影响其他 Project 正在运行的 Generation Task

---

## 3.3 Project Management

支持：

- 新建 Project
- 编辑 Project
- 删除 Project
- 切换 Project

移除现有测试项目。

---

# 4. Project Config

每个 Project 独立保存一套配置。

包括但不限于：

- 项目名称
- 短剧类型
- 创作风格
- 视频生成模型
- 模型版本
- 语言
- 默认 Prompt / 基础提示词配置

语言 P0：

~~~text
简体中文
繁体中文
English
~~~

语言配置影响：

- AI 剧本解析
- Prompt
- 后续生成内容

Project Config 通过 Modal 编辑。

Modal：

~~~text
[取消] [保存]
~~~

---

# 5. 删除 Project

删除 Project 必须二次确认。

提示：

> 删除项目将同时删除该短剧项目相关内容，此操作不可恢复。

如果当前 Project 存在：

~~~text
PROCESSING Generation
~~~

不能直接删除。

需要：

1. 提示存在正在执行的生成任务
2. 用户先取消/结束相关任务
3. 再执行删除

防止：

~~~text
Project 已删除
↓
Provider Callback 返回
↓
找不到对应 Project / Shot
~~~

---

# 6. Script Import

## 6.1 文件格式

支持：

- TXT
- Markdown
- Word
- PDF

需要定义：

- 文件大小限制
- 字符数限制
- 文件格式限制
- 文件解析失败提示
- 空文件处理
- 不支持格式提示

---

# 7. 剧本导入方式

重新上传剧本不能默认直接覆盖。

P0 至少考虑：

### 7.1 覆盖当前剧本

使用新剧本替换当前剧本。

如果已经存在：

- AI 解析结果
- Characters
- Scenes
- Shots
- Asset Binding
- 已生成视频
- 人工修改内容

必须进行影响范围提示。

---

### 7.2 补充 / 追加剧本

允许用户向已有剧本增加新的内容。

原则：

- 已有内容尽量保持不变
- 已有人工修改不能无提示覆盖
- 新内容可以继续进行 AI 分析和分镜拆分

---

### 7.3 后续剧情 / 续集

需要为未来：

~~~text
Project
  ↓
Episode / Chapter
  ↓
Script
  ↓
Shots
~~~

预留数据结构。

P0 可以暂时不完整实现 Episode 管理，但不能把数据结构完全锁死为：

~~~text
Project → 唯一 Script → Shots
~~~

---

# 8. AI Script Parsing

上传剧本后支持 AI 自动分析。

AI 分析：

~~~text
Script
   ↓
AI Parsing
   ↓
Characters
Scenes
Shots
~~~

---

## 8.1 AI Parsing 状态

必须有明确状态：

~~~text
待解析
解析中
解析成功
解析失败
~~~

解析失败：

~~~text
[重新解析]
~~~

不能出现失败以后用户没有操作出口。

---

# 9. 重新 AI 拆分

用户可以重新执行 AI Parsing / Storyboard Split。

但是不能直接覆盖。

重新解析之前计算当前影响范围。

例如：

~~~text
⚠️ 重新解析剧本

当前项目包含：

30 个分镜
5 个角色
4 个角色已绑定素材
10 个分镜已生成视频
8 个分镜存在人工修改

重新解析可能覆盖当前分镜内容。

[取消] [继续重新解析]
~~~

P0 不要求实现复杂 AI Diff / Merge。

核心要求：

> 用户必须明确知道重新解析会影响什么。

---

# 10. Character Library

AI Parsing 自动识别角色。

例如：

~~~text
张总
李雪
王经理
服务员
~~~

角色需要明确状态：

~~~text
已绑定 Asset
未绑定 Asset
~~~

例如：

~~~text
张总        ✓ 已绑定
李雪        ✓ 已绑定
王经理      ⚠ 未绑定
~~~

---

# 11. Character Asset Binding

角色可以绑定 Project Asset。

用于保证跨 Shot 人物一致性。

Generation 时：

~~~text
Character
    ↓
Character Asset
    ↓
Shot
    ↓
Generation
~~~

未绑定角色需要明确提示。

特别是主要角色。

---

# 12. Scene Library

AI Parsing 除角色外，需要识别 Scene。

例如：

~~~text
张总办公室
公司大厅
咖啡厅
李雪家
~~~

Scene 作为 Project 内独立对象管理。

---

# 13. Scene Asset / Reference

Scene 可以绑定参考 Asset。

例如：

~~~text
张总办公室

Reference Asset:
office-reference.png

使用 Shot:
01
03
08
12
~~~

用于保证跨 Shot 场景稳定性。

---

## 13.1 Scene 完整性提示

例如：

~~~text
✓ 主要角色全部绑定

⚠ 3 个重复场景没有参考素材
可能影响跨镜头场景一致性
~~~

Scene Reference 默认规则（P0）：

~~~text
主要角色未绑定 Asset          → BLOCKING
次要角色未绑定 Asset          → WARNING
Scene 没有 Reference         → WARNING
必要 Prompt 缺失             → BLOCKING
必要 Generation Config 缺失  → BLOCKING
Token / Credit 不足           → BLOCKING
~~~

说明：

~~~text
Scene Reference 缺失默认 WARNING，不阻塞 Generation。
~~~

---

# 14. Storyboard / Shot Editor

AI 拆分剧本后生成 Shot List。

例如：

~~~text

Shot 01

Shot 02

Shot 03

...

~~~

每个 Shot 至少包含：

- 分镜内容

- 时长

- 镜头

- Prompt

- 角色

- 场景

- 对白（Dialogue）

  - 支持多条对白

  - 说话角色

  - 对白内容

  - 情绪 / 语气

- 字幕（Subtitle）

  - 默认跟随对白生成

  - 支持独立修改

  - 支持项目语言配置

- 音频提示（Audio Prompt）

- 是否延续上一分镜

Shot 数据关系：

~~~text

Shot

├── Description

├── Characters

├── Scene

├── Camera

├── Duration

├── Prompt

│

├── Dialogues[]

│   ├── speakerCharacterId

│   ├── text

│   ├── emotion

│   └── order

│

├── Subtitles[]

│   ├── dialogueId

│   ├── text

│   └── language

│

├── AudioPrompt

│

└── Continuity

~~~

注意：

- 一个 Shot 可以存在多条 Dialogue

- Dialogue 必须明确关联说话角色

- Dialogue 顺序必须保留

- Subtitle 默认可以由 Dialogue 自动生成

- Subtitle 与 Dialogue 数据独立，允许用户修改字幕但不修改原始对白

- AI Script Parsing 时应尽可能自动提取 Dialogue / Speaker / Emotion

# 15. Shot List Management【P0】

必须支持：

- 新增 Shot
- 删除 Shot
- 复制 Shot
- 编辑 Shot
- 拖动排序

不能只支持单 Shot 编辑。

---

# 16. Shot 删除引用检查

删除 Shot 前需要检查：

- 是否存在 Generation
- 是否存在生成视频
- 是否被其他 Shot 延续
- 是否影响 Continuity Group

例如：

~~~text
删除 Shot 08

⚠ 当前分镜：

• 已生成 2 个视频
• Shot 09 延续当前分镜

删除后：
Shot 09 的延续关系将被解除。

[取消] [确认删除]
~~~

---

# 17. 延续上一分镜

「延续上一分镜」不能只定义为模糊 Checkbox。

需要明确其作用。

主要用于：

- 人物一致性
- 场景延续
- 视觉上下文
- Reference Asset
- 上一个 Shot 输出参考
- 模型支持情况下的首尾帧衔接

内部不能只保存：

~~~text
continuePrevious = true
~~~

建议保存实际关联：

~~~text
continuitySourceShotId
~~~

UI 可以继续展示：

~~~text
☑ 延续上一分镜
~~~

---

# 18. Continuity Group【P0】

连续延续的 Shot 视为一个连续镜头组。

例如：

~~~text
Shot 01
   ↓
Shot 02 延续 Shot 01
   ↓
Shot 03 延续 Shot 02
~~~

形成：

~~~text
[Shot 01 → Shot 02 → Shot 03]
~~~

存在延续关系时：

> 不能简单单独处理其中一个 Shot。

特别是：

- 拖动排序
- 删除
- 修改关联

如果用户尝试单独移动：

~~~text
⚠ 当前分镜与其他分镜存在延续关系，
无法单独调整顺序。

[取消]
[整体移动连续分镜]
[解除延续关系]
~~~

避免排序后破坏镜头连续性。

---

# 19. Shot Editor 操作

底部：

~~~text
[取消] [保存] [直接生成]
~~~

## 19.1 取消

如果没有修改：

~~~text
dirty = false
→ 直接关闭
~~~

如果存在修改：

~~~text
dirty = true
~~~

提示：

> 当前修改尚未保存，是否放弃修改？

---

## 19.2 保存

保存当前 Shot 数据。

---

## 19.3 直接生成

明确：

~~~text
直接生成 = Save + Generate
~~~

流程：

~~~text
校验
↓
保存当前 Shot
↓
创建 Generation Task
↓
进入 Generation Queue
~~~

防止使用旧数据生成。

---

# 20. 单 Shot Generation

支持单独生成一个 Shot。

状态：

~~~text
待生成
↓
排队中
↓
生成中
↓
生成成功
~~~

失败：

~~~text
生成失败
↓
[重试]
~~~

一个 Shot 失败不能阻塞其他 Shot。

例如：

~~~text
Shot 01   ✓
Shot 02   ✓
Shot 03   Failed
Shot 04   ✓
Shot 05   Processing
~~~

---

# 21. Generation Snapshot【P0】

Generation 创建时保存当时的生成参数。

例如：

~~~text
Generation Snapshot

Prompt
Model
Model Version
Model Params
Character Assets
Scene Assets
Reference Assets
Duration
Continuity
...
~~~

原因：

用户可以在 Generation 过程中继续修改 Shot。

例如：

~~~text
Generation #001
使用 Shot V1

与此同时

用户编辑 Shot
↓
Shot V2
~~~

当前 Generation：

> 继续使用 V1 Snapshot，不受后续修改影响。

Generation 完成后可以提示：

~~~text
当前分镜内容已发生修改。

本次视频使用修改前配置生成。

[使用当前配置重新生成]
~~~

---

# 22. Asset 修改影响【P0】

如果 Character / Scene Asset 已经被 Shot 使用，再修改 Asset，需要进行影响提示。

例如：

~~~text
修改角色素材

⚠ 当前素材已被 12 个分镜引用，
其中 5 个已经生成视频。

更换素材不会影响已经生成的视频。
后续生成将使用新的素材。

[取消] [确认更换]
~~~

规则：

~~~text
已生成 Shot
→ 保留原 Generation Snapshot

未生成 Shot
→ 使用最新 Asset
~~~

---

# 23. Generate All【P0】

增加：

~~~text
[全部生成]
~~~

或：

~~~text
[生成全部未完成分镜]
~~~

不能直接开始生成。

必须先执行：

~~~text
Generation Preflight
~~~

---

# 24. Generation Preflight【P0】

全部生成前进行完整性检查。

检查：

~~~text
Project Config
Script
Characters
Character Assets
Scenes
Scene Assets
Shots
Prompts
Generation Config
Model Availability
Token / Credit Availability
Continuity
~~~

---

## 24.1 Blocking

Blocking 问题不能继续生成。

例如：

~~~text
❌ 主要角色没有绑定 Asset
❌ 必要 Prompt 缺失
❌ 必要生成配置缺失
❌ Token / Credit 不足
❌ 视频模型不可用
~~~

用户必须处理后才能继续。

说明：次要角色未绑定 Asset / Scene 没有 Reference 进入 Warning 流程，可通过配置阈值下沉为可选校验。

---

## 24.2 Warning

Warning 不阻塞生成。

例如：

~~~text
⚠ 次要人物没有绑定 Asset
⚠ Scene 没有 Reference Asset
⚠ 部分 Shot 没有设置延续关系
⚠ 可选音频 Prompt 缺失
~~~

允许：

~~~text
[返回修改] [仍然生成]
~~~

---

## 24.3 Preflight UI

例如：

~~~text
生成前检查

✓ 32 个分镜
✓ 项目配置完整
✓ 5 / 5 主要角色已绑定
✓ 视频模型可用

⚠ 2 个次要角色未绑定
⚠ 3 个场景没有参考素材

预计生成：
32 个视频

[返回修改] [继续生成]
~~~

P0：

> 不展示预计 Token 消耗。

---

# 25. Batch Generation【P0】

全部生成后创建 Batch Generation。

例如：

~~~text
Batch Generation

Total:      30
Completed:  8
Processing: 3
Queued:     19
Failed:     0
~~~

---

# 26. Generation 并发

默认：

~~~text
MAX_CONCURRENT_GENERATIONS = 3
~~~

但是：

> 并发数必须配置化，不能写死在前端业务代码中。

未来可能根据：

- 用户等级
- Provider
- 模型
- 系统负载

动态调整。

前端只展示真实状态。

---

# 27. Batch 防重复生成【P0】

用户点击：

~~~text
[全部生成]
~~~

前端立即进行点击保护：

~~~text
[全部生成]
↓
[正在创建任务...]
↓
Disabled
~~~

防止：

~~~text
连续点击
↓
重复创建 Batch
↓
重复消耗资源
~~~

P0 至少完成前端点击保护。

---

# 28. Token 不足处理【P0】

Token 不足不能简单定义为：

~~~text
Generation Failed
~~~

如果 Batch Generation 过程中 Token 不足：

~~~text
RUNNING
↓
PAUSED
~~~

停止消费后续 Queue。

例如：

~~~text
已完成：12 / 30
剩余：18

⚠ Token 余额不足

剩余生成任务已暂停。

[充值] [稍后处理]
~~~

充值完成：

~~~text
[继续生成]
~~~

恢复：

~~~text
PAUSED
↓
RUNNING
~~~

从剩余任务继续。

不能要求用户重新执行「全部生成」。

---

# 29. Generation Task 后台化【P0】

Generation Task 必须与 Project 绑定。

不能依赖当前页面生命周期。

以下行为均不能导致 Generation Task 丢失：

- 切换 Project
- 切换 Normal / Short Drama
- 页面刷新
- 离开 `/video`
- 关闭浏览器
- 重新登录

例如：

~~~text
Project A

30 Shots
↓
Generate All
↓
3 Processing
27 Queued
~~~

用户切换：

~~~text
Project B
~~~

Project A：

> 后台继续执行。

重新进入 Project A：

~~~text
13 / 30 Completed
3 Processing
13 Queued
1 Failed
~~~

恢复真实服务端状态。

---

# 30. Project Progress【P0】

项目需要提供整体进度。

不能只显示一个百分比。

例如：

~~~text
Project Progress 72%

剧本       ✓ 已完成
角色       4 / 5 已绑定
场景       6 / 8 已完善
分镜       28 / 30 已完善
视频       18 / 30 已生成
~~~

---

# 31. Progress Algorithm

P0 可以采用简单权重算法。

例如：

~~~text
Script        15%
Scenes        15%
Storyboard    25%
Generation    30%
~~~

计算：

~~~text
Progress =
    scriptProgress     * 0.15 +
    characterProgress  * 0.15 +
    sceneProgress      * 0.15 +
    shotProgress       * 0.25 +
    generationProgress * 0.30
~~~

具体权重后续可根据真实使用情况调整。

---

# 32. Action Items【P0】

Progress 和 Action Items 必须分开。

例如：

~~~text
项目进度：72%

还需要完成：

• 1 个主要角色未绑定
• 2 个场景没有参考素材
• 2 个分镜信息不完整
• 12 个分镜尚未生成
~~~

Action Item 最好支持点击定位：

~~~text
1 个主要角色未绑定
        ↓
Character Library

2 个场景没有参考素材
        ↓
Scene Library

2 个分镜信息不完整
        ↓
Shot List
~~~

目标：

> 不只是告诉用户“完成了多少”，还要告诉用户“下一步应该做什么”。

---

# 33. P0 状态体系

## 33.1 Script / AI Parsing

~~~text
DRAFT
↓
PARSING
↓
PARSED
~~~

异常处理：

~~~text
PARSING
↓
FAILED
  │ retry
  ↓
PARSING
~~~

说明：

- `RETRY` 为用户动作，不是持久化状态。

状态说明：

- `DRAFT`：剧本已创建或上传，但尚未执行 AI 解析
- `PARSING`：AI 正在解析剧本
- `PARSED`：解析完成，已生成角色、场景、分镜等结构化结果
- `FAILED`：解析失败，可重新执行解析

---

## 33.2 Shot

~~~text
DRAFT
READY
~~~

说明：

- `DRAFT`：分镜信息尚未完整
- `READY`：分镜已经满足基本生成条件

Shot 本身的编辑状态与 Generation 状态分开管理。

不要使用一个 `status` 同时表示：

~~~text
分镜是否完善
+
视频是否生成
~~~

---

## 33.3 Generation

~~~text
QUEUED
↓
PROCESSING
↓
FAILED
↓
SUCCEEDED
~~~

异常/重试：

~~~text
PROCESSING
↓
FAILED
  │ retry
  ↓
QUEUED
~~~

取消：

~~~text
QUEUED / PROCESSING
↓
CANCELLED
~~~

状态说明：

- `QUEUED`：已进入生成队列
- `PROCESSING`：正在调用模型生成
- `SUCCEEDED`：生成成功
- `FAILED`：生成失败
- `CANCELLED`：任务被取消

Generation 失败不能影响其他 Shot 的 Generation。

---

## 33.4 Batch Generation

~~~text
CREATED
↓
RUNNING
  ├──> CANCELLED
  │
↓
PAUSED
  （pauseReason = TOKEN_INSUFFICIENT）
↓
COMPLETED
~~~

持久化状态仅包含：

~~~text
CREATED
RUNNING
PAUSED
COMPLETED
CANCELLED
~~~

说明：

- `TOKEN_INSUFFICIENT` 和 `RESUME` 不作为状态，属于动作流转参数：
  - `pauseReason = TOKEN_INSUFFICIENT`
  - `resume()` 动作触发继续消费队列

暂停：

~~~text
RUNNING
↓
PAUSED
  │ resume
  ↓
RUNNING
~~~

如果 Batch 内存在部分失败：

~~~text
Total:      30
Succeeded:  26
Failed:      2
Processing:  0
Queued:      2
~~~

Batch 不应该因为单个 Shot Failed 而整体停止。

---

# 34. Generation Queue

Generation Queue 属于服务端任务。

不能依赖：

- 当前 Modal
- 当前页面
- 当前 Project UI
- 浏览器生命周期

Queue 根据配置控制并发数量。

例如：

~~~text
MAX_CONCURRENT_GENERATIONS = 3

Processing:
Shot 01
Shot 02
Shot 03

Queued:
Shot 04
Shot 05
Shot 06
...
~~~

当一个 Processing Task 完成：

~~~text
Shot 01 → SUCCEEDED

Shot 04:
QUEUED → PROCESSING
~~~

继续消费 Queue。

---

# 35. Generation Failure Handling

生成失败必须提供明确原因。

至少区分：

~~~text
Provider Error
Model Error
Network Error
Timeout
Invalid Parameters
Asset Error
Content / Safety Error
Token / Credit Error
Unknown Error
~~~

UI 不一定展示技术错误，但必须转换成用户可以理解的信息。

例如：

~~~text
生成失败

视频模型暂时不可用，请稍后重试。

[重试]
~~~

不能直接向用户展示 Provider 原始 Error Stack。

---

# 36. Token / Credit 不足

Token / Credit 不足属于特殊业务状态。

不能简单作为普通 Generation Failed 处理。

Batch Generation：

~~~text
RUNNING
↓
检测余额不足
↓
停止启动新的 Queued Task
↓
PAUSED
~~~

已经进入 `PROCESSING` 的任务按照实际 Provider 能力决定继续完成或正常等待结果。

UI：

~~~text
Token 余额不足

已完成：12 / 30
剩余：18

剩余生成任务已暂停。

[充值]
[稍后处理]
~~~

充值后：

~~~text
[继续生成]
~~~

继续消费原 Batch 剩余 Queue。

不得重新创建整个 Batch。

---

# 37. Preflight 与 Action Items 的关系

Action Items 用于日常提示项目还有哪些内容需要完善。

Preflight 用于真正执行 Generation 前的最终检查。

两者可以复用同一套 Validation Rules。

~~~text
Validation Rules
       │
       ├── Project Progress
       ├── Action Items
       └── Generation Preflight
~~~

避免三套逻辑分别实现。

Validation Result 分为：

~~~text
PASS
WARNING
BLOCKING
~~~

例如：

~~~text
主要角色没有 Asset
→ BLOCKING

次要角色没有 Asset
→ WARNING

场景没有 Reference
→ WARNING

必要 Prompt 缺失
→ BLOCKING

必要 Generation Config 缺失
→ BLOCKING

Token / Credit 不足
→ BLOCKING

模型不可用
→ BLOCKING
~~~

具体规则允许配置。

---

# 38. 数据修改与 Generation 隔离

用户可以在 Generation 过程中继续编辑：

- Shot
- Prompt
- Character Asset
- Scene Asset
- Generation Config

但是：

> 已经创建的 Generation Task 不允许被后续修改影响。

Generation 创建时保存 Snapshot。

~~~text
Shot V1
↓
Generation #001
↓
Snapshot V1
↓
PROCESSING

与此同时

Shot V1
↓
用户修改
↓
Shot V2
~~~

Generation #001：

~~~text
仍然使用 Snapshot V1
~~~

下一次 Generation：

~~~text
Shot V2
↓
Generation #002
↓
Snapshot V2
~~~

---

# 39. Project / 页面切换

Generation 与 Project 绑定，而不是与页面绑定。

以下行为不能影响 Generation：

~~~text
切换 Project
切换 Normal / Short Drama
刷新页面
关闭页面
重新进入 /video
~~~

重新进入 Project 时：

从服务端恢复：

- Batch 状态
- Generation 状态
- Queue 状态
- Project Progress
- Failed Tasks

---

# 40. P0 核心数据关系

P0 推荐保持以下核心关系：

~~~text
User
 │
 └── ShortDramaProject
       │
       ├── ProjectConfig
       │
       ├── Script
       │
       ├── Characters
       │      └── Asset Binding
       │
       ├── Scenes
       │      └── Reference Asset
       │
       ├── Shots
       │      └── Continuity
       │
       ├── BatchGeneration
       │      │
       │      └── Generations
       │             └── Snapshot
       │
       └── Project Progress / Action Items
~~~

---

# 41. P0 验收主流程

P0 至少保证以下完整流程可以正常完成：

~~~text
进入 /video
↓
切换 Short Drama
↓
创建 Project
↓
配置 Project
↓
上传 Script
↓
AI Parsing
↓
生成 Characters / Scenes / Shots
↓
绑定 Character Assets
↓
绑定 Scene References
↓
编辑 / 排序 Shots
↓
处理 Continuity
↓
Project Progress / Action Items
↓
点击 Generate All
↓
Preflight
↓
处理 Blocking / Warning
↓
创建 Batch
↓
Generation Queue
↓
并发生成
↓
Success / Failed / Retry
↓
Token 不足 → Pause
↓
充值
↓
Resume
↓
完成剩余任务
~~~

同时验证：

- 刷新页面任务不丢失
- 切换 Project 任务不丢失
- 切换 Normal 模式任务不丢失
- Generation 过程中允许继续编辑 Shot
- 修改 Asset 不影响历史 Generation Snapshot
- 删除 Shot 会检查引用关系
- Continuity Group 不允许被无提示破坏
- 重新 AI Parsing 会提示影响范围
- Generate All 不允许重复提交
- 单个 Generation Failed 不阻塞整个 Batch

---

# 42. P0 暂不包含

以下能力暂不进入 P0：

- 完整 Episode 管理
- Timeline 视频剪辑
- BGM 编辑
- 完整字幕编辑器
- Voice Clone
- 复杂角色多造型系统
- Prompt Version Management
- AI Diff / Smart Merge
- 自动 Best Take
- 高级 Generation History 对比
- 高级任务优先级
- 完整 Undo / Redo

这些能力进入后续 P1 / P2 评估。

---

# 43. P0 Definition of Done

P0 完成标准：

> 用户可以稳定完成「创建短剧项目 → 导入剧本 → AI 拆分 → 角色/场景资产绑定 → 分镜编辑 → Preflight → 批量生成 → 异常处理 → 完成生成」完整工作流。

同时满足：

1. 不因页面刷新、项目切换导致生成任务丢失
2. 不因重新解析、删除、排序等操作无提示破坏已有内容
3. Character / Scene Asset 能够参与跨镜头一致性控制
4. Generation 使用 Snapshot，避免生成过程中数据变化导致结果不可追踪
5. Batch Generation 支持 Queue、并发、失败重试、Pause / Resume
6. Token 不足不会导致整个 Batch 作废
7. Project Progress 能表达当前完成情况
8. Action Items 能告诉用户下一步需要完成什么
9. Preflight 能在批量生成前发现关键问题
10. P0 主流程不存在无出口状态

# 44. 交付验收清单（开发执行）

2026-09-14 状态修订：2026-09-10 的“XCT Studio 不接数据库”判断已被 2026-09-13 提交 `4505c6b` 取代。Studio 已交付 PostgreSQL 云端业务持久化、同源 `/api/business`、revision/事务及队列 claim；见 [持久化与执行边界](../architecture/short-drama-infrastructure.md)。以下验收项仍按端到端产品结果判断，不能因底座已交付而自动视为完整 P0 完成。

按顺序验证以下项，缺一不可。

- [ ] /video 可在入口处切换 Normal / Short Drama，切回 Short Drama 后恢复最近选择
- [ ] 项目创建 / 切换 / 编辑 / 删除（含二次确认）不影响其他 Project 的进行中生成任务
- [ ] Script 上传支持 TXT / Markdown / Word / PDF，包含大小、字符数、格式与空文档错误提示
- [ ] AI Parsing 能输出 Characters / Scenes / Shots，具备 `DRAFT → PARSING → PARSED` 状态与失败重试
- [ ] 重新解析前显示影响范围，二次确认后才执行覆盖操作
- [ ] Character / Scene 资产与 Reference 能够绑定并参与 Generation 前置校验
- [ ] Shot 支持新增、删除、复制、编辑、拖拽；删除与 Continuity 引用关系需要提示与确认
- [ ] Shot 的延续关系落库为 `continuitySourceShotId`，不能被无提示破坏连续组
- [ ] 点击 Generate All 之前必须经过 Preflight，生成 PASS/WARNING/BLOCKING 统一规则并返回 Action Items
- [ ] Batch 创建为服务端任务，队列并发配置化；重复点击 Generate All 有禁用态，避免重复创建
- [ ] Token 不足时 Batch 进入 `PAUSED`，充值后可 `Resume`，不重建 Batch
- [ ] 所有 Generation 使用 Snapshot，与后续编辑解耦，历史生成不被修改影响
- [ ] 刷新页面 / 切换 Project / 切换模式后，Project、Batch、Queue 与任务状态可恢复
- [ ] Project Progress 同时输出数字进度与角色/场景/分镜/视频待办信息
- [ ] 单 Shot 失败可 Retry，失败不阻塞其他队列任务
- [ ] 失败信息转为用户可读文案，不直接返回原始 Provider Error Stack
- [ ] 中文 / 英文 / 繁体语言配置贯穿 Prompt 与字幕，不出现默认语言污染导致的混合输出
- [ ] 本阶段明确排除能力（Episode 完整管理、Timeline、TTS/Voice 体系、复杂 Merge）不进入 P0 代码路径

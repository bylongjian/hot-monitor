---
name: hot-monitor
description: "Use this skill whenever the user asks about AI热点情报台、热点情报台、热点雷达、监控词编排台、系统控制室、AI 热点、刷新热点、扫描状态、关键词监控、账号监控、命中记录、测试邮件、扫描间隔、OpenRouter 配置或 SMTP 配置. This skill operates the local hot-monitor service through its HTTP API instead of UI clicking, and should be preferred even when the user only describes the task in natural language."
---

# Hot Monitor

把本地 AI热点情报台 当成一个 HTTP 服务来使用，而不是去点前端页面。

## 目标

用真实后端接口完成 4 类动作：

1. 查询热点
2. 管理监控词和账号监控
3. 读取或更新系统配置
4. 触发扫描并观察扫描状态

## 工作方式

先做 API，再考虑 UI：

- 优先直接请求本地后端 HTTP API。
- 不要默认通过前端页面自动化点击来完成业务动作。
- 只有在 API 不可达、但用户明确要求走页面时，才考虑 UI 级 fallback。

优先探测可用 base URL：

1. 先探测 http://localhost:8000/api/v1/settings/status
2. 若不可达，再探测 http://localhost:8001/api/v1/settings/status
3. 两者都失败时，明确告诉用户服务未启动或端口不可达，不要编造结果

优先使用当前环境里最稳的 HTTP 调用方式：

- Bash 环境优先用 curl
- PowerShell 环境可用 Invoke-RestMethod
- 发送 JSON 时显式携带 Content-Type: application/json

需要精确字段、请求样例或筛选参数时，读取 references/api-contract.md。

## 触发意图路由

### 1. 查询热点

当用户在问这些事时，走热点查询：

- 今天有哪些 AI 热点
- 帮我看热度最高的热点
- 看看哪些热点是监控词命中的
- 找 24 小时内值得写的热点
- 按来源、标签、热度或关键词筛选热点
- 查看某条热点详情

默认策略：

- 用户说“最新”时，优先 sort=newest
- 用户说“最值得写”或“热度最高”时，优先 sort=heat
- 用户说“命中”时，优先 keyword_mode=matched
- 用户说“未通知”时，优先 sort=unnotified
- 用户未指定数量时，默认返回 5 到 10 条

### 2. 管理监控

当用户在问这些事时，走监控管理：

- 添加关键词监控
- 添加平台账号监控
- 启用或停用某个监控项
- 删除某个监控项
- 查看某个监控词的命中记录

处理顺序：

1. 先定位目标条目
2. 目标不唯一时先列出候选项
3. 再执行变更

### 3. 配置系统

当用户在问这些事时，走系统配置：

- 看当前扫描间隔
- 修改通知阈值
- 修改最低入库热度
- 更新 OpenRouter 配置
- 更新 SMTP 配置
- 发送测试邮件

### 4. 触发与观测扫描

当用户在问这些事时，走扫描控制：

- 刷新热点
- 立即扫描
- 看看现在有没有在扫描
- 扫描完成了没有
- 上次扫描多久、有没有报错

## 核心规则

### 删除必须确认

删除监控项前必须拿到明确确认。

即使只匹配到一个候选项，也要先告诉用户目标是谁，再确认一次，再发 DELETE 请求。

### 不要假设秘密字段可回显

GET /settings 不会返回：

- openrouter_api_key
- smtp_password

因此：

- 不要声称自己读到了这些值
- 更新这些字段时，只回显“已更新”或“已提交更新”，不要伪造明文

### 扫描已在运行时不要重复触发

POST /topics/scan 返回 triggered=false 时，不要继续重复提交。

要改为：

1. 告诉用户已有扫描在执行
2. 读取当前状态
3. 必要时继续轮询状态接口

### 时间语义

后端时间统一输出 UTC。

- published_at 表示真实发布时间，可能为空
- discovered_at 一定存在，表示系统发现/抓取时间

汇报热点时优先使用 published_at；没有时明确回退为 discovered_at。

## 工作流

### 工作流 A：查询热点

1. 把用户意图翻译成 topics 查询参数
2. 调用 GET /api/v1/topics
3. 若用户要求单条详情，再调用 GET /api/v1/topics/{id}
4. 输出结构化结果，而不是原始 JSON

默认输出字段：

- 标题
- 来源名称
- 来源类型
- 热度分
- 发布时间或抓取时间
- AI 摘要
- 是否监控词命中
- 是否已推送
- 原始链接

若用户在做选题判断，可额外突出：

- relevance_score
- relevance_reason
- engagement
- source_metrics

### 工作流 B：新增监控

关键词监控：

1. 检查 keyword 是否提供
2. 调用 POST /api/v1/keywords
3. 默认 enabled=true，type=keyword
4. 回显新增结果

账号监控：

1. 检查 keyword、platform、account_id 是否齐全
2. 调用 POST /api/v1/keywords，type=account
3. 回显新增结果

若信息不完整，先追问，不要猜测。

### 工作流 C：启用或停用监控

1. 先用 GET /api/v1/keywords 搜索目标
2. 目标唯一后调用 PATCH /api/v1/keywords/{id}
3. 仅修改必要字段，例如 enabled
4. 返回生效后的条目

### 工作流 D：删除监控

1. 先搜索并定位候选项
2. 返回候选项的关键字段：id、keyword、type、platform、account_id、enabled
3. 取得用户明确确认
4. 调用 DELETE /api/v1/keywords/{id}
5. 返回删除完成

如果候选项不唯一，不要替用户选。

### 工作流 E：查看命中记录

1. 先定位监控项
2. 调用 GET /api/v1/keywords/{id}/hits
3. 按热点结果格式输出命中记录

### 工作流 F：读取或更新系统配置

读取配置：

1. 调用 GET /api/v1/settings
2. 输出可见字段

更新配置：

1. 只提交用户明确给出的字段
2. 调用 PUT /api/v1/settings
3. 回显实际生效的非敏感字段

发送测试邮件：

1. 调用 POST /api/v1/settings/test-email
2. 直接回传 message

### 工作流 G：触发扫描并观测状态

1. 调用 POST /api/v1/topics/scan
2. 若 triggered=true，告诉用户扫描已触发
3. 若用户要求继续观察，再调用 GET /api/v1/settings/status 轮询 scan_running
4. 结束时汇报：scan_finished_at、last_scan_duration_seconds、last_scan_error

状态汇报优先字段：

- scheduler_running
- next_run
- scan_running
- scan_started_at
- scan_finished_at
- last_scan_success_at
- last_scan_duration_seconds
- last_scan_error
- total_topics
- total_keywords

## 参数映射速查

### 热点查询参数

- sort: newest | heat | matched | unnotified
- min_heat: 1-10
- source_names: 逗号拼接的来源列表
- keyword_mode: all | matched | unmatched
- time_range: all | 6h | 24h | 48h | 7d
- tag: 单标签精确过滤
- q: 标题和摘要搜索
- limit / offset: 分页

### 监控列表参数

- enabled: all | enabled | disabled
- type: all | keyword | account
- platform: 平台精确过滤
- search: 关键词名或账号 ID 搜索
- sort: created_desc | created_asc

## 输出模板

### 查询类

优先输出精简结构化列表：

1. 标题
2. 来源与来源类型
3. 热度
4. 时间
5. 摘要
6. 命中状态或通知状态
7. 链接

不要直接把整个 JSON 原样甩给用户，除非用户明确要求原始响应。

### 变更类

至少回显这些信息：

1. 动作是否成功
2. 目标对象是谁
3. 实际生效的关键参数
4. 若失败，返回 detail 或 message

### 歧义场景

候选项多于一个时，先返回候选列表，再请用户确认目标。

## 平台账号约定

当前项目里前端使用过这些平台值：

- bilibili
- zhihu
- weibo
- twitter
- github

账号 ID 约定来自现有页面语义：

- bilibili: UP 主 UID
- zhihu: 用户 URL ID
- weibo: 用户 UID
- twitter: 用户名，不带 @
- github: 用户名或组织名

## 失败处理

### API 不可达

如果 8000 和 8001 都不可达：

1. 明确说明服务未启动或端口不可达
2. 不返回伪造数据
3. 如用户需要，可建议启动后端服务再重试

### 409 冲突

创建监控返回 409 时，说明关键词已存在，不要重复创建。

### 404

对关键词或热点返回 404 时，直接说明目标不存在。

## 参考文件

- 需要接口细节、curl 样例或字段说明时，读取 references/api-contract.md
- 需要测试样例时，读取 evals/evals.json
